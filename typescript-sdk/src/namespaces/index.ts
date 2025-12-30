/**
 * Namespace classes for Anchor SDK - 5 core namespaces per spec.
 */

// Namespaces
export { AgentsNamespace } from './agents';
export { ConfigNamespace } from './config';
export { DataNamespace } from './data';
export { CheckpointsNamespace } from './checkpoints';
export { AuditNamespace } from './audit';

// Agent types
export type { Agent } from './agents';

// Config types
export type { Config, ConfigVersion } from './config';

// Data types
export type { WriteResult, DataEntry, SearchResult } from './data';

// Checkpoint types
export type { Checkpoint, RestoreResult, DataSnapshot } from './checkpoints';

// Audit types
export type { AuditEvent, Verification, ExportResult } from './audit';
