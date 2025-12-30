/**
 * CrewAI integration for Anchor SDK
 *
 * Provides policy-enforced memory for CrewAI agents and crews.
 *
 * @example
 * ```typescript
 * import { Anchor } from 'anchorai';
 * import { AnchorCrewAgent, AnchorCrewMemory } from 'anchorai/integrations';
 *
 * const anchor = new Anchor({ apiKey: 'your-api-key' });
 *
 * // Create a governed agent
 * const agent = new AnchorCrewAgent(anchor, {
 *   role: 'Researcher',
 *   goal: 'Research topics thoroughly',
 * });
 *
 * // Store and retrieve data with policy enforcement
 * await agent.store('findings', 'Research results here');
 * const findings = await agent.retrieve('findings');
 * ```
 */

import type { Anchor } from '../anchor';

/**
 * CrewAI agent wrapper with Anchor governance.
 *
 * Features:
 * - Automatic agent registration with Anchor
 * - Policy-checked data storage
 * - Vector similarity search
 * - Full audit trail
 */
export class AnchorCrewAgent {
  private anchor: Anchor;
  private _agentId: string;
  readonly role: string;
  readonly goal: string;
  readonly backstory?: string;

  constructor(
    anchor: Anchor,
    options: {
      role: string;
      goal: string;
      backstory?: string;
      agentId?: string;
    }
  ) {
    this.anchor = anchor;
    this.role = options.role;
    this.goal = options.goal;
    this.backstory = options.backstory;
    this._agentId = options.agentId || '';
  }

  /**
   * Initialize the agent (creates in Anchor if needed).
   */
  async initialize(): Promise<void> {
    if (!this._agentId) {
      const agent = await this.anchor.agents.create(
        `crew-${this.role.toLowerCase().replace(/\s+/g, '-')}`,
        {
          role: this.role,
          goal: this.goal,
          backstory: this.backstory,
          type: 'crewai',
        }
      );
      this._agentId = agent.id;
    }
  }

  /**
   * Get the agent ID.
   */
  get agentId(): string {
    return this._agentId;
  }

  /**
   * Store data with policy enforcement.
   *
   * @returns true if stored, false if blocked by policy
   */
  async store(
    key: string,
    value: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.anchor.data.write(
      this._agentId,
      key,
      value,
      metadata
    );
    return result.allowed;
  }

  /**
   * Retrieve data by key.
   */
  async retrieve(key: string): Promise<string | null> {
    await this.ensureInitialized();
    return this.anchor.data.read(this._agentId, key);
  }

  /**
   * Search data using vector similarity.
   */
  async search(
    query: string,
    limit = 10
  ): Promise<Array<{ key: string; value: string; similarity: number }>> {
    await this.ensureInitialized();
    const results = await this.anchor.data.search(this._agentId, query, {
      limit,
    });
    return results.map((r) => ({
      key: r.key,
      value: r.value,
      similarity: r.similarity,
    }));
  }

  private async ensureInitialized(): Promise<void> {
    if (!this._agentId) {
      await this.initialize();
    }
  }
}

/**
 * Shared memory for CrewAI crews with Anchor governance.
 *
 * Features:
 * - Policy-checked writes
 * - Shared across all crew agents
 * - Checkpoint/rollback support
 * - Full audit trail
 */
export class AnchorCrewMemory {
  private anchor: Anchor;
  private _agentId: string;

  constructor(anchor: Anchor, options?: { agentId?: string }) {
    this.anchor = anchor;
    this._agentId = options?.agentId || '';
  }

  /**
   * Initialize the memory (creates agent if needed).
   */
  async initialize(): Promise<void> {
    if (!this._agentId) {
      const agent = await this.anchor.agents.create('crew-shared-memory', {
        type: 'crewai-memory',
      });
      this._agentId = agent.id;
    }
  }

  /**
   * Get the agent ID.
   */
  get agentId(): string {
    return this._agentId;
  }

  /**
   * Save data to shared memory.
   *
   * @returns true if saved, false if blocked by policy
   */
  async save(key: string, value: any): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.anchor.data.write(
      this._agentId,
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    return result.allowed;
  }

  /**
   * Search shared memory.
   */
  async search(
    query: string,
    limit = 10
  ): Promise<Array<{ key: string; value: string; similarity: number }>> {
    await this.ensureInitialized();
    const results = await this.anchor.data.search(this._agentId, query, {
      limit,
    });
    return results.map((r) => ({
      key: r.key,
      value: r.value,
      similarity: r.similarity,
    }));
  }

  /**
   * Get data by key.
   */
  async get(key: string): Promise<string | null> {
    await this.ensureInitialized();
    return this.anchor.data.read(this._agentId, key);
  }

  /**
   * Delete data by key.
   */
  async delete(key: string): Promise<boolean> {
    await this.ensureInitialized();
    return this.anchor.data.delete(this._agentId, key);
  }

  /**
   * Clear all shared memory.
   */
  async clear(): Promise<number> {
    await this.ensureInitialized();
    return this.anchor.data.deletePrefix(this._agentId, '');
  }

  /**
   * Create a checkpoint of memory state.
   */
  async createCheckpoint(label?: string): Promise<string> {
    await this.ensureInitialized();
    const checkpoint = await this.anchor.checkpoints.create(this._agentId, {
      label: label || `crew-memory-checkpoint-${Date.now()}`,
    });
    return checkpoint.id;
  }

  /**
   * Restore memory to a checkpoint.
   */
  async restoreCheckpoint(checkpointId: string): Promise<void> {
    await this.ensureInitialized();
    await this.anchor.checkpoints.restore(this._agentId, checkpointId);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this._agentId) {
      await this.initialize();
    }
  }
}
