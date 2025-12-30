/**
 * Data namespace: Policy-checked key-value storage with audit logging.
 * @module
 */

import { HttpClient } from '../http';
import { NotFoundError } from '../exceptions';

/**
 * Result of a data write operation.
 */
export interface WriteResult {
  /** The key that was written */
  key: string;
  /** Whether the write was allowed (false if blocked by policy) */
  allowed: boolean;
  /** Audit trail ID for this operation */
  auditId: string;
  /** Policy that blocked the write (if blocked) */
  blockedBy?: string;
  /** Reason for blocking (if blocked) */
  reason?: string;
  /** When this data expires (if TTL set) */
  expiresAt?: Date;
  /** When this data was created */
  createdAt?: Date;
}

/**
 * Full data entry with metadata.
 */
export interface DataEntry {
  /** The key */
  key: string;
  /** The stored value */
  value: string;
  /** Custom metadata */
  metadata: Record<string, any>;
  /** When this entry was created */
  createdAt?: Date;
  /** When this entry was last updated */
  updatedAt?: Date;
  /** When this entry expires */
  expiresAt?: Date;
  /** Audit trail ID */
  auditId: string;
}

/**
 * Search result with similarity score.
 */
export interface SearchResult {
  /** The key */
  key: string;
  /** The stored value */
  value: string;
  /** Similarity score (0.0 - 1.0) */
  similarity: number;
  /** Custom metadata */
  metadata: Record<string, any>;
}

function parseWriteResult(data: Record<string, any>): WriteResult {
  return {
    key: data.key || '',
    allowed: data.allowed !== false,
    auditId: data.audit_id || '',
    blockedBy: data.blocked_by,
    reason: data.reason,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
  };
}

function parseDataEntry(data: Record<string, any>): DataEntry {
  return {
    key: data.key || '',
    value: data.value || '',
    metadata: data.metadata || {},
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
    expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    auditId: data.audit_id || '',
  };
}

function parseSearchResult(data: Record<string, any>): SearchResult {
  return {
    key: data.key || '',
    value: data.value || '',
    similarity: data.similarity || 0,
    metadata: data.metadata || {},
  };
}

/**
 * Key-value storage with policy checks and audit logging.
 */
export class DataNamespace {
  constructor(private http: HttpClient) {}

  /**
   * Write a key-value pair. Policy-checked and audit-logged.
   *
   * @param agentId - Agent ID
   * @param key - Key (e.g., "user:123:preference")
   * @param value - Value to store
   * @param metadata - Optional metadata
   * @returns WriteResult with allowed status and auditId
   *
   * @remarks
   * If blocked by policy, result.allowed will be false
   * and result.blockedBy will indicate which policy.
   *
   * @example
   * ```typescript
   * const result = await anchor.data.write(agentId, 'user:123:pref', 'dark_mode');
   * if (result.allowed) {
   *   console.log(`Stored with audit_id: ${result.auditId}`);
   * } else {
   *   console.log(`Blocked by: ${result.blockedBy}`);
   * }
   * ```
   */
  async write(
    agentId: string,
    key: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<WriteResult> {
    const response = await this.http.post<Record<string, any>>(`/agents/${agentId}/data`, {
      key,
      value,
      metadata: metadata || {},
    });
    return parseWriteResult(response);
  }

  /**
   * Write multiple key-value pairs.
   */
  async writeBatch(agentId: string, items: Record<string, string>): Promise<WriteResult[]> {
    const payload = {
      items: Object.entries(items).map(([k, v]) => ({ key: k, value: v })),
    };
    const response = await this.http.post<{ results: Record<string, any>[] }>(
      `/agents/${agentId}/data/batch`,
      payload
    );
    return (response.results || []).map(parseWriteResult);
  }

  /**
   * Read a value by key. Audit-logged.
   *
   * @returns Value string, or null if not found
   */
  async read(agentId: string, key: string): Promise<string | null> {
    try {
      const response = await this.http.get<{ value: string }>(`/agents/${agentId}/data/${key}`);
      return response.value ?? null;
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  /**
   * Read full entry including metadata.
   *
   * @returns DataEntry object, or null if not found
   */
  async readFull(agentId: string, key: string): Promise<DataEntry | null> {
    try {
      const response = await this.http.get<Record<string, any>>(`/agents/${agentId}/data/${key}`);
      return parseDataEntry(response);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  /**
   * Delete a key. Audit-logged.
   */
  async delete(agentId: string, key: string): Promise<boolean> {
    await this.http.delete(`/agents/${agentId}/data/${key}`);
    return true;
  }

  /**
   * Delete all keys with a prefix.
   *
   * @returns Number of keys deleted
   */
  async deletePrefix(agentId: string, prefix: string): Promise<number> {
    const response = await this.http.delete<{ deleted_count: number }>(
      `/agents/${agentId}/data`,
      { prefix }
    );
    return response.deleted_count || 0;
  }

  /**
   * List keys.
   */
  async list(agentId: string, options?: { prefix?: string; limit?: number }): Promise<string[]> {
    const params: Record<string, any> = { limit: options?.limit || 100 };
    if (options?.prefix) params.prefix = options.prefix;

    const response = await this.http.get<{ keys: { key: string }[] }>(
      `/agents/${agentId}/data`,
      params
    );
    return (response.keys || []).map((k) => k.key || '');
  }

  /**
   * Search data using vector similarity.
   */
  async search(
    agentId: string,
    query: string,
    options?: { limit?: number; prefix?: string; minSimilarity?: number }
  ): Promise<SearchResult[]> {
    const payload: Record<string, any> = {
      query,
      limit: options?.limit || 10,
      min_similarity: options?.minSimilarity || 0.7,
    };
    if (options?.prefix) payload.prefix = options.prefix;

    const response = await this.http.post<{ results: Record<string, any>[] }>(
      `/agents/${agentId}/data/search`,
      payload
    );
    return (response.results || []).map(parseSearchResult);
  }
}
