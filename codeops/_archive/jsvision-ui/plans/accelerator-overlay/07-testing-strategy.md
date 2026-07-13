# 07 — Testing Strategy — accelerator-overlay

> **Feature**: jsvision-ui / accelerator-overlay · **CodeOps Skills Version**: 3.3.0

Spec-first (immutable `*.spec.test.ts` oracles derived from the FRs/ARs, never the implementation),
then `*.impl.test.ts` edges. Tests are headless: mount a tree in a `RenderRoot`/`EventLoop`, drive
synthetic key/mouse events, inspect the `ScreenBuffer` (for reveal) or command/focus effects (for
fire). Harness patterns exist in `packages/ui/test/app-shell.*.impl.test.ts`, `event.*.test.ts`,
`controls.button.spec.test.ts`. New files under `packages/ui/test/accelerator-*.{spec,impl}.test.ts`.

## Specification test cases

| ST | Traces | Setup | Assertion |
|----|--------|-------|-----------|
| **ST-1** | FR-1, AR-2 | Mount a dialog with a `~O~pen` Button + a `~N~ame` Label; `setRevealAccelerators(true)`, flush | The buffer cell at each hot glyph (`O`, `N`) has `Attr.underline` set on its accent style; base cells do not. `setRevealAccelerators(false)` → no underline anywhere. |
| **ST-2** | FR-2, AR-4 | App with a `~O~pen` Button (postProcess) in the focused window; arm mode; dispatch plain `key('o')` | The button activates — its command is emitted exactly as `key('o',{alt:true})` would — and the mode dismisses (`revealAccelerators` false after). |
| **ST-3** | FR-3, AR-1/AR-10 | App with the default `revealKey`; dispatch `key('f12')` | Accelerator mode turns on (`revealAccelerators` true; overlay underlines present). A second `key('f12')` turns it off (no residual underline). |
| **ST-4** | FR-4, AR-5 | Two overlapping windows, a modal `Dialog` open over a background window; both contain a `~O~pen` accelerator; arm; dispatch plain `key('o')` | Only the **modal's** Open fires; the background window's does not. Reveal underlines only the modal's hot glyph, not the background window's. |
| **ST-5** | FR-5, AR-3 | Arm mode, then (a) `key('escape')`; (b) a plain non-accelerator letter with nothing matching; (c) a mouse click | Each dismisses the mode: `revealAccelerators` false afterwards, buffer has **no** residual underline. Esc is consumed; (b)/(c) dispatch normally. |
| **ST-6** | FR-6, AR-8 | A dialog with a **disabled** `~O~pen` Button; arm | The disabled button's `O` is **not** underlined; a plain `key('o')` does **not** activate it. |
| **ST-7** | FR-7, AR-7 | A MenuBar with a `~F~ile` menu open; arm was on beforehand | Opening the menu dismissed accelerator mode; while the menu is open a plain `key('n')` routes to the menu item (`controller.itemHotkey`), not a synth-alt fire. |
| **ST-8** | FR-8, AR-10 | (a) `revealKey: null`; (b) `revealKey: 'f9'` | (a) `key('f12')` does nothing (no mode, no intercept, dispatches normally). (b) `key('f9')` toggles the mode; `key('f12')` does not. |
| **ST-9** | AR-4 (collision) | Two `~O~pen` Buttons in the same scope; arm; plain `key('o')` | The first in dispatch order (preProcess→focus→postProcess) fires — identical to dispatching `key('o',{alt:true})` in the same tree. |
| **ST-10** | FR-2, AR-9 | A StatusLine with a `~S~ave` item whose chord is `Alt+S`, and a `~Q~uit` item whose chord is `Ctrl+Q`; arm | Reveal underlines both `S` and `Q`. Plain `key('s')` fires Save (Alt+S matches). Plain `key('q')` does **not** fire Quit (Ctrl chord; documented limitation). |
| **ST-11** | NFR-1/NFR-2 (packaging) | Import surface | `DrawContext` carries `revealAccelerators`; `EventLoopOptions` accepts `revealKey`; **no** new `@jsvision/core` export is added (assert `@jsvision/core` surface unchanged vs a snapshot / underline uses the existing `Attr`). |

## Impl test cases (edges)

- **IT-1 (re-entrancy):** the synthesized `alt:true` event cannot re-trigger the armed branch (no
  infinite loop) — arm, dispatch `key('o')`, assert exactly one activation and a terminated tick.
- **IT-2 (coalesced frame, AR-14):** a single F12 toggle produces exactly one frame/`onFrame` call;
  `revealAccelerators` change routes through `markRelayout`/`fullCompose` once.
- **IT-3 (TabView scope):** reveal underlines the focused TabView's tab hotkeys; an unfocused
  TabView's are not armed-fired by a plain letter (`isWithin` scope, `tab-view.ts:320`).
- **IT-4 (Cluster family):** a `~Y~es` CheckGroup / `~R~ed` RadioGroup / MultiCheckGroup hot label
  underlines on reveal and its item is selected by a plain letter when armed.
- **IT-5 (MenuBar top hotkey):** armed plain `key('f')` opens the `~F~ile` top menu (synth-alt →
  MenuBar preProcess) and dismisses accelerator mode in the same tick.
- **IT-6 (no-op letter):** armed plain letter with no matching accelerator dismisses and changes
  nothing on screen.

## Kitchen-sink smoke (AR-11)

`test/kitchen-sink.smoke.spec.test.ts` gains the new story: mount headlessly, arm reveal, assert at
least one hot glyph gains `Attr.underline`; unique id + required metadata.

## Verify

`yarn verify` + `yarn lint` (AR-12).
