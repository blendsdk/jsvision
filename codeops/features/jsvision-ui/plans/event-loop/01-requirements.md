# Requirements: Event Loop + Focus + Modality + Commands

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-04](../../requirements/RD-04-event-loop.md)

## Feature Overview

RD-04 is the host-agnostic **dispatch mechanism** for `@jsvision/ui`. It consumes already-decoded
`@jsvision/core` `InputEvent`s through a single pure `dispatch(event)` entry and turns them into
focus movement, command execution, and modal flows, driving RD-03's `RenderRoot` exactly one frame
per dispatch tick. It reimagines Turbo Vision's event pump, 3-phase dispatch, focus chain, command
set, and `execView`/`endModal` modal loop as an idiomatic, async TypeScript engine — the
`TProgram`/`TApplication` machinery *without* the concrete app objects (those are RD-05).

## Functional Requirements

### Must Have

- [ ] **`createEventLoop(viewport, opts)` → `EventLoop`** — builds and owns a `RenderRoot` over the
  viewport, controlling its construct-time `schedule` seam so the loop drives frames (AR-55, AR-61).
- [ ] **Pure `dispatch(event: AppEvent)`** — wraps the event in a `DispatchEvent` envelope, routes
  it through 3-phase dispatch, drains any cascaded commands, and flushes **one** coalesced frame
  for the tick. No TTY/host dependency (AR-49, AR-54, AR-60, AR-64).
- [ ] **Faithful 3-phase dispatch** — (1) pre-process views (`preProcess`, root→down), (2) the
  focused leaf + focus-chain bubble, (3) post-process views (`postProcess`); a handler setting
  `ev.handled = true` halts all later phases/views (AR-51, PA-2).
- [ ] **`DispatchEvent` envelope** — `{ event: AppEvent; handled: boolean; local?: Point }`; the
  loop wraps each event; `View.onEvent(ev: DispatchEvent)` reads/writes `ev.handled`; core
  `InputEvent`s stay readonly (AR-60, PA-8).
- [ ] **Per-group `current` focus chain** — each `Group` tracks a `current` focused child; global
  focus is the root→leaf path of `current` pointers; the focused leaf's `state.focused` is `true`,
  all others `false`; a focus change flips exactly the old + new view's flag and invalidates them
  (AR-48).
- [ ] **Focusable predicate** — eligible iff `visible && !disabled && focusable` **and** no
  `!visible`/`disabled` ancestor; `focusable` defaults `false`; a `Group` is focusable iff it has
  a focusable descendant (AR-56, AR-65).
- [ ] **Tab / Shift-Tab traversal** — `focusNext`/`focusPrev` advance `current` among focusable
  siblings (wrap at ends); descending into a child `Group` focuses its `current` (or first
  focusable); deterministic child-order (AR-57). A dispatched **unbound `tab`/`shift+tab` KeyEvent**
  drives `focusNext`/`focusPrev` as a built-in and is consumed (a keymap-bound `tab` overrides)
  (PA-10).
- [ ] **One coalesced frame per public mutator** — `dispatch`, `emitCommand`, `focusNext`/
  `focusPrev`/`focusView`, `endModal`, and `execView` each run through a single internal tick (drain
  cascade → `onIdle` → exactly one `RenderRoot.flush()`); re-entrant calls join the active tick
  (PA-11). `execView` wraps its synchronous push-modal + focus-modal mutation in the tick so opening
  a modal paints one frame (PF-009), then returns its `Promise`.
- [ ] **`focusView(view)` / `getFocused()`** — programmatic focus sets `current` at every ancestor
  level; focusing a non-focusable view is a **no-op** (PA-5); `getFocused()` returns the focused
  leaf or `null` (AR-48).
- [ ] **Save/restore focus** — re-entering a group (or closing a modal) restores the previously
  `current` child, not the first focusable (AR-48, AR-53).
- [ ] **Top-most-first mouse hit-test** — normalize 1-based coords to 0-based (AR-63), walk
  front-to-back (last sibling first, paint Z-order), skip `!visible`/`disabled` subtrees, deliver
  to the top-most view whose absolute ancestor-clipped bounds contain the point, with view-local
  coords on `ev.local` (AR-50, AR-65).
- [ ] **Focus-on-click** — a mouse-down on a focusable view (or descendant) moves focus to its
  chain; a click on empty space steals no focus (AR-50, AR-57).
- [ ] **Typed command layer** — `emitCommand(name, arg?)` raises a `CommandEvent` dispatched
  through the 3-phase machine; a registry with `enableCommand`/`isCommandEnabled`; unknown commands
  are **enabled by default** (PA-3); a disabled command is dropped before dispatch (AR-52).
- [ ] **Key → command keymap** — reuse core `createKeymap`/`Keymap` (`'ctrl+q'` grammar); a bound
  chord **consumes** the key and raises the command instead of plain key dispatch (AR-52, AR-62,
  PA-1).
- [ ] **`execView(view) → Promise<R>` / `endModal(result)`** — push/pop a modal stack, capture
  dispatch to the top modal subtree, save/restore the outer focus, resolve the awaited Promise;
  nested `execView` stacks (LIFO). `endModal` is called explicitly (PA-4) (AR-53).
- [ ] **Modal input capture** — while a modal is active, all input (key/mouse/command) dispatches
  only within the top modal subtree; clicks outside it are **ignored** (PA-6) (AR-53).
- [ ] **`resize(size)`** — calls `RenderRoot.resize` (reflow) then flushes exactly one frame
  (AR-54).
- [ ] **Handler-error isolation** — a `View.onEvent` that throws is logged via the injectable
  `EventLoopOptions.logger` and the loop continues; one bad widget can't wedge the loop (AR-66,
  Security §).
- [ ] **Packaging** — pure TS, no third-party/native runtime deps (only Node built-ins + the
  declared `@jsvision/core` dep); ESM/NodeNext; lives in `packages/ui/src/event/`; re-exported
  through `@jsvision/ui`; `yarn check:deps` passes (AR-47, PA-7).

### Should Have

- [ ] **`onIdle` hook** — fires once when a dispatch tick's cascade queue drains (AR-58).
- [ ] **Headless `demo:events`** — a deterministic synthetic-dispatch walkthrough (Tab focus,
  Enter→`'ok'` command, modal `execView` resolving) printing ASCII frames (AR-59, PA-9).

### Won't Have (Out of Scope)

- **`Application`/`run()`/concrete app objects** (`Desktop`/`Window`/`MenuBar`/`StatusLine`) + the
  real `createHost` wiring → RD-05 (AR-47, AR-55).
- **Leaf controls** (`Button`/`Input`/`Menu`) → RD-06; acceptance uses test `View` subclasses.
- **Typed broadcast / message bus, timer-queue wrapper** → RD-05 (AR-58).
- **Arrow-key spatial focus navigation** → later (Tab-order only) (AR-57).
- **Drag / window raise / focus-on-click raise** → RD-05's Desktop.
- **Built-in Esc/cmCancel→endModal default wiring** → RD-05 (PA-4).
- **Audible/visual bell on out-of-modal click** → RD-05 (no output seam in RD-04) (PA-6).
- **Real terminal interactivity** → RD-05's `run()`; RD-04 is driven by synthetic `dispatch()`.

## Technical Requirements

### Performance
- A `dispatch` is a single bounded pass over a finite tree (3-phase walk + at most one hit-test +
  one coalesced flush). Modal/focus state are bounded stacks/pointers. Inherits RD-03's coalescing
  (one frame per tick) and RD-01's 1000-iteration runaway guard. No new perf budget beyond RD-10.

### Compatibility
- ESM-only, NodeNext, `strict`; zero runtime deps; active LTS Node 20/22/24. Additive to RD-03's
  final `View`/`Group` shape (no re-shape, AR-30/AR-56). The `onEvent` retype from `unknown` to
  `DispatchEvent` is *override-compatible* with existing subclass overrides (TS method bivariance),
  **but it narrows the base parameter**, so a *direct call* passing a non-`DispatchEvent` literal no
  longer typechecks. The one such site is the RD-03 spec oracle `view.tree.spec.test.ts:94`; its
  call argument is type-adapted to a valid `DispatchEvent` (assertion preserved) — see PF-008 and
  99 T1.3 (PA-8).

### Security
- Operates on developer-provided views, decoded events, and opaque command strings; no PII,
  credentials, persistence, network, or untrusted-byte parsing (events are pre-decoded + bounded by
  core's RD-06 decoder). Validates event *kind* before routing; off-tree hit-tests / out-of-range
  focus requests are no-ops, never throw. Emits **no** terminal output itself — all glyphs reach
  the screen via RD-03's `DrawContext`→core `serialize`/`sanitize` boundary; command names are
  opaque keys compared by equality (no `eval`/SQL/shell/fs). Most categories N/A (RD-04 Security §).

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Keymap-bound key | consume · in-addition | **consume** | accelerator semantics; no double-handling | PA-1 |
| Pre/post flag | two booleans · phase enum | **`preProcess`/`postProcess`** | TV-faithful; independent sweeps | PA-2 |
| Unknown command | enabled-by-default · strict registry | **enabled by default** | matches "enabled on first use"; no friction | PA-3 |
| `endModal` drivers | explicit-only · built-in defaults | **explicit only** | RD-04 is mechanism; defaults → RD-05 | PA-4 |
| `focusView` non-focusable | no-op · redirect | **no-op** | predictable; no surprise jumps | PA-5 |
| Click outside modal | ignore · bell | **ignore** | no output seam in RD-04 | PA-6 |
| File layout | granular `event/` · one file | **granular `event/`** | mirrors `view/`; ≤ 500 lines/file | PA-7 |
| Additive surface | edit RD-03 files + types in `view/types.ts` · cast | **edit + contract in `view/types.ts`** | no unsafe cast; no `view/`↔`event/` cycle | PA-8 |
| `handled` carrier | envelope · readonly field · core change | **`DispatchEvent` envelope** | core events stay pure/readonly | AR-60 |
| Frame ownership | loop builds root · inject into built root | **loop builds the `RenderRoot`** | construct-time schedule seam is the only one | AR-61 |
| Keymap impl | reuse core `createKeymap` · bespoke | **reuse core** | DRY; one grammar; free validation | AR-62 |
| Tab-key binding | built-in in RD-04 · defer to RD-05 | **built-in `tab`/`shift+tab`→focus** (consumed; keymap overrides) | AR-57 reads as live behavior; demo can show Tab via a dispatched key | PA-10 |
| Frame-driving methods | only `dispatch`/`resize` · one shared tick | **one `runTick` for every public mutator** | standalone `focusNext`/`emitCommand` must paint; `emitCommand` must drain | PA-11 |
| Modal Phase-2 bubble | clamp to scope root · bubble to tree root | **clamp to the modal `scopeRoot`** | `parent` pointers cross the modal boundary; clamp keeps the outer tree inert | PA-12 |

> **Traceability:** every scope decision references the Ambiguity Register entry (PA/AR #) that
> resolved it. See [00-ambiguity-register.md](00-ambiguity-register.md).

## Acceptance Criteria

(1:1 with RD-04 AC-1…AC-20; the immutable oracles ST-01…ST-20 in
[07-testing-strategy.md](07-testing-strategy.md) derive from these.)

1. [ ] **Pure dispatch** — `createEventLoop(viewport, { caps })` returns a loop driven entirely by
   `dispatch(event)` with no TTY/host dependency. (AR-49)
2. [ ] **3-phase order + `handled`** — pre (root→down) → focused (+bubble) → post; `ev.handled`
   halts later phases/views. (AR-51)
3. [ ] **Focus = per-group current chain** — focusing a leaf sets `current` at every ancestor;
   `getFocused()` returns it; exactly that leaf has `state.focused === true`. (AR-48)
4. [ ] **Tab / Shift-Tab traversal** — advances/retreats among focusable siblings (wrap); skips a
   hidden/disabled/`!focusable` view. (AR-56, AR-57)
5. [ ] **Focusable predicate** — eligible iff `visible && !disabled && focusable` (default false)
   and no `!visible`/`disabled` ancestor; a `Group` is focusable iff it has a focusable descendant.
   (AR-56, AR-65)
6. [ ] **Focus flips repaint** — moving focus invalidates exactly the old + new focused views and
   coalesces into one frame. (AR-48, AR-54)
7. [ ] **Mouse hit-test (top-most-first)** — a `MouseEvent` (1-based → 0-based) is delivered to the
   top-most front-to-back view whose ancestor-clipped bounds contain the point; overlaps resolve to
   the on-top one. (AR-50, AR-63)
8. [ ] **Focus-on-click** — a mouse-down on a focusable view (or descendant) moves focus to it; a
   click on empty space steals no focus. (AR-50, AR-57)
9. [ ] **Typed command dispatch** — `emitCommand('ok')` raises a `CommandEvent` routed 3-phase; the
   nearest handler consumes it (sets `handled`). (AR-52)
10. [ ] **Command enable/disable** — `enableCommand('save', false)` makes `emitCommand('save')` a
    no-op; re-enabling restores dispatch; `isCommandEnabled` reflects state; an unregistered command
    is enabled by default. (AR-52, PA-3)
11. [ ] **Key → command keymap** — with `{ keymap: createKeymap({ 'ctrl+q': 'quit' }) }`, a `ctrl+q`
    key raises `'quit'` and the raw key is **not** also dispatched; an unbound key dispatches plain.
    (AR-52, AR-62, PA-1)
12. [ ] **`execView` resolves on `endModal`** — `await execView(dialog)` blocks input to everything
    but `dialog`'s subtree; `endModal('ok')` resolves it to `'ok'`. (AR-53)
13. [ ] **Modal input capture** — while modal, key/mouse/command dispatch only within the top modal
    subtree; the outer tree receives nothing; a click outside is ignored. (AR-53, PA-6)
14. [ ] **Focus save/restore around modality** — the outer focused view is restored on modal close.
    (AR-48, AR-53)
15. [ ] **Nested modality** — a second `execView` stacks; each `endModal` resolves the matching
    promise LIFO, restoring each saved focus. (AR-53)
16. [ ] **Loop drives one frame per tick** — one dispatch tick (event + cascade) causing M
    invalidations produces exactly one `RenderRoot.flush()`. (AR-54, AR-61, AR-64)
17. [ ] **Resize reflows + repaints** — `loop.resize(size)` triggers a `RenderRoot.resize` and one
    subsequent frame. (AR-54)
18. [ ] **`onIdle` on queue drain** — after a dispatch tick's cascade drains, `onIdle` fires once.
    (AR-58)
19. [ ] **Handler-error isolation** — a `View.onEvent` that throws is logged via
    `EventLoopOptions.logger` and the loop continues. (AR-66, Security §)
20. [ ] **Packaging + standalone demo** — imports nothing beyond the package + `@jsvision/core` +
    Node built-ins (`check:deps` passes); `EventLoop`/`createEventLoop`/`CommandEvent`/
    `DispatchEvent` import from `@jsvision/ui`; the headless `demo:events` runs a focus + command +
    modal walkthrough printing ASCII frames. (AR-47, AR-59, PA-9)
