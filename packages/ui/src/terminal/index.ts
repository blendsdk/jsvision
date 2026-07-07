/**
 * The streaming log-sink widget: `Terminal` (the view) and `terminalWriter` (a callback adapter for
 * feeding it from a logger). `LineRing` is exported for its own tests but is not part of the public
 * package API.
 */
export { Terminal, terminalWriter } from './terminal.js';
export type { TerminalOptions } from './terminal.js';
export { LineRing } from './ring.js';
