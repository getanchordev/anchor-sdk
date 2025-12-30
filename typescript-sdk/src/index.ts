/**
 * Anchor TypeScript SDK
 *
 * Control what your AI agents store. Audit everything.
 *
 * Anchor lets you persist agent state, block bad data, prove what happened.
 *
 * @example Quick Start
 * ```typescript
 * import { Anchor } from 'anchorai';
 *
 * const anchor = new Anchor({ apiKey: 'your-api-key' });
 * const agent = await anchor.agents.create('my-agent');
 * ```
 *
 * @example Full Example
 * ```typescript
 * import { Anchor } from 'anchorai';
 *
 * const anchor = new Anchor({ apiKey: 'your-api-key' });
 *
 * // Create agent
 * const agent = await anchor.agents.create('support-bot');
 *
 * // Store data (automatically audit-logged)
 * await anchor.data.write(agent.id, 'user:123:pref', 'concise answers');
 *
 * // PII gets blocked by policy
 * const result = await anchor.data.write(agent.id, 'user:123:ssn', '123-45-6789');
 * console.log(result.allowed);  // false - blocked by policy
 *
 * // Checkpoint before risky operation
 * const checkpoint = await anchor.checkpoints.create(agent.id, { label: 'pre-update' });
 *
 * // Something goes wrong? Rollback
 * await anchor.checkpoints.restore(agent.id, checkpoint.id);
 *
 * // Prove what happened
 * const events = await anchor.audit.query(agent.id, { limit: 5 });
 * ```
 *
 * @packageDocumentation
 */

// Main client
export { Anchor } from './anchor';

// Configuration
export { Config, normalizeConfig, type AnchorConfig } from './config';

// Exceptions
export {
  AnchorError,
  AnchorAPIError,
  AuthenticationError,
  AuthorizationError,
  PolicyViolationError,
  RateLimitError,
  NotFoundError,
  ValidationError,
  NetworkError,
  ServerError,
  ChainIntegrityError,
} from './exceptions';

// Types from namespaces
export type {
  // Agent types
  Agent,
  // Config types
  Config as AgentConfig,
  ConfigVersion,
  // Data types
  WriteResult,
  DataEntry,
  SearchResult,
  // Checkpoint types
  Checkpoint,
  RestoreResult,
  DataSnapshot,
  // Audit types
  AuditEvent,
  Verification,
  ExportResult,
} from './namespaces';

// Integrations (optional - users can import directly from 'anchorai/integrations')
export * from './integrations';

export const VERSION = '1.0.0';
