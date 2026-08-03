/** A stable application-owned card identity. Numbers and strings remain distinct keys. */
export type CardKey = string | number;

/** A validated workflow-column identity. */
export type KanbanColumnId = string;

/** A validated swimlane identity. */
export type KanbanSwimlaneId = string;

/** A validated application field identity. */
export type KanbanFieldId = string;

/** A validated saved-view identity. */
export type KanbanViewId = string;

/** A validated checklist-group identity. */
export type KanbanChecklistId = string;

/** A validated lowercase dotted identity for an application extension. */
export type KanbanExtensionId = string;

/** A validated identity that correlates one application request and result. */
export type KanbanOperationId = string;

/** Structural identity categories accepted by the shared uniqueness validator. */
export type KanbanIdentityKind = 'column' | 'swimlane' | 'field' | 'view' | 'checklist' | 'extension' | 'operation';

declare const placementTokenBrand: unique symbol;

/**
 * An opaque source-issued placement token.
 *
 * Consumers may retain and return this value but must not decode, serialize, or log it.
 */
export type PlacementToken = string & { readonly [placementTokenBrand]: true };

/** A safe typed error raised before an invalid structural identity is published. */
export class KanbanInvalidIdentityError extends Error {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-identity' as const;

  /** Semantic identity category that failed validation. */
  readonly kind: KanbanIdentityKind | 'placement-token';

  /** Creates an error without retaining or displaying the rejected input. */
  constructor(kind: KanbanIdentityKind | 'placement-token') {
    super(`Invalid Kanban ${kind} identity.`);
    this.name = 'KanbanInvalidIdentityError';
    this.kind = kind;
  }
}

/** Maximum UTF-8 size of a structural identity. */
const MAX_ID_BYTES = 256;
/** Maximum UTF-8 size of an opaque placement token. */
const MAX_TOKEN_BYTES = 2_048;
/** Terminal control characters forbidden in every identity and token. */
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
/** Lowercase dotted namespace grammar used by application extensions. */
const EXTENSION_ID = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
/** Prefix reserved for package-owned extension identities. */
const RESERVED_EXTENSION_PREFIX = 'jsvision.';

/** Returns the encoded size without relying on platform-specific string length behavior. */
function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/** Validates one bounded control-free string without exposing rejected text in an error. */
function validateIdentity(kind: KanbanIdentityKind, value: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    CONTROL_CHARACTERS.test(value) ||
    utf8Bytes(value) > MAX_ID_BYTES ||
    (kind === 'extension' && (!EXTENSION_ID.test(value) || value.startsWith(RESERVED_EXTENSION_PREFIX)))
  ) {
    throw new KanbanInvalidIdentityError(kind);
  }
  return value;
}

/** Creates a validated workflow-column identity. */
export function createKanbanColumnId(value: string): KanbanColumnId {
  return validateIdentity('column', value);
}

/** Creates a validated swimlane identity. */
export function createKanbanSwimlaneId(value: string): KanbanSwimlaneId {
  return validateIdentity('swimlane', value);
}

/** Creates a validated application field identity. */
export function createKanbanFieldId(value: string): KanbanFieldId {
  return validateIdentity('field', value);
}

/** Creates a validated saved-view identity. */
export function createKanbanViewId(value: string): KanbanViewId {
  return validateIdentity('view', value);
}

/** Creates a validated checklist-group identity. */
export function createKanbanChecklistId(value: string): KanbanChecklistId {
  return validateIdentity('checklist', value);
}

/**
 * Creates a validated application-extension identity.
 *
 * @example
 * ```ts
 * const extensionId = createKanbanExtensionId('example.review');
 * ```
 */
export function createKanbanExtensionId(value: string): KanbanExtensionId {
  return validateIdentity('extension', value);
}

/** Creates a validated request operation identity. */
export function createKanbanOperationId(value: string): KanbanOperationId {
  return validateIdentity('operation', value);
}

/** Creates a validated opaque placement token without interpreting its contents. */
export function createPlacementToken(value: string): PlacementToken {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    CONTROL_CHARACTERS.test(value) ||
    utf8Bytes(value) > MAX_TOKEN_BYTES
  ) {
    throw new KanbanInvalidIdentityError('placement-token');
  }
  return value as PlacementToken;
}

/**
 * Validates a complete identity collection before optionally publishing it.
 *
 * The callback runs only after every value is safe and unique, so callers cannot observe a partial
 * collection when a later value is invalid.
 */
export function validateKanbanUniqueIds(
  kind: KanbanIdentityKind,
  values: readonly string[],
  publish?: (validated: readonly string[]) => void,
): readonly string[] {
  const validated = values.map((value) => validateIdentity(kind, value));
  if (new Set(validated).size !== validated.length) throw new KanbanInvalidIdentityError(kind);

  const snapshot = Object.freeze([...validated]);
  publish?.(snapshot);
  return snapshot;
}
