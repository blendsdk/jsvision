# Default Keymap & Commands: Global Clipboard & Selection

> **Document**: 03-01-keymap-and-commands.md
> **Parent**: [Index](00-index.md)

## Overview

The outer layer of the design: a framework **default keymap** that binds `Ctrl+A/C/X/V` (plus classic
aliases) to `Commands.selectAll/copy/cut/paste`, merged into the event loop so a matched chord fires
the command and the raw key is swallowed. This document also adds the missing `Commands.selectAll` and
the `clipboardKeys` config surface.

## Architecture

### Current Architecture

`EventLoop.keymap` is `readonly keymap?: Keymap`, set from `opts.keymap` in the constructor
(`event-loop.ts:122,169`) and passed to the router untouched. With no user keymap, it is `undefined`
and no chord is globalized. `route()` only converts a chord when `ctx.keymap !== undefined`
(`dispatch.ts:122`).

### Proposed Changes

Introduce `buildKeymap(clipboardKeys, userKeymap)` that compiles a default clipboard keymap for the
selected mode and merges the user's bindings on top (user wins). The loop constructor calls it instead
of assigning `opts.keymap` directly. `clipboardKeys` is a new option on `EventLoopOptions` and
`ApplicationOptions`.

## Implementation Details

### New file: `packages/ui/src/event/default-keymap.ts`

```ts
import { createKeymap } from '@jsvision/core';
import type { Keymap } from '@jsvision/core';
import { Commands } from '../status/index.js';

/** Which clipboard key set the framework binds by default. */
export type ClipboardKeys = 'modern' | 'classic' | 'both' | 'none';

// Modern chords: Ctrl+A/C/X/V. Classic Turbo Vision chords: Ctrl+Insert / Shift+Insert / Shift+Delete.
// (bindings map chord -> command name; see core createKeymap grammar.)
```

- `DEFAULT_CLIPBOARD_KEYMAP` is not a single exported constant but the *modern* and *classic* binding
  records; `buildKeymap` selects/combines them by mode. (Naming per AR-9 — the module exports the
  builder + the mode type; the raw records may stay module-private.)
- Modern bindings: `{ 'ctrl+a': selectAll, 'ctrl+c': copy, 'ctrl+x': cut, 'ctrl+v': paste }`.
- Classic bindings: `{ 'ctrl+insert': copy, 'shift+insert': paste, 'shift+delete': cut }`.
  *(no `selectAll` classic chord — TV had none; select-all stays modern-only.)*

### New function: `buildKeymap`

```ts
/**
 * Build the loop's keymap: the framework's default clipboard bindings for `clipboardKeys`, with the
 * caller's own `keymap` merged on top (the caller's bindings win on any conflicting chord).
 *
 * @param clipboardKeys Which clipboard key set to bind by default. Defaults to `'both'`.
 * @param userKeymap    An optional app keymap whose bindings override the defaults.
 * @returns A compiled keymap, or `undefined` when there is nothing to bind (`'none'` + no user keymap).
 * @example
 * const keymap = buildKeymap('modern', createKeymap({ 'ctrl+s': 'save' }));
 * keymap?.lookup({ ctrl: true, alt: false, shift: false, key: 'c' }); // 'copy'
 */
export function buildKeymap(clipboardKeys?: ClipboardKeys, userKeymap?: Keymap): Keymap | undefined;
```

**Merge semantics (grounded in `core/keymap.ts`):** `createKeymap` compiles a flat chord→name table.
Because a compiled `Keymap` exposes only `lookup`, the merge cannot re-read a user `Keymap`'s table.
Two viable shapes — chosen: **compose at lookup time** (the returned keymap tries `userKeymap.lookup`
first, then the default). This preserves "user wins" without needing the user's raw bindings, and keeps
`createKeymap` the single compiler. `'none'` with no user keymap returns `undefined` (so
`route()`'s `ctx.keymap !== undefined` guard short-circuits and nothing is globalized).

> Rationale for compose-over-lookup vs. merging raw records: `EventLoopOptions.keymap` is already a
> compiled `Keymap` (not a record), so the loop never sees the user's chord strings. Composing two
> `lookup`s is the only merge that works without changing the public `keymap` option's type. *(AR-4/AR-9)*

### `Commands.selectAll` (in `packages/ui/src/status/commands.ts`)

Add to the `Commands` object:

```ts
/** Select all text in the focused editable widget. */
selectAll: 'selectAll',
```

And **rewrite** the clipboard JSDoc block (`commands.ts:36-49`), which today claims the classic chords
are the only mapping. New text states, in plain language, that these commands are raised by the default
clipboard keymap (`Ctrl+A/C/X/V`, with classic `Ctrl+Insert`/`Shift+Insert`/`Shift+Delete` as aliases)
and handled by the focused editable widget — **no** CodeOps/TV IDs, no `getColor`/`t*.cpp` references.
The rewritten JSDoc also notes that registering an `onCommand` handler for `copy`/`cut`/`paste`/
`selectAll` intercepts them before the focused widget (the loop's command sink runs first), so an app
should handle these app-wide only when it means to override the in-widget clipboard.

### `clipboardKeys` option

- `EventLoopOptions.clipboardKeys?: ClipboardKeys` (`event/types.ts`) — JSDoc: default `'both'`;
  describe each mode; note that a user `keymap` still merges on top and wins; and note that `'none'`
  binds **no** clipboard chords at all — only the widgets' raw `Ctrl+A` select-all fallback survives,
  so an app on `'none'` that wants copy/cut/paste (or the classic chords) supplies its own keymap.
  (The classic chords have no raw-key fallback once `clipboardChord()` is retired — see 03-03 §Input.4.)
- `ApplicationOptions.clipboardKeys?: ClipboardKeys` (`app/application.ts`) — forwarded to the loop
  at `application.ts:239` alongside `keymap`.

### Loop constructor change (`event-loop.ts:169`)

```ts
// before: this.keymap = opts.keymap;
this.keymap = buildKeymap(opts.clipboardKeys, opts.keymap);
```

`this.keymap` stays `readonly keymap?: Keymap` (`:122`). No other loop change in this document.

## Integration Points

- `route()` already consumes `ctx.keymap` (`dispatch.ts:122`) — unchanged.
- The commands raised (`selectAll`/`copy`/`cut`/`paste`) are handled by widgets — see
  [03-03](03-03-widget-integration.md).
- The app seeds `commands: Object.values(Commands)` (`application.ts:236`), so `selectAll` becomes a
  known command automatically once added to the map.

## Code Examples

```ts
// A bare loop with modern-only clipboard keys and a custom Ctrl+S:
const loop = createEventLoop(viewport, {
  caps,
  clipboardKeys: 'modern',
  keymap: createKeymap({ 'ctrl+s': 'save' }),
});
// Ctrl+C -> 'copy' (default), Ctrl+S -> 'save' (user), both live.
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Malformed default binding | Impossible at runtime — the default records are literals compiled once via `createKeymap`, which throws at build time on a bad chord; covered by a construction smoke test | AR-9 |
| `clipboardKeys: 'none'` + no user keymap | `buildKeymap` returns `undefined`; `route()` globalizes nothing | AR-3 |
| User keymap rebinds `ctrl+c` to `'save'` | User wins (compose-at-lookup tries user first); `copy` no longer fires from `Ctrl+C` | AR-4 |
| A classic/WordStar-mode `Editor` under `'modern'`/`'both'` | Its `Ctrl+A/C/X/V` become commands; documented — the app sets `clipboardKeys: 'classic'` or `'none'` | AR-8 |

> **Traceability:** every design choice above cites the AR entry that resolved it. See
> [00-ambiguity-register.md](00-ambiguity-register.md).

## Testing Requirements

- Keymap→command mapping for each mode (`modern`/`classic`/`both`/`none`) — ST-1..ST-6.
- User keymap overrides a default chord — ST-5.
- `Commands.selectAll` exists + is barrel-exported — ST-7 packaging.
