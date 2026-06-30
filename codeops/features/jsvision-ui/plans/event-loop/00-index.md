# Event Loop + Focus + Modality + Commands — Implementation Plan (Index)

> **Implements**: jsvision-ui/RD-04
> **Feature**: `@jsvision/ui` event loop — the host-agnostic dispatch **mechanism** that makes
> the RD-03 view/group spine interactive. A pure `EventLoop` with `dispatch(event)`, faithful
> 3-phase (pre/focus/post) dispatch, a per-group `current` focus chain (Tab/Shift-Tab + click),
> top-most-first mouse hit-testing, a typed command layer (registry + `enable/disable` + a
> core-`Keymap` key→command binding), and async modality (`execView`/`endModal`). The loop
> **builds** and drives RD-03's `RenderRoot` one frame per dispatch tick. Concrete
> `Application`/`run()`/shell → RD-05.
> **Status**: Planning Complete (ready for exec_plan)
> **Created**: 2026-06-30
> **CodeOps Skills Version**: 3.0.0

---

## Overview

RD-04 turns the RD-03 spine from a self-drawing-but-inert tree into an **interactive** one. The
spine already composes, reflows, themes, and reactively repaints — but `View.onEvent` is a stub
and `state.focused`/`state.disabled` are never driven. RD-04 is the **dispatch engine**: it
consumes already-decoded `@jsvision/core` `InputEvent`s through a single pure `dispatch(event)`
entry, routes them through Turbo Vision's 3-phase model, moves focus along a per-group `current`
chain, raises and routes typed commands, runs an async modal stack, and drives exactly **one**
coalesced frame per dispatch tick.

The engine is **pure** (AR-49): there is no TTY dependency, so focus, dispatch, modality, and
commands are unit-testable with synthetic events — exactly how `@jsvision/core`'s decoder is pure
and RD-03's scheduler is injectable. The real terminal is wired by a thin host adapter in RD-05's
`run()`; RD-04 ships only the mechanism RD-05 composes (AR-47, AR-55).

The build is **additive** on three done subsystems and introduces **no** cross-package primitive
(unlike RD-03). New code lives under `packages/ui/src/event/`, re-exported through the single
`@jsvision/ui` entry point; the only edits to existing code are additive `View`/`Group` fields and
the event-handler contract types in `view/types.ts` (PA-8). No third-party/native runtime deps.

## Document map

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — plan decisions PA-1…PA-9 + inherited RD AR-47…AR-66 |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria (sourced from RD-04) |
| [02-current-state.md](02-current-state.md) | What exists, patterns to mirror, target file/test layout |
| [03-01-foundation-types-and-view-surface.md](03-01-foundation-types-and-view-surface.md) | The `DispatchEvent` envelope + `CommandEvent`/`AppEvent`/`EventLoop` types; additive `View.focusable`/`preProcess`/`postProcess` + `onEvent(DispatchEvent)`; `Group.current`; `createEventLoop` building + owning the `RenderRoot` (schedule seam, one-frame-per-tick, `resize`, `onIdle`, handler-error isolation) |
| [03-02-dispatch-commands-keymap.md](03-02-dispatch-commands-keymap.md) | The 3-phase dispatch pipeline (`handled` short-circuit); the command registry (`emitCommand`/`enableCommand`/`isCommandEnabled`); core-`Keymap` key→command (consume) |
| [03-03-focus-and-mouse.md](03-03-focus-and-mouse.md) | The focus manager (per-group `current` chain, focusable predicate + subtree semantics, Tab/Shift-Tab wrap, `focusView`/`getFocused`, save/restore, focus-flip repaint); mouse hit-test (1-based→0-based normalize, top-most-first, view-local on the envelope) + focus-on-click |
| [03-04-modality-loop-assembly-demo.md](03-04-modality-loop-assembly-demo.md) | Modality (`execView`/`endModal`, modal stack, input capture, nested LIFO, save/restore-around-modal); the `EventLoop` assembly + packaging; the headless `demo:events` |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases ST-01…ST-20 (↔ RD-04 AC-1…AC-20) + impl tests |
| [99-execution-plan.md](99-execution-plan.md) | Phases, sessions, task checklist (spec-first ordering) |

## Quick reference

### Usage example (the shape RD-05 will compose)

```ts
import { createEventLoop, Group, View } from '@jsvision/ui';
import { createKeymap, resolveCapabilities } from '@jsvision/core';

const loop = createEventLoop(
  { width: 80, height: 24 },
  { caps: resolveCapabilities(), keymap: createKeymap({ 'ctrl+q': 'quit', 'enter': 'ok' }) },
);
loop.mount(buildAppTree());          // mounts into the loop-built RenderRoot
loop.focusNext();                    // programmatic focus move (one coalesced frame, PA-11)
loop.dispatch({ type: 'key', key: 'tab', ctrl: false, alt: false, shift: false }); // built-in: Tab → focusNext (PA-10)
const result = await loop.execView(dialog);   // modal; resolves on endModal(result)
// RD-05's run() will wire createHost({ onInput }) → loop.dispatch
```

### Key decisions (at a glance)

| Decision | Choice | Ref |
|----------|--------|-----|
| Keymap-bound key | **consume** (chord ⇒ command, raw key not also dispatched) | PA-1 |
| Pre/post sweep flag | additive `View.preProcess`/`postProcess` booleans (default false) | PA-2 |
| Unknown command | **enabled by default**; explicit `enableCommand(name,false)` blocks | PA-3 |
| `endModal` drivers | **explicit only**; Esc/cmCancel defaults → RD-05 | PA-4 |
| `focusView(non-focusable)` | **no-op** | PA-5 |
| Click outside modal | **ignored** (bell → RD-05) | PA-6 |
| Files | new granular `src/event/` split (mirror `view/`) | PA-7 |
| Additive surface | edit RD-03 `view.ts`/`group.ts`; contract types in `view/types.ts` | PA-8 |
| Demo | headless `demo:events` (mirror `demo:view`) | PA-9, AR-59 |
| `handled` carrier | `DispatchEvent` envelope (core events stay readonly) | AR-60 |
| Frame ownership | loop **builds** the `RenderRoot`, drives one flush/tick | AR-61, AR-64 |
| Keymap | reuse core `createKeymap`/`Keymap` (`'ctrl+q'`) | AR-62 |
| Tab key | built-in `tab`/`shift+tab`→focus traversal (consumed; keymap overrides) | PA-10 |
| Frame ticks | one `runTick` for every public mutator (drain → one flush) | PA-11 |
| Modal capture | Phase-2 focus bubble clamped to the modal scope root | PA-12 |

## Related files

- **New:** `packages/ui/src/event/{types,dispatch,commands,focus,hit-test,modal,event-loop,index}.ts`
- **Edited (additive):** `packages/ui/src/view/view.ts`, `packages/ui/src/view/group.ts`, `packages/ui/src/view/types.ts`, `packages/ui/src/index.ts` (barrel re-exports)
- **New (demo):** `packages/examples/event-demo/main.ts` + `"demo:events"` script + `packages/examples/test/event-demo.e2e.test.ts`
- **New (tests):** `packages/ui/test/event.{loop,dispatch,commands,focus,mouse,modal,packaging}.{spec,impl}.test.ts`

## To begin implementation

Use the **exec_plan** skill on `event-loop`. Commits reference **/gitcm** / **/gitcmp**; the
verify command is `yarn verify` (per the project CLAUDE.md). Scoped iteration:
`yarn workspace @jsvision/ui test`. Commit scope: `event` for the loop, `view` for the additive
`View`/`Group` edits, `examples` for the demo.
