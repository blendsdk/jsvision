/** Stable machine-readable codes for package-owned contract failures. */
export type KanbanErrorCode =
  | 'invalid-identity'
  | 'invalid-limit'
  | 'invalid-semantic-value'
  | 'invalid-query'
  | 'invalid-range'
  | 'invalid-source-publication'
  | 'invalid-presentation'
  | 'invalid-descriptor'
  | 'invalid-geometry'
  | 'disposed-resource';

/** Base class for sanitized programmer and configuration errors raised by Kanban. */
export abstract class KanbanError extends Error {
  /** Stable machine-readable failure code. */
  abstract readonly code: KanbanErrorCode;
}

/** Raised when a semantic value cannot be safely snapshotted. */
export class KanbanInvalidSemanticValueError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-semantic-value' as const;

  /** Creates an error without retaining the rejected semantic value. */
  constructor() {
    super('Invalid Kanban semantic value.');
    this.name = 'KanbanInvalidSemanticValueError';
  }
}

/** Raised when a query does not satisfy the published query contract. */
export class KanbanInvalidQueryError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-query' as const;

  /** Creates a bounded query-validation error. */
  constructor() {
    super('Invalid Kanban query.');
    this.name = 'KanbanInvalidQueryError';
  }
}

/** Raised before an invalid half-open source range reaches application code. */
export class KanbanInvalidRangeError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-range' as const;

  /** Creates a bounded range-validation error. */
  constructor() {
    super('Invalid Kanban source range.');
    this.name = 'KanbanInvalidRangeError';
  }
}

/** Raised when a source publication violates its structural contract. */
export class KanbanInvalidSourcePublicationError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-source-publication' as const;

  /** Creates a bounded source-publication error. */
  constructor() {
    super('Invalid Kanban source publication.');
    this.name = 'KanbanInvalidSourcePublicationError';
  }
}

/** Raised when presentation policy or per-card selection data is structurally invalid. */
export class KanbanInvalidPresentationError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-presentation' as const;

  /** Creates a bounded error that never retains rejected card or policy data. */
  constructor() {
    super('Invalid Kanban presentation configuration.');
    this.name = 'KanbanInvalidPresentationError';
  }
}

/** Raised when a custom card descriptor violates its bounded render contract. */
export class KanbanInvalidDescriptorError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-descriptor' as const;

  /** Creates a bounded descriptor-validation error. */
  constructor() {
    super('Invalid Kanban card descriptor.');
    this.name = 'KanbanInvalidDescriptorError';
  }
}

/** Raised when component geometry is unsafe or internally inconsistent. */
export class KanbanInvalidGeometryError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'invalid-geometry' as const;

  /** Creates a bounded geometry-validation error. */
  constructor() {
    super('Invalid Kanban geometry.');
    this.name = 'KanbanInvalidGeometryError';
  }
}

/** Raised when a caller uses a source, cursor, or viewport after disposal. */
export class KanbanDisposedResourceError extends KanbanError {
  /** Stable machine-readable failure code. */
  readonly code = 'disposed-resource' as const;

  /** Creates a bounded disposed-resource error. */
  constructor() {
    super('The Kanban resource has been disposed.');
    this.name = 'KanbanDisposedResourceError';
  }
}
