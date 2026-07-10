# Ambiguity Register — Live-Example Remediation (docs-website)

> **Feature**: docs-website · **Type**: Remediation (post-ship bugfix follow-up to RD-03)
> **CodeOps Skills Version**: 3.3.2
> **Status**: ✅ GATE PASSED — AR-1…AR-8 user-decided; AR-9…AR-18 user-confirmed in a batch; AR-19 preflight-derived, user-authorized. Zero open, zero deferred.

Grounded in the code-verified triage `../_draft/live-example-bugs.md` (per-bug root cause with
`file:line` + live browser reproduction of bug #3). The seven reported bugs cluster into four
workstreams: **A** Play resize (#1, + the latent GridRows H-scroll golden for #3), **B** unify the
demo shell (#4 shadow-on-dots, #5 commands-in-footer, #6 inconsistent shells), **C** dialog reopen
(#7), **D** Source framing (#2).

## Legend
✅ (user) = explicit user decision · ✅ (batch) = recommended resolution, user-confirmed in one batch · 🔴 Open (blocks gate) — none remain.

## Register

| # | Category | Item / question | Decision | Status |
|---|----------|-----------------|----------|--------|
| AR-1 | Behavior / UX | How is every example chromed (fixes #4/#5/#6)? | ONE consistent shell: each demo runs inside a titled **Window** on the desktop hosting the component; menu bar = **System** (About) / **View** (Theme, Depth); status line = hotkey hints only (primary controls move OUT of the footer into the menu). The desktop example uses this same menu bar (+ a Window menu) instead of its own. | ✅ (user) |
| AR-2 | Behavior | How does Play resize behave (fixes #1)? | **Genuinely resizable, terminal-driven**: the modal is resizable; the terminal fits the container; the app viewport is derived from the terminal's ACTUAL `cols/rows` via `mountApp`'s existing `onResize → loop.resize` (live, no remount). The terminal is the single source of truth. | ✅ (user) |
| AR-3 | Behavior | How do the dialog demos reopen (fixes #7)? | An **"Open dialog" Button on the stage** (the demo's Window) reopens the modal Dialog each time; the demo may still start with it open once. | ✅ (user) |
| AR-4 | Docs / UX | How is the "Source" block presented (fixes #2)? | **Show the `build()` region by default** (a caption ties it to the Play window); the **full module is available behind a toggle**. | ✅ (user) |
| AR-5 | Behavior / Edge | Is a component demo's own stage Window closable? | **No** — movable + zoomable only (no `[×]`), so a demo can never vanish to an empty desktop. The desktop example keeps its real closable Welcome/Tips windows (closability is meaningful there). | ✅ (user) |
| AR-6 | Testing | Acceptance bar for #1/#3/#4 (xterm/browser-host behaviours headless paint-smoke can't catch)? | **Headless LOGIC tests + a documented manual browser check.** Deterministic: a controller test asserting the app viewport tracks the terminal `cols/rows` on resize (#1); a GridRows headless golden rendering an OVERFLOW grid at `indent>0` (#3). Pixel-level xterm visuals (#4 surface look) → a recorded manual verification checklist. No new browser-e2e harness. | ✅ (user) |
| AR-7 | Ordering | Workstream / phase order? | **Resize → Shell → Reopen → Source.** Fix the worst functional bug first and re-test #3 right after; the reopen button (#7) lands on the new shell; Source last. | ✅ (user) |
| AR-8 | Scope | How deep on #3 now? | **Fix #1, add the overflow-grid golden, fix any real GridRows bug it exposes, re-test #3 in the browser.** A deeper web-host/damage-diff investigation opens ONLY if it still garbles after #1. The wheel-over-terminal→page leak is fixed in this workstream too. | ✅ (user) |
| AR-9 | Consistency / Contradiction | The prior RD-03 plan chose **whole-file embed, no region markers** for the drift guarantee — AR-4 supersedes it. How is "shown code == running code" preserved and the drift oracle updated? | The `build()` region is extracted by VitePress `#region` markers from the **real compiled module** (still running code — a subset). The drift oracle is **updated** to assert each example page embeds (a) the `build()` region via a `<<<#region` directive at a real registry file AND (b) the full module via a whole-file `<<<` (behind the toggle) — both directive-based, **no pasted blocks**. Supersedes the prior whole-file-only oracle. | ✅ (batch) |
| AR-10 | Feasibility / Impl | Exact resize mechanism + viewport derivation. | CSS `resize: both` (or an equivalent drag handle) on the modal terminal container + a `ResizeObserver` → `fit.fit()`; the terminal's `onResize` drives `loop.resize`. On first mount, build the app at the terminal's fit size (read `term.cols/rows`), NOT a hardcoded preset. A **min terminal size clamp of 40×12** floors the fit. Preset buttons become **container resizers** (they re-size the DOM box, which re-fits). | ✅ (batch) |
| AR-11 | Impl | Where is the wheel-over-terminal→page-scroll leak fixed? | The terminal's DOM `wheel` event is `preventDefault`ed while the terminal is focused (in the `PlayExample.vue` `createTerminal` wiring), so the page never scrolls/zooms under the modal. DOM-only; no engine change. | ✅ (batch) |
| AR-12 | Consistency | Does every example show a Window menu, or only multi-window ones? | **System + View always**; the **Window** menu (Next/Zoom/Cascade/Tile) is added only for examples with real window management (the desktop example). Single-demo stage windows are non-closable, so window-management is inert for them → no Window menu. | ✅ (batch) |
| AR-13 | Impl | Stage-Window title + geometry for a component demo. | Title = the example title; the stage Window is centered and sized to fill the desktop minus a small margin, giving the component a clean interior surface. The component is placed in the Window interior (the current `placeContent` centering logic, retargeted from the desktop to the Window interior). | ✅ (batch) |
| AR-14 | Impl | How does a dialog example fit the Window shell? | The dialog example's stage Window hosts an **"Open the dialog" Button** (+ a one-line hint); clicking runs `execView` to open the modal Dialog over the desktop; the example starts with it open once. The example still returns an `Application` (via `demoApp`). | ✅ (batch) |
| AR-15 | Dependencies | Verify command. | `yarn verify` (project CLAUDE.md). docs-site participates in verify's **test + typecheck**; the ui goldens run under `@jsvision/ui`'s test project; `vp:build` stays build-isolated. | ✅ (batch) |
| AR-16 | Scope (OUT) | Explicit non-goals. | NO new browser-e2e harness (AR-6); NO engine/ui theming redesign; NO change to the 8-example set (we fix, not add examples); the deeper web-host damage-diff dig is DEFERRED unless #3 persists post-#1; the closable-window reopen affordance is not needed (AR-5 non-closable stage). | ✅ (batch) |
| AR-17 | Testing | Headless coverage for the shell change (#4/#6). | Testable at the LOGIC level: a DemoShell test asserts a component example is wrapped in a **non-closable Window** whose interior fills the stage (the component's cells sit on the window surface, not the desktop pattern). Pixel look → the manual checklist (AR-6). | ✅ (batch) |
| AR-18 | Security | Any new input / injection / data surface? | **None.** Examples still compose via `@jsvision/ui` and paint through the existing `sanitize` boundary; the resize path only changes viewport sizing; the wheel fix is DOM `preventDefault` only. No new user-data path, no new dependency. | ✅ (batch) |
| AR-19 | Consistency / Test impact | The unified shell contradicts a shipped RD-03 spec oracle (`demo-shell.spec` ST-4: "no menu bar" + Theme/Depth/About in the status line) and breaks the two-chrome-mode + `content`/`chrome` test signatures (surfaced by preflight PF-001). | **Supersede ST-4** and rewrite ST-5/ST-9 (`demo-shell.spec`) + ST-7 (`play-controller.spec`) to the unified-shell behaviour — the AR-9 precedent for a user-authorized change to a shipped oracle when the requirement changes — and migrate every `content`/`chrome` caller in the test suite. Enumerated in 03-02 §Test migration + 99 Phase 2. | ✅ (preflight) |

## Contradiction note (AR-9, AR-19)

RD-03's `00-ambiguity-register.md` AR-6 recorded: *"snippet-drift via whole-file `<<<` … no region
markers."* This remediation deliberately supersedes that under AR-4/AR-9 — the user chose a
`build()`-first presentation. The drift oracle (RD-03 ST-3) is therefore **extended**, not
weakened: a region embed is still a real slice of the compiled module, and the full-file embed
remains present behind the toggle.

Likewise (AR-19), the unified draggable-Window shell (AR-1) contradicts RD-03's `demo-shell.spec`
**ST-4** ("no menu bar" + Theme/Depth/About in the status line), which encoded the now-removed
two-chrome-mode design. ST-4 is superseded and ST-5/ST-9/ST-7 rewritten to the unified behaviour.
Both are scoped, user-authorized changes to shipped oracles, recorded here for traceability — the
deliberate, narrow exception to spec-test immutability (the requirement changed).

## Runtime notes (exec-time discoveries — goal unchanged, mechanism corrected)

- **AR-11 (runtime) — the wheel fix must be a *capture-phase* listener + a background scroll-lock.**
  During the Phase-1 manual browser check, the first implementation (a **bubble-phase** `wheel`
  `preventDefault` on the terminal host) was found to **never fire**: xterm.js calls
  `stopPropagation()` on the wheel in the target phase, so the event never reaches a bubble listener
  on the ancestor host (instrumented: a bubble probe recorded zero events; a capture probe fired).
  Corrected to a **capture-phase** listener (`{ capture: true, passive: false }`) — it runs before
  xterm, `preventDefault`s the browser's scroll/zoom, and still lets xterm forward the wheel to the
  app (verified live: the grid still scrolled). Added a **background scroll-lock** (`<html>`
  `overflow: hidden` while the modal is open, restored on close) as conventional modal behaviour and
  a routing-independent second line of defence. Note: the actual page-scroll-STOP under a **real
  hardware wheel** can't be asserted via browser automation — CDP's synthetic `scroll` force-scrolls
  regardless of both `preventDefault` and CSS `overflow` — so that final confirmation stays in the
  manual checklist (M3). The scroll-lock run+restore and the capture listener firing WERE verified
  live. AR-11's *intent* (wheel over the terminal never scrolls/zooms the page) is unchanged.
