# Fallback Policy: Cross-Platform Function Keys

> **Document**: 03-02-fallback-policy.md
> **Parent**: [Index](00-index.md)

## Overview

The UI input boundary applies the approved number-row fallback before any keymap or widget policy.
The decoder remains byte-faithful, while all UI consumers observe the same canonical function key.
See AR-2, AR-3, AR-4, and AR-7.

## Architecture

### Public Contract

```ts
export type FunctionKeyFallback = 'number-row' | 'none';

export interface EventLoopOptions {
  functionKeyFallback?: FunctionKeyFallback;
}

export interface ApplicationOptions {
  functionKeyFallback?: FunctionKeyFallback;
}
```

`createEventLoop` resolves an omitted value to `'none'` for compatibility with direct,
host-agnostic consumers. `createApplication` passes
`options.functionKeyFallback ?? 'number-row'`, so application shells share the default-on policy
while direct event loops opt in explicitly. The type is exported from the UI package alongside
other event-loop option types.

### Pure Normalizer

```ts
function normalizeFunctionKey(event: InputEvent, policy: FunctionKeyFallback): InputEvent;
```

For a key event with `alt: true`, `ctrl: false`, `shift: false`, and an exact key in
`1,2,3,4,5,6,7,8,9,0,-,=`, the `'number-row'` policy returns an unmodified canonical F1–F12 event
without a `codepoint`. All other events are returned unchanged.

Shift-Alt symbols are not aliases, Ctrl-Alt chords are not aliases, mouse/paste/focus/wheel events
are unchanged, and `'none'` is identity behavior.

### Routing Order

Narrow `AppEvent` to `event.type === 'key'`, then normalize once at the start of
`EventLoop.dispatch()` before queueing/routing. Command events remain identity values. This ensures cascaded
dispatch, keymaps, F12 reveal mode, F10 menu handling, focus navigation, and focused views receive
the canonical event. Synthetic events created internally after routing are not reinterpreted unless
they enter through the public dispatch boundary.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Unsupported policy value from untyped JavaScript | Treat only exact `'number-row'` as enabled; otherwise preserve input | AR-2 |
| Modified alias candidate includes Ctrl or Shift | Preserve the original chord | AR-4, AR-7 |
| Slow Escape then number-row key | Dispatch the already-resolved Escape and later ordinary key | AR-3 |
| Consumer needs literal Alt chord | Configure `'none'` | AR-7 |

## Compatibility

Default-on is an intentional application/UI behavior change. It must be recorded in UI and root
changelogs with the exact opt-out. Low-level core callers of `decode()` observe no change for
Escape-prefix or Alt-printable input.

## Testing Requirements

- Pure mapping table covers all twelve aliases.
- Boundary cases cover policy disabled, Ctrl/Shift combinations, uppercase/symbol text, codepoint
  removal, and non-key identity.
- Event-loop tests prove normalization occurs before keymap, menu, accelerator, and focused-view
  routing.
- Feature-owned public-package tests prove the event-loop and application options are accepted and
  exported without repurposing unrelated immutable specification oracles.
