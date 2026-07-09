# RD-03: Live-Example System

> **Document**: RD-03-live-example-system.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-01 (site shell), RD-02 (`@jsvision/web`)
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

The system that makes every code sample on the site **runnable live in the browser**. It defines
the docs **example-module contract**, the **Play button → modal terminal dialog** that hosts a
running example, the **snippet-embed** mechanism that shows the example's real source (so shown code
and running code are the same file), the reusable **DemoShell** (menu bar with About + Theme
switcher over the default Turbo Vision theme) that wraps every demo, the **accessibility fallback**
(source + prose beside every live terminal, GIF/screenshot on no-keyboard devices), and the
**headless smoke test** every example must pass.

This is the beating heart of the pitch: the reader sees the code, clicks Play, and the exact program
runs in a real terminal in their browser. Docs examples are kept **separate** from the kitchen-sink
story registry, but each is a real, compiled, tested module — never copy-pasted prose (AR-3).

---

## Functional Requirements

### Must Have

- [ ] **Example-module contract** — a docs example is a single `.ts` module under
      `packages/docs-site/examples/<category>/<name>.ts` exporting a known shape (e.g.
      `export default defineExample({ title, blurb, build(ctx): Application | View })`) that composes
      an `@jsvision/ui` app/view. It is plain `@jsvision/ui` — nothing in it knows it is in a browser.
- [ ] **Play button + live dialog** — a VitePress theme component renders a Play button on/near an
      example. Clicking it opens a **modal dialog** hosting an xterm.js terminal; RD-03 mounts the
      example via `@jsvision/web`'s `mountApp`. The terminal is **instantiated lazily** (only on open)
      and **fully disposed** on close (terminal, addons, event listeners, timers) — no leaked
      instances when reopened.
- [ ] **DemoShell** — a reusable shell every example and sample app runs inside: a menu bar with an
      **About** item (opens an About dialog: name, version, links) and a **View → Theme** submenu
      listing **all 13 presets** (default **Turbo Vision**), plus a status line. Switching a theme
      repaints the running app live. Single-component demos use DemoShell too (AR-5, AR-20).
- [ ] **Snippet embedding** — the code block shown above/beside a Play button is the example's real
      source, embedded via VitePress region-import (not pasted). Editing the `.ts` file changes both
      the shown code and the running demo; they cannot diverge.
- [ ] **Focus & key handling** — while the dialog terminal is focused, `@jsvision/web`'s key-chord
      reclaim is active so F-keys/`Alt`/`Ctrl` chords drive the TUI; when the dialog closes, focus and
      normal browser shortcuts are restored. A visible hint tells the reader the terminal has focus.
- [ ] **Accessibility fallback** — every live example renders its **source and a prose description**
      in the DOM regardless of the terminal (the terminal canvas is opaque to screen readers); the
      Play region is keyboard-operable and labelled (ARIA).
- [ ] **No-keyboard fallback** — on touch/no-keyboard devices (feature-detected), the Play button is
      replaced (or supplemented) by a pre-rendered **GIF/screenshot** (produced by RD-09), with a note
      that live interaction needs a hardware keyboard.
- [ ] **Headless smoke test** — a test harness mounts every registered example headlessly (the
      `@xterm/headless` + `@jsvision/web` path, mirroring the existing `kitchen-sink.smoke` pattern),
      asserting it builds, paints a non-empty frame, and has the required metadata (unique id, title,
      blurb). This is the contract RD-09's gate enforces.

### Should Have

- [ ] A "Reset" control in the dialog that re-mounts the example to its initial state.
- [ ] A "Copy code" control mirroring the site-wide copy button, scoped to the example source.
- [ ] A size selector (e.g. 80×24 / 100×30) so readers can see reflow.
- [ ] Deep-linkable examples (`?example=controls/button`) that auto-open the dialog.

### Won't Have (Out of Scope)

- Editing the code (that is the Phase-E playground/REPL — AR-9, AR-17).
- The per-component page content/props tables — RD-05 (this RD provides the Play mechanism they use).
- Generating the GIFs/screenshots — RD-09 (this RD consumes them).

---

## Technical Requirements

### Mounting

- The Play dialog uses `@jsvision/web`'s `mountApp({ element, app, caps })`. The example's `build(ctx)`
  is wrapped by DemoShell (which supplies the menu/status/About/theme) before mounting.
- Lifecycle: `open()` creates the xterm `Terminal` + addons, builds the DemoShell-wrapped example,
  mounts, focuses; `close()` disposes in reverse and nulls references. A reopen builds fresh.
- The caps profile's `colorDepth` is driven by the theme switcher / a depth control so downsampling
  is demonstrable.

### DemoShell

- Built once as a small reusable module in `packages/docs-site` (a thin composition over
  `@jsvision/ui` `createApplication` + `menuBar`/`statusLine` + `messageBox`-style About + a theme
  `Signal`). Sample apps (RD-07) import the same DemoShell.
- Theme switch = swap the app's active `Theme` (one of the 13 core presets) and repaint; the About
  dialog reads name/version from a shared constant.

### Snippet embed & registry

- A generated `examples/index.ts` registry enumerates all example modules (id, category, module,
  source path) — used by the smoke test, the Play component, and RD-09's coverage gate.
- VitePress `<<< @/examples/...` region imports render the source into the page.

---

## Integration Points

### With RD-02 (`@jsvision/web`)
- Uses `mountApp`, the caps profile, key-chord reclaim, and (for file examples) the virtual FS seed.

### With RD-05 (component docs)
- Each component page embeds one or more examples via the Play component + snippet; the page template
  RD-05 defines slots the Play region in.

### With RD-07 (sample apps)
- Sample apps reuse DemoShell (About + theme switcher); the polished kitchen-sink is itself a large
  DemoShell-hosted app.

### With RD-09 (anti-drift + screenshots)
- The example registry + smoke test are the inputs to the `check:docs-site` coverage gate; the
  no-keyboard GIFs come from RD-09's Playwright capture of these same examples.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Live runtime | Client-side / backend | Client-side (`@jsvision/web`) | Static hosting; proven | AR-1 |
| Example ↔ kitchen-sink | Unify / separate | Separate, but real + smoke-tested + snippet-embedded | User choice + anti-drift | AR-3 |
| Play UX | Modal dialog / inline / route | Modal dialog, lazy + disposed | User-specified; performant with many examples | AR-9 |
| Demo wrapper | Bare / app shell | DemoShell (About + theme, TV default) for ALL demos | User requirement | AR-5, AR-20 |
| a11y for terminal | None / source-beside | Source + prose always in DOM | Canvas is opaque to AT | AR-29 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: none by default; file examples use the seeded virtual FS (RD-02), which never
  transmits data.
- **Input validation**: reader keystrokes flow through the engine's `decode()`; all rendered text
  passes `@jsvision/core` `sanitize()`. Example source is authored (trusted) content, compiled at
  build time — no runtime `eval` of reader input in this RD (that is the sandboxed Phase-E REPL).
- **Authentication & authorization**: N/A.
- **Injection risks**: escape-sequence injection is closed by `sanitize()`; the Play component renders
  example source as a static, syntax-highlighted code block (escaped), never as HTML.
- **Rate limiting / encryption / infra**: N/A beyond RD-01 (HTTPS, CSP). Lazy terminal creation +
  disposal bounds memory; a hard cap on concurrently open dialogs (1) prevents resource exhaustion.

---

## Acceptance Criteria

1. [ ] A docs page with an example renders a code block whose text is byte-identical to the source of
       `packages/docs-site/examples/<category>/<name>.ts` (snippet embed, not a copy) — verified by a
       test comparing the rendered block to the file.
2. [ ] Clicking Play opens a modal dialog containing an xterm terminal that paints the example's first
       frame within 1 s; the DemoShell menu bar (with About) and status line are visible.
3. [ ] Opening then closing the dialog 20 times leaves no growth in live xterm `Terminal` instances
       or attached DOM listeners (disposal verified) — measured in a headless test.
4. [ ] Selecting a different theme from **View → Theme** repaints the running example in that preset's
       colors without re-opening the dialog; the default on open is the Turbo Vision theme.
5. [ ] With the dialog focused, pressing `F10` (or the app's menu key) opens the menu **in the TUI**
       and the browser default for `F10`/reclaimed chords does not fire (`defaultPrevented`); closing
       the dialog restores normal browser shortcuts.
6. [ ] Every example module is discoverable in `examples/index.ts`, has a unique id + title + blurb,
       and passes the headless smoke test (builds, paints a non-empty frame) — the suite fails if any
       example throws or renders an empty frame.
7. [ ] Each live-example region exposes its source and a text description in the DOM (present without
       JavaScript execution of the terminal), and the Play control is reachable and operable by
       keyboard with an accessible label.
8. [ ] On a simulated no-keyboard/touch device, the Play region shows the pre-rendered GIF/screenshot
       fallback plus the "needs a keyboard" note instead of (or alongside) the interactive terminal.
9. [ ] A file-dialog example (e.g. `FileDialog`) mounted in the Play dialog lists the seeded virtual
       tree and lets the reader navigate into a subdirectory — proving file demos work with no backend.
10. [ ] Security requirements verified: an example whose seeded file content contains a raw `ESC` byte
        renders it stripped (via `sanitize()`); at most one example dialog is open at a time; example
        source is rendered escaped (no HTML injection from a crafted blurb/title).
