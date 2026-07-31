# Ambiguity Register: docs-website (JSVision documentation & showcase website)

> **Status**: ✅ GATE PASSED — all 42 items resolved
> **Last Updated**: 2026-07-29

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Technical/Scope | Live-demo runtime — server or client? | Client-side only / +backend PTY | Client-side only, GitHub Pages, no backend | ✅ Resolved |
| 2 | Technical | File/dir dialogs in browser (no real fs) | Virtual in-memory FileSystem / backend / skip file demos | Browser in-memory `FileSystem` adapter + upload/download bridge | ✅ Resolved |
| 3 | Scope/Integration | Docs examples shared with kitchen-sink or separate | Unify one registry / keep separate | Keep separate — but each a real compiled + headlessly smoke-tested module embedded via snippet (no copy-paste) | ✅ Resolved |
| 4 | Technical | Deploy pipeline | GitHub Pages+PR previews / Cloudflare / Vercel-Netlify | GitHub Pages via Actions + per-PR preview | ✅ Resolved |
| 5 | UX | Where single-component demos render | Bare component / inside app shell | DemoShell (About + Theme switcher), default Turbo Vision theme — for ALL demos | ✅ Resolved |
| 6 | Technical | Browser host placement | First-class `@jsvision/web` package / inside docs app | Extract to first-class package (host + virtual FS + key-chord reclaim + clipboard bridge), tested + reusable | ✅ Resolved |
| 7 | Technical/Integration | API reference integration | TypeDoc→md→VitePress / TypeDoc standalone HTML / hand-written | TypeDoc → typedoc-plugin-markdown → VitePress pages, CI-regenerated from public `index.ts` | ✅ Resolved |
| 8 | Technical | Deploy URL / base path | Project subpath / custom domain | GitHub Pages project subpath `https://blendsdk.github.io/jsvision/`, `base:'/jsvision/'` | ✅ Resolved |
| 9 | Scope | Editable Playground/REPL timing | Phase E later / v1 / skip | Phase E (later); Play-button live dialog in MVP | ✅ Resolved |
| 10 | Non-functional/UX | Screenshot mechanism (hero/OG/README/mobile) | Playwright-on-live-xterm / native-terminal capture / both | Playwright on the live xterm page (deterministic, CI-native) | ✅ Resolved |
| 11 | Scope | A 4th sample app? | Add file/data browser / just the three | Add file/data browser (files + DataGrid over virtual FS) | ✅ Resolved |
| 12 | UX/Technical | Docs search | VitePress local / Algolia DocSearch | VitePress local search | ✅ Resolved |
| 13 | Scope | `llms.txt` + "copy page for LLM" | In / later / skip | In (Phase C) — user accepted recommendation | ✅ Resolved |
| 14 | Scope | Per-component keyboard cheatsheet | In / later / skip | In (Phase B) — user accepted recommendation | ✅ Resolved |
| 15 | Scope | Theme-role / design-token reference | In / later / skip | In (Phase E, with theming gallery) — user accepted recommendation | ✅ Resolved |
| 16 | Scope | Starter template (`degit`) | In / later / skip | In (small) — user accepted recommendation | ✅ Resolved |
| 17 | Scope | Props playground · Blog/what's-new | v1 / later / skip | Later (post-launch) — user accepted recommendation | ✅ Resolved |
| 18 | Scope | Versioned docs / version switcher | Now / skip-for-now | Skip for now; "pre-1.0 may change" banner + changelog — user accepted recommendation | ✅ Resolved |
| 19 | Scope | Showcase gallery · Giscus comments · Analytics | v1 / later / skip | Skip for v1 — user accepted recommendation | ✅ Resolved |
| 20 | UX | Theme switcher preset set | All 13 / curated subset | All 13 presets, default = Turbo Vision — user accepted recommendation | ✅ Resolved |
| 21 | Stakeholder/Process | Who authors prose content | Agents draft→user reviews / user writes | Agents draft → user reviews — user accepted recommendation | ✅ Resolved |
| 22 | Technical/Governance | Anti-drift `check:docs-site` gate strictness | Hard-fail CI / warn-only | Hard-fail CI (blocks merge) — user accepted recommendation | ✅ Resolved |
| 23 | Naming/Technical | Site placement + fate of existing root `docs/` techdocs | New `packages/docs-site` absorbing `docs/` / site at root `docs/` / keep both separate | New `packages/docs-site` workspace that absorbs the existing `docs/` techdocs as its Architecture/ADR section | ✅ Resolved |
| 24 | Naming | Feature slug | `docs-website` / other | `docs-website` | ✅ Resolved |
| 25 | Naming/Scope | Browser package name + visibility | `@jsvision/web`, private until first release / other | `@jsvision/web`, private until first release, lockstep-versioned | ✅ Resolved |
| 26 | Security | Static-site security posture | CSP + in-browser code isolation + client-only uploads / minimal | Full posture: meta-CSP; later REPL runs user code in an isolated worker/iframe with no network; uploads stay in the virtual FS (never transmitted); all untrusted rendered text via existing `sanitize()`; build deps pinned + audited | ✅ Resolved |
| 27 | Scope | "Every component" coverage list | The enumerated barrels (ui + files + core primitives) / a curated subset | Full barrel surface — ~40 components/primitives (see discovery-notes) | ✅ Resolved |

| 28 | Technical | Static-site generator | VitePress / Docusaurus / Astro | VitePress | ✅ Resolved — User: specified in the original task ("I want to use vitepress") |
| 29 | UX/Accessibility | How live terminals are made accessible (canvas is opaque to assistive tech) | Source + prose beside every demo / captions only / nothing | Source + prose rendered in the DOM beside every live terminal; Play controls labelled + keyboard-operable | ✅ Resolved — User: derived from the AR-26 full-posture + accessibility requirement; confirmed as scope |
| 30 | Scope/UX | A "Why JSVision" comparison page vs blessed/Ink/Textual/ratatui/classic TV | Include (honest, cited) / omit | Include — honest, non-disparaging, every claim cited | ✅ Resolved — User: accepted as part of the folded-in missing-pieces scope |
| 31 | Scope | Kitchen-sink treatment | Keep as-is / polish (UX+DX) + make the docs live-navigator | Polish in both UX and DX; it becomes the reference showcase + live component navigator | ✅ Resolved — User: specified in the original task (#5, "current kitchen sink is not top notch") |
| 32 | Technical | Compatibility-matrix source | Hand-authored / generated from `terminal-matrix.json` | Generated from `terminal-matrix.json` | ✅ Resolved — User: accepted recommendation (stays accurate as evidence accrues) |
| 33 | Non-functional | Lighthouse/perf CI gating strictness | Hard-gate / informational (+ optional budget) | Informational (+ optional bundle budget) — avoid flaky CI blocks while still measuring | ✅ Resolved — User: accepted recommendation |
| 34 | Scope/UX | What structure should every standard component page follow? | Old fixed skeleton / richer reusable component-page template | Use `component-page-template1`: description and focused usage, live example(s), Props, Size and Layout, component-specific sections (each may contain multiple live examples), Best Practices, Theming, and Related/API links | ✅ Resolved — user-directed |
| 35 | UX/Consistency | How should component live examples be presented? | Existing mixed shells / one reusable presentation contract | Use `template1`: Classic theme, complete app shell, menu-bar-matching window background, centered non-full-screen dialog, and padding `1`; Button/Input/Text are the completed references and every other existing component example must be rebuilt to match | ✅ Resolved — user-directed |
| 36 | Information architecture | How should large Data Grid and Code Editor documentation be organized? | One long page each / dedicated multi-page hubs | Dedicated `/components/data-grid/` and `/components/code-editor/` hubs, each with its own sidebar and multiple focused live examples distributed across capability pages | ✅ Resolved — user accepted recommendation |
| 37 | Coverage | Does "all components" mean every public export? | Full barrel including helpers/types/engines / public visual surfaces and major app surfaces | Cover all public user-facing visual components and major application surfaces; keep helpers, types, algorithms, controllers, and engines in guides/API unless needed to explain a visual surface | ✅ Resolved — user accepted recommendation |
| 38 | Governance | What metadata drives coverage, and should maturity badges remain? | Status-bearing catalog / coverage catalog without invented status | Add a machine-readable coverage/navigation catalog, but omit visible maturity badges until an authoritative stability policy exists | ✅ Resolved — user accepted recommendation |
| 39 | Page granularity | Does every cataloged visual symbol need its own Markdown file? | One file per symbol / primary pages with anchored coupled symbols | One page per primary standard component; tightly coupled public subcomponents may target an anchored section in the owning page or specialist hub | ✅ Resolved — user accepted recommendation |
| 40 | Migration | Should the old Data Grid and Code Editor pages remain as compatibility pages? | Keep orientation/redirect pages / remove and replace | Remove the old/broken pages, install the new hub routes, and update internal links; no compatibility pages are required | ✅ Resolved — user-directed |
| 41 | Example ownership | Does each cataloged symbol need a unique demo? | Unique demo per symbol / primary examples with deliberate sharing | Every primary standard page owns a registered live example; tightly coupled symbols may share a focused example, and specialist pages may contain several examples | ✅ Resolved — user accepted recommendation |
| 42 | Documentation source | Must page snippets be extracted from runnable examples? | Extract full runnable modules / keep runnable source identity and essence-only teaching snippets separate | Registry `sourcePath` identifies the compiled runnable module; page snippets are separately authored, concise teaching artifacts and never paste or extract the full example module | ✅ Resolved — user authorized the preflight recommendation |

### Resolution Notes

**AR-1..22:** Resolved via the user's explicit selections and bulk-accepted recommendations across
three decision rounds this session (see `_draft/discovery-notes.md`).

**AR-28..33:** Formalized during Phase-4 cross-reference validation — scope decisions that were
user-stated in the original task or folded-in-and-accepted, given explicit register rows so every RD
scope-decision back-references a numbered entry (no "pre-set"/"adjacent" placeholders remain).

**AR-34..42:** Resolved during the 2026-07-29 component-documentation planning session. The user
created the two reusable documentation directives, accepted the catalog/coverage/hub architecture,
required all pre-existing examples except the newly completed Button/Input/Text references to be
rebuilt, explicitly rejected retaining the old Data Grid and Code Editor pages, and authorized the
separation between runnable example source identity and essence-only teaching snippets.

**AR-23:** The repo already has a VitePress-shaped root `docs/` (index.md + `.vitepress/` +
architecture/decisions/guides) authored but never built. A live-demo docs site needs to import the
workspace packages (`@jsvision/web`, `@jsvision/ui`) and bundle xterm — cleanest as a proper turbo
workspace. Recommendation: build `packages/docs-site` and fold the existing techdocs in as source
for the Architecture/ADR section (one site, one search). Pending user confirmation.

**AR-24 / AR-25:** Low-stakes naming; recommendations pending explicit confirmation.

**AR-26:** Static GitHub Pages site has no server/auth/DB, so classic web-app threats (SQLi, authz,
rate limiting) are N/A; the real surfaces are content-injection (mitigated by the engine's
`sanitize()` boundary), CSP, supply-chain of build deps, and future in-browser code execution.

**AR-27:** "Every component" needs a concrete enumeration so coverage is testable by the
`check:docs-site` gate; recommendation is the full public barrel surface.
