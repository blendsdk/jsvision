# Current State — accelerator-overlay

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0

Grounded map of the three mechanisms this feature builds on (all under `packages/ui/src/`, plus the
already-shipped decode fix). Cited `file:line`.

## 1. Accelerator handlers (7) — the uniform `~X~` match shape

The shared primitives live in `menu/builders.ts`: `parseTilde(label)` (`:61-69`) → `{ text, hotkey,
hotkeyCol }` (single-char, lowercased); `tildeSegments(label)` (`:80-104`) → color runs `{ text, hot,
col }` used by every drawer. Both re-exported (`menu/index.ts:10`). The match shape is uniformly
`inner.alt && parsed.hotkey !== null && inner.key.length === 1 && inner.key.toLowerCase() === parsed.hotkey`.

| Widget | Match site | Phase | Fire action | Accent draw (role) |
|--------|-----------|-------|-------------|--------------------|
| **Button** | `controls/button.ts:186-194` | postProcess (`:39`) | `activate` + emit command | `tildeSegments`, `buttonShortcut` (`:105,156-158`) |
| **Label** | `controls/label.ts:79-88` | postProcess (`:26`) | `ev.focusView(link)` | `tildeSegments`, `labelShortcut` (`:57,60-62`) |
| **Cluster** (Check/Radio/MultiCheck) | `controls/cluster.ts:130-140` | postProcess (`:34`) | select+press item + `focusView(self)` | `tildeSegments`, `clusterShortcut` (`:104-105`) |
| **MenuBar** | `menu/menubar.ts:94-97` | **preProcess** (`:29`) | `controller.topHotkey` (opens top menu) | redraw hot char, `menuBar.hotkey` (`:63-66`) |
| **TabView** | `tabs/tab-view.ts:332-338` | **preProcess** (`:179`), scoped to focused TabView (`:320`) | `select` tab | strip `tildeSegments`, `tab*.hotkey` (`tab-strip.ts:328-343`) |
| **StatusLine** | `status/statusline.ts:202-208` | postProcess (`:89`) | `emitCommand` | `tildeSegments`, `statusBar.hotkey` (`:130-131,144-145`) |
| **MenuController** (menu open) | `menu/controller.ts:362-371` | via menubar `:132` | `itemHotkey` — **plain letter**, no Alt | popup `menuBar.hotkey` (`popup.ts:118-122`) |

**StatusLine is the exception (AR-9):** it fires by full-chord label match `matchesChord(item.key)`
(`statusline.ts:65-74`), not the single-char `~X~` shape — so a `Ctrl+Q`/`F1` item cannot fire via a
synth-alt letter, though its `~X~` text accent still lights up.

Audited non-tilde `.alt` uses (open-dropdown gestures `combo-box.ts:177`/`history.ts:83`/
`date-picker.ts:154`/`color-picker.ts:224`, editor keymap, input word-delete) are **not** `~X~`
accelerators and are out of scope.

## 2. Event-loop key dispatch

`EventLoopImpl.route(ev)` → `route(ev, ctx)` (`event/event-loop.ts:285-287`). Every mutator funnels
through `runTick(work)` (`:231-250`): work → drain queue via `route` → `onIdle` → one `flush()`.
`route()` (`event/dispatch.ts:107-173`), in order:

1. scopeRoot guard (`:108-109`).
2. **keymap consume** — key bound in keymap ⇒ `emitCommand`, **return** (`:113-120`).
3. built-in Tab (`:122-128`).
4. **`ev2` enrichment** — one fresh envelope spread from `ev` with `emit`/`focusView`/`setCapture`/
   … sourced from `ctx`, the single additive-primitive seam (`:135-145`).
5. mouse/wheel branch → `hitTestRoute`, return (`:147-151`).
6. Phase-1 **preProcess** sweep, `if (ev2.handled) return` (`:153-158`).
7. Phase-2 **focus chain** leaf→scopeRoot, short-circuit (`:159-166`).
8. Phase-3 **postProcess** sweep, short-circuit (`:167-172`).

`scopeRoot()` = top modal subtree if modal, else `this.root` (`event-loop.ts:294-296`) — this is the
FR-4 scope for free. `RouteContext` shape at `dispatch.ts:22-59`, built in `routeContext()`
(`event-loop.ts:299-346`).

**Intercept point (AR-16):** immediately after the keymap block (`dispatch.ts:129`), before `ev2`
enrichment — the established "convert-a-key-before-views" location. F10 is the closest precedent but
is *not* router-special: it reaches `MenuBar.onEvent` via the preProcess sweep (`menubar.ts:98-103`).
Placing the arm intercept in `route()` itself is stronger — it sees the key before even preProcess
views (MenuBar/TabView), which is required so synth-alt reaches all handlers.

## 3. The `DrawContext.caps` threading seam (to mirror)

`caps` is a **plain field re-read every compose** (no Signal). Hops:
`RenderRootImpl.caps` (`view/render-root.ts:197,212`) → `fullCompose`/partial pass it into
`composeView(...)` (`:303,316-328`) → `composeView(..., caps, ...)` forwards to `makeDrawContext`
(`:135`) and recurses with the same `caps` (`:156`) → `makeDrawContext(..., caps)` closes over it and
returns `{ …, caps }` (`draw-context.ts:64-70,190`) → `DrawContext.caps` type (`view/types.ts:64`).

**Mirror for `revealAccelerators` (AR-17):** add one field at exactly those hops. Difference from
`caps`: the flag is **mutable** and changes at runtime, so a flip needs an explicit repaint —
`RenderRoot.markRelayout()` (`render-root.ts:260`) schedules a `fullCompose()` (`:290`) on the next
`flush()` (AR-14). Underline adds no width, so the relayout is geometrically a no-op but repaints all.

## What's missing (the gap this plan fills)

- No global "accelerator mode" state; no F12 handling anywhere (`grep 'f12'` = 0 hits).
- No way to fire an accelerator without a live Alt from the terminal.
- No scope-wide reveal flag on `DrawContext`; drawers have no "emphasize now" input.
