# RD-09: Anti-Drift Governance & Automation

> **Document**: RD-09-anti-drift-governance.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-03 (example registry + smoke), RD-05 (component coverage list)
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

The machinery that makes "the docs are always correct" a **guarantee, not a good intention**. It
adds a **non-negotiable prime directive** to `CLAUDE.md` (when component/API code changes, the
relevant docs & examples must be updated), and — because a directive alone rots — backs it with a
**hard-failing CI gate `check:docs-site`** that blocks any merge where a public component lacks a
docs example, where an embedded example fails to compile or smoke, or where a props/coverage source
has drifted. It also owns the **automated visual assets** (Playwright screenshots/GIFs of the live
demos for the hero, OG cards, and the no-keyboard fallback), the **`llms.txt` + per-page raw-markdown**
generation (AI-consumable docs), and the **README rewrite** (lean, DX-first, points to the site).

This mirrors the project's existing enforcement patterns (`scripts/check-jsdoc.mjs`,
`codeops/kitchen-sink-gate.md`) — the same guard-first discipline, applied to the website.

---

## Functional Requirements

### Must Have

- [ ] **Prime directive in `CLAUDE.md`** — a clearly-marked non-negotiable section: any change to a
      public component or its API MUST update the corresponding docs page, props table, and live
      example in the same change; adding a public export MUST add its `components.json` row + docs page
      + example. Written in plain language (no plan/RD IDs in shipped guidance), referencing the gate
      as the objective done-criterion.
- [ ] **`check:docs-site` gate** (a script, e.g. `scripts/check-docs-site.mjs`, wired into `yarn
      verify` and CI) that **fails the build** when any of:
      - a public export (from the `@jsvision/ui`/`@jsvision/files`/core-primitive barrels) has no row
        in `components.json` or no docs page;
      - a component with a page has **no** live example in the RD-03 registry;
      - any embedded/registered example fails to **compile** (typecheck) or fails its **headless smoke
        test** (builds + paints a non-empty frame);
      - a snippet-embed points at a source region that no longer exists.
- [ ] **Example compile + smoke in CI** — the RD-03 example registry is typechecked and smoke-tested in
      the CI pipeline; a broken example is a red build (this is the mechanism that makes shown code ==
      working code enforceable).
- [ ] **Automated visual assets** — a Playwright job drives the **deployed/preview live pages** in
      headless Chromium at fixed viewport(s) with seeded state and captures deterministic
      **screenshots** (hero, per-app, per-flagship-component) and **GIFs** (for the no-keyboard
      fallback and OG animation), written to the site's assets and regenerated in CI.
- [ ] **`llms.txt` + raw markdown** — generate a root `llms.txt` index and per-page raw-markdown
      endpoints (or a "copy page for LLM" affordance) so AI agents can consume the docs; kept in sync
      by the build.
- [ ] **README rewrite** — replace the current long `README.md` with a lean, DX-first version: what it
      is, the one-liner install, a tiny example, an animated/screenshot hero, and prominent links to
      the website (Getting Started, Components, Live demos). Less prose; the site is the detail.

### Should Have

- [ ] The gate reports **what** is missing (which export, which example) with actionable messages, and
      supports a `--fix`-style scaffold that stubs a missing component page/example row.
- [ ] A CI comment on PRs summarizing docs coverage deltas (new/greying components).
- [ ] Screenshot **visual-diff** to catch unintended rendering changes (informational, not gating).

### Won't Have (Out of Scope)

- Authoring the pages/examples themselves — RD-04/05/07/08 (this RD enforces + automates).
- The site build/deploy pipeline — RD-01 (this RD adds jobs to it).

---

## Technical Requirements

- `check:docs-site` reads: the package barrels (public exports), `components.json` (RD-05), and the
  example registry (RD-03); it is a Node script consistent with `scripts/check-jsdoc.mjs` style
  (clear pass/fail, non-zero exit, listed offenders). It runs in `yarn verify` and as a required CI
  check (hard-fail — blocks merge, AR-22).
- Playwright runs against the built site (or the PR preview) so screenshots are the exact pixels users
  see; runs are seeded and viewport-fixed for determinism; assets are committed or published as build
  artifacts consumed by the site.
- `llms.txt` follows the emerging convention (a curated index of the docs with links); raw-markdown is
  emitted from the same source markdown.
- README rewrite keeps the essential legal/status bits (license, pre-1.0 notice) and defers depth to
  the site; it must not reference CodeOps/plan IDs (repo doc convention).

---

## Integration Points

### With RD-03 (live-example system) — consumes the example registry + smoke harness; produces the GIFs the no-keyboard fallback uses.
### With RD-05 (component docs) — reads `components.json` for the coverage gate; the badges + coverage share that source.
### With RD-01 (CI pipeline) — adds the gate + Playwright + `llms.txt` jobs to the workflow scaffolded there.
### With RD-04/RD-07 (hero + app assets) — supplies the hero/OG/app screenshots + GIFs.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Anti-drift mechanism | Directive only / directive + hard gate | Directive **and** hard-fail gate | A directive alone rots | AR-22 |
| Example verification | Manual / compile + smoke in CI | Compile + headless smoke in CI | Shown code == working code | AR-3 |
| Screenshots | Native capture / Playwright-on-live-page | Playwright on the live page | Deterministic, same pixels, CI-native | AR-10 |
| AI-consumable docs | None / `llms.txt` + raw md | `llms.txt` + raw markdown | Project targets AI agents | AR-13 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: none — the gate reads repo files; Playwright drives public pages; no secrets.
- **Input validation / injection**: the gate parses trusted repo sources; Playwright loads only the
  project's own built site (its network is constrained to the site origin) so captures cannot execute
  third-party content.
- **Authentication / rate limiting**: N/A. CI jobs use the ephemeral `GITHUB_TOKEN` (RD-01); no stored
  secret is added.
- **Infrastructure**: Playwright/its browser and the gate's deps are **devDependencies only** (never
  in a shipped package; `check:deps` unaffected), pinned and audited. The gate is a governance
  control that raises the project's overall assurance (docs cannot silently misrepresent the code).

---

## Acceptance Criteria

1. [ ] `CLAUDE.md` contains a clearly-marked non-negotiable prime directive stating that a public
       component/API change must update its docs page, props table, and live example in the same
       change, and that adding a public export requires its `components.json` row + page + example.
2. [ ] `yarn check:docs-site` exits **non-zero** when: (a) a public export is added to a barrel with no
       `components.json` row; (b) a component page has no registered example; (c) a registered example
       fails typecheck; (d) a registered example fails its smoke test; (e) a snippet-embed points at a
       missing region — each case demonstrated by a failing fixture, and exits **zero** when all hold.
3. [ ] `check:docs-site` is part of `yarn verify` and is a **required** CI check that blocks merge on
       failure (branch-protection / required-status configured or documented).
4. [ ] The Playwright job produces deterministic screenshots (re-running on the same commit yields
       pixel-stable images within tolerance) for the hero, each sample app, and each flagship
       component, plus GIFs used by the no-keyboard fallback.
5. [ ] A root `llms.txt` is generated listing the docs sections with links, and each page's raw
       markdown is retrievable (or a "copy for LLM" control yields the page's source) — verified for a
       sample page.
6. [ ] The rewritten `README.md` is substantially shorter than the current one, contains a one-line
       install, a minimal example, a hero image/GIF, and prominent links to the website; `check:docs`
       (JSDoc/reference guard) and markdown lint still pass, and it contains no CodeOps/plan IDs.
7. [ ] Security requirements verified: the gate and Playwright add only devDependencies (`check:deps`
       green for shipped packages); CI uses no stored deploy secret; Playwright is constrained to the
       site origin.
