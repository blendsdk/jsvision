// Fixture: two `@example` blocks on the SAME declaration — the shape that forces
// the `#N` ordinal, mirroring a real widget that documents two usages of one class.
// The first compiles, the second does not; each must be its own allowlist entry.

/**
 * A trivial counter.
 *
 * @example
 * import { Counter } from './same-symbol.js';
 *
 * const counter = new Counter();
 * void counter.bump(1);
 *
 * @example
 * import { Counter } from './same-symbol.js';
 *
 * const counter = new Counter();
 * void counter.bump();
 */
export class Counter {
  bump(by: number): number {
    return by;
  }
}
