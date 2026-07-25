/**
 * Node-only rooted JSON catalog loading.
 *
 * Import this subpath explicitly so browser-safe code never pulls Node filesystem built-ins.
 */
export { jsonFileSource } from './json-file-source.js';
export type { JsonFileSourceLimits, JsonFileSourceOptions } from './json-file-source.js';
