// A fixture package barrel that exercises every path barrelExports() must handle:
//  - named re-exports (A, B),
//  - a star re-export followed transitively (C, from ./sub),
//  - a locally-declared symbol that is never exported (must not surface),
//  - an @internal export (must be excluded, matching the generator's excludeInternal).

export { A, B } from './members.js';
export * from './sub.js';

// Never exported — must not appear in the public barrel set.
function internalHelper(): number {
  return 42;
}

// Exported but flagged internal — excluded from the public API surface.
/** @internal */
export const InternalThing = internalHelper();
