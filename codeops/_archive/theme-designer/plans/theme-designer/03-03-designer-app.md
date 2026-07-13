# Designer App: Theme Designer

> **Document**: 03-03-designer-app.md
> **Parent**: [Index](00-index.md)
> Lives in `packages/theme-designer/src/` (view + shell + host). The reactive shell over the pure model (03-02).

## Overview

The interactive three-pane TUI (AR-12), matching the approved mockup: a menu bar, three flex panels
(roles rail · live preview · inspector), and a status bar. It binds the `DesignerModel` to widgets so every
edit repaints the preview via `Application.setTheme`. On a real terminal it runs live; piped, it runs a
narrated headless walkthrough that composes and prints frames (AR-11, the e2e path).

## Architecture

`createApplication` hosts a full-screen `Group` column: `[menuBar, workspace(fr:1), statusLine, overlay]`.
The `workspace` is a `row` of three panels sized `fixed`/`fr`/`fixed`. Panels are framed `Group`s (not
movable `Window`s) — no draggable splitter (deferred, AR-7). The app registers as the popup/modal host so
`FileDialog`, `messageBox`, and dropdowns work.

### File map (`packages/theme-designer/src/`)

```
main.ts                 # entrypoint: TTY split (live vs headless walkthrough) + launcher
app.ts                  # createDesignerApp(model, host): composes the app + wires commands
model/                  # the pure DesignerModel (03-02) + hex-validator
view/
  roles-panel.ts        # left rail: 16 aliases + "Advanced roles" section (a ListView/rows), selects target
  preview-panel.ts      # center: the curated widget gallery, themed live
  inspector-panel.ts    # right: color picker (R/G/B Sliders + hex Input + ColorSwatch) + contrast + depth
  gallery.ts            # the sample widget scene builder (window/menu/buttons/input/checks/list/progress/status)
host/
  file-io.ts            # the ONLY fs surface: open/save via @jsvision/files FileDialog + read/write
  walkthrough.ts        # headless narrated frame walkthrough (piped mode)
```

## Implementation Details

### Left rail — `roles-panel.ts` (R1/R2, AR-13)

A scrollable list: the 16 aliases (each with a color chip + name + hex, the color read from
`model.resolvedAliases()`), then an "Advanced roles" section listing the 63 roles (colors from
`model.theme()`). Selecting a row calls `model.select(target)`. The current target is highlighted. Uses the
existing `ListView`/`ListRows` + `ScrollBar`. In roles mode, selecting/editing an alias transitions the model
to derive mode (03-02).

### Center — `preview-panel.ts` + `gallery.ts` (R5, AR-5)

`gallery.ts` builds a fixed-size `Group` of themed widgets exercising the roles a user cares about: a framed
window with a title, a menu strip (one highlighted), default + normal + disabled `Button`s, a labelled
`Input`, a `CheckGroup` + `RadioGroup`, a `ListView` with a selected row, a `ProgressBar`, and a status row.
It is a **preview** (not wired to real commands) so it can't steal focus. The panel repaints when
`model.theme()` changes — the app calls `app.setTheme(model.theme())` in an `effect`, coalesced to one frame.

### Right — `inspector-panel.ts` (R3/R6/R7)

- **Picker:** a `ColorSwatch` (DOS-16) + a hex `Input` (custom `#rrggbb` validator) + three horizontal
  `Slider`s (R, G, B; min 0 max 255). All bound so editing any one updates `model` for the selected target
  and re-syncs the others (the ColorPicker two-way idiom, RGB-equality-guarded to avoid loops). Live drag →
  `onInput` → `model.setAlias`/`setRole`; commit → `onChange`.
- **Contrast:** renders `contrastRows(model.theme())` — pair · ratio · AA/AAA/fail badge (AR-14).
- **Depth:** a strip shows `depthSamples(model.colorOf(selected))` — the selected color at
  truecolor/256/16/mono (display-only). The whole-preview re-render at a chosen `ColorDepth` is **out of
  scope**: the app has a single `RenderRoot` whose `caps` is immutable, with no in-scope mechanism to switch
  it at runtime (00-preflight-report PF-004). A `setDepth` toggle can still record the previewed depth in
  state for the sample strip, but it does not re-render the gallery.

### Menu + status (R14)

- **File:** Open (`Alt+I`/`F3`), Save (`F2`), Save As, Quit (`Alt+X`) — via `onCommand`.
- **Theme:** the 7 presets, Reset.
- **View:** selects which depth the inspector's sample strip highlights (truecolor/256/16/mono); it does not
  re-render the gallery (see §Depth / PF-004).
- **Status line** mirrors the mockup's bindings.

### File I/O — `host/file-io.ts` (R9/R10, AR-4/20/21)

The sole fs boundary. It reuses the existing `@jsvision/files` **`openFile(host, opts)`** opener (which wraps
add-window → `execView` → remove-window and returns `Promise<string | null>`) rather than driving
`FileDialog` by hand. Open → `openFile(app)` → on a path, `nodeFileSystem.readFile(path)` → `model.importJson`
(catch `InvalidThemeError` → `errorBox`/`messageBox`, model untouched) → on success `markSaved`. Save/Save As
→ `openFile(app, { save: true })` → `writeFile(path, model.exportJson())` → `markSaved`. `null` (cancel) →
no-op.

### Unsaved-changes guard (R11, AR-24)

Before Open, Load-preset, and Quit: if `model.state().dirty`, `await confirm(app, 'Discard unsaved changes?')`;
proceed only on yes.

### Headless walkthrough — `host/walkthrough.ts` (R12)

Piped (no TTY), drives the model through: initial → edit an alias → override a role → load a preset →
change depth → show contrast → export JSON, composing each step's widget gallery under the current theme +
depth into a `ScreenBuffer` and printing an ASCII frame (the `themes-demo` `printFrame`/`capsFor` pattern).
This is the deterministic e2e oracle.

## Integration Points

- `createApplication({ statusLine, menuBar, caps })`, `app.onCommand`, `app.setTheme` (live repaint),
  `app.run()`; the app is the `ExecHost`/`ModalDialogHost` (for `openFile`/`messageBox`/`confirm`).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Import parse/validate failure | `messageBox` with the error; keep current theme; never crash | AR-20 |
| Save write failure (fs error) | `messageBox` with the error; stay dirty | AR-21 |
| FileDialog cancelled | no-op | AR-24 |
| Launch without a TTY | run the headless walkthrough (not the live app); exit 0 | AR-11 |
| Quit/open/preset with unsaved edits | `confirm` gate | AR-24 |

> **Traceability:** see `00-ambiguity-register.md`.

## Testing Requirements

- App-core assertions on a headless `Application` (injected input/output, `requireTty:false`): target select loads picker (ST-24), slider edit → setTheme repaint (ST-25), dirty guard (ST-26), open/save via a fake `FileSystem`/FileDialog (ST-27/28), invalid import → error + unchanged (ST-29).
- Headless walkthrough e2e renders non-empty frames for every step (ST-23).
