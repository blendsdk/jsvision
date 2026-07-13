# Current State: Out-of-tick Repaint (missing-flush audit)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)
> **Note**: This document is the issue #68 DoD deliverable — "a written audit of all mutators /
> `invalidate*` sites with their tick-safety classification." Classifications verified against the
> code this session (branch `feat/issue-68`).

## Existing Implementation

### What exists — the one-frame-per-tick mechanism

- The loop constructs its render root with a **no-op `schedule`** (`event-loop.ts:189-195`), so the
  render root never self-repaints; the loop owns timing.
- The **only** paint is the trailing trio at the tail of `runTick`
  (`event-loop.ts:375-377`): `renderRoot.flush(); onFrame?.(buffer()); emitCaret()`.
- Every loop-wrapped mutator routes through `runTick` (`dispatch` 215, `emitCommand` 270, `focus*`
  252-266, `execView`/`endModal` 304-324, `setTheme` 335). `resize` (232) and `mount` (203) paint
  inline (not via `runTick`).
- The render root **already** coalesces: `scheduleFlush()` guards with a `scheduled` flag
  (`render-root.ts:326-330`); `flush()` clears it and is a near-no-op when nothing is dirty
  (`render-root.ts:332-345`); `serialize()` force-flushes a pending frame (`render-root.ts:438`).
- Reactivity repaints indirectly: a `signal.set()` wakes any `effect` created by `View.bind()`
  (`view.ts:228-239`), whose body calls `invalidate()`/`invalidateLayout()` → `markRepaint`/
  `markRelayout` → `scheduleFlush()`. **The loop's no-op `schedule` is where that chain dies
  out-of-tick.**

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/ui/src/event/event-loop.ts` | The loop; owns the `schedule` seam + `runTick` paint trio | Coalesced painter, `paint()` extraction, `flushPending`, `stopped`, `stop()` (PA-5, PA-3, PA-11) |
| `packages/ui/src/event/types.ts` | `EventLoop` / `EventLoopOptions` public types | Add `EventLoopOptions.scheduleMicrotask`, `EventLoop.stop()` (PA-2, PA-3) |
| `packages/ui/src/app/run.ts` | Connects the loop to a real terminal | `finally` calls `loop.stop()` after `host.stop()` (PA-3) |
| `packages/ui/src/view/render-root.ts` | Coalescing already lives here | **No change** — reused as-is |

## The audit — `invalidate` / `invalidateLayout` classification

**41 call sites** total across `packages/ui/src` (definitions excluded). `packages/files/src` and
`packages/web/src` contain **zero**. Legend: **(a)** runs synchronously inside an
onEvent/key/command/mouse handler (loop wraps it in a tick → safe today); **(b)** can run **after an
async boundary / from a timer / from a direct public-API call between ticks** (out-of-tick → stale
today, fixed by Option A).

### ✅ Safe today — (a) only reached inside a tick (34 sites)

| Group | Sites | Why safe |
| ----- | ----- | -------- |
| Controls | `input.ts` ×8 (160,277,295,341,392,422,463,471), `cluster.ts` (130,144,160,176), `button.ts` (194,198) | fire from `onEvent`/key/mouse handlers → inside `dispatch` |
| Focus | `event/focus.ts` (109,113) | always wrapped by the loop's `focusInto`/`focusNext`; (b) reachable only via `removeWindow` teardown, which the shipped else-branch already ticks |
| Menu / status / editor chrome | `menu/controller.ts` (285,306), `status/statusline.ts` (116,121), `editor/edit-window.ts` (114), `editor/editor-draw.ts` (59) | menu nav / postProcess / resize handling during `dispatch` |
| Reactive-flush drivers | `view/dsl.ts` (286 Stack settle), `desktop/gestures.ts` (47,63,81 captured-drag) | run inside the paint/layout-settle pass or a capture-driven `onEvent` |
| WM (command-tick path) | `desktop/desktop.ts` (177 `raise`), `desktop/arrange.ts` (20), `window/window.ts` (208 `onDesktopResize`), `app/application.ts` (170,286), `theme-designer/app.ts` (313) | reached via a command tick / the loop's resize handler / build-time |
| Controls setup | `cluster.ts` (85 `setItemEnabled`) | widget-config mutator, typically setup/handler |

### ⚠️ Reactive path — (a)/(b): safe **iff** the driving signal is written in-tick (the systemic heart)

| Site | Trigger |
| ---- | ------- |
| `view/view.ts:236` (relayout branch), `view/view.ts:237` (repaint branch) | any `bind()` reader's signal changes — **(b) whenever the read signal is `.set()` from a timer/promise/stream.** No per-site fix exists; the "site" is every async signal write in every app |
| `view/group.ts` (93 `add`, 115 `remove`, 178 `startDynamic` reconcile) | structural / reactive `Show`/`For` reconcile — **(b)** when driven out-of-tick (e.g. `Desktop.removeWindow` async teardown, an out-of-tick `For` source) |

### ⚠️ WM public mutators — (a)/(b): safe via command tick; **stale if an app calls them directly between ticks**

| Site | Method | Fix |
| ---- | ------ | --- |
| `desktop/desktop.ts:183` | `cascade()` | Option A backstop (PA-4) |
| `desktop/desktop.ts:189` | `tile()` | Option A backstop (PA-4) |
| `window/window.ts:193` | `zoom()` | Option A backstop (PA-4) |

## Confirmed out-of-tick sources (the (b) evidence base)

### Genuine timers (write a signal from a `setTimer` callback → repaint via the `bind` effect)
| Site | Note |
| ---- | ---- |
| `feedback/run-spinner.ts:46` | `frame.set(frame()+1)` from a re-armed one-shot timer → a running `Spinner` does **not** visibly advance without incidental input. **Strongest repro (ST-1).** |
| `theme-designer/src/app.ts:250` | preview-blink `blinkLit.set(!blinkLit())` from a timer — same shape |
| `web/src/host.ts:152` | ESC-disambiguation timer — **self-healing**: it calls `onInput(event)` → `loop.dispatch` → a tick. Not a gap; noted for completeness |

### Async view-tree teardown (mutate the tree after `await`, out-of-tick)
| Site | Note |
| ---- | ---- |
| `dialog/message-box.ts:80` | `runDialog`'s `finally { removeWindow(dlg) }` — the exemplar; now self-healing via the shipped `removeWindow` else-branch |
| `window/window.ts:214` | `Window.close()` → `removeWindow(this)` — same async-teardown shape |
| `files/openers.ts:77,112`, `files/dialog/error-dialog.ts:57` | `removeWindow` in a modal-helper `finally` — inherit the same self-heal; Option A also backstops |

### Post-`await` mutations (editor / file-editor)
| Site | Note |
| ---- | ---- |
| `editor/editor-search.ts` (find/replace after `await ed.dialog()`), `editor/editor-actions.ts:64-72` (fire-and-forget `void ed.find()`) | mutate buffer/selection out-of-tick → `editorUpdate` → invalidate; backstopped by Option A |
| `files/editor/file-editor.ts` (89 `saveAs` title, 116/132 `modified.set`) | signal writes after `await this.dialog()` |

## Gaps Identified

### Gap 1: Out-of-tick mutations never flush
**Current:** an out-of-tick `invalidate*` marks dirty and calls the loop's **no-op** `schedule`; the
frame stays stale until the next input runs a tick.
**Required:** the mutation produces a painted frame on the next microtask, with no further input.
**Fix:** replace the no-op `schedule` with the coalesced painter (03-01, PA-1/PA-5).

### Gap 2: No lifecycle gate on the painter
**Current:** nothing tells the loop it has stopped; `run()`'s `finally` nulls `onFrame`/`onCaret`
(`run.ts:135-138`) but a microtask firing *during* `await host.stop()` could still write to a
stopping host.
**Required:** a hard gate that suppresses a deferred paint after teardown.
**Fix:** `EventLoop.stop()` + `stopped` flag; `run()` calls it (03-02, PA-3).

### Gap 3: Test blind spot
**Current:** existing suites call `renderRoot.flush()` manually, which paints regardless of the
loop's schedule — masking this entire class (headless stayed green while the real app was broken).
**Required:** painted-frame oracles that assert via `loop.onFrame`.
**Fix:** the new painted-frame suite + the injectable `scheduleMicrotask` seam (07, PA-2/PA-8).

## Dependencies

### Internal
- RD-04 event loop (`event/`), RD-03 render root (`view/render-root.ts`), the reactive `bind()` effect (`view.ts`).
- Downstream inheritors that wire the same loop: `@jsvision/web` `mountApp`, `@jsvision/theme-designer`, `@jsvision/files` dialogs.

### External
- None. Pure `@jsvision/core` + existing surface; no new runtime dependency (keeps `check:deps` green).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Redundant microtask after `resize()`/`mount()` produces an extra frame | Med | Low | `flushPending` cleared by every synchronous loop-paint → the microtask no-ops (PA-5); ST-5 guards it |
| A test asserting exact `onFrame` counts breaks | Low | Med | Only 3 such tests, all synchronous (no `await` after wiring `onFrame`) → stay green; full `yarn verify` re-run is a task |
| Caret drifts if the paint trio order is wrong | Low | High | `paint()` reuses the exact `flush → onFrame → emitCaret` order from `runTick`; documented in 03-01; caret checked in ST-1 |
| Double-paint of real content (tick + racing microtask) | Low | Low | `draining` guard skips scheduling in-tick; `flushPending` guard makes a racing microtask a no-op (PA-5); ST-4/ST-5 guard it |
