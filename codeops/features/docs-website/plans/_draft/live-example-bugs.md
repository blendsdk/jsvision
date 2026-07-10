# Live-example system — post-ship bug triage

> Reported by the user 2026-07-10 after RD-03 shipped. Captured pre-`/compact` so the fix
> session has a durable checklist. Nothing here is triaged/root-caused yet — investigate first.

## The seven reported issues

1. **Play window is not resizable / size toggle breaks the app.**
   The Play modal hosts the demo at a single size. Switching 80×24 ⇄ 100×30 (the size toggle)
   leaves the app non-functional — nothing works afterward. Likely the remount-on-resize path
   (`PlayExample.vue` `remount({size})` → controller) doesn't rewire input/frame sinks, or the
   xterm term isn't resized/refit. Want a genuinely resizable window, not just two presets.
   → Files: `.vitepress/theme/components/PlayExample.vue`, `src/play/play-controller.ts`, `mountApp`.

2. **"Source" section is confusing — reader can't tell what they're looking at.**
   The `<<< @/examples/…>` include dumps the raw example module (with `defineExample`/`demoApp`
   scaffolding) with no framing, so it's unclear this is "the code that's running above." Needs
   a heading/explanation, or to show only the meaningful build() body, or a caption tying it to
   the Play window. → Files: the `components/*.md` + `apps/desktop.md` pages, maybe demo-shell.

3. **DataGrid renders garbled on horizontal scroll (right part of grid).**
   Scrolling the grid right corrupts the right-hand cells. Likely a wide-glyph / clip / column
   x-offset (`x = starts[c] − indent`) bug in `grid-rows.ts`, OR a compose/damage-diff artifact
   surfaced by the browser host. Reproduce in `table/data-grid` example. → `packages/ui/src/table/grid-rows.ts` (+ maybe web host serialize).

4. **Flat-shadow components (e.g. Button) look wrong on the app-shell dotted background.**
   The button's block-glyph shadow renders correctly in isolation but looks odd over the
   desktop's dotted fill. Cosmetic/chrome — decide the demo backdrop or shadow treatment.
   → demo-shell chrome + `packages/ui/src/controls/button.ts` shadow role.

5. **Important menus/commands are rendered in the FOOTER — why?**
   Question about the demo-shell layout: status/command row placement. Possibly menu content is
   in the StatusLine instead of a MenuBar. → `src/demo-shell.ts` `buildMenuBar`/`buildStatusLine`.

6. **Multiple inconsistent app-shells — they should be consistent.**
   Different examples present different chrome (`minimal` vs `full`, apps/desktop self-chromes
   its own). Want ONE consistent shell design across all examples. → `src/demo-shell.ts`
   `demoShell`/`demoApp` chrome modes + `apps/desktop.ts` (self-built) + `preset-gallery.ts`.

7. **Dialog demos: once the dialog is closed there's no way to reopen it.**
   `controls/form-dialog` + `files/file-dialog` open the dialog once in `build()` via
   `execView`; on close (OK/Cancel/Esc) the example is dead — no reopen affordance. Need a
   trigger (a Button in the shell) that re-opens the dialog. → `examples/controls/form-dialog.ts`,
   `examples/files/file-dialog.ts`.

## Cross-cutting observation

Issues **4, 5, 6** are all one thing: the **demo-shell chrome is under-designed and
inconsistent**. Worth resolving as a single "unify the demo shell" work item rather than three
patches. Issues **1, 3, 7** are concrete functional bugs. Issue **2** is a docs/presentation fix.

## Grounded root-cause analysis (post-compact, code-verified)

Investigated the implicated files directly. Findings, with confidence:

1. **Play resize breaks the app — HIGH confidence, root cause found.**
   `mountApp` already supports *live* resize: `mount.ts:101` wires `term.onResize → loop.resize`.
   The Play layer never uses it. `toggleSize` (`PlayExample.vue:116`) calls
   `controller.remount({ size })` → `play-controller.ts:163` which does `close()` then `open()`,
   rebuilding a fresh xterm via the `createTerminal` closure (`PlayExample.vue:67`). That closure
   runs `fit.fit()`, which sizes the terminal to the **DOM container** — capped by
   `.play-modal { max-width:95vw; max-height:90vh }` (`PlayExample.vue:246`), so the container does
   **not** grow to 100×30. Result: the app is composed at `viewport:{100,30}` (the controller's
   `size`) while the terminal is fit to ~80×24 → the frame the loop writes and the mouse hit-test
   coordinates desync from the terminal grid → "nothing works." **Fix is architectural:** make the
   terminal the source of truth for the viewport (fit → read `term.cols/rows` → build the app at
   those), and resize *live* (a `ResizeObserver` + `fit.fit()`, letting `mountApp`'s existing
   `onResize→loop.resize` flow) instead of remounting at hardcoded presets. Matches the user's ask
   for a "genuinely resizable window, not just two presets."

2. **"Source" confusing — confirmed presentation gap.** Pages embed the whole module via
   `<<< @/examples/…` — imports, the local `at()` helper, `defineExample(...)` scaffolding — with
   no caption tying it to the Play window. Fix: frame it ("Source — the exact module running
   above") and/or use VitePress region markers so only the meaningful `build()` body shows.

### Bug #3 — live reproduction results (2026-07-10, `yarn docs:dev` + browser)

Reproduced the DataGrid Play in a real browser. Findings:
- **The docs example cannot horizontally scroll.** Pressing → 12× was a no-op — City is `1fr`, so
  `maxIndent = 0`. Confirmed against the code path.
- **The docs example cannot vertically scroll either** — all 12 rows fit the ~14-row grid viewport
  at both 80×24 and 100×30, so `topItem` never leaves 0.
- **At rest and under keyboard nav the grid renders cleanly** (verified by a crisp zoom capture — no
  garble, dividers and zebra correct).
- **Mouse-wheel over the terminal leaks to the page** (the doc content scrolled behind the fixed
  modal; a stray ctrl+wheel from the automation also zoomed the browser — likely a tool artifact,
  but the plain page-scroll leak is real). The terminal should capture wheel + `preventDefault`.
- **Coverage gap found:** the DataGrid suite exercises the `indent` *signal* (ST-10 asserts
  `indent > 0` after →; the clamp impl test asserts the clamp value) but **no test inspects the
  rendered buffer at `indent > 0`** — the negative-`x` cell-clip / divider-placement path is
  untested. That is precisely where an H-scroll garble would hide.

**Conclusion:** the literal "H-scroll garbles the right part" is NOT reproducible in the shipped docs
example (it can't H-scroll). The garble the user saw is most plausibly (a) a symptom of the resize
desync (#1) on the dense grid, and/or (b) the wheel-leak making the modal look broken. The genuine
GridRows H-scroll path remains a **latent, untested risk** (a real overflow grid / the kitchen-sink
story would exercise it). Plan sequencing: fix #1 first, add a headless golden that renders an
*overflow* grid at `indent > 0` (asserting clean cells + dividers + no orphan wide-glyph
continuation at the left clip), then re-test #3 in the browser. If headless is clean and the browser
still garbles after #1, it's a web-host/xterm damage-diff artifact.

3. **DataGrid garble on scroll — UNCERTAIN, reproduce-first.** In the docs example
   (`examples/table/data-grid.ts:53`) the City column is `'1fr'`, so `apportionColumns` makes
   `totalWidth === width` → `maxIndent = 0` (`grid-rows.ts:175`) → **horizontal scroll is
   impossible**. So the reported "garble on scroll" is NOT column H-scroll. Candidates: (a) a
   right-edge artifact — the last column's `│` divider is drawn at `x + widths[last]` which lands at
   `totalWidth` i.e. the vbar column (`grid-rows.ts:217`); (b) a browser-host damage-diff / WebGL
   artifact the headless golden tests can't see; (c) **a symptom of bug #1** — if the viewport is
   desynced from the terminal, the dense right edge garbles most visibly. Must reproduce (ideally
   test whether it reproduces *without* toggling size first, to rule #1 in/out).

4. **Flat shadow on dotted bg — code-obvious.** Component demos return a bare `Group` placed
   straight on the `Desktop`, which fills with `role.pattern` (`desktop.ts:115`). Button `▄█▀`
   shadows (`shadow` role) sit on the dots. Fix: give component demos a clean surface (a framed
   panel / window-role fill), not the raw desktop pattern.

5. **Commands in the footer — a design question, ties to #6.** In `minimal` chrome the Theme/Depth/
   About affordances live ONLY in the status line (`demo-shell.ts:220`, no menu bar). The user reads
   the footer as "important commands hidden at the bottom." Resolve by unifying on one chrome that
   always exposes the primary controls in a visible menu.

6. **Inconsistent shells — confirmed, three paths.**
   (a) `apps/desktop.ts` self-chromes via `createApplication` with its OWN `≡`/`Window` menu +
   status; `demoShell` only calls `wireCommands` onto it, so the shared Theme/Depth handlers are
   registered but **unreachable** (no menu/status item emits `demo.theme.N`) — you cannot switch
   theme on the desktop demo. (b) `demoApp(ctx,'full')` (form/file dialogs) gets the shared menu +
   status. (c) `shellForView` minimal vs full differ again. Fix: ONE shell design; the desktop
   example should compose its windows into the shared shell (or the shared shell should expose the
   window-manager commands) rather than bringing its own.

7. **Dialog can't reopen — code-obvious.** `form-dialog.ts:49-50` and `file-dialog.ts:44` open the
   dialog once in `build()` via `execView`; on OK/Cancel/Esc the example is dead. Fix: a trigger
   (a Button/menu item/status item in the shell) that re-opens the dialog.

**Vehicle recommendation:** a CodeOps remediation plan (spec-first regression tests per fixable
bug). #1 and #6 are architectural (resize design + shell unification), #3 needs a reproduce-first
investigation task, and the fixes span `@jsvision/ui` + `docs-site` — too much for a trivial task.
The `@jsvision/ui` fixes (#3, #4) need golden/headless coverage; the docs-site fixes (#1, #2, #5,
#6, #7) need the live-example harness + a browser repro for #1/#3.
