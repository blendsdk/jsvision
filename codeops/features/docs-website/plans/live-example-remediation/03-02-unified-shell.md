# 03-02 — Workstream B: Unify the demo shell (draggable-Window)

> Bugs #4, #5, #6 · AR-1, AR-5, AR-12, AR-13, AR-17 · Phase 2 (AR-7 order).

## The target shell (AR-1)

ONE consistent chrome for every example:
- A **desktop** (patterned background) with a **menu bar** = `System` (About) / `View` (Theme, Depth),
  and a **Window** menu added only for window-managing examples (AR-12).
- A **status line** carrying **hotkey hints only** (`F1 About  F10 Menu`, plus window hints for the
  desktop) — the primary Theme/Depth/About controls live in the menu, not the footer (#5).
- Every **component** demo runs inside a **titled, movable, zoomable, non-closable Window** on the
  desktop (AR-5). The component's cells sit on the Window's clean interior surface, not the desktop
  dot pattern (#4). The Window is inset a cell within the desktop so the pattern frames it (matching
  the chosen mockup).
- The **desktop** example uses this same shared chrome (+ the Window menu) instead of its own — its
  Theme/Depth become reachable (the current unreachable-handler defect, #6).

## Registry: `kind` replaces `chrome`

`packages/docs-site/examples/index.ts` — `ExampleEntry.chrome: 'minimal'|'full'` →
`kind: 'component' | 'app'`. The distinction is now honest and load-order-safe (demoShell must size
before building):
- `component` — `build()` returns a bare `View`; demoShell wraps it in a stage Window.
- `app` — `build()` returns a whole `Application` (it owns its desktop content: the desktop example,
  the dialog examples). demoShell only wires shared commands onto it.

Map the 8 entries: `controls/button`·`controls/input`·`containers/list-box`·`table/data-grid`·
`theming/preset-gallery` → `component`; `controls/form-dialog`·`files/file-dialog`·`apps/desktop` →
`app`. Update the parity test (`test/*`) to require `kind ∈ {component, app}`, and swap the test
harness `fakeEntry`'s `chrome` param → `kind` (`test/helpers/play-harness.ts`).

## `packages/docs-site/src/demo-shell.ts`

**Interface change** — demoShell defers building so it can size the component to the Window interior:
- `DemoShellOptions`: replace `content: Application | View` with `build: (ctx: ExampleContext) =>
  Application | View` + `title: string` + `kind: 'component' | 'app'`. Keep `caps`, `viewport`,
  `theme?`, `onDepthChange?`.
- `demoShell(opts)`:
  - `kind === 'app'`: `const app = opts.build(fullCtx) as Application; wireCommands(app, opts); return
    app;` (the example built its chrome via `demoApp`).
  - `kind === 'component'`: `shellForView(opts)`.

**`demoApp(ctx, opts?)`** — drop the `chrome` parameter; add `opts.windowMenu?: boolean`:
```
createApplication({
  caps: ctx.caps,
  viewport: { width: ctx.width, height: ctx.height },
  theme: turboVisionTheme,
  menuBar: buildMenuBar({ windowMenu: opts?.windowMenu ?? false }),
  statusLine: buildStatusLine({ windowMenu: opts?.windowMenu ?? false }),
});
```

**`shellForView(opts)`** — the component path:
1. `const app = createApplication({ caps, viewport, theme, menuBar: buildMenuBar({ windowMenu:false }),
   statusLine: buildStatusLine({ windowMenu:false }) });`
2. Compute the stage Window rect: the desktop area is `viewport` minus the menu row and status row
   (`app.desktop.bounds`); inset the Window by a 1-cell margin. `winRect = { x:1, y:0, width:
   dw−2, height: dh−1 }` (values tuned so the pattern frames the window).
3. `const win = new Window(opts.title); win.closable = false; win.layout.rect = winRect;`
   (`zoomable`/`movable` already default `true` — window.ts:99/103; no need to re-set). **The Window's
   `layout` is `{ position:'absolute', padding:1 }` (window.ts:81)** — the `padding:1` insets an
   absolute child by one cell past the border, so the component is placed at `{0,0}` and sized to the
   interior below; do NOT add an extra margin (avoids the known double-inset gotcha).
4. Build the component at the **Window interior** size (frame eats 1 cell each side + the title row):
   `const view = opts.build({ width: winRect.width − 2, height: winRect.height − 2, caps }); win.add(view);`
   — the interior placement of `view` fills `{0,0,interiorW,interiorH}` (absolute).
5. `app.desktop.addWindow(win); wireCommands(app, opts); app.loop.resize(viewport);` (settle + paint).

**`buildMenuBar({ windowMenu })`** — `System` (About) + `View` (Theme submenu over the 13 presets,
Depth submenu) + (if `windowMenu`) a `Window` menu (`Next`/`Zoom`/`Cascade`/`Tile`/`Close` on the
existing `Commands.*`). The Theme/Depth submenus + command names are unchanged from today.

**`buildStatusLine({ windowMenu })`** — a consistent hint row `~F1~ About  ~F10~ Menu`; when
`windowMenu`, append `~F5~ Cascade  ~F4~ Tile  ~F6~ Next`. No primary Theme/Depth controls in the
status line (that was #5).

**`wireCommands`** — unchanged in substance: registers the shared About (`messageBox`), the 13
`demo.theme.N` and 4 `demo.depth.D` handlers, and the `demo.theme.cycle`/`demo.depth.cycle` (now
unused by the status line — keep for any caller, or drop; low-risk either way, drop to avoid dead
code). `placeContent`/`intendedSize` (the old bare-on-desktop centering) are **removed** — the
component now lives in a Window.

## `packages/docs-site/examples/apps/desktop.ts` (the #6 concrete fix)

Replace the self-built chrome: `createApplication({... menuBar: menuBar([...]) , statusLine: ...})`
→ `demoApp(ctx, { windowMenu: true })`. Remove the example's own `≡`/`Window` menu, its status line,
and its own `about` command + handler (the shared `System ▸ About` + `wireCommands` provide it). Keep
`app.desktop.shadow = true` and the two `Window`s (Welcome, Tips) it adds. Result: the desktop
example shows the SAME `System`/`View`/`Window` menu as every other example, and Theme/Depth work.

## Controller wiring

`packages/docs-site/src/play/play-controller.ts` `open()` — pass the deferred build + title + kind:
```
const app = demoShell({
  build: (ctx) => def.build(ctx),
  title: def.title,
  kind: opts.entry.kind,   // was opts.entry.chrome
  caps, viewport: dims, onDepthChange,
});
```
(`dims` is the terminal-driven size from 03-01.) Only `ExampleEntry` swaps `chrome` → `kind`;
`play-controller.ts:134` reads `entry.kind` instead of `entry.chrome`. **`PlayExample.vue` does NOT
reference `chrome`** (it passes the whole `entry` to `createPlayController`), so the rename does not
touch it — its only edits are the Phase-1 resize/wheel changes.

## Coverage (AR-17)

`packages/docs-site/test/*` — a DemoShell test asserts:
- a `component` example is wrapped in a `Window` with `closable === false`, titled with the example
  title, whose interior hosts the component (the component's cells render on the Window surface, not
  the desktop pattern — assert a sampled interior cell's background is the window role, not the
  desktop pattern glyph);
- an `app` example (desktop) is returned with the shared menu bar present (a `Window` menu item
  exists) and the shared About handler registered;
- the status line contains no `demo.theme.*`/`demo.depth.*` primary command (hints only).

Pixel look (flat shadow on the window surface, #4) → the manual browser checklist (07 §Manual).

## Test migration (AR-19)

The `content → build/title/kind` interface change + the `chrome → kind` rename break existing RD-03
tests that must be migrated in this phase (verified file-by-file in the preflight):

- **Supersede / rewrite (spec oracles, AR-19):** `demo-shell.spec.test.ts` — **ST-4** (`:62`, *directly
  contradicted*: asserts "no menu bar" + Theme/Depth/About in the status line → rewrite to the unified
  shell: a menu bar on row 0, hints-only status); **ST-5** (`:80`) + **ST-9** (`:93`) (rewrite the
  `content:`/`chrome:` calls; ST-9's live-`setTheme` assertion survives). `play-controller.spec.test.ts`
  — **ST-7** (`:43`, "full chrome paints a menu bar") + its `fakeEntry('minimal'|'full',…)` calls
  (`:31,46,60,76,95,99,115`).
- **Signature migration (compile-breaks on the rename):** `paint-smoke.spec.test.ts:37`
  (`chrome: entry.chrome` → `kind: entry.kind`); `demo-shell.impl.test.ts:43,59`;
  `security.spec.test.ts:34`; `test/helpers/play-harness.ts` `fakeEntry` (`:38,45`, param `chrome` →
  `kind`); `registry.spec.test.ts:6` + `examples/_contract.ts:27,34` (JSDoc mentions — accuracy only).

New ST-B1…ST-B5 (07) are added alongside the rewritten oracles.
