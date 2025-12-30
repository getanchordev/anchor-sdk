/**
 * Config namespace: Agent configuration with versioning.
 * @module
 */

import { HttpClient } from '../http';

/**
 * Agent configuration.
 */
export interface Config {
  /** Agent ID */
  agentId: string;
  /** Config version string */
  version: string;
  /** Configuration object (schema-less, you define the structure) */
  config: Record<string, any>;
  /** Previous version (for rollback reference) */
  previousVersion?: string;
  /** When this version was created */
  createdAt?: Date;
  /** Who created this version */
  createdBy?: string;
  /** Audit trail ID */
  auditId?: string;
}

/**
 * Config version metadata.
 */
export interface ConfigVersion {
  /** Version string */
  version: string;
  /** When this version was created */
  createdAt?: Date;
  /** Who created this version */
  createdBy?: string;
  /** Optional summary of changes */
  summary?: string;
}

function parseConfig(data: Record<string, any>): Config {
  return {
    agentId: data.agent_id || '',
    version: data.version || '',
    config: data.config || {},
    previousVersion: data.previous_version,
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    createdBy: data.created_by,
    auditId: data.audit_id,
  };
}

function parseConfigVersion(data: Record<string, any>): ConfigVersion {
  return {
    version: data.version || '',
    createdAt: data.created_at ? new Date(data.created_at) : undefined,
    createdBy: data.created_by,
    summary: data.summary,
  };
}

/**
 * Agent configuration management with versioning.
 *
 * Anchor uses a schema-less config approach:
 * - Store ANY fields you want (framework-specific, custom, etc.)
 * - Anchor ONLY enforces the `policies` section
 * - Compatible with any AI framework (CrewAI, LangChain, OpenAI, etc.)
 */
export class ConfigNamespace {
  constructor(private http: HttpClient) {}

  /**
   * Get current config for an agent.
   *
   * @param agentId - Agent ID
   * @returns Current Config object
   */
  async get(agentId: string): Promise<Config> {
    const response = await this.http.get<Record<string, any>>(`/agents/${agentId}/config`);
    return parseConfig(response);
  }

  /**
   * Update agent config. Creates a new version.
   *
   * @param agentId - Agent ID
   * @param config - Configuration object (store any fields, Anchor enforces `policies`)
   * @returns Updated Config object with new version
   *
   * @example
   * ```typescript
   * await anchor.config.update(agentId, {
   *   // Your custom fields - Anchor just stores these
   *   instructions: 'You are helpful',
   *   model: 'gpt-4',
   *
   *   // Anchor enforces these on every data.write()
   *   policies: {
   *     block_pii: true,
   *     block_secrets: true,
   *     retention_days: 90
   *   }
   * });
   * ```
   */
  async update(agentId: string, config: Record<string, any>): Promise<Config> {
    const response = await this.http.put<Record<string, any>>(`/agents/${agentId}/config`, config);
    return parseConfig(response);
  }

  /**
   * List config versions.
   *
   * @param agentId - Agent ID
   * @param limit - Max versions to return (default: 20)
   * @returns List of ConfigVersion objects
   */
  async versions(agentId: string, limit = 20): Promise<ConfigVersion[]> {
    const response = await this.http.get<{ versions: Record<string, any>[] }>(
      `/agents/${agentId}/config/versions`,
      { limit }
    );
    return (response.versions || []).map(parseConfigVersion);
  }

  /**
   * Get a specific config version.
   *
   * @param agentId - Agent ID
   * @param version - Version string to retrieve
   * @returns Config object for that version
   */
  async getVersion(agentId: string, version: string): Promise<Config> {
    const response = await this.http.get<Record<string, any>>(
      `/agents/${agentId}/config/versions/${version}`
    );
    return parseConfig(response);
  }

  /**
   * Rollback config to a previous version.
   * Creates a new version with the old config.
   *
   * @param agentId - Agent ID
   * @param targetVersion - Version to rollback to
   * @returns New Config object (with incremented version number)
   */
  async rollback(agentId: string, targetVersion: string): Promise<Config> {
    const response = await this.http.post<Record<string, any>>(
      `/agents/${agentId}/config/rollback`,
      { target_version: targetVersion }
    );
    return parseConfig(response);
  }
}
