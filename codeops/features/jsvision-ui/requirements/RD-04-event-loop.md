# RD-04: Event Loop + Focus + Modality + Commands

> **Document**: RD-04-event-loop.md
> **Status**: Draft
> **Created**: 2026-06-29
> **Project**: jsvision UI (`@jsvision/ui`)
> **Depends On**: RD-03 (View/Group spine — done), RD-01 (Reactive core — done), `@jsvision/core` (input/host — done)
> **CodeOps Skills Version**: 3.0.0

---

## Feature Overview

RD-04 makes the RD-03 spine **interactive**. The view tree already composes, reflows,
themes, and reactively repaints — but its `View.onEvent` is an inert stub and its
`state.focused`/`state.disabled` flags are never driven. RD-04 is the **dispatch
mechanism** that turns decoded input into focus movement, command execution, and modal
flows, driving the existing `RenderRoot` one frame per input tick.

It reimagines Turbo Vision's event pump, `phaseType` 3-phase dispatch, focus chain,
command set, and `execView`/`endModal` modal loop as an idiomatic, **host-agnostic,
async** TypeScript engine — the `TProgram`/`TApplication` event machinery *without* the
concrete app objects.

**Scope boundary (AR-47):** RD-04 ships the **mechanism** — an `EventLoop` that owns
`dispatch(event)`, a focus manager (the per-group `current` chain), a command registry,
a modal stack, and the `RenderRoot` it builds and drives. The concrete app objects
that *compose* this mechanism — `Application`/`run()`, `Desktop`, `Window`, `MenuBar`,
`StatusLine`, and the real `createHost` input wiring — are **RD-05**. This mirrors the
RD-03 decision (AR-30) to ship the `View` shape and defer the logic: RD-04 ships the
dispatch logic and defers the app shell.

The engine is **pure** (AR-49): a single `dispatch(event)` entry consumes already-decoded
`InputEvent`s; there is no TTY dependency, so focus, dispatch, modality, and commands are
unit-testable with synthetic events — exactly how `@jsvision/core`'s decoder is pure and
RD-03's scheduler is injectable. The real terminal is wired by a thin host adapter in
RD-05's `run()`.

Complexity: **L** (the 3-phase dispatch × per-group focus chain × async modal stack
interplay over a clipped, overlapping view tree is where Turbo Vision earned 30 years of
focus/modality bug-fixes — the correctness risk, not the line count, is the weight).

---

## Functional Requirements

### Must Have

#### The event loop (the pump)

- [ ] **`EventLoop`** — the central object (`createEventLoop(viewport, opts)`), host-agnostic.
  It **builds and owns** the `RenderRoot` (controlling its construct-time `schedule` seam to drive
  frames, PF-402), the focus manager, the command registry, and the modal stack. It exposes
  `mount(root)`, `dispatch(event)` (the single input entry), `resize(size)`, focus/command/modal
  APIs (below), an `onIdle` hook, and the built `renderRoot`. It has no `createHost` dependency.
  (AR-47, AR-49, AR-55, AR-61)
- [ ] **`dispatch(event)`** — the pure input entry. Accepts a decoded `InputEvent`
  (`KeyEvent | MouseEvent | WheelEvent | PasteEvent | FocusEvent` from `@jsvision/core`)
  **or** an internally-raised `CommandEvent`, wraps it in a `DispatchEvent` envelope, routes it
  through 3-phase dispatch (below) — draining any commands it cascades — then flushes **one**
  coalesced frame for that **dispatch tick** (the event plus its cascade). (AR-49, AR-54, PF-401, PF-405)
- [ ] **Loop drives frames (AR-54)** — `EventLoop` **builds** its `RenderRoot` (it owns
  construction so it controls RD-03's construct-time `schedule` seam — the root's self-flush is
  suppressed and the loop drives the frame). After a dispatch tick's cascade queue drains the loop
  calls `RenderRoot.flush()` exactly **once**, so every `invalidate()` from that tick coalesces into
  one frame. `resize(size)` calls `RenderRoot.resize` (reflow) then flushes once. `onIdle()` fires
  when the tick's cascade queue drains. (AR-32, AR-54, PF-402, PF-405)

#### 3-phase dispatch

- [ ] **Faithful pre/focus/post dispatch (AR-51)** — a keyboard event flows in three phases:
  (1) **pre-process** — groups flagged pre-process see it first, root→down (accelerators /
  global hotkeys); (2) **focused** — the focused leaf view (and, for unhandled events,
  bubbling up its focus-chain ancestors); (3) **post-process** — groups flagged post-process
  (default/cancel buttons, menu hotkeys). A `handled` flag on the event halts propagation at
  the first handler that sets it. (AR-51)
- [ ] **`handled` flag** — the loop wraps each event in a **dispatch envelope** `DispatchEvent`
  (carrying the `AppEvent`, a mutable `handled`, and, for mouse/wheel, the view-local coords);
  `onEvent(ev)` marks the event consumed by setting `ev.handled = true`. Core `InputEvent`s stay
  readonly/pure — the envelope, not the event, carries `handled`. Once handled, no later phase or
  view sees it. (AR-51, PF-401)
- [ ] **Event routing by kind** — keyboard/paste route through the 3-phase focus path; mouse/
  wheel route by hit-test (below); a `CommandEvent` routes through the same 3-phase machine so
  a command can be handled pre/focus/post. (AR-50, AR-51, AR-52)

#### Focus (the per-group `current` chain)

- [ ] **Per-group `current` chain (AR-48)** — each `Group` tracks a `current` focused child;
  the application's global focus is the root→leaf path of `current` pointers. The focused
  **leaf** view's `state.focused` is `true`; all others are `false`. Focus changes update the
  flags and invalidate the affected views (so `buttonFocused`-style roles repaint). (AR-48)
- [ ] **Focusable predicate (AR-56)** — a view can receive focus iff `visible && !disabled &&
  focusable`, where `focusable` is a new **additive** `View` option (TV's `ofSelectable`,
  default per the widget). A `Group` is focusable iff it has a focusable descendant. (AR-56)
- [ ] **Tab / Shift-Tab traversal (AR-57)** — Tab advances `current` to the next focusable
  sibling in the active group (Shift-Tab the previous), wrapping at the ends; descending into
  a child `Group` focuses that group's `current` (or its first focusable). Focus movement is
  deterministic child-order traversal. (AR-57)
- [ ] **`focusView(view)` / programmatic focus** — moving focus to a target view sets the
  `current` pointer at every level of its ancestor chain and updates the flags; a request to
  focus a non-focusable view is a no-op (or redirects to its nearest focusable, finalized in
  planning). (AR-48)
- [ ] **Save/restore focus** — when a subtree loses then regains the active path (group
  re-entry, modal close), the previously-`current` child is restored, not reset to the first.
  (AR-48, AR-53)

#### Mouse hit-testing

- [ ] **Top-most-first hit-test (AR-50)** — a `MouseEvent`/`WheelEvent` at absolute `(x,y)` is
  routed to the **top-most** view whose absolute bounds (∩ ancestor clips) contain the point,
  found by walking the tree front-to-back (last sibling first, matching paint Z-order). The
  event is delivered to that view's `onEvent`; coordinates are translated to view-local for the
  handler (finalized in planning). (AR-50)
- [ ] **Focus-on-click** — a mouse-down on a focusable view (or a descendant) moves focus to it
  (sets the `current` chain). A click outside any focusable view does not steal focus. (AR-50,
  AR-57)
- [ ] **Modal hit-test capture** — while a modal is active, hit-testing is confined to the top
  modal subtree; clicks outside it are ignored (or bell, finalized in planning). (AR-50, AR-53)

#### Commands

- [ ] **Typed `CommandEvent` (AR-52)** — a command is a typed string (e.g. `'ok'`, `'cancel'`,
  `'quit'`). `emitCommand(name, arg?)` raises a `CommandEvent` dispatched through the same
  3-phase machine, so the nearest interested view (or a pre/post handler) consumes it. (AR-52)
- [ ] **Command registry + enable/disable (AR-52)** — the loop owns the set of known commands
  and their enabled/disabled state; `enableCommand(name, on)` toggles it. A disabled command is
  not dispatched (and widgets read the state to render greyed — the widget-side rendering is
  RD-06). (AR-52)
- [ ] **Key → command keymap (AR-52)** — RD-04 **reuses** `@jsvision/core`'s `createKeymap`/
  `Keymap` (the `'ctrl+q'` lowercase `'+'`-joined chord grammar, with build-time validation); the
  loop calls `keymap.lookup(keyEvent)` so a bound key chord raises the bound command (subject to
  enable/disable) instead of (or in addition to, finalized in planning) plain key dispatch. No
  bespoke chord parser. (AR-52, PF-403)

#### Modality

- [ ] **`execView(view) → Promise<Result>` (AR-53)** — pushes `view` onto a modal stack,
  captures dispatch to the top modal subtree, saves the outer focus, focuses the modal, and
  returns a Promise that resolves when the modal ends. (AR-53)
- [ ] **`endModal(result)` (AR-53)** — ends the top modal: pops the stack, restores the outer
  focus, and resolves the `execView` Promise with the typed `result`. A standard `'ok'`/
  `'cancel'` command (or Esc) can drive `endModal` (finalized in planning). (AR-53)
- [ ] **Modal input capture** — while a modal is on the stack, all input (keyboard, mouse,
  commands) is dispatched only within the top modal subtree; the rest of the tree is inert
  until the modal ends. (AR-53)

#### Packaging

- [ ] **Packaging** — pure TypeScript, no third-party/native runtime dependencies (only Node
  built-ins + the declared workspace dep `@jsvision/core`); ESM/NodeNext; lives in
  `packages/ui/src/event/` (final dir name in planning) and is re-exported through the single
  `@jsvision/ui` entry point; `yarn check:deps` passes. (AR-47)

### Should Have

- [ ] **`onIdle` hook** — a callback fired when the dispatch queue drains (for idle-time work).
  (AR-58)
- [ ] **Headless `demo:events`** — a runnable, deterministic walkthrough that feeds synthetic
  events into `dispatch()` and prints ASCII frames showing focus moving (Tab), a command firing
  (Enter → `'ok'`), and a modal `execView` resolving — the RD-04 acceptance vehicle, consistent
  with `demo:view`. (AR-59)
- [ ] **`getFocused()` / focus introspection** — read the current focused view (for tests and
  for RD-05's status line). (AR-48)

### Won't Have (Out of Scope)

- **`Application` / `run()` / concrete app objects** — `Application`, `Desktop`, `Window`,
  `Frame`, `ScrollBar`, `MenuBar`, `StatusLine`, and the real `createHost({onInput}) →
  dispatch` wiring are **RD-05**. RD-04 ships the mechanism they compose. (AR-47, AR-55)
- **Leaf controls** (`Button`, `Input`, `Menu`, …) — first controls land in RD-06; RD-04
  acceptance uses test `View` subclasses + the headless demo. (component map §4)
- **Typed broadcast / message bus** — deferred to RD-05; RD-01 signals already serve cross-view
  state. (AR-58)
- **Timer queue / `idle()` scheduling wrapper** — Node's native `setTimeout`/`setInterval`
  suffice; only the `onIdle` hook ships. (AR-58)
- **Arrow-key spatial focus navigation** — Tab-order traversal only in v1; spatial nav is a
  later enhancement. (AR-57)
- **Drag / window management / focus-on-click *raise*** — moving/raising windows on click is
  the Desktop's job (RD-05); RD-04 does focus-on-click, not z-order raise. (component map §2)
- **Real terminal interactivity** — the live TTY app is RD-05's `run()`; RD-04 is driven by
  synthetic `dispatch()` calls. (AR-49, AR-59)

---

## Technical Requirements

### Public API surface

```ts
import type { InputEvent, Keymap, CapabilityProfile, Theme, Logger } from '@jsvision/core';
import type { Size2D } from '../layout/index.js';               // intra-package reuse (RD-02)
import type { View, RenderRoot, Point } from '../view/index.js'; // intra-package reuse (RD-03)

/** A typed command raised within the app (routed through the 3-phase machine). (AR-52) */
interface CommandEvent {
  readonly type: 'command';
  readonly command: string;        // typed command name, e.g. 'ok' | 'cancel' | 'quit'
  readonly arg?: unknown;          // optional payload
}

/** Any event the loop dispatches: a decoded core input event or an internal command. */
type AppEvent = InputEvent | CommandEvent;

/**
 * The envelope the loop wraps each event in before 3-phase routing; this — not the readonly core
 * `InputEvent` — is what `View.onEvent(ev)` receives. Keeps core's event model pure. (AR-51, PF-401)
 */
interface DispatchEvent {
  readonly event: AppEvent;        // the wrapped decoded input event or internal command
  handled: boolean;                // set true by a handler to halt propagation (AR-51)
  readonly local?: Point;          // mouse/wheel coords translated to view-local (AR-50, PF-404)
}

/** Options for the event loop. The loop builds + owns the RenderRoot, so it carries the root config. */
interface EventLoopOptions {
  /** REQUIRED — depth-aware encoding for the loop-built RenderRoot's `serialize()`. (AR-44) */
  caps: CapabilityProfile;
  /** Active theme; forwarded to the RenderRoot (defaults to core's `defaultTheme`). (AR-35) */
  theme?: Theme;
  /** Screen-safe logger for draw() AND onEvent() errors; defaults to a disabled logger. (AR-42, AC-19, PF-407) */
  logger?: Logger;
  /** Key-chord → command keymap, built via core's `createKeymap` (`'ctrl+q'` grammar). (AR-52, PF-403) */
  keymap?: Keymap;
  /** Commands known at construction; absent → enabled on first use (finalized in planning). */
  commands?: Iterable<string>;
  /** Fired when a dispatch tick's cascade queue drains. (AR-58) */
  onIdle?: () => void;
}

/** The host-agnostic dispatch mechanism. Concrete Application/run() is RD-05. (AR-47, AR-55) */
interface EventLoop {
  /** The RenderRoot the loop built and drives — for host integration + tests. (PF-402) */
  readonly renderRoot: RenderRoot;
  mount(root: View): void;                      // mount the view tree into the loop's render root
  dispatch(event: AppEvent): void;              // the single input entry (AR-49)
  resize(size: Size2D): void;                   // reflow + flush (AR-54)

  // focus (per-group current chain) — AR-48, AR-57
  focusNext(): void;                            // Tab
  focusPrev(): void;                            // Shift-Tab
  focusView(view: View): void;                  // programmatic focus
  getFocused(): View | null;

  // commands — AR-52
  emitCommand(command: string, arg?: unknown): void;
  enableCommand(command: string, on: boolean): void;
  isCommandEnabled(command: string): boolean;

  // modality — AR-53
  execView<R>(view: View): Promise<R>;          // push modal; resolves on endModal
  endModal<R>(result: R): void;                 // pop top modal; resolve its promise
}

/**
 * Construct the loop. It **builds** its `RenderRoot` over a `viewport`-cell buffer, controlling the
 * construct-time `schedule` seam so it owns frame timing (AR-54, PF-402). Concrete Application/run()
 * is RD-05. (AR-47, AR-55)
 */
function createEventLoop(viewport: Size2D, opts: EventLoopOptions): EventLoop;
```

**Additive `View` surface (extends the RD-03 final shape, not a re-shape — AR-30, AR-56):**

```ts
// On View (additive):
//   focusable: boolean        // option flag (TV ofSelectable), DEFAULT false (decorative-by-default,
//                             // PF-406); eligibility = visible && !disabled && focusable AND no
//                             // !visible/disabled ancestor (subtree semantics, PF-406).
//   onEvent(ev: DispatchEvent): void   // receives the envelope; sets ev.handled to halt (AR-51, PF-401)
// Group gains an internal `current: View | null` focused-child pointer (AR-48); raise/lower stays RD-05.
```

> `InputEvent`/`Keymap`/`CapabilityProfile`/`Theme`/`Logger` come from `@jsvision/core`; `View`/
> `RenderRoot`/`Size2D`/`Point` are reused from the package's own RD-02/RD-03 surfaces.
> `CommandEvent`/`DispatchEvent`/`EventLoop` are RD-04-owned. Method signatures are indicative and
> finalized during planning.

### Behavior notes

- **Dispatch pipeline** — `dispatch(event)` → wrap in a `DispatchEvent` envelope → (resolve
  key→command via `keymap.lookup`, if bound) → 3-phase route (pre groups → focused chain → post
  groups) with `ev.handled` short-circuiting → drain any cascaded commands → one coalesced
  `RenderRoot.flush()` for the tick (AR-51, AR-54, PF-401). Mouse/wheel events skip the focus path
  and route by hit-test (AR-50).
- **Focus** — the focus manager keeps the `current` pointer per `Group`; the active leaf is the
  end of the root→leaf `current` path. Tab/Shift-Tab mutate `current` among focusable siblings
  (wrap); focus changes flip exactly two views' `focused` flag (old + new) and invalidate them
  (AR-48, AR-57).
- **Hit-test** — mouse/wheel coords arrive **1-based** from core (`MouseEvent`/`WheelEvent`), so the
  loop normalizes them to 0-based (`x-1`, `y-1`) at the dispatch boundary before testing against the
  0-based view `bounds` (PF-404); a front-to-back walk (last child first) returns the top-most view
  whose absolute, ancestor-clipped bounds contain the point (skipping `!visible`/`disabled` subtrees,
  PF-406); the hit coords are translated to view-local on the envelope (`ev.local`). Mouse-down on a
  focusable target focuses its chain; modal active ⇒ confine to the top modal subtree (AR-50, AR-53).
- **Commands** — `emitCommand` raises a `CommandEvent` dispatched through the 3-phase machine;
  disabled commands are dropped before dispatch; core's `Keymap.lookup` turns bound key chords
  (`'ctrl+q'` grammar) into commands (AR-52, PF-403).
- **Modality** — `execView` pushes a modal frame {view, savedFocus, resolve}; input is captured
  to the top subtree; `endModal(result)` pops it, restores `savedFocus`, and resolves the
  promise. Nested `execView` stacks (AR-53).
- **Frame determinism** — because the loop builds the render root and suppresses its self-flush,
  each dispatch tick (the event + its command cascade) produces exactly one `flush()`; tests assert
  flush counts with a synthetic dispatch sequence (AR-54, PF-402/PF-405), inheriting RD-03's
  coalescing guarantee (AR-32).

---

## Integration Points

### With RD-03 (View/Group spine — done)

- **`onEvent` stub → live** — RD-04 implements the dispatch that RD-03 left as an overridable
  stub; the `View` shape is unchanged except the additive `focusable` option and `Group`'s
  internal `current` pointer (AR-30, AR-56).
- **`state.focused`/`state.disabled`** — RD-04 *drives* these flags (RD-03 only read them to
  pick a role); a focus change invalidates the affected views so role-dependent draws repaint
  (AR-48).
- **`RenderRoot.schedule`** — RD-04 **builds** the render root and controls its construct-time
  `schedule` seam (the root's self-flush is suppressed; the loop drives the frame), so dispatch and
  frames are deterministic (AR-32, AR-54, PF-402).
- **`RenderRoot.resize`/`flush`** — the loop owns the root and calls these on resize and at
  end-of-tick (AR-54).

### With RD-01 (Reactive core — done)

- **No new reactivity** — focus/command/modal state is held in plain loop-owned structures, not
  signals; widgets that want to *react* to focus already do so via RD-03 `bind` on their own
  state. RD-04 adds no parallel reactive layer. (AR-58)
- **Owner scopes** — a modal view mounted via `execView` is wired into the tree using RD-03's
  existing scope-nesting (`runWithOwner`), so closing it disposes cleanly (AR-53, AR-43).

### With `@jsvision/core` (done)

- **Input events** — `dispatch` consumes the decoder's `InputEvent` union directly; RD-04 does
  **no** byte decoding (that is the decoder's job). (AR-49)
- **Host (deferred wiring)** — the real `createHost({ onInput, onResize })` → `dispatch`/`resize`
  adapter is **RD-05**'s `run()`; RD-04 stays host-agnostic and TTY-free. (AR-49, AR-55)

### With RD-05 (App shell — backlog)

- RD-05's `Application` *composes* this `EventLoop`: it wires `createHost` input into `dispatch`,
  owns `run()`/lifecycle, and adds `Desktop`/`Window`/`MenuBar`/`StatusLine` (which use the
  focus chain, commands, and `execView` RD-04 provides). No `EventLoop` re-shape required.
  (AR-47, AR-55)

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| RD-04/RD-05 boundary | mechanism only · full Application now | dispatch mechanism (`EventLoop`), defer Application/`run()`/shell | mirrors RD-03 ship-shape/defer-logic; keeps the spine/shell line clean | AR-47 |
| Focus model | per-group `current` chain · flat global focused-view | per-group `current` chain (TV-faithful) | composes with nesting + modality; restore-on-re-entry is free | AR-48 |
| Input seam | pure `dispatch`, injectable · own `createHost` | pure `dispatch(event)`, host wiring deferred | TTY-free unit tests; consistent with pure core decoder + RD-03 scheduler | AR-49 |
| Mouse hit-testing | in RD-04 · defer to RD-05 | top-most-first hit-test + focus-on-click in RD-04 | mouse is part of the event model RD-04 owns; RD-03 deferred it here | AR-50 |
| Dispatch model | faithful 3-phase · simple bubble | faithful pre/focus/post + `handled` flag | menu hotkeys + default buttons need pre/post; component map keeps it | AR-51 |
| Commands | typed command layer · raw dispatch only | `CommandEvent` + registry + enable/disable + key→command keymap | gives `execView` a typed result vocabulary; Tier-0 per component map | AR-52 |
| Modality | modal stack + `endModal` → Promise · defer to RD-05 | `execView` pushes a modal stack; `endModal(result)` resolves the awaited Promise | async-native modality; Phase-0 demo payoff | AR-53 |
| Loop↔render | loop drives frames (control schedule seam) · keep microtask | loop **builds** the render root + controls its construct-time `schedule` seam (self-flush suppressed; loop drives the frame) | one deterministic frame per dispatch tick; uses RD-03's seam (realization refined by PF-402) | AR-54 |
| Central object | `EventLoop`/`createEventLoop` · fold into `RenderRoot` | `EventLoop` owns dispatch/focus/commands/modal; `run()` → RD-05 | don't overload the render seam with input/focus concerns | AR-55 |
| Focusable predicate | additive `focusable` flag · infer from `onEvent` | additive `focusable` option; predicate `visible && !disabled && focusable` | explicit, additive to the RD-03 final shape, expresses decorative views | AR-56 |
| Focus traversal | Tab/Shift-Tab over current-chain · arrow spatial nav | Tab/Shift-Tab (wrap) + click-to-focus | deterministic, matches forms; spatial nav later | AR-57 |
| Idle/broadcast/timers | `onIdle` only · ship broadcast + timer queue | `onIdle` only; broadcast + timers → RD-05 | signals subsume cross-view messaging; Node timers suffice | AR-58 |
| Demo vehicle | headless `demo:events` · real-TTY interactive | headless scripted-dispatch demo | deterministic + CI-able; interactive TTY needs RD-05 host wiring | AR-59 |

> **Traceability:** every decision references its Ambiguity Register entry
> (`00-ambiguity-register.md`, AR-47…AR-59). AR-47…AR-54 are explicit user choices; AR-55…AR-59
> are single-dominant-option decisions recorded for traceability. The **RD-04 preflight**
> (`00-preflight-report-RD-04.md`, PF-401…PF-408) refined the codebase-grounded realization —
> recorded as **AR-60…AR-66** (accepted 2026-06-29).

---

## Security Considerations

> An in-process input-dispatch engine over a developer-authored view tree: no network, no
> persistence, no untrusted-input parsing. It consumes events **already decoded and bounded**
> by `@jsvision/core`'s RD-06 decoder (paste size caps, resync on oversized sequences) and emits
> nothing to the terminal directly — all output still flows through RD-03 → core's `serialize`/
> `sanitize` boundary. Most categories are N/A and recorded as such honestly.

- **Data sensitivity**: none — operates on developer-provided views, decoded events, and command
  strings; no PII, credentials, or persistence in RD-04.
- **Input validation**: `dispatch` consumes the decoder's typed `InputEvent` union, not raw
  bytes; the decoder already bounds paste size and resynchronises on malformed sequences (RD-06).
  RD-04 validates event *kind* before routing and treats unknown/degenerate coordinates (off-tree
  hit-tests, out-of-range focus requests) as no-ops, never throws.
- **Injection risks**: RD-04 emits **no** terminal output itself; all glyphs reach the screen via
  RD-03's `DrawContext` → core `ScreenBuffer`/`serialize`/`sanitize` boundary, so terminal-escape
  injection remains guarded exactly as in RD-03. Command names are opaque string keys compared by
  equality — no `eval`, no SQL/HTML/shell/filesystem surface.
- **Authentication & authorization**: N/A (in-process library, no access boundary).
- **Availability**: a `dispatch` is a single bounded pass over a finite tree (3-phase walk +
  one hit-test + one coalesced flush). Modal/focus state are bounded stacks/pointers. A handler
  that throws in `onEvent` is isolated like RD-03's `draw()` isolation (logged via the injectable
  screen-safe `EventLoopOptions.logger`, dispatch continues) so one bad widget can't wedge the loop
  (AC-19, PF-407). The
  reactive layer it may touch inherits RD-01's 1000-iteration runaway guard.
- **Encryption / rate limiting / infrastructure**: N/A.

---

## Acceptance Criteria

1. [ ] **Pure dispatch** — `createEventLoop(viewport, { caps })` returns a loop driven entirely by
   `dispatch(event)` with no TTY/host dependency; a test feeds synthetic `InputEvent`s and
   asserts behavior without `createHost`. (AR-49)
2. [ ] **3-phase order** — a key event visits pre-process groups (root→down), then the focused
   view (+ focus-chain bubble), then post-process groups, in that order; a handler setting
   `ev.handled` (the dispatch envelope, PF-401) stops all later phases/views from seeing it. (AR-51)
3. [ ] **Focus = per-group current chain** — focusing a leaf sets `current` at every ancestor
   group; `getFocused()` returns it; exactly that leaf has `state.focused === true`. (AR-48)
4. [ ] **Tab / Shift-Tab traversal** — Tab advances focus to the next focusable sibling
   (Shift-Tab the previous), wrapping at the ends; a non-focusable (hidden/disabled/`!focusable`)
   view is skipped. (AR-56, AR-57)
5. [ ] **Focusable predicate** — `focusable` defaults to `false` (PF-406); a view is focus-eligible
   iff `visible && !disabled && focusable` AND it has no `!visible`/`disabled` ancestor (subtree
   semantics, PF-406); toggling any factor changes eligibility; a `Group` is focusable iff it has a
   focusable descendant. (AR-56, PF-406)
6. [ ] **Focus flips repaint** — moving focus invalidates exactly the old and new focused views
   (their `focused`-dependent roles repaint) and coalesces into one frame. (AR-48, AR-54)
7. [ ] **Mouse hit-test (top-most-first)** — a `MouseEvent` (1-based coords, normalized to 0-based,
   PF-404) at `(x,y)` is delivered to the top-most view (front-to-back) whose ancestor-clipped bounds
   contain the point; overlapping siblings resolve to the later (on-top) one. (AR-50, PF-404)
8. [ ] **Focus-on-click** — a mouse-down on a focusable view (or descendant) moves focus to it;
   a click on empty space steals no focus. (AR-50, AR-57)
9. [ ] **Typed command dispatch** — `emitCommand('ok')` raises a `CommandEvent` routed through
   the 3-phase machine; the nearest handler consumes it (sets `handled`). (AR-52)
10. [ ] **Command enable/disable** — `enableCommand('save', false)` makes `emitCommand('save')`
    a no-op (not dispatched); re-enabling restores dispatch; `isCommandEnabled` reflects state.
    (AR-52)
11. [ ] **Key → command keymap** — with `{ keymap: createKeymap({ 'ctrl+q': 'quit' }) }` (core's
    keymap, PF-403), a `Ctrl-Q` key event raises the `'quit'` command; an unbound key dispatches as a
    plain key event. (AR-52, PF-403)
12. [ ] **`execView` resolves on `endModal`** — `const r = await execView(dialog)` blocks input
    to everything but `dialog`'s subtree; calling `endModal('ok')` inside it resolves `r ===
    'ok'`. (AR-53)
13. [ ] **Modal input capture** — while a modal is active, key/mouse/command events dispatch only
    within the top modal subtree; the outer tree receives nothing until the modal ends. (AR-53)
14. [ ] **Focus save/restore around modality** — the outer focused view is restored when the
    modal closes (not reset to the first focusable). (AR-48, AR-53)
15. [ ] **Nested modality** — a second `execView` inside a modal stacks; each `endModal` resolves
    the matching promise in LIFO order, restoring each saved focus. (AR-53)
16. [ ] **Loop drives one frame per tick** — one `dispatch` tick (an event plus any commands it
    cascades) causing M invalidations produces exactly **one** `RenderRoot.flush()` (assert via a
    flush counter on the loop-built root). (AR-54, PF-402, PF-405)
17. [ ] **Resize reflows + repaints** — `loop.resize(size)` triggers a `RenderRoot.resize`
    (reflow) and exactly one subsequent frame. (AR-54)
18. [ ] **`onIdle` on queue drain** — after a dispatch tick's cascade queue is fully processed, the
    `onIdle` hook fires once. (AR-58, PF-405)
19. [ ] **Handler-error isolation** — a view whose `onEvent` throws is logged via the injectable
    `EventLoopOptions.logger` (screen-safe) and the loop continues dispatching/rendering (one bad
    widget can't wedge the loop). (Security §, PF-407)
20. [ ] **Packaging + standalone demo** — RD-04 imports nothing beyond the package, its declared
    workspace dep `@jsvision/core`, and Node built-ins (`yarn check:deps` passes); `EventLoop`/
    `createEventLoop`/`CommandEvent` are importable from `@jsvision/ui`; the headless `demo:events`
    runs a focus + command + modal walkthrough with synthetic events and prints ASCII frames.
    (AR-47, AR-59)

---

> **Next step:** run the make_plan skill on RD-04 to produce the implementation plan, then
> preflight, then exec_plan — the same path RD-01, RD-02, and RD-03 followed.
