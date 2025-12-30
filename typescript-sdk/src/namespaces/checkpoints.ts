/**
 * Checkpoints namespace: State snapshots and rollback operations.
 * @module
 */

import { HttpClient } from '../http';

/**
 * Data snapshot info in checkpoint.
 */
export interface DataSnapshot {
  /** Number of keys in the snapshot */
  keyCount: number;
  /** Total size of data in bytes */
  totalSizeBytes: number;
}

/**
 * Checkpoint snapshot.
 */
export interface Checkpoint {
  /** Checkpoint ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Human-readable label */
  label?: string;
  /** Description of this checkpoint */
  description?: string;
  /** Config version at checkpoint time */
  configVersion: string;
  /** Data snapshot metadata */
  dataSnapshot: DataSnapshot;
  /** When the checkpoint was created */
  createdAt?: Date;
  /** Audit trail ID */
  auditId?: string;
}

/**
 * Result of a checkpoint restore operation.
 */
export interface RestoreResult {
  /** Checkpoint ID that was restored from */
  restoredFrom: string;
  /** Whether config was restored */
  configRestored: boolean;
  /** Config version after restore */
  configVersion?: string;
  /** Whether data was restored */
  dataRestored: boolean;
  /** Number of data keys restored */
  dataKeysRestored: number;
  /** Number of data keys removed */
  dataKeysRemoved: number;
  /** Audit trail ID */
  auditId: string;
  /** When the restore was performed */
  restoredAt?: Date;
}

function parseDataSnapshot(data: Record<string, any>): DataSnapshot {
  return {
    keyCount: data.key_count || 0,
    totalSizeBytes: data.total_size_bytes || 0,
  };
}

function parseCheckpoint(data: Record<string, any>): Checkpoint {
  return {
    id: data.id || '',
    agentId: data.agent_id || '',
    label: data.label,
    description: data.description,
    configVersion: data.config_version || '',
    dataSnapshot: parseDataSnapshot(data.data_snapshot || {}),
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    auditId: data.audit_id,
  };
}

function parseRestoreResult(data: Record<string, any>): RestoreResult {
  return {
    restoredFrom: data.restored_from || '',
    configRestored: data.config_restored || false,
    configVersion: data.config_version,
    dataRestored: data.data_restored || false,
    dataKeysRestored: data.data_keys_restored || 0,
    dataKeysRemoved: data.data_keys_removed || 0,
    auditId: data.audit_id || '',
    restoredAt: data.restored_at ? new Date(data.restored_at) : undefined,
  };
}

/**
 * Checkpoint management for rollback.
 */
export class CheckpointsNamespace {
  constructor(private http: HttpClient) {}

  /**
   * Create a checkpoint of current state.
   *
   * @param agentId - Agent ID
   * @param options - Optional label and description
   * @returns Checkpoint object
   *
   * @example
   * ```typescript
   * const checkpoint = await anchor.checkpoints.create(agentId, { label: 'pre-migration' });
   * console.log(checkpoint.id);
   * ```
   */
  async create(
    agentId: string,
    options?: { label?: string; description?: string }
  ): Promise<Checkpoint> {
    const response = await this.http.post<Record<string, any>>(
      `/agents/${agentId}/checkpoints`,
      {
        label: options?.label,
        description: options?.description,
      }
    );
    return parseCheckpoint(response);
  }

  /**
   * List checkpoints.
   *
   * @param agentId - Agent ID
   * @param limit - Max checkpoints to return (default: 20)
   * @returns List of Checkpoint objects
   */
  async list(agentId: string, limit = 20): Promise<Checkpoint[]> {
    const response = await this.http.get<{ checkpoints: Record<string, any>[] }>(
      `/agents/${agentId}/checkpoints`,
      { limit }
    );
    return (response.checkpoints || []).map(parseCheckpoint);
  }

  /**
   * Get a specific checkpoint.
   *
   * @param agentId - Agent ID
   * @param checkpointId - Checkpoint ID
   * @returns Checkpoint object
   */
  async get(agentId: string, checkpointId: string): Promise<Checkpoint> {
    const response = await this.http.get<Record<string, any>>(
      `/agents/${agentId}/checkpoints/${checkpointId}`
    );
    return parseCheckpoint(response);
  }

  /**
   * Restore agent to a checkpoint.
   *
   * @param agentId - Agent ID
   * @param checkpointId - Checkpoint to restore
   * @param options - Restore options
   * @param options.restoreConfig - Whether to restore config (default: true)
   * @param options.restoreData - Whether to restore data (default: true)
   * @returns RestoreResult with details
   */
  async restore(
    agentId: string,
    checkpointId: string,
    options?: { restoreConfig?: boolean; restoreData?: boolean }
  ): Promise<RestoreResult> {
    const response = await this.http.post<Record<string, any>>(
      `/agents/${agentId}/checkpoints/${checkpointId}/restore`,
      {
        restore_config: options?.restoreConfig ?? true,
        restore_data: options?.restoreData ?? true,
      }
    );
    return parseRestoreResult(response);
  }

  /**
   * Delete a checkpoint.
   *
   * @param agentId - Agent ID
   * @param checkpointId - Checkpoint ID
   * @returns True if deleted
   */
  async delete(agentId: string, checkpointId: string): Promise<boolean> {
    await this.http.delete(`/agents/${agentId}/checkpoints/${checkpointId}`);
    return true;
  }
}
