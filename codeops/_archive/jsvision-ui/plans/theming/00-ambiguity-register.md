# Ambiguity Register: Theming (`createTheme` + aliases + presets + hot-swap)

> **Document**: 00-ambiguity-register.md
> **Parent**: [Index](00-index.md)
> **Gate status**: ✅ GATE PASSED
> **Created**: 2026-07-08
> **CodeOps Skills Version**: 3.3.2

The Zero-Ambiguity Gate for the RD-22 plan. RD-22 (Theming) was authored (`make_requirements`,
2026-07-08) and **preflighted PASSED** (`../../requirements/00-preflight-report-RD-22.md`,
2026-07-08 — 6 findings, all resolved → AR-279…AR-283): the `EventLoop.setTheme` frame-delivery
seam (AR-279), the dropped `accentForeground` synonym → a fully-defined 16-token set (AR-280),
parse-by-field-kind validation (AR-281), the `{version,roles}` envelope (AR-282), and the
unresolvable-`'default'` policy — `ramp` throws / `contrastRatio` → `NaN` (AR-283). Those
requirement-level decisions (AR-264…AR-283) are **already resolved in the RD** and are the primary
input to this plan; they are not re-litigated here.

This register resolves the residual **plan-time decisions the RD deferred or that surfaced during
plan-time codebase reconnaissance** — the verify command, the generated-theme role-mapping fidelity,
the exact hot-swap mechanism against the real render root, and three grounding corrections the recon
turned up (the true `defaultTheme`-invariance oracle, the `desktop.pattern` glyph validator, and the
additive-surface governance guard). Two were put to the user (PA-1, PA-2) and accepted as
recommended on 2026-07-08; the rest are single-dominant-option decisions grounded in the current
code and recorded for traceability.

## Gate summary

| #    | Status | Category | Decision | Source |
|------|--------|----------|----------|--------|
| PA-1 | ✅ Resolved | Process / verify | Per-phase Verify line = `yarn verify`; the final hardening phase additionally runs `yarn lint` + per-package `yarn typecheck` before done (closes the known gap: `yarn verify` skips lint/prettier and vitest does not type-check). | User (accepted rec) |
| PA-2 | ✅ Resolved | Design / theme | `rolesFromAliases` uses **semantic collapse**: each of the 63 roles maps to its nearest of the 16 aliases by purpose (accent/focus surfaces → `accent`/`accentMuted` + `foregroundOnAccent`; body text → `foreground`; sunken fields → `backgroundSunken`; status → `danger`/`warning`/`success`/`info`). Generated themes get a coherent, accent-seed-driven look; `defaultTheme` keeps its full per-role variety as the literal `turboVisionTheme`. | User (accepted rec) |
| PA-3 | ✅ Resolved | Design / hot-swap mechanism | `RenderRoot.setTheme(t)` mirrors the existing `setRevealAccelerators` pattern: assign the (now-mutable) `theme` field, then call `markRelayout()` — one coalesced full recompose (the reflow is a harmless deterministic no-op on geometry, exactly as it already is for the accelerator overlay). `EventLoop.setTheme(t) = runTick(() => renderRoot.setTheme(t))` so the trailing `flush()`+`onFrame()` pushes the frame regardless of call context; `Application.setTheme` forwards to the loop seam. | Source (`packages/ui/src/view/render-root.ts:225,296,300,367`; `event-loop.ts:351-370`) |
| PA-4 | ✅ Resolved | Testing / oracle correction | The RD's AC-7 "golden-screen suite passes byte-identical" is the **wrong oracle** — `golden-screen.spec.test.ts` uses synthetic `Style` literals and never imports `defaultTheme`. The true `defaultTheme`-unchanged oracles are the data-level `*-theme.spec` `toStrictEqual` tests (`color-palette-theme.spec`, `theme-roles.spec`, and the ui `*-theme.spec` files) plus a new `themeRoleToStyle` attr-free-invariance impl test. The testing strategy cites those; golden-screen only proves the render pipeline is untouched. | Source (recon: `packages/core/test/golden-screen.spec.test.ts:49`, `color-palette-theme.spec.test.ts:42-68`) |
| PA-5 | ✅ Resolved | Security / validation refinement | `parseTheme` validates `desktop.pattern` as a **single printable cell**, not merely `sanitize`-clean: `sanitize` keeps `\t`/`\n`, so a pattern is rejected unless `sanitize(pattern) === pattern` **and** it contains no `\t`/`\n` **and** it is exactly one display cell wide. | Source (recon: `packages/core/src/engine/safety/sanitize.ts:35` — tab/newline preserved) |
| PA-6 | ✅ Resolved | Governance / additive guard | `api-stability.spec` is doc-presence only (CHANGELOG `[Unreleased]` + README heading), **not** an export snapshot. The additive-only guard is a new `theme-packaging.spec.test.ts` (mirrors `color.packaging.spec.test.ts`) asserting the new symbols are importable, every pre-existing color export still resolves, and each new source file is ≤ 500 lines; plus a CHANGELOG `[Unreleased]` entry. `@example` (via `check-jsdoc.mjs`) is required on the 7 functions/class only — presets, `defaultTheme`, and `ThemeColors` are exempt (plain data / types). | Source (recon: `api-stability.spec.test.ts:24-34`, `color.packaging.spec.test.ts:42-66`, `scripts/check-jsdoc.mjs:164-194`) |
| PA-7 | ✅ Resolved | Structure / demo shape | `demo:themes` splits into a **pure `designer.ts`** (the seed→theme state machine + export-JSON + depth toggle + contrast-warning computation — unit-tested headlessly and driven by a headless-walkthrough e2e) and a real-TTY **`main.ts`** (`createApplication`, hand-verified per AC-15). Headless CI coverage of live theme-switching comes from the kitchen-sink `Theming` story + smoke test. | Source (recon: `feedback-demo/main.ts` + `feedback-demo.e2e.test.ts`; `controls-live/form.ts` split idiom) |
| PA-8 | ✅ Resolved | Structure / file split | Files follow RD-22's module layout. Contingency: if `create-theme.ts` (the 63-role `rolesFromAliases` map + `createTheme`) approaches the 500-line budget, split the mapping into `roles.ts` (`rolesFromAliases`) and keep `create-theme.ts` for `ThemeOptions`/`createTheme`. `theme.ts` (currently 334 lines) gains only the optional `attrs?` field. | Source (recon: file-budget rule in `color.packaging.spec.test.ts:59-66`; `theme.ts` = 334 lines) |

## Category sweep (12 categories)

All 12 Zero-Ambiguity categories were reviewed against the RD + the current code. Because RD-22 was
freshly preflighted (13 dimensions, codebase-grounded), most categories were already resolved at the
requirement level (AR-264…AR-283). Residual plan-time items are captured above.

| Category | Outcome |
|----------|---------|
| 1. Functional scope | Resolved in RD (Feature Overview + Must/Should/Won't). No residual. |
| 2. Data model & types | Resolved: `ThemeColors` (16 tokens, AR-266/AR-280), `ThemeRole.attrs` (AR-271), `{version,roles}` envelope (AR-282). Role-mapping fidelity → **PA-2**. |
| 3. Behavior & control flow | Hot-swap mechanism against the real render root → **PA-3**. |
| 4. Error handling | Resolved: `ramp` throws / `contrastRatio` → `NaN` (AR-283), `InvalidThemeError` no-partial-theme (AR-281). Pattern-glyph validator refinement → **PA-5**. |
| 5. Security | Resolved: `toRgb`/`sanitize` boundaries, JSON-only, no fs in core (RD §Security). Pattern validator → **PA-5**. |
| 6. Integration & dependencies | Resolved: reuses `Color`/`toRgb`/`encode`/`downsample`/`Attr` (RD §Integration). Additive-surface governance guard → **PA-6**. |
| 7. Performance | Resolved: one coalesced recompose per swap; no new diffing (RD §Hot-swap; reuses `serialize`). |
| 8. UX / presentation | Resolved: designer surfaces contrast warnings (warn-only), depth preview (AR-273, AR-278). Demo shape → **PA-7**. |
| 9. Testing & acceptance | 18 ACs in RD. `defaultTheme`-invariance oracle correction → **PA-4**. |
| 10. Edge cases | Resolved: `'default'`/unresolvable seeds (AR-283), light-vs-dark inversion, out-of-range attrs, wrong role shape (AR-281). |
| 11. Naming & structure | Resolved: API names (AR-275), module layout (AR-265). File-split contingency → **PA-8**. |
| 12. Process / tooling | Verify command → **PA-1**. |

> **Traceability:** requirement-level decisions live in `../../requirements/00-ambiguity-register.md`
> (AR-264…AR-283). This register owns only the plan-time PA-1…PA-8 above.
