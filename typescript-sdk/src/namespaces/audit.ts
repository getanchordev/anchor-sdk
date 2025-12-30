/**
 * Audit namespace: Hash-chained audit trail per agent.
 * @module
 */

import { HttpClient } from '../http';

/**
 * Audit event record.
 */
export interface AuditEvent {
  /** Event ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Operation type (e.g., "data.write", "data.delete") */
  operation: string;
  /** Resource affected (e.g., key name) */
  resource: string;
  /** Result: "allowed" or "blocked" */
  result: 'allowed' | 'blocked';
  /** Policy that blocked the operation, if blocked */
  blockedBy?: string;
  /** When the event occurred */
  timestamp?: Date;
  /** SHA-256 hash of this event */
  hash: string;
  /** Hash of the previous event (chain link) */
  previousHash?: string;
  /** Additional event metadata */
  metadata: Record<string, any>;
}

/**
 * Result of audit chain verification.
 */
export interface Verification {
  /** Whether the hash chain is valid */
  valid: boolean;
  /** Number of events verified */
  eventsChecked: number;
  /** Hash of first event in chain */
  chainStart?: string;
  /** Hash of last event in chain */
  chainEnd?: string;
  /** When verification was performed */
  verifiedAt?: Date;
  /** Details of first invalid event, if any */
  firstInvalid?: Record<string, any>;
}

/**
 * Result of audit export request.
 */
export interface ExportResult {
  /** Export ID */
  exportId: string;
  /** Export format ("json" or "csv") */
  format: string;
  /** URL to download the export */
  downloadUrl: string;
  /** When the download URL expires */
  expiresAt?: Date;
  /** Number of events in export */
  eventCount: number;
  /** Verification result, if requested */
  verification?: Verification;
}

function parseAuditEvent(data: Record<string, any>): AuditEvent {
  return {
    id: data.id || '',
    agentId: data.agent_id || '',
    operation: data.operation || '',
    resource: data.resource || '',
    result: data.result || 'allowed',
    blockedBy: data.blocked_by,
    timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
    hash: data.hash || '',
    previousHash: data.previous_hash,
    metadata: data.metadata || {},
  };
}

function parseVerification(data: Record<string, any>): Verification {
  return {
    valid: data.valid || false,
    eventsChecked: data.events_checked || 0,
    chainStart: data.chain_start,
    chainEnd: data.chain_end,
    verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
    firstInvalid: data.first_invalid,
  };
}

function parseExportResult(data: Record<string, any>): ExportResult {
  return {
    exportId: data.export_id || '',
    format: data.format || 'json',
    downloadUrl: data.download_url || '',
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    eventCount: data.event_count || 0,
    verification: data.verification ? parseVerification(data.verification) : undefined,
  };
}

/**
 * Agent-scoped audit trail operations.
 *
 * All agent operations are logged to a hash-chained audit trail
 * that can be verified for integrity.
 *
 * @example
 * ```typescript
 * const anchor = new Anchor({ apiKey: 'your-api-key' });
 *
 * // Query audit events for an agent
 * const events = await anchor.audit.query(agentId, {
 *   operations: ['data.write', 'data.delete'],
 *   limit: 100
 * });
 *
 * for (const event of events) {
 *   console.log(`${event.timestamp}: ${event.operation}`);
 *   console.log(`  Result: ${event.result}`);
 *   console.log(`  Hash: ${event.hash}`);
 * }
 *
 * // Verify chain integrity
 * const verification = await anchor.audit.verify(agentId);
 * console.log(verification.valid); // true/false
 *
 * // Export for compliance
 * const exportResult = await anchor.audit.export(agentId, {
 *   format: 'json',
 *   includeVerification: true
 * });
 * console.log(`Download: ${exportResult.downloadUrl}`);
 * ```
 */
export class AuditNamespace {
  constructor(private http: HttpClient) {}

  /**
   * Query audit events for an agent.
   *
   * @param agentId - Agent ID
   * @param options - Query options
   * @param options.operations - Filter by operation types (e.g., ["data.write", "data.delete"])
   * @param options.startTime - Filter events after this time
   * @param options.endTime - Filter events before this time
   * @param options.limit - Max events to return (default: 100, max: 1000)
   * @returns List of AuditEvent objects
   */
  async query(
    agentId: string,
    options?: {
      operations?: string[];
      startTime?: Date;
      endTime?: Date;
      limit?: number;
    }
  ): Promise<AuditEvent[]> {
    const params: Record<string, any> = { limit: Math.min(options?.limit || 100, 1000) };
    if (options?.operations) params.operations = options.operations.join(',');
    if (options?.startTime) params.start = options.startTime.toISOString();
    if (options?.endTime) params.end = options.endTime.toISOString();

    const response = await this.http.get<{ events: Record<string, any>[] }>(
      `/agents/${agentId}/audit`,
      params
    );
    return (response.events || []).map(parseAuditEvent);
  }

  /**
   * Get a specific audit event.
   *
   * @param agentId - Agent ID
   * @param auditId - Audit event ID
   * @returns AuditEvent object
   */
  async get(agentId: string, auditId: string): Promise<AuditEvent> {
    const response = await this.http.get<Record<string, any>>(
      `/agents/${agentId}/audit/${auditId}`
    );
    return parseAuditEvent(response);
  }

  /**
   * Verify hash chain integrity.
   *
   * @param agentId - Agent ID
   * @param startTime - Optional start time for verification
   * @returns Verification result with valid status
   */
  async verify(agentId: string, startTime?: Date): Promise<Verification> {
    const params: Record<string, any> = {};
    if (startTime) params.start = startTime.toISOString();

    const response = await this.http.get<Record<string, any>>(
      `/agents/${agentId}/audit/verify`,
      params
    );
    return parseVerification(response);
  }

  /**
   * Export audit trail for compliance.
   *
   * @param agentId - Agent ID
   * @param options - Export options
   * @param options.format - Export format ("json" or "csv")
   * @param options.startTime - Start of export range
   * @param options.endTime - End of export range
   * @param options.includeVerification - Include chain verification (default: true)
   * @returns ExportResult with download URL
   */
  async export(
    agentId: string,
    options?: {
      format?: 'json' | 'csv';
      startTime?: Date;
      endTime?: Date;
      includeVerification?: boolean;
    }
  ): Promise<ExportResult> {
    const payload: Record<string, any> = {
      format: options?.format || 'json',
      include_verification: options?.includeVerification ?? true,
    };
    if (options?.startTime) payload.start = options.startTime.toISOString();
    if (options?.endTime) payload.end = options.endTime.toISOString();

    const response = await this.http.post<Record<string, any>>(
      `/agents/${agentId}/audit/export`,
      payload
    );
    return parseExportResult(response);
  }
}
