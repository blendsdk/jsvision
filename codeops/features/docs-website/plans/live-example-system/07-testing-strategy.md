# 07 — Testing Strategy

Spec tests are immutable oracles derived from RD-03's ACs + the register. Expectations come from the
spec, never from imagined implementation. Test mechanism favors a **pure vitest render-root
paint-smoke** (each example's `demoShell` app read via `app.loop.renderRoot.buffer()` — deterministic,
no xterm); `@xterm/headless` only where a real `Terminal` is required
(mount/leak/reclaim); a few docs-glue facts are asserted as **static text checks** on the `.vue`/`.md`
sources (no jsdom — matching the project's no-jsdom convention).

All tests live in `packages/docs-site/test/**/*.{spec,impl}.test.ts`.

| ST | Traces | Input | Expected |
|----|--------|-------|----------|
| **ST-1** | AC-6, AR-5 | The `EXAMPLES` registry + the `examples/**/*.ts` file list. | Every file has exactly one entry (matching `sourcePath`) and vice-versa; every entry has a unique `id` and non-empty `title`/`blurb`. |
| **ST-2** | AC-6, AR-3 | Each registry entry, built via `demoShell(...)` (→ `Application`) and read from the app's own render root (`app.loop.renderRoot.buffer()`) at 80×24, truecolor. | `paintedCells > 0` for every example (no example throws or renders an empty frame). |
| **ST-3** | AC-1, AR-6 | Each example's docs page text. | Contains the exact `<<< @/<sourcePath>` (whole-file, no line-range/region); `<sourcePath>` resolves to a real file; the page contains **no** fenced code block duplicating example source. |
| **ST-4** | AR-17 | `demoShell({ content: <a View>, chrome:'minimal', … })` composed to a frame. | The component is centered; a compact status line is present exposing **Theme**, **Depth**, **About** items; **no** menu bar row. |
| **ST-5** | AC-2, AR-7 | `demoShell({ content, chrome:'full', … })` composed to a frame. | A menu bar (with `≡`/About and a **View** menu offering Theme + Depth) and a status line are present. |
| **ST-6** | AC-2, AR-10 | A `PlayController` for `controls/button`, `createTerminal` → `@xterm/headless`; `open(el)`. | Resolves; the headless terminal receives a non-empty first frame (bytes written > 0; buffer non-blank). |
| **ST-7** | AC-2 | After ST-6 `open` with `chrome:'full'` (`files/file-dialog`). | The painted frame includes DemoShell chrome (a menu-bar cell row + a status-line row). |
| **ST-8** | AC-3, AR-18 | `PlayController` for `files/file-dialog` with a counting headless-terminal factory; `open`/`close` ×20. | Live `Terminal` count returns to 0 after each `close`; final net growth = 0 (no leaked instances/listeners). |
| **ST-9** | AC-4, AR-8 | A mounted DemoShell app; capture a themed cell's color; `app.setTheme(nordTheme)`; recompose. | The default-open theme is Turbo Vision; after `setTheme` the same cell repaints in the new preset's color **without** a re-mount. |
| **ST-10** | AC-5, AR-11 | `attachKeyReclaim(fakeTerm, { target, isFocused:()=>true })`; dispatch a synthetic `F10` keydown on `target`. | `preventDefault()` was called (chord reclaimed). With `isFocused:()=>false` (dialog closed), `F10` is **not** prevented. |
| **ST-11** | AC-7, AR-12 | Each example page source + `PlayExample.vue`. | The page contains the `<<<` source + the example `blurb` text + a `<PlayExample id="…"/>`; the component template renders a real `<button>` with an `aria-label` bound to the title. |
| **ST-12** | AC-8, AR-13 | `isNoKeyboardDevice(mm)` with a stub `matchMedia` returning `matches:true` for `(hover: none) and (pointer: coarse)`; the fallback decision. | Returns `true`; the fallback branch selects the note + `/screenshots/<id>.gif` slot; with the asset absent, the decision degrades to note + source (no `<img>`). |
| **ST-13** | AC-9 | Build `files/file-dialog`; mount its `FileDialog`/`FileList` over the seeded virtual FS; read entries; enter a subdir. | Lists the seeded top-level entries; after `directory.set('<subdir>')`, lists the subdir's entries (re-scan works — no backend). |
| **ST-14** | AC-10, AR-15 | (a) a seeded file with a raw `ESC` byte, read into a paint; (b) opening a 2nd dialog via the singleton; (c) a crafted `title`/`blurb` with `<script>`; (d) an example whose `build()` throws. | (a) the painted buffer contains no raw control byte (`sanitize` stripped it); (b) the 1st controller is closed — live terminal count = 1 (≤1 open); (c) the rendered code/blurb is escaped (bound as text, never `v-html`); (d) `open()` renders the **error panel** + `isOpen === false` + `close()` cleans up. |

## Implementation (impl) tests
- PlayController `remount({size|depth})` merges params + reuses close→open (Reset/size/depth share one seam).
- Deep-link parser: `?example=controls/button` → the matching entry; unknown id → no-op; no-keyboard ⇒ no terminal opened.
- Registry `load()` returns a `default` `ExampleDefinition`; each seed module has no `@xterm/*` import and no DOM globals (static scan); the allow-listed exception is `@jsvision/web`'s pure `createBrowserFileSystem`.
- DemoShell normalization: a `View` content → an `Application`; an `Application` content → menu/status attached.
- Turbo/dist freshness: docs-site tests resolve the built `@jsvision/*` dist (C1) — a clean-`dist` `yarn verify` passes.

## Verify
`yarn verify` (AR-21) — now includes `docs-site#typecheck` + `docs-site#test`.
