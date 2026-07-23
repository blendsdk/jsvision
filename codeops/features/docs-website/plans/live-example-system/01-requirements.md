# 01 — Requirements & Scope

> **Source**: [RD-03](../../requirements/RD-03-live-example-system.md)
> **Implements**: docs-website/RD-03

## Objective

Make every code sample on the docs site runnable live in the browser, with shown code guaranteed
identical to running code, wrapped in a consistent shell, accessible, and headlessly gated.

## In scope

1. **Example-module contract** — `defineExample({ title, blurb, build(ctx) })` producing an
   `@jsvision/ui` `Application | View`; SSR/headless-safe (no `@xterm/*` import, no DOM globals). A
   module may import `@jsvision/web`'s **pure** `createBrowserFileSystem` (the sole browser-package
   exception — it is `node:`/DOM-free); the impure browser host surface stays in the Play component (AR-14).
2. **Registry** — hand-authored `examples/index.ts` + a parity test (AR-5).
3. **Snippet embed** — whole-file `<<<` region-import; a directive-check drift test (AR-6).
4. **DemoShell** — one module, `minimal` + `full` chrome, About + Theme + Depth, over the 13 presets,
   default Turbo Vision (AR-7/8/9/17).
5. **Play component** — a client-only Vue Play button → modal xterm dialog via `mountApp`; a plain-TS
   `PlayController`; lazy create / full dispose; in-dialog error panel; one-dialog cap (AR-10/15).
6. **Focus & keys** — `attachKeyReclaim` while focused; × / backdrop close; Escape → TUI; focus hint (AR-11).
7. **Accessibility** — source + prose always in the DOM; ARIA/keyboard Play (AR-12).
8. **No-keyboard fallback** — touch detection + a fallback slot (note + screenshot path); RD-09 fills
   the assets (AR-13).
9. **Should-haves** — Reset, size selector (80×24 / 100×30), deep-link (scroll+highlight+open, no
   auto-focus). Copy-code is already free (AR-19).
10. **Two-tier headless harness** — paint-smoke (all) + leak-smoke (one) + parity + drift, in a docs-site
    vitest project that runs under `yarn verify` (AR-2/3/18).
11. **Seed examples** — 8, phased (AR-20).

## Out of scope (owner)

- Editing code in the browser / a REPL sandbox — Phase E.
- Per-component page content + props tables + the full ~40 examples — RD-05.
- Generating GIFs/screenshots (Playwright capture) — RD-09 (this RD only consumes them).
- A live in-place caps/colorDepth swap primitive — deferred (re-mount is used instead, AR-9).

## Acceptance criteria (from RD-03; traced in 07)

| AC | Summary | Primary ST |
|----|---------|-----------|
| AC-1 | Shown code == example source (snippet embed, not a copy) | ST-3 |
| AC-2 | Play opens a modal xterm painting the first frame within 1 s; DemoShell menu+status visible | ST-6, ST-7 |
| AC-3 | 20× open/close leaks no `Terminal` instances / listeners | ST-8 |
| AC-4 | Theme switch repaints live without reopening; default Turbo Vision | ST-9 |
| AC-5 | `F10`/reclaimed chords drive the TUI (`defaultPrevented`); close restores browser shortcuts | ST-10 |
| AC-6 | Every example is registered, unique id/title/blurb, passes paint-smoke | ST-1, ST-2 |
| AC-7 | Source + text description present in the DOM without JS; Play is keyboard-operable + labelled | ST-11 |
| AC-8 | Simulated no-keyboard device shows the fallback slot + note | ST-12 |
| AC-9 | A FileDialog example lists the seeded virtual tree + navigates into a subdir | ST-13 |
| AC-10 | Security: raw ESC in seeded content renders stripped; ≤1 dialog open; source rendered escaped | ST-14 |

## Success criteria (definition of done)

- All ST-1…ST-N green; `yarn verify` passes (docs-site now participates in test + typecheck).
- The 8 seed examples build, paint, and are registered; the flagship `apps/desktop` renders.
- No shipped-code JSDoc violations (`check-jsdoc.mjs`) in any new `packages/*/src` (none expected —
  RD-03 lives in docs-site, which is not shipped, but any `@jsvision/*` primitive added would qualify;
  **none is planned** — AR-8/9 use existing seams).
- AGENTS.md's docs-site isolation note updated (C2).
