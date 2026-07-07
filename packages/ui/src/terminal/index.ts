/**
 * Terminal barrel (RD-08 03-05) — `Terminal` + `terminalWriter` are the API; `LineRing` stays
 * internal (03-07 §Packaging).
 */
export { Terminal, terminalWriter } from './terminal.js';
export type { TerminalOptions } from './terminal.js';
export { LineRing } from './ring.js';
