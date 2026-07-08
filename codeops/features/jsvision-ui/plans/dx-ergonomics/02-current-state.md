# Current State: DX Ergonomics Pass

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The engine and widgets are complete; the gaps are all in the convenience surface. Each proposal has
a proven internal precedent to build on rather than invent.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/app/application.ts` | `createApplication`, `ApplicationOptions`, internal `QuitCommandSink` | P1: optional `caps` + resolve-once; P2: forward `onCommand`, generalize the quit sink |
| `packages/ui/src/app/run.ts` | `runApplication`, consumes `ctx.caps` | P1: receive the resolved profile (no `'auto'` reaches here) |
| `packages/ui/src/index.ts` | package barrel | P1: add the 7 core re-exports |
| `packages/ui/src/event/event-loop.ts` | `EventLoopImpl`, owns dispatch/registry | P2: add `onCommand` + the internal command-sink registration |
| `packages/ui/src/event/types.ts` | `EventLoop` interface | P2: declare `onCommand` |
| `packages/ui/src/dialog/message-box.ts` *(new)* | — | P3: `messageBox`/`confirm`/`inputBox` + the `{loop,desktop}` host seam |
| `packages/ui/src/dialog/index.ts` | dialog barrel | P3: export the new helpers + host type |
| `packages/ui/src/editor/dialogs.ts` | editor `infoBox`/`confirmBox`/`runDialog` | P3: refactor `infoBox`/`confirmBox` to delegate |
| `packages/examples/tvision-demo/{main,widgets}.ts` | flagship demo | P1/P2/P3: adopt the new APIs (the live proof) |

### Code Analysis

- **Caps is required and threaded twice.** `ApplicationOptions.caps` (`application.ts:25`) feeds both
  `createEventLoop` (`:211-219`) and `runApplication` (`:272`); `run.ts` reads `ctx.caps` (`:67`).
  `createApplication` must resolve caps once and pass the concrete profile to both — `'auto'` must
  never leak past `createApplication`.
- **The barrel re-exports nothing from core.** `packages/ui/src/index.ts` only mentions `@jsvision/core`
  in prose; the seven target symbols all live in `packages/core/src/engine/index.ts`.
- **The quit sink is the onCommand template.** `QuitCommandSink` (`application.ts:82-102`) is a
  `preProcess`, `visible:false` `View` that, on `Commands.quit`, calls a callback and sets
  `ev.handled = true`. Generalizing it to a `Map<command, handler[]>` and registering quit as one
  entry yields `onCommand` with the exact same dispatch characteristics.
- **The command registry is untouched.** `event/commands.ts` enqueues emitted commands onto the tick;
  the sink is a *consumer* of routed command events. `onCommand` needs no registry change.
- **The modal-helper pattern already exists in the editor.** `editor/dialogs.ts` has `infoBox`
  (`:179`), `confirmBox` (`:158`), the private `runDialog` (`:49`, add→`execView`→remove), and the
  `EditorDialogHost` seam `{ loop: Pick<EventLoop,'execView'>, desktop: Pick<Desktop,'addWindow'|'removeWindow'|'bounds'> }`
  (`:30-35`). The new general helpers lift that pattern into `dialog/`; the editor's two message
  helpers then delegate. `Application` (`readonly desktop :64`, `readonly loop :66`) satisfies the seam.

## Gaps Identified

### Gap 1: Mandatory caps prologue + two-package tax (Proposal 2)
**Current:** `caps` is required and only `@jsvision/core` produces it; a custom `draw()` needs
`Attr`/`Style`, a keymap needs `createKeymap`/`Keymap` — all from core.
**Required:** `createApplication({ menuBar })` works with no caps, and the essentials import from `@jsvision/ui`.
**Fix:** optional `caps` with `'auto'` resolution; seven re-exports.

### Gap 2: No first-class command handler (Proposal 3)
**Current:** catching an app command means subclassing `View`, setting `postProcess`/`visible=false`,
mapping `onEvent`, and honoring `ev.handled` — the demo's `CommandSink`.
**Required:** `app.onCommand('about', fn)`.
**Fix:** generalize the quit sink into a public `onCommand`.

### Gap 3: Raw modal ceremony (Proposal 4)
**Current:** the flagship About box hand-writes size clamp, centering math, `endModal`+`remove`+refresh,
and a `CommandSink` to open it (~7 steps) — while a proven `runDialog` pattern sits in the editor.
**Required:** `await messageBox(app, { title, text })`.
**Fix:** general helpers on the shared host seam; editor helpers delegate.

## Dependencies

### Internal Dependencies
- P2 forward (`app.onCommand`) depends on P2's `EventLoop.onCommand` — same phase.
- P3's `messageBox` is used by the P3 `tvision-demo` update and (optionally) by P2's demo `about` wiring.
- Phases are independently shippable; recommended order P1 → P2 → P3 (demo proof accumulates).

### External Dependencies
- None (zero runtime deps).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Generalizing the quit sink regresses quit / the modal-cascade quit | Low | High | Spec test ST-9/ST-10 pin quit + open-modal cascade before the refactor (red first) |
| `'auto'` leaks past `createApplication` into the loop/host | Low | Med | Resolve to a concrete profile at the top of `createApplication`; ST-1..ST-3 assert the loop sees a real profile |
| Refactoring editor `infoBox`/`confirmBox` changes their behavior | Low | Med | ST-16/ST-17 pin their existing returns; the editor e2e (`editor-*`) must stay green |
| `check-jsdoc.mjs` fails on new exports missing `@example` | Med | Low | Each new export authored with an `@example`; guard runs in `verify` |
| Local `yarn verify` segfaults under load | Med | Low | Run package-isolated typecheck/test for signal (known env issue) |
