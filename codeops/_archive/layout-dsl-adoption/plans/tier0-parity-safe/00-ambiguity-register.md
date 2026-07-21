# Ambiguity Register: Tier-0 Parity-Safe DSL Adoption

> **Status**: ✅ GATE PASSED — all plan-level items resolved
> **Plan**: `layout-dsl-adoption/tier0-parity-safe`
> **Implements**: `layout-dsl-adoption/RD-01` (Tier-0 slice) · verification contract `RD-02`
> **Last Updated**: 2026-07-19
> **CodeOps Skills Version**: 3.9.0

## Inherited context (already resolved upstream)

This plan sits under a feature whose requirements gate has already passed. The 13 policy-level
decisions in [`../../requirements/00-ambiguity-register.md`](../../requirements/00-ambiguity-register.md)
(scope = maximal divergence, oracle re-derivation protocol, keep-absolute boundary, behavior
invariant, machinery deletion, tiering, security posture) are **inherited as pre-resolved** and not
re-litigated here. This register captures only the **plan-level** decisions this Tier-0 slice raised —
several of them surfaced by grounding the RD's "Tier 0 = zero oracle cost" claim against the real code.

## Plan-level decisions

| # | Category | Ambiguity / Gap | Options | Decision | Status |
|---|----------|-----------------|---------|----------|--------|
| PA-1 | Scope / Testing | The app overlay (`ui/app/application.ts:335/435`) is located by `app-shell.menu.spec.test.ts:58-59` (a **spec** oracle) and asserted by `app-shell.lifecycle.impl.test.ts:41-43,51,59` via `layout.position === 'absolute'` + its rect. `cover()` sets `position:'fill'` (no rect), breaking both even though the rendered screen is identical — so this one Tier-0 site is **not** zero-spec-oracle-cost. | (A) Split — defer the app-overlay conversion, keep it absolute in Tier 0 · (B) Include — convert now + re-derive the spec/impl oracles | **A — Split.** The app overlay stays `position:'absolute'` in this plan; its `cover()` conversion + the recorded spec re-derivation move to a follow-up under #115. Tier 0 stays literally zero-spec-oracle-cost. | ✅ Resolved |
| PA-2 | Scope / Docs | RD-01 FR-7 / AC-1 requires a CLAUDE.md "Turbo Vision fidelity" carve-out naming the deliberately-non-faithful dialog set. Tier 0 changes no geometry; Tier 2 is the first real divergence. When does this plan land it? | (A) Land now in Tier 0 · (B) Defer to Tier 2 | **A — Land now.** Add the carve-out as a doc-only task in this plan, so the record is in place before Tier 2's first divergence. Zero code risk. | ✅ Resolved |
| PA-3 | Tooling | Which command fills every Verify line? | Detected from CLAUDE.md | **`yarn verify`** (= `yarn lint` → `turbo run typecheck build test check:docs`); `yarn lint:fix` before each PR-bound push (repo prime directive). | ✅ Resolved |
| PA-4 | Naming | Plan slug. | Proposed | **`tier0-parity-safe`** under `codeops/features/layout-dsl-adoption/plans/`. | ✅ Resolved |
| PA-5 | Scope boundary | RD-01 Tier-0 names "walkthrough demos" + "demo-shell inner". The examples package holds ~470 conversion sites total. Which are IN this plan vs Tier 3 (#110/#112)? | Enumerated by the current-state sweep | **IN Tier 0:** the enumerated full-viewport walkthrough roots + the 2 demo-shell inners + the one hand-centered `controls-live` dialog (§02, ~15-18 sites). **OUT (→ Tier 3):** inner-widget `at()` sites, story canvases, docs-site examples. | ✅ Resolved |
| PA-6 | Technical | `center(view,w,h)` and `at(view,rect)` do **not** set `padding`, but base `Dialog` sets `padding:1` in the same `layout` assignment (`dialog.ts:108`). A naive swap would drop the padding. | Grounded in `dsl/absolute.ts:93-97` + `dialog.ts:99-109` | **Preserve `padding:1`.** The conversion pre-seeds `this.layout = { padding: 1 }` (or merges it) so the merge-preserving `center()`/`at()` retain it. The witness oracles (`dialog.centering.spec`, `dialog.resize.impl`) are the hard gate on shape parity. | ✅ Resolved |
| PA-7 | Testing posture | CodeOps is spec-first (red → green). This slice is a **behavior-invariant refactor** — there is no new behavior to drive a red test. What is the correct discipline? | (A) Characterization/witness (green-before-green-after) + fill coverage gaps · (B) Force artificial red tests | **A.** Existing behavioral/witness oracles must pass **unedited** (RD-02 NFR-1); where coverage is thin (menu-catcher rect, base-Dialog layout shape) add a characterization test that is green on current code first, then stays green through the refactor. No spec oracle is edited in this plan (that is PA-1's whole point). | ✅ Resolved |
| PA-8 | Technical | With the app overlay deferred (PA-1), can the **menu catcher** (`menu/controller.ts:230/286`, a child of that overlay) still convert to `cover()` in Tier 0? | Grounded in `app-shell.menu.spec.test.ts` (selects the overlay, not the catcher's rect) | **Yes.** The catcher's own rect is not oracle-pinned; the menu spec finds the *overlay* (which stays absolute) then asserts click behavior. Convert `cover(catcher)` and gut the `controller.resize()` re-anchor body; leave `application.ts`'s overlay + its `onResize` re-anchor untouched. | ✅ Resolved |

### Notes

- **PA-1 is the headline plan-level finding.** The RD's tiering table labelled all five `cover()`
  overlays "Tier 0, zero oracle cost." Grounding that against the tests showed the app overlay is the
  exception — its `position:'absolute'` descriptor is used as a *locator* by a spec test and asserted
  by an impl test. Deferring it keeps the MVP's promise (prove the direction with zero spec-oracle
  cost) literally true; the deferred piece is small and lands under #115 with the RD-02 ceremony.
- **PA-6 / PA-7** are technical constraints, recorded so the plan traces them rather than leaving
  the padding subtlety and the "why no red-first tests" question implicit.
