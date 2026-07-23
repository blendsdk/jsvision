# Browser Integration: Cross-Platform Function Keys

> **Document**: 03-03-browser-integration.md
> **Parent**: [Index](00-index.md)

## Overview

The browser host uses xterm.js's pre-processing hook when available to convert physical F1–F12
`keydown` events directly into canonical JSVision events. Minimal and headless terminals continue
through `onData`. Alias normalization remains owned by the UI event loop. See AR-5 through AR-7.

## Architecture

### Structural Types

Extend `TerminalLike` with an optional custom key-event hook using a local, DOM-library-free event
shape containing only `type`, `key`, `code`, `repeat`, modifier flags including `metaKey`,
`preventDefault()`, and `stopPropagation()`.
The hook returns the boolean expected by xterm.js: `false` for a handled event and `true` otherwise.
Because xterm.js stores a single custom handler and exposes no getter/disposable, JSVision is the
singleton hook owner while the host is active. `BrowserHostOptions` accepts an optional narrow
downstream handler for caller composition. Every event JSVision does not handle is delegated and
uses the downstream boolean result; absent downstream handling returns `true`. JSVision-handled
events are never delegated. Callers must pass their handler rather than pre-attaching it.

### Direct Function-Key Handling

- Handle only focused, non-repeat, non-Meta terminal `keydown` events whose `key` exactly matches
  `F1` through `F12`.
- Dispatch `{ type: 'key', key: 'fN', ctrl, alt, shift }` through `BrowserHostOptions.onInput`.
- For exact Alt-only physical codes `Digit1…Digit0`, `Minus`, and `Equal`, dispatch the corresponding
  literal raw Alt chord derived from `code` (never layout-dependent `key`). Return `false` so
  xterm.js emits no duplicate bytes; the UI policy then maps it or preserves it under `'none'`.
- Call `preventDefault()` and `stopPropagation()` and return `false`.
- For keyup, repeat, Meta-modified, malformed, and unrelated events, do not dispatch directly;
  delegate to the downstream handler and return its boolean result, or `true` when absent.

### Reclaim Coordination

Extract only a pure F1–F12 classifier (and alias-code map if shared) for browser-host interception
and `attachKeyReclaim()`. Preserve the reclaim helper's unrelated chord, wildcard, focus, and
capture-listener behavior. `mountApp()` must not install a second handler that causes a handled
F-key to be processed twice.

Where the xterm.js hook cannot be detached independently, terminal disposal remains lifecycle
ownership; standalone host behavior is documented consistently with the existing `onData`
subscription. JSVision cannot discover or restore a previously attached handler.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| Custom hook absent | Retain byte-only `onData` behavior | AR-5 |
| Browser/OS consumes event before hook | Rely on documented number-row fallback | AR-6 |
| `keyup` follows handled `keydown` | Do not dispatch; suppress only if required to avoid browser action |
| Unsupported `KeyboardEvent.key` spelling | Return `true`; do not guess from hardware code | AR-5, AR-8 |
| Repeat or Meta-modified keydown | Return `true`; do not synthesize a direct JSVision event | AR-8, AR-9 |
| Headless terminal has no DOM methods | Optional structural member keeps it compatible | AR-5 |
| Caller requires custom key policy | Compose it through the host's downstream handler; do not pre-attach a competing singleton | AR-5 |

## Testing Requirements

- A fake DOM-capable terminal captures the installed handler.
- F1 and F12 with modifiers dispatch exact canonical events once.
- Handled events prevent default/propagation and return false.
- Keyup, unrelated keys, and malformed names pass through.
- Alt aliases use exact physical codes and exercise both application-default and `'none'` policy.
- Repeat and Meta-modified inputs do not dispatch directly.
- Downstream handler true/false results are preserved for unhandled events, while JSVision-handled
  keys are not delegated; singleton ownership and non-restoration are documented.
- A headless/minimal terminal still compiles and decodes legacy bytes.
- `mountApp` integration proves no duplicate UI action.
- A real `@xterm/xterm` consumer compile-time contract is checked in the examples workspace, and a
  committed Chromium/Firefox smoke checklist records representative physical, alias, opt-out,
  single-event, repeat, and Meta cases without adding browser-runner tooling.
