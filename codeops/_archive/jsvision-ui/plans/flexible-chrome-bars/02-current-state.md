# Current State — Chrome Bars

> Owning doc for current-code facts. Component docs (03-*) and the testing strategy (07) reference
> this by `file:line`; they do not restate it.

## StatusLine — `packages/ui/src/status/statusline.ts`

- `class StatusLine extends View` (statusline.ts:91). `items: readonly StatusItem[]`;
  `StatusItem = { text: string; command: string; key?: string }` (statusline.ts:17-24).
- **Monolithic paint.** `draw(ctx)` (statusline.ts:138) fills the row background then walks
  `itemBoxes()` (statusline.ts:116-126) — a hand-rolled left-pack: `x=0`, each item ` text ` span is
  `width = text.length + 2` (1-cell pad each side), abutting, `gap:0`. Each span is both the coloured
  region and the `[x, x+width)` hit-zone.
- **Interaction (single owner).** `postProcess = true` (statusline.ts:103). `onEvent` (statusline.ts:180):
  a mouse **down** captures the pointer (`seam.setCapture(this)`) and highlights the item under the
  cursor (no emit); **drag** re-targets the highlight via `itemAt(ev.local.x)`; **up** releases capture
  and emits the command of the item **under the release point** if enabled. Key events sweep `items`
  matching `matchesChord` (statusline.ts:63) and emit on the first enabled match.
- **Seam.** `attach(seam: StatusLoopSeam)` (statusline.ts:111): `emitCommand`/`isCommandEnabled`/
  `setCapture`/`releaseCapture`.
- **Builders.** `statusLine(items: StatusItem[]): StatusLine` (statusline.ts:248);
  `statusItem(text, command, key?): StatusItem` (statusline.ts:266) — `command` currently **required**.
- **Barrel** `status/index.ts`: exports `StatusLine`, `statusLine`, `statusItem`, types
  `StatusItem`, `StatusLoopSeam`, plus `Commands`/`CommandName` from `commands.ts`.

## MenuBar — `packages/ui/src/menu/`

- `class MenuBar extends View` (menubar.ts:40). `items: readonly MenuItem[]`;
  `MenuItem = {kind:'item',…} | {kind:'sub',…} | {kind:'separator'}` (builders.ts:30-33).
  `preProcess = true` (sees keys before the focused window).
- **Title geometry** is `layoutTitles(tops)` (builders.ts:145-155): `x = TITLE_MARGIN` (=1), each title
  ` name ` button `width = text.length + TITLE_PAD`, abutting. `titleIndexAt(tops, x)` (builders.ts:159)
  maps a column back to a title index. Both are **public exports** (`menu/index.ts`) with a direct impl
  oracle.
- **Draw** (menubar.ts:60) walks `layoutTitles(this.items)`, drawing each title with the
  `menuBar`/`menuSelected` palette and the `~hotkey~` accent; the open title uses the selected palette.
- **Navigation** is a separate `MenuController` created in `attach(overlay, seam)` (menubar.ts:60) from
  `this.items`. It drives ↑↓/←→/Enter/Esc/hotkeys and mounts dropdown `MenuPopup`s in the overlay.
- **Popup anchoring — the coupling.** `controller.ts` `openTop(index)` (controller.ts:197-201) reads
  `layoutTitles(tops)[index].x` to place the level-0 popup one column left of the title, one row below
  the bar. So the controller depends on `layoutTitles` for the title x. **If a title moves
  (right-align/spacer), the controller must compute the same moved x** (AR-8).
- **Seam.** `attach(overlay: Group, seam: MenuLoopSeam)` — `emitCommand`/`isCommandEnabled`/
  `focusView`/`getFocused`/`dismissAccelerators`.

## App shell — `packages/ui/src/app/application.ts`

- Root is a `col` group of `[menuBar?, desktop, statusLine?, overlay]` (application.ts:216-236).
- Each bar is sized fixed 1 row: **`opts.statusLine.layout = { size: { kind:'fixed', cells: 1 } }`**
  (application.ts:227) and the same for the menu bar (application.ts:222) — this **replaces** the
  bar's `layout`, so any internal `direction` would be dropped (AR-11).
- Bars are attached after mount: menu with the overlay + richer seam (application.ts:262-270), status
  with the capture seam (application.ts:269-275).
- On resize (application.ts:283-289) the overlay is re-fitted and `menu?.controller?.resize()` runs.

## Layout DSL — `packages/ui/src/view/dsl.ts`

- `row(...)`/`col(...)` return a `Group` with `layout.direction` set (dsl.ts:106-125). Children added
  in order; a `Flex` props object may lead (`gap`/`justify`/`align`/`padding` + `grow`/`fixed`/`fill`
  shorthands + `background`).
- `spacer(arg = 1)` (dsl.ts:180) returns an invisible `Empty` view sized `fr` (fill) or `{fixed:n}` —
  the flexible/hard gap primitive. The RD-02 engine already apportions it.
- The engine's 1-D solver (`solveTrack`/largest-remainder apportion) lives in
  `packages/ui/src/layout/apportion.ts` — the reuse target for the menu bar's flex titles (AR-6).

## Embeddable widgets

- `ProgressBar extends View` (feedback/progress-bar.ts): `measure()` returns `height: top ? 2 : 1`
  (progress-bar.ts:167) — the plain/inline-caption/left-right-label forms are **1 row**; only a `top`
  label is 2 rows. Bound to a `Signal<number>`; **self-repaints** via `this.bind()` on mount.
- `Spinner extends View` (feedback/spinner.ts): 1-row passive, caller-driven `frame`.
- Both are non-focusable, command-less leaves — natural passive segments.

## Immutable oracles that constrain this refactor

- **`app-shell.status.spec.test.ts`** — ST-19 (click+accelerator emit; disabled non-activatable),
  RD-10 ST-01 (press highlights green, no emit), RD-10 ST-02/03 (drag re-targets; release emits the
  item under the release point; off-item emits nothing). These assert **pixel columns**
  (`buf.get(2,statusY)`, `buf.get(8,statusY)`) — "File" span x0–5, "Edit" x6–11 — so the new layout
  must reproduce ` text `, `gap:0`, from column 0.
- **`app-shell.menu.spec.test.ts`** — ST-16 (F10/click/Alt open), ST-17 (nested nav: skip separator,
  sub-popup, Esc one level, ←→, Enter), ST-18 (activation/disabled/re-enable).
- **`app-shell.menu.impl.test.ts`** — `layoutTitles + titleIndexAt` default behavior (` name ` buttons
  from col 1, x↔index), right-edge popup clamp, TV popup width/box/shadow/right-aligned key.
- **`app-shell.packaging.spec.test.ts:49-51`** — `const statusEntry: StatusItem = statusItem(...)`
  **typed** and `.command` **read**; `statusLine([]) instanceof StatusLine`;
  `menuBar([subMenu('~F~ile', [])]) instanceof MenuBar`. **⇒ the retained `StatusItem` type must
  remain assignable from `statusItem()`'s return and expose `.command`** (AR-10).

## Backward-compat blast radius (Q2 / AR-10)

- 61 `statusItem(` call sites (examples, docs-site, theme-designer, files, kitchen-sink, tvision-demo,
  tests). All pass the result straight into `statusLine([...])` — compatible when `statusLine` takes
  `View[]` and `statusItem()` returns a view assignable to `StatusItem`.
- `packages/examples/kitchen-sink/shell.ts:99` already calls `statusItem('~Tab~ Sidebar↔Story')` with
  **no command** — legitimised by the optional-command design (AR-9).
- The only non-test `.command` read near status is `controls/input.ts:233` (reads
  `inner.command` off a *command event*, unrelated). No call site reads `.command` off a `statusItem`
  result except the packaging spec (handled by AR-10).
