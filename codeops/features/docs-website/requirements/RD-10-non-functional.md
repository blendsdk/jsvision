# RD-10: Non-Functional Requirements

> **Document**: RD-10-non-functional.md
> **Status**: Draft
> **Created**: 2026-07-09
> **Project**: jsvision
> **Feature-Set**: docs-website
> **Depends On**: spans all (RD-01…RD-09)
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.3.2

---

## Feature Overview

The cross-cutting quality bar the whole site must meet: **performance** (fast pages, bounded
live-terminal memory), **accessibility** (the site chrome meets WCAG; every live terminal has a
DOM-accessible source + description), **security** (the CSP and client-only posture already decided,
stated here as testable targets), **SEO & social**, **browser/device support**, and
**maintainability / content-ops** (the site scales as components are added without per-page bespoke
work). These are the requirements users forget and reviewers regret — collected here so no content RD
has to re-derive them.

---

## Functional / Quality Requirements

### Must Have

- [ ] **Performance targets**:
      - Production build: initial route (landing) **Lighthouse Performance ≥ 90** on desktop; largest
        content paints without layout shift (CLS < 0.1).
      - The xterm/live-demo runtime and Monaco (later) are **lazy-loaded** — they are NOT in the
        initial landing bundle; a Play dialog loads them on demand.
      - At most **one** live terminal is instantiated at a time; closing a dialog disposes it (RD-03),
        so long browsing sessions do not accumulate memory.
- [ ] **Accessibility targets**:
      - Site chrome (nav, sidebar, content, controls) meets **WCAG 2.1 AA** (contrast ≥ 4.5:1 body
        text; keyboard-navigable; visible focus; landmarks/headings) in light and dark.
      - Every live example exposes its **source + prose description in the DOM** (the terminal canvas
        is not relied on for meaning); Play controls are labelled and keyboard-operable (RD-03).
      - Respects `prefers-reduced-motion` (GIFs/animations degrade to static).
- [ ] **Security targets** (consolidating AR-26):
      - A `<meta http-equiv="Content-Security-Policy">` restricts `script-src`/`style-src`/`img-src`/
        `connect-src`/`frame-src` to the site origin + explicitly allowlisted hosts; no `unsafe-eval`
        except inside the isolated later-REPL worker/iframe.
      - No secrets in the client bundle; the deploy uses only the ephemeral `GITHUB_TOKEN` (RD-01).
      - All untrusted rendered text (file content, paste, example data) passes `sanitize()`; uploads
        stay client-side (RD-02/RD-07).
      - Build dependencies pinned (`yarn.lock`) and audited (`npm audit` in CI); docs-site toolchain
        never leaks into a shipped package's runtime deps (`check:deps` green).
- [ ] **Browser/device support**: current Chrome, Firefox, Edge, and Safari (last 2 major versions) on
      desktop render the site and run live demos; **touch/no-keyboard** devices get the GIF/screenshot
      fallback (RD-03) and can read all content.
- [ ] **SEO & social**: unique title/description per page, OG/Twitter cards with the generated hero
      image, `sitemap.xml`, `robots.txt`, canonical URLs under `base:'/jsvision/'` (RD-01).
- [ ] **Maintainability / content-ops**: adding a new component's docs is **one page + one example +
      one `components.json` row** (no bespoke wiring); the coverage gate (RD-09) enforces it; content
      is authored by agents and reviewed by the user (AR-21).

### Should Have

- [ ] A CI **Lighthouse** (or equivalent) check on the built landing + one component page, reported
      informationally (gating threshold optional to avoid flaky failures).
- [ ] Bundle-size budget for the initial route (e.g. warn if the landing JS exceeds a set KB budget).
- [ ] A basic **link-check** across the built site in CI (no dead internal links).
- [ ] **i18n-readiness**: content structure does not preclude a future locale split (no hard-coupled
      copy in components) — not translated now.

### Won't Have (Out of Scope)

- Actual localization/translations — future.
- Backend performance/availability concerns — N/A (static CDN).
- Load/stress testing — N/A (static site).

---

## Technical Requirements

- Lazy-loading is achieved via dynamic `import()` of the `@jsvision/web` + xterm bundle behind the
  Play action; the landing route ships no terminal runtime.
- Accessibility is verified with an automated pass (e.g. axe) on key pages plus manual keyboard checks;
  the source-beside-demo requirement is structural (RD-03) and testable in the DOM.
- The CSP is delivered via `<meta>` (GitHub Pages cannot set headers); it is authored to the minimum
  hosts actually used (site origin + any social-badge host); the later REPL's code execution is
  isolated to a worker/iframe with no network (`connect-src 'none'` in that context).
- Determinism/caching: static assets are content-hashed (VitePress default) for long-cache + correct
  invalidation.

---

## Integration Points

- **RD-01** owns the SEO/CSP/build-hashing surface these targets are asserted against.
- **RD-03** owns lazy terminal creation/disposal and source-beside-demo that the perf + a11y targets
  depend on.
- **RD-09** owns the CI jobs (Lighthouse/axe/link-check/audit) that verify these targets.
- **RD-02/RD-07** own the client-only upload + `sanitize()` behaviors the security targets assert.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Terminal loading | Eager / lazy per Play | Lazy, single instance, disposed | Perf + bounded memory | AR-9, RD-03 |
| Security posture | Minimal / full (CSP + sandbox + client-only) | Full | "Security is a selling point" | AR-26 |
| a11y for live demos | Canvas only / source-beside | Source + prose in DOM always | Canvas opaque to AT | AR-29 |
| Perf gating | Hard-gate Lighthouse / informational | Informational (+ optional budget) | Avoid flaky CI blocks; still measured | AR-33 |

---

## Security Considerations

> **🚨 MANDATORY section.** (This RD *is* substantially the security/quality consolidation.)

- **Data sensitivity**: none server-side; user file content stays client-only (RD-02/RD-07).
- **Input validation & sanitization**: every untrusted rendered byte passes `@jsvision/core`
  `sanitize()`; the later REPL compiles/executes only in an isolated, network-less sandbox.
- **Injection prevention**: escape-sequence injection closed by `sanitize()`; no server → no SQL/command
  injection surface; content rendered escaped by VitePress.
- **Authentication & authorization**: N/A (public static site).
- **Rate limiting**: N/A (static CDN).
- **Secrets management**: no hardcoded secrets; deploy via `GITHUB_TOKEN` only.
- **Encryption**: HTTPS enforced by GitHub Pages; no data at rest beyond in-browser memory.
- **Infrastructure hardening**: CSP; pinned + audited build deps; docs toolchain isolated from shipped
  packages; content-hashed assets.
- **Security testing**: a `sanitize()` regression on rendered untrusted content; a CSP-presence check;
  a `check:deps` assertion for shipped packages; an `npm audit` step in CI.

---

## Acceptance Criteria

1. [ ] A production Lighthouse run on the landing page scores **Performance ≥ 90** and **Accessibility
       ≥ 95** on desktop (reported in CI); CLS < 0.1.
2. [ ] The landing route's initial JavaScript does **not** include the xterm/`@jsvision/web` runtime
       (verified by inspecting the built landing bundle); opening a Play dialog triggers a dynamic
       chunk load for the terminal runtime.
3. [ ] An automated a11y pass (axe or equivalent) on the landing, one component page, and one app page
       reports **no critical violations**; keyboard-only navigation can reach nav, sidebar, and the
       Play control with a visible focus indicator; contrast ≥ 4.5:1 for body text in both themes.
4. [ ] Every live example page contains the example's source and a text description in the DOM without
       running the terminal (verified with JS/canvas disabled), and honors `prefers-reduced-motion`.
5. [ ] Every deployed page carries a `<meta http-equiv="Content-Security-Policy">` whose `connect-src`
       excludes any non-allowlisted host; a test asserts no `unsafe-eval` on content pages.
6. [ ] The site renders and a flagship live demo runs on current Chrome, Firefox, Edge, and Safari
       (last 2 majors) desktop; a simulated touch device shows the fallback and can read all content.
7. [ ] Each page has a unique title/description + OG card; `sitemap.xml`, `robots.txt`, and canonical
       URLs are present; a CI link-check finds no dead internal links.
8. [ ] Adding a dummy public export and running `yarn check:docs-site` fails until a page + example +
       `components.json` row are added — proving the "one page + one example + one row" maintainability
       contract is enforced (cross-check with RD-09).
9. [ ] Security requirements verified: `sanitize()` regression passes; CSP presence + no-`unsafe-eval`
       check passes; `check:deps` green for shipped packages; `npm audit` runs in CI; no secret in the
       client bundle.
