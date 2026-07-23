# RD-04: Landing / Pitch Surface

> **Document**: RD-04-landing-pitch.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-01 (site shell), RD-03 (live examples)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

---

## Feature Overview

The content that sells JSVision in the first 30 seconds and gets an evaluating developer from
"what is this?" to a running program: the **hero landing page** (headline, inviting terminal
screenshot/GIF, one-click live demo, feature highlights, call-to-action), a **Getting Started /
5-minute quickstart** (install → hello-world → running live), a **Core Concepts** set that gives the
mental model (reactive signals, the view/group spine, the event loop, the layout engine, capability
auto-detection, theming), a **Why JSVision** page with an honest **comparison** to alternatives, and
a **starter template** (`degit`) so a reader can scaffold a real project in one command.

This is the primary surface for the **Evaluator dev** stakeholder — the sale.

---

## Functional Requirements

### Must Have

- [ ] **Hero landing page** (`/`): a headline + subhead stating what JSVision is (a Turbo Vision-style
      TUI SDK in TypeScript) and its wedge (runs in a real terminal *and* in the browser), an inviting
      **terminal screenshot or GIF** (from RD-09), a prominent **"Run it live"** action (opens a
      flagship live demo via RD-03), primary CTAs (Get Started, GitHub), and a **feature-highlight**
      row (zero-dep, tree-shakeable, capability auto-detection, theming, live-in-browser,
      accessibility/NO_COLOR).
- [ ] **Getting Started** (`/guide/getting-started`): prerequisites (Node ≥ 20), install
      (`npm i @jsvision/core @jsvision/ui`), a **complete hello-world** (an app that runs in a real
      terminal), how to run it, and a **live** version of the same program (Play). ESM-only note.
- [ ] **Core Concepts** (`/guide/concepts/*`): one focused page each for **Reactivity** (signals /
      computed / effect / Show / For), **Views & Groups** (the retained self-drawing tree), the
      **Event Loop** (dispatch, focus, commands, modality), the **Layout Engine** (cell-native flex),
      **Capability Detection** (zero-config terminal adaptation + downsampling), and **Theming**
      (roles, presets). Each concept page has at least one live example.
- [ ] **Why JSVision** (`/guide/why`): the differentiators (pure byte-in/byte-out engine → runs in a
      browser; zero runtime deps; capability auto-config; Turbo Vision fidelity + modern reactive DX;
      the injection-safe `sanitize()` boundary) with a **comparison table** vs **blessed**, **Ink**,
      **Textual**, **ratatui**, and **classic Turbo Vision** — factual, not disparaging; each claim
      links to evidence (a concept page, a benchmark, or source).
- [ ] **Starter template**: a `degit`-able template repo/dir producing a minimal runnable app
      (`npx degit … my-app` → `yarn && yarn start`), referenced from Getting Started.

### Should Have

- [ ] A short **"How it works"** teaser on the landing page (the byte-in/byte-out story) linking to
      the full Architecture page (RD-08).
- [ ] A "next steps" panel at the bottom of Getting Started (→ Components, → Sample Apps, → Concepts).
- [ ] Social-proof slots (GitHub stars badge, npm version) — data-driven, no hard-coded numbers.

### Won't Have (Out of Scope)

- The screenshot/GIF asset generation itself — RD-09.
- The deep Architecture, Performance, Security, Accessibility pages — RD-08.
- Per-component tutorials — RD-05.

---

## Technical Requirements

- Hero uses VitePress's home layout with custom theme slots (RD-01) for the live-demo action and the
  feature row.
- Every code sample on these pages is a **real embedded example** (RD-03) with a Play button — the
  hello-world in Getting Started is literally the flagship example module.
- The comparison table is authored content reviewed by the user (agents draft, AR-21); every
  comparative claim carries a citation link so it survives scrutiny.
- The `degit` starter is a directory in the repo (e.g. `packages/docs-site/starter/` or a dedicated
  template path) kept compiling in CI (RD-09 smoke or a build check) so the advertised command works.

---

## Integration Points

### With RD-03 (live examples)
- The landing "Run it live", the Getting Started hello-world, and every Concepts example use the Play
  mechanism + DemoShell.

### With RD-08 (reference & trust)
- "Why" links to Architecture/Performance/Security; the comparison references the Compatibility matrix.

### With RD-09 (screenshots)
- The hero image/GIF and the OG/social card come from RD-09's Playwright capture of the flagship demo.

### With RD-05 (component docs)
- Getting Started and Concepts link into the component pages as "next steps".

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Hero live proof | Static image only / one-click live demo | Live demo (via RD-03) + image fallback | The live proof IS the pitch | AR-1, AR-9 |
| Comparison stance | Omit / include honest comparison | Include, cited, non-disparaging | Evaluators want it; credibility | AR-30 |
| Starter delivery | `degit` template / CLI generator | `degit` template (small) | Frictionless; near-zero cost | AR-16 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: none. Social-proof badges fetch only public GitHub/npm metadata over HTTPS;
  the CSP `connect-src` allowlists those hosts (or the badges are build-time baked to avoid runtime
  fetches). No third-party tracking is added (analytics skipped, AR-19).
- **Input validation / injection**: all page content is authored markdown; live examples inherit
  RD-03's `sanitize()` protection. The comparison table renders escaped text only.
- **Authentication / rate limiting / encryption**: N/A (static, HTTPS).
- **Infrastructure**: the starter template's dependencies are pinned and its build is verified in CI
  so the advertised quickstart cannot rot.

---

## Acceptance Criteria

1. [ ] The landing page (`/`) renders a headline, a hero terminal image/GIF, a "Run it live" control
       that opens a working live demo (RD-03), a GitHub CTA, and a feature-highlight row — with no
       broken images or dead links.
2. [ ] Following Getting Started verbatim (install the two packages, paste the hello-world, run it) in
       a clean Node ≥ 20 environment produces a running terminal app — verified by a CI test that
       executes the documented hello-world source and asserts it starts and paints.
3. [ ] The same hello-world has a Play button that runs it live in the browser and paints the same UI.
4. [ ] Each of the six Core Concepts pages exists, explains its concept in prose, and contains at
       least one working live example.
5. [ ] The "Why" comparison table lists blessed, Ink, Textual, ratatui, and classic Turbo Vision, and
       every comparative claim about JSVision links to a supporting page/benchmark/source (no
       unsupported superlatives).
6. [ ] `npx degit <starter-path> tmp-app && cd tmp-app && yarn && yarn start` (or the documented
       equivalent) produces a runnable app — the starter builds green in CI.
7. [ ] Security requirements verified: no third-party tracking script is present on the landing page;
       any social-proof fetch targets only HTTPS hosts allowlisted by the CSP; comparison/hero content
       renders escaped (no HTML injection).
