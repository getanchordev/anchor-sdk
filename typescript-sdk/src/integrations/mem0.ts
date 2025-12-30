/**
 * Mem0 integration for Anchor SDK
 *
 * Wraps Mem0 memory operations with Anchor policy enforcement and audit logging.
 *
 * @example
 * ```typescript
 * import { Anchor } from 'anchorai';
 * import { AnchorMem0 } from 'anchorai/integrations';
 * import { Memory } from 'mem0ai';
 *
 * const anchor = new Anchor({ apiKey: 'your-api-key' });
 * const mem0 = new Memory();
 *
 * const wrapped = new AnchorMem0(anchor, agentId, mem0);
 *
 * // Add memory with policy enforcement
 * const result = await wrapped.add('User prefers dark mode', { userId: 'user_123' });
 * console.log(result.allowed); // true or false based on policies
 * ```
 */

import type { Anchor } from '../anchor';

/**
 * Result of a policy-checked operation.
 */
export interface PolicyResult {
  allowed: boolean;
  blockedBy?: string;
  reason?: string;
  mem0Result?: any;
  expiresAt?: Date;
}

/**
 * Mem0 client interface (minimal typing for integration)
 */
interface Mem0Client {
  add(data: string, options?: Record<string, any>): Promise<any>;
  search(query: string, options?: Record<string, any>): Promise<any[]>;
  get(memoryId: string): Promise<any>;
  getAll(options?: Record<string, any>): Promise<any[]>;
  update(memoryId: string, data: string, options?: Record<string, any>): Promise<any>;
  delete(memoryId: string): Promise<any>;
  deleteAll?(options?: Record<string, any>): Promise<any>;
  history?(memoryId: string, options?: Record<string, any>): Promise<any[]>;
  reset?(): Promise<any>;
}

/**
 * Anchor-wrapped Mem0 client with policy enforcement.
 *
 * Features:
 * - Policy enforcement on add/update operations
 * - Audit logging for all operations
 * - Checkpoint/rollback support
 * - Full audit trail access
 */
export class AnchorMem0 {
  private anchor: Anchor;
  readonly agentId: string;
  private mem0: Mem0Client;

  constructor(anchor: Anchor, agentId: string, mem0Client: Mem0Client) {
    this.anchor = anchor;
    this.agentId = agentId;
    this.mem0 = mem0Client;
  }

  /**
   * Add a memory with policy enforcement.
   */
  async add(
    data: string,
    options?: {
      userId?: string;
      agentId?: string;
      runId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PolicyResult> {
    // Check policy first
    const policyCheck = await this.anchor.data.write(
      this.agentId,
      `mem0:add:${Date.now()}`,
      data,
      {
        operation: 'mem0.add',
        user_id: options?.userId,
        agent_id: options?.agentId,
        run_id: options?.runId,
        ...options?.metadata,
      }
    );

    if (!policyCheck.allowed) {
      return {
        allowed: false,
        blockedBy: policyCheck.blockedBy,
        reason: policyCheck.reason,
      };
    }

    // Policy passed, add to Mem0
    const mem0Result = await this.mem0.add(data, options);

    return {
      allowed: true,
      mem0Result,
      expiresAt: policyCheck.expiresAt,
    };
  }

  /**
   * Search memories (audit-logged).
   */
  async search(
    query: string,
    options?: {
      userId?: string;
      agentId?: string;
      runId?: string;
      limit?: number;
    }
  ): Promise<any[]> {
    // Log the search
    await this.anchor.data.write(
      this.agentId,
      `mem0:search:${Date.now()}`,
      query,
      {
        operation: 'mem0.search',
        user_id: options?.userId,
        limit: options?.limit,
      }
    );

    return this.mem0.search(query, options);
  }

  /**
   * Get a memory by ID.
   */
  async get(memoryId: string): Promise<any> {
    return this.mem0.get(memoryId);
  }

  /**
   * Get all memories.
   */
  async getAll(options?: {
    userId?: string;
    agentId?: string;
    runId?: string;
  }): Promise<any[]> {
    return this.mem0.getAll(options);
  }

  /**
   * Update a memory with policy enforcement.
   */
  async update(
    memoryId: string,
    data: string,
    options?: Record<string, any>
  ): Promise<PolicyResult> {
    // Check policy first
    const policyCheck = await this.anchor.data.write(
      this.agentId,
      `mem0:update:${memoryId}:${Date.now()}`,
      data,
      {
        operation: 'mem0.update',
        memory_id: memoryId,
        ...options,
      }
    );

    if (!policyCheck.allowed) {
      return {
        allowed: false,
        blockedBy: policyCheck.blockedBy,
        reason: policyCheck.reason,
      };
    }

    // Policy passed, update in Mem0
    const mem0Result = await this.mem0.update(memoryId, data, options);

    return {
      allowed: true,
      mem0Result,
    };
  }

  /**
   * Delete a memory.
   */
  async delete(memoryId: string): Promise<any> {
    return this.mem0.delete(memoryId);
  }

  /**
   * Delete all memories matching criteria.
   */
  async deleteAll(options?: {
    userId?: string;
    agentId?: string;
    runId?: string;
  }): Promise<any> {
    if (this.mem0.deleteAll) {
      return this.mem0.deleteAll(options);
    }
    throw new Error('deleteAll not supported by this Mem0 client');
  }

  /**
   * Get memory history.
   */
  async history(
    memoryId: string,
    options?: Record<string, any>
  ): Promise<any[]> {
    if (this.mem0.history) {
      return this.mem0.history(memoryId, options);
    }
    throw new Error('history not supported by this Mem0 client');
  }

  /**
   * Reset all memories.
   */
  async reset(): Promise<any> {
    if (this.mem0.reset) {
      return this.mem0.reset();
    }
    throw new Error('reset not supported by this Mem0 client');
  }

  /**
   * Create a checkpoint of current state.
   */
  async createCheckpoint(label?: string): Promise<string> {
    const checkpoint = await this.anchor.checkpoints.create(this.agentId, {
      label: label || `mem0-checkpoint-${Date.now()}`,
    });
    return checkpoint.id;
  }

  /**
   * Restore to a checkpoint.
   */
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    await this.anchor.checkpoints.restore(this.agentId, checkpointId);
    // Note: Mem0's internal state may need to be reloaded after restore
  }

  /**
   * Query audit trail for this agent's operations.
   */
  async queryAuditLog(options?: {
    operations?: string[];
    limit?: number;
  }): Promise<any[]> {
    return this.anchor.audit.query(this.agentId, {
      operations: options?.operations,
      limit: options?.limit || 100,
    });
  }

  /**
   * Verify audit chain integrity.
   */
  async verifyAuditChain(): Promise<any> {
    return this.anchor.audit.verify(this.agentId);
  }

  /**
   * Export audit trail for compliance.
   */
  async exportAuditLog(options?: {
    format?: 'json' | 'csv';
    includeVerification?: boolean;
  }): Promise<any> {
    return this.anchor.audit.export(this.agentId, {
      format: options?.format || 'json',
      includeVerification: options?.includeVerification ?? true,
    });
  }
}
