# RD-08: Reference & Trust Content

> **Document**: RD-08-reference-trust.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: RD-03 (live examples), RD-05 (component pages)
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

The content that earns a developer's **trust** and answers the "can I depend on this?" questions:
the **Architecture / How-it-works** story (the pure byte-in/byte-out engine and why it runs in a
browser), **task-oriented Guides / Cookbook**, a **Best Practices** hub, an **FAQ**, the
**Accessibility**, **Security**, and **Performance** pages (genuine differentiators), a **terminal
Compatibility matrix**, the **Theming gallery + design-token (theme-role) reference** with the
**embedded theme-designer**, **Versioning & stability / Changelog / Roadmap** (honest pre-1.0
status), **Migration/upgrade** notes, and a **Contributing / development** guide. It absorbs and
expands the existing repo `docs/` techdocs (architecture, ADRs, guides) placed by RD-01.

---

## Functional Requirements

### Must Have

- [ ] **Architecture / "How it works"** — the host-agnostic pure-engine model (`serialize`/`decode`,
      the `RuntimeAdapter` seam, why the same engine runs native *and* in a browser), the subsystem
      map, and the absorbed ADRs. This is the differentiator the landing page teases (RD-04).
- [ ] **Guides / Cookbook** — task-oriented how-tos, each with a live example: e.g. "make a modal
      dialog", "two-way bind state", "keyboard shortcuts & commands", "async modality", "theme an
      app", "build a custom control", "handle resize", "go NO_COLOR / ASCII-safe".
- [ ] **Best Practices** hub — the cross-cutting gotchas (e.g. `measure()` or a view collapses to
      0×0; reactive vs imperative seams; disposing resources; focus management), linkable from
      component pages.
- [ ] **FAQ** — the recurring questions (ESM-only / no `require()`; Node version; "does it work over
      SSH / in tmux / on Windows?"; "why Turbo Vision?"; "can I use it in the browser?"; performance;
      production-readiness / pre-1.0).
- [ ] **Accessibility** page — NO_COLOR/`FORCE_COLOR`, ASCII-safe chrome fallback, mono depth &
      reverse/bold legibility, and the docs-site's own a11y posture (source-beside-every-live-demo).
- [ ] **Security** page — the `sanitize()` injection boundary as a first-class feature (untrusted text
      can never inject an escape sequence), the redaction/logging safety model, and the docs-site
      security posture (client-only, CSP).
- [ ] **Performance** page — the bytes∝damage design, the frame benchmark (median/p95, the 16 ms
      budget), and what makes rendering cheap; informational, cited to the bench.
- [ ] **Compatibility matrix** — a terminal support table (from `terminal-matrix.json`) of what works
      where (color depth, mouse, glyphs, OSC features), with the honest "verified on Linux/macOS" note.
- [ ] **Theming** — a **gallery** of all 13 presets (live, switchable), a **theme-role / design-token
      reference** documenting every `Theme` role with live swatches, and the **embedded
      theme-designer** (the `@jsvision/theme-designer` app running in the browser via `@jsvision/web`)
      so readers author a theme live.
- [ ] **Versioning & stability / Changelog / Roadmap** — the SemVer + pre-1.0 policy (surfaced from
      `CHANGELOG.md`), a "may change between minors" banner, and a status/roadmap of what's built vs
      planned (aligned with the component status badges from RD-05).
- [ ] **Contributing / development** — how to set up the monorepo, the test tiers, `yarn verify`, the
      docs conventions, and how to add a component doc + example (feeding RD-09's directive).

### Should Have

- [ ] **Migration notes** — "coming from blessed / Ink / Textual / classic Turbo Vision" orientation.
- [ ] A **keyboard-shortcuts reference** aggregating the per-component cheatsheets (RD-05).
- [ ] A **glossary** of TUI terms.
- [ ] `llms.txt` coverage note (the machine-readable index is produced in RD-09; this page explains it).

### Won't Have (Out of Scope)

- The generated symbol API reference — RD-06.
- Screenshot/`llms.txt` generation — RD-09 (this RD authors the human content).
- The editable playground — Phase E (AR-9, AR-17).

---

## Technical Requirements

- The theming gallery and embedded theme-designer run via `@jsvision/web` (RD-02) as live demos
  (RD-03); the theme-role reference is generated/cross-checked against the core `Theme` roles so it
  stays accurate (63 roles).
- The compatibility matrix is generated from `terminal-matrix.json` (a build step transforms it into a
  table) so it updates as evidence accrues.
- Performance figures link to (or are generated from) the `yarn bench` output; they are labelled
  informational and never presented as guarantees.
- The versioning/changelog page is sourced from the repo `CHANGELOG.md` (imported/rendered) so it does
  not fork.

---

## Integration Points

### With RD-01 (site shell) — absorbs the existing `docs/` techdocs as Architecture/ADR seed.
### With RD-04 (landing) — "Why"/"How it works" teasers link here.
### With RD-05 (component docs) — best-practices, theme-role reference, and shortcut aggregation link bidirectionally; status/roadmap aligns with badges.
### With RD-06 (API reference) — cross-links for exhaustive signatures.
### With RD-09 (anti-drift) — `llms.txt`, changelog surfacing, and screenshot assets.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Theme-role/token reference | Skip / include | Include, with live swatches | Unique TUI differentiator | AR-15 |
| Theme-designer | Link native only / embed live | Embed live (via `@jsvision/web`) | Strong interactive proof | AR-15, AR-6 |
| Versioned docs | Multi-version / single + banner | Single "latest" + pre-1.0 banner + changelog | Pre-1.0 churn; honest, low-overhead | AR-18 |
| Compatibility source | Hand-authored / from `terminal-matrix.json` | Generated from the matrix | Stays accurate as evidence grows | AR-32 |

---

## Security Considerations

> **🚨 MANDATORY section.**

- **Data sensitivity**: none (authored content + live demos over the virtual FS). The embedded
  theme-designer's file open/save uses the virtual FS / local-file picker (client-only, AR-26).
- **Input validation / injection**: the theme-designer's color/hex inputs are validated (the existing
  `#rrggbb` validator); all rendered text passes `sanitize()`. The **Security page itself** documents
  this boundary as a feature — it must describe the real behavior accurately (no overclaiming).
- **Authentication / rate limiting / encryption / infra**: N/A beyond RD-01 (static, HTTPS, CSP).
- **Accuracy as a trust control**: performance and compatibility claims are cited to generated
  artifacts (`bench`, `terminal-matrix.json`) and labelled with their verification scope, so the
  "trust" content cannot itself become a source of false claims.

---

## Acceptance Criteria

1. [ ] Each required page exists and renders: Architecture, Guides/Cookbook (≥6 how-tos each with a
       live example), Best Practices, FAQ, Accessibility, Security, Performance, Compatibility matrix,
       Theming (gallery + role reference + embedded designer), Versioning/Changelog/Roadmap,
       Contributing — reachable from the Reference nav with no dead links.
2. [ ] The Architecture page explains the byte-in/byte-out engine and why the same code runs native
       and in-browser, and links to a live demo demonstrating it.
3. [ ] The theming gallery shows all 13 presets and lets the reader switch a live component between
       them; the theme-role reference lists every core `Theme` role with a live swatch; a test asserts
       the documented role list equals the actual core roles (no missing/extra role).
4. [ ] The embedded theme-designer runs in the browser (open, edit a color, see the live preview
       update) with no backend.
5. [ ] The compatibility matrix is generated from `terminal-matrix.json` and reflects its current
       contents (regenerating after an entry is added updates the table).
6. [ ] The Versioning page states the SemVer + pre-1.0 policy and renders the current `CHANGELOG.md`
       content (sourced, not forked); the "may change" banner is visible site-wide (RD-01 slot).
7. [ ] The FAQ answers at least: ESM-only/no-`require`, Node ≥ 20, SSH/tmux/Windows status, "why Turbo
       Vision", browser support, and production-readiness — each answer accurate to the code.
8. [ ] Security requirements verified: the Security page's description of `sanitize()` matches actual
       behavior; the embedded designer's inputs are validated; all live content is `sanitize()`-guarded;
       performance/compatibility claims cite their generated source.
