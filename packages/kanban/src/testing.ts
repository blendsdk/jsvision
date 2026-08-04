/**
 * Public entry point for deterministic Kanban fixtures and instrumentation.
 *
 * This module is intentionally separate so production consumers never pull testing helpers into
 * their runtime import graph.
 */
export * from './testing/cursor-harness.js';
export * from './testing/eager-fixture.js';
export * from './testing/instrumentation.js';
export * from './testing/query-harness.js';
export * from './testing/windowed-fixture.js';
