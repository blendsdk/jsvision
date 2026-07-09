# grill_me notes — RD-03 Live-Example System (docs-website)

- Topic: RD-03 live-example system
- Date: 2026-07-09
- Artifact: `codeops/features/docs-website/requirements/RD-03-live-example-system.md` (Draft) @ HEAD 4b40292
- Grounding: RD-03; docs-site (isolated; vp:build only); web-xterm main.ts+vite.config; kitchen-sink.smoke (uses createRenderRoot, NOT xterm); application.ts/render-root.ts (setTheme EXISTS; caps readonly); buildBrowserCaps({colorDepth}); RD-01 Shiki copy button.

## STATUS: all 6 branches walked; REVISED after user asked for objections + more examples. Awaiting final confirm → make_plan.

## FINAL (revised) decisions — source of truth
- **D1 Example home** = examples in docs-site/examples/; docs-site gains vitest `test` + `typecheck`, joins verify test+typecheck phases; vp:build stays isolated. Dev deps: vitest, core/ui/web/files, @xterm/xterm+fit/webgl, @xterm/headless.
- **D1' Smoke architecture = TWO-TIER** (revised): (a) cheap `createRenderRoot` paint-smoke for EVERY example (fixed caps/viewport, no xterm) — the real kitchen-sink pattern; (b) `@xterm/headless`+mountApp leak-smoke (20x open/close, AC-3) for ONE representative example only. Scales to 40+; avoids per-example terminal flakiness.
- **D1a Typecheck** = examples + DemoShell + PlayController/mountApp wiring in the scoped tsconfig (revised: include the glue, not just leaf modules).
- **D2a Registry** = hand-authored index.ts array + parity test (no orphan files).
- **D2b Snippet-drift** = light `<<<` directive check, MADE CORRECT BY CONVENTION: examples use WHOLE-FILE embeds (no region markers) so shown==whole file provably; heavier rendered-compare only if a region is ever needed.
- **D3 DemoShell = ONE module, TWO chrome modes** (revised): `chrome:'minimal'` (centered lone component + compact theme/depth affordance) for single-component demos; `chrome:'full'` (menu bar About/Theme/Depth + status) for apps/multi-widget. Shared About/theme/depth plumbing (honors AR-5/20). Default: single-component→minimal, app/multi-widget→full, per-example override.
- D3b About from site-meta.ts (version ← root package.json). D3c theme = existing setTheme. D3d depth = re-mount at new colorDepth via buildBrowserCaps (View→Depth; no new primitive; state resets).
- **D4 Play** = plain-TS PlayController (Vue wraps; leak test drives); client-only (ClientOnly + dynamic import, SSR-safe + code-split); close = × + backdrop; Escape→TUI; focus hint; one-dialog singleton; xterm+alias per web-xterm.
- **D5 A11y** = source+prose always in DOM (blurb + whole-file source; ARIA/keyboard Play); touch via matchMedia('(hover:none) and (pointer:coarse)'); fallback slot+note now, GIF drop-in (RD-09) later.
- **D6a Should-haves** = Reset + Size selector + Deep-link ALL IN (copy-code already free). Reset+size share the PlayController re-mount seam. **Deep-link = scroll-to+highlight+open WITHOUT auto-focusing the terminal** (revised; a11y focus-trap fix).
- **D6b Seed set = 8, PHASED** (revised up from 5-6, de-risked):
  - Phase1 (mechanism): controls/button (minimal), files/file-dialog (full, AC-9 + leak target).
  - Phase2 (breadth): controls/input (min), controls/form-dialog (full), containers/list-box (min), table/data-grid (full), apps/desktop (full, flagship/RD-04 hero, re-authored from web-xterm buildApp), theming/preset-gallery (full, theme+depth showcase).
  - Droppable under time pressure: input/list-box/data-grid/preset-gallery. Core: button/file-dialog/form-dialog/desktop.

## Constraints
- C1 turbo builds core/ui/web/files before docs-site#test. C2 CLAUDE.md docs-site isolation note → "isolated from build/shipped verify; participates in test+typecheck". C3 caps readonly → re-mount for depth.
- C4 (new) xterm is browser-only → Play component MUST be client-only (SSR-safe) or VitePress build breaks.

## Deferrals
- Live caps/colorDepth swap primitive on @jsvision/ui · owner: framework · revisit: if re-mount state-reset unacceptable.
- GIF/screenshot Playwright pipeline · owner: RD-09 · revisit: RD-09 fills fallback slots.
- Full ~40 examples + per-component page template · owner: RD-05 · revisit: RD-05 extends this registry/mechanism.
- Whole-file-embeds-only convention · owner: RD-03 · revisit: if an example needs a region marker → add heavier rendered-compare for those.

## Resume from: awaiting user confirm of the revised design → make_plan (feed this as pre-resolved Ambiguity Register context; Phase 1C gate still fires).
