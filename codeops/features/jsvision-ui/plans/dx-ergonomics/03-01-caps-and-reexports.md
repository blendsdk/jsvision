# Caps 'auto' & Core Re-exports (Proposal 2)

> **Document**: 03-01-caps-and-reexports.md
> **Parent**: [Index](00-index.md)

## Overview

Make a terminal app startable with zero capability plumbing from a single package. Two changes:
default `ApplicationOptions.caps` to `'auto'` and resolve it inside `createApplication`; re-export the
seven `@jsvision/core` symbols a UI developer needs.

## Architecture

### Current Architecture
`ApplicationOptions.caps: CapabilityProfile` is required (`application.ts:25`) and passed to both
`createEventLoop` (`:211-219`) and `runApplication` (`:272`). The barrel (`index.ts`) re-exports
nothing from core.

### Proposed Changes
`createApplication` resolves caps once at the top and uses the concrete profile everywhere it
currently uses `opts.caps`. The barrel gains seven re-exports.

## Implementation Details

### New Types/Interfaces

```ts
// application.ts — widen the option (AR-3)
export interface ApplicationOptions {
  /**
   * Terminal capability profile that drives color-depth encoding. Defaults to `'auto'`, which
   * detects the running terminal's capabilities. Pass an explicit profile (or `'auto'`) to override.
   */
  caps?: CapabilityProfile | 'auto';
  // …all other fields unchanged
}
```

### New Functions/Methods

```ts
// application.ts — resolve once, near the top of createApplication (AR-3)
import { resolveCapabilities } from '@jsvision/core';

function resolveCaps(caps: ApplicationOptions['caps']): CapabilityProfile {
  return caps === undefined || caps === 'auto' ? resolveCapabilities().profile : caps;
}

export function createApplication(opts: ApplicationOptions): Application {
  const caps = resolveCaps(opts.caps);           // concrete profile from here down
  // …use `caps` where `opts.caps` was used: createEventLoop({ caps, … }) and runApplication({ caps, … })
}
```

`run.ts` is unchanged in shape — it still receives a concrete `CapabilityProfile`; `'auto'` never
reaches it.

### Integration Points

```ts
// packages/ui/src/index.ts — new re-export block (AR-4)
// Capability detection, style attributes, and keymaps — the @jsvision/core essentials a UI
// developer needs so a hello-world app imports from one package.
export { resolveCapabilities, resolveCapabilitiesAsync, createKeymap, Attr } from '@jsvision/core';
export type { CapabilityProfile, Style, Keymap } from '@jsvision/core';
```

**Value vs type split — confirmed against `packages/core/src/engine/index.ts`:**
`resolveCapabilities`/`resolveCapabilitiesAsync` (`:15`), `createKeymap` (`:35`), and **`Attr`** (`:55`)
are **values**; `CapabilityProfile` (`:17`), `Keymap` (`:48`), and `Style` (`:74`, an `interface`) are
**types**. `Attr` is `export const Attr = { none, bold, underline, … }` (`render/types.ts:40`) — a
runtime object a custom `draw()` uses by value (`{ attrs: Attr.bold }`), so it MUST be a value
re-export. Re-exporting it under `export type` would erase the runtime binding and make
`import { Attr } from '@jsvision/ui'` resolve to `undefined` at run time.

## Code Examples

```ts
// Zero-config, single package
import { createApplication, menuBar, item, Commands } from '@jsvision/ui';
const app = createApplication({ menuBar: menuBar([item('E~x~it', Commands.quit)]) });
await app.run();

// Power user still forces a profile
import { resolveCapabilities } from '@jsvision/ui'; // now re-exported
const caps = resolveCapabilities({ override: { unicode: { utf8: true } } }).profile;
const app2 = createApplication({ caps });
```

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| `caps` omitted | Resolve via `resolveCapabilities().profile` (the documented zero-config path) | AR-3 |
| `caps: 'auto'` explicit | Same as omitted | AR-3 |
| Explicit profile passed | Used verbatim — no resolution, no behavior change | AR-3 |

> **Traceability:** design per AR-3 (scope), AR-4 (re-export set).

## Testing Requirements
- Spec: ST-1…ST-5 (`07-testing-strategy.md`).
- Impl: a duck-typed check that the loop received a concrete profile (no `'auto'` string leaks);
  re-export presence is a barrel/packaging assertion.
