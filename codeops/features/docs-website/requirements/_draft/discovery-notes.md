# Discovery Notes — docs-website (JSVision documentation & showcase site)

> Working notes for `make-requirements` Full Discovery. Resume point for `make-requirements --continue`.
> **Last updated**: 2026-07-09

## Feature

A professional, DX/UX-first **VitePress** documentation & showcase website for JSVision — the
project's sales pitch. Deployed to **GitHub Pages** via CI/CD. Every component teaches with a
**live, in-browser** example running the real engine in **xterm.js** (no backend).

Slug: `docs-website` (proposed; confirm).

## Key finding that reframes the project

`packages/examples/web-xterm/` **already proves** the entire engine runs 100% client-side in
xterm.js: `serialize()` (damage-diff→ANSI) and `decode()` (bytes→events) are pure, so only the OS
boundary is swapped (`browser-host.ts`). → Live demos are a **static site**. No server/PTY.

`@jsvision/files` uses an **injectable `FileSystem`** (`packages/files/src/fs/types.ts`; `scan.ts`
never touches `node:fs`; only `node-fs.ts` does) → a browser in-memory `FileSystem` makes
`FileDialog`/`ChDirDialog`/`FileList`/`DirList`/tvedit run **unchanged** in the browser.

## Confirmed decisions (this session) — see 00-ambiguity-register.md

- Live runtime: **client-side only**, GitHub Pages, no backend (AR-1).
- File dialogs: **browser virtual FileSystem** + upload/download bridge (AR-2).
- Docs examples **separate** from kitchen-sink, but each a **real compiled + smoke-tested module
  embedded via snippet** (no copy-paste) (AR-3).
- Deploy: **GitHub Pages + per-PR preview** (AR-4); URL = **project subpath** `base:'/jsvision/'` (AR-8).
- Every demo (incl. single-component) inside a **DemoShell**: About dialog + Theme switcher, default
  **Turbo Vision** theme (AR-5), all **13 presets** in the switcher (AR-20).
- Browser host **extracted to first-class `@jsvision/web`** package (AR-6).
- API reference: **TypeDoc → markdown → VitePress** (AR-7).
- Editable **Playground/REPL → Phase E / later**; Play-button live dialog in MVP (AR-9).
- Screenshots: **Playwright on the live xterm page** (hero/OG/README/mobile fallback) (AR-10).
- 4th sample app: **file/data browser** (files + DataGrid) included (AR-11).
- Search: **VitePress local search** (AR-12).
- In: `llms.txt`/copy-for-LLM (AR-13), per-component keyboard cheatsheet (AR-14), theme-role/token
  reference (AR-15), degit starter (AR-16). Later: props playground, blog (AR-17). Skip for v1:
  versioned docs (AR-18), showcase gallery / Giscus / analytics (AR-19).
- Content: **agents draft → user reviews** (AR-21). Anti-drift gate: **hard-fail CI** (AR-22).

## Open (pending final confirmation before RDs) — AR-23..27

- AR-23 site placement + fate of existing root `docs/` techdocs.
- AR-24 feature slug · AR-25 `@jsvision/web` package name/visibility.
- AR-26 security posture (CSP, in-browser code isolation, uploads stay client-side).
- AR-27 component-coverage list = the enumerated barrels (ui + files + core primitives).

## Component surface to document (from packages/ui/src/index.ts + files + core)

Spine/concepts: View, Group, Window, Desktop, createApplication, MenuBar/MenuPopup, StatusLine,
layout DSL (col/row/grow/fixed/spacer/stack/place/centered/…), reactive (signal/computed/effect/
Show/For). Controls: Text, Label, Button, Input, CheckGroup, RadioGroup, Slider, Switch.
Containers: ScrollBar, Scroller, ListView, ListBox, Dialog (+messageBox/confirm/inputBox),
ComboBox, History, Tree, DataGrid, TabView. Feedback: ProgressBar, Spinner. Date: Calendar,
DatePicker. Color: ColorSwatch, ColorPicker. Surface: Surface, SurfaceView. Terminal. Files:
FileDialog, ChDirDialog, FileList, DirList, FileInput, FileInfoPane.

## Proposed RD decomposition (10 RDs) — see below in main thread / README when gate passes

RD-01 Site foundation & delivery pipeline · RD-02 `@jsvision/web` browser runtime ·
RD-03 Live-example system (Play dialog + DemoShell + snippet embed + a11y source-beside) ·
RD-04 Landing/pitch surface (hero, quickstart, core concepts, why/comparison, starter) ·
RD-05 Component documentation system + full coverage · RD-06 API reference (TypeDoc) ·
RD-07 Sample apps (Todo, tvedit, kitchen-sink, file/data browser) · RD-08 Reference & trust
content (perf, security, a11y, compat matrix, theming gallery/token ref, FAQ, guides, contributing) ·
RD-09 Anti-drift governance & automation (prime directive, check:docs-site gate, screenshots, README, llms.txt) ·
RD-10 Non-functional requirements (perf budgets, a11y, security/CSP, SEO, browser support, content-ops).
