# 02 — Current State

> Verified against the real code during the RD-07 preflight (6 recon agents + 1 challenger). Every
> `file:line` below was read, not assumed.

## `Input` — the control we extend (`packages/ui/src/controls/input.ts`, 212 lines)

- Fields: `value: Signal<string>` (:38), `maxLength` (:40), `validator?: Validator` (:42), `curPos` (:44),
  `firstPos` (:46) — `curPos`/`firstPos` are **plain JS string indices** (not grapheme-aware → PA-1).
- `draw()` (:100-109) paints the value from `firstPos` at column 1 + the `◄`/`►` arrows (`◄`/`►`);
  it renders **no caret cell** today (→ logical caret is new).
- `onEvent` (:131-140) handles only `type==='mouse'` (:133) and `type==='key'` (:137) — **no `'paste'`**
  branch (→ paste is new).
- `handleKey` (:143), `insertPrintable` (:176) calls `validator.isValidInput(candidate)` (:182) live.
- Headroom for the additions: 212 → target < 500 lines (split a `input-selection.ts`/`input-clipboard.ts`
  helper if it approaches the limit).

## `Validator` model (`controls/validators/`)

- Interface `{ isValidInput(s): boolean; isValid(s): boolean; error?: string }` (`types.ts:9-16`).
- Factories: `filter` (`filter.ts:17`), `range` (`range.ts:27`), `lookup` (`lookup.ts:15`); barrel
  `validators/index.ts:7-10`. `picture` will be the **fourth**, same shape.

## `Cluster` base (`controls/cluster.ts`)

- Abstract `mark(i): boolean` (:49), `press(i): void` (:51), `box(): ClusterBox` (:53); hook `movedTo(i)`
  (:54-57). `ClusterBox` = 5-cell `{ icon, on, off }` (:17-24). `draw()` (`cluster.ts:78-96`) paints the box
  and — crucially — the col-2 marker as a **boolean 2-state** glyph: `ctx.text(2, i, this.mark(i) ? on : off, base)`
  (:91). `CheckGroup` (`box()` = `{ ' [ ] ', on:'X', off:' ' }`) and `RadioGroup` (`{ ' ( ) ', on:'•', off:' ' }`)
  extend it. **`MultiCheckGroup` does NOT fit this seam unchanged (PF-001):** a multi-**state** marker
  (`states[value[i]]`, `selRange > 2`) cannot be produced by the boolean `mark(i)`/`on`/`off` triple — the base
  must first be generalized to TV's marker-**string** model (see 03-03 §"Cluster base change (PF-001)").
  Turbo Vision unifies all three via a single `drawMultiBox(icon, marker)` indexed by `multiMark(item)`
  (`tcluster.cpp:87-129`); our TS base collapsed that to a boolean and must restore it.

## DispatchEvent seams (`view/types.ts`)

- `emit?` (:107), `focusView?` (:112), `setCapture?` (:118), `releaseCapture?` (:120) — sourced onto every
  routed envelope in `event-loop.ts:206-239`. No new dispatch primitive needed for RD-07.

## Caret seam surfaces (all additive)

- `View` (`view/view.ts`): overridable `draw`/`onEvent`/`focusable`/`pre`/`postProcess`/`focusSignal` — **no
  caret concept** → add `desiredCaret(): Point | null` (default null).
- `RenderRoot` (`view/render-root.ts:95-142`): `composeView` already tracks `absOrigin: Point` + a per-view
  cache — add an absolute-caret collection step (private); public iface `{mount,resize,flush,serialize,buffer}`
  unchanged.
- `EventLoop` (`event/event-loop.ts:53,176`): `onFrame?: (buffer) => void` fires after `flush()` in `runTick`
  (:176), `resize`, `mount` — add a sibling `onCaret?: (cell|null) => void` fired at the same points.
- `run()` (`app/run.ts:79`): currently `ctx.loop.onFrame = (buffer) => host.render(buffer)`. `run()` receives
  the output stream via `RunContext.output` (:34-35, passed to `createHost` :50-55) → it **co-owns** the
  stream and writes `cursor.to()/show()/hide()` after `host.render` (PA-5).
- Host: the `Host` interface exposes only `render(buffer)` (`core/host/types.ts:76-85`) — **no core change**;
  on SIGCONT the host re-asserts modes + repaints the last buffer (`host/signals.ts:110-124`) but not the
  caret, so `run()` re-applies it on `onResume`.

## Core infra reused as-is (`@jsvision/core`)

- `setClipboard(text, caps)` — OSC-52, gated on `caps.osc.clipboard52`, base64 + `sanitize`, `''` no-op
  (`render/osc.ts:47-49`; exported `index.ts:62`).
- Bracketed `PasteEvent { type:'paste', text, truncated }` + `PASTE_CAP_BYTES=1_048_576`
  (`input/events.ts:45-49,131`); already routed to the focused view by `route()`.
- `cursor.show()/hide()/to(row,col)` (`render/cursor.ts:14-29`; exported) — **pure string builders**;
  `run()` writes them to the output stream.
- Input decoder emits every needed chord (Shift/Ctrl-Shift arrows, Shift+Home/End, Ctrl+A, Ctrl/Shift+Ins/Del)
  — verified in `input/keys.ts:176-193,225-235,246-252` + `input-keyboard.impl.test.ts`.

## `Theme` + `Commands`

- `Theme` (`core/color/theme.ts`): `inputNormal` (:88, slot 19, `0x1F`), `inputSelected` (:90, slot 20,
  `0x2F` — the focused **field**, NOT text selection), `inputArrows` (:92, slot 21, `0x1A`). RD-07 adds a
  4th `inputSelection` role (PA-4; color = `cpInputLine` color-3, decoded at GATE-1, PA-6). `ThemeRoleName =
  keyof Theme` (`view/types.ts:29`) → a new core role is automatically usable via `ctx.color`/`ctx.role`.
- `Commands` (`ui/status/commands.ts:12-37`): `quit/close/zoom/next/prev/cascade/tile/ok/cancel/yes/no` — no
  `cut/copy/paste` yet (additive add, PA-7).
