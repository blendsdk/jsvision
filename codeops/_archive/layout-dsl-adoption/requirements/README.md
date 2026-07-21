# Layout-DSL Flex-Elimination — Requirements Documents

> **Project**: jsvision — `layout-dsl-adoption` feature (the deliberate-divergence flex-elimination sub-scope of epic GH #108)
> **Status**: Draft
> **Created**: 2026-07-19
> **Architecture**: TypeScript ESM monorepo (yarn 1.x + Turborepo); `@jsvision/*` packages; the layout DSL (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`/`center`/`cover`/`at`) in `packages/ui/src/view/dsl/`
> **CodeOps Skills Version**: 3.9.0

---

## Overview

Now that the layout DSL is hardened (GH #113, shipped), most of jsvision's absolute placement turns out to be structurally flex — it only used hand-computed cell coordinates to stay faithful to Borland Turbo Vision. This requirements set records a deliberate policy: **jsvision will break TV geometry parity where doing so replaces absolute placement with flex composition**, because the payoff is *deleting* the coordinate math and resize machinery (not swapping `at()` for `at()`) plus ~470 example/story/docs sites adopting the recommended idiom.

The change overrides two standing disciplines — the TV-fidelity porting guideline and the immutable-spec-test rule — so the policy, the affected component list, the keep-absolute boundary, and the oracle re-derivation protocol are recorded here as the auditable, non-reversible source of truth. Per-package executable scope lives in the GitHub issues; these RDs are the governing contract.

## Domain Glossary

| Term | Definition |
|------|-----------|
| **Flex-elimination** | Replacing absolute (`position:'absolute'`, `.layout.rect`) placement with DSL flex composition (`col`/`row`/`grow`/`fixed`/`stack`/`center`/`cover`). |
| **Deliberate divergence** | A sanctioned, recorded departure from Turbo Vision's exact rendered geometry, invoking the CLAUDE.md TV-fidelity "deliberate divergence" carve-out. |
| **Behavior invariant** | The set of properties that MUST NOT change during a conversion: content, signals, keyboard + mouse, validation, focus/tab order, colors, min-size floor, return values. Only geometry may change. |
| **grow-mode** | The bespoke per-child resize-reflow machinery (`grow-dialog.ts` + `grow.ts`) used only by the file/chdir dialogs; deleted by this work. |
| **Keep-absolute boundary** | Sites that are genuinely not flex (windows, gestures, cursor/caret/measure-anchored placements, true scatter) and are explicitly excluded. |
| **Oracle re-derivation** | Recomputing a geometry spec test's asserted rects from the new flex tree — a recorded requirement change, not a test "fix." |
| **Tier 0 / 2 / 3** | Parity-safe (no geometry change) / dialog bodies (deliberate divergence) / maximal demos-stories-docs. |

## Document Index

| # | Document | Description | Depends On |
|---|----------|-------------|------------|
| **AR** | [Ambiguity Register](00-ambiguity-register.md) | Zero-Ambiguity Gate decisions (13 resolved) | — |
| **RD-01** | [Deliberate TV-Divergence Flex-Elimination Policy](RD-01-deliberate-divergence-policy.md) | The policy: what may diverge, the non-faithful component list, keep-absolute boundary, machinery deletion, tiering | — |
| **RD-02** | [Non-Functional Requirements & Verification](RD-02-non-functional-and-verification.md) | Behavior-invariant test strategy, the spec-oracle re-derivation protocol, kitchen-sink quality gate, perf, security | RD-01 |

## Dependency Graph

```
RD-01 (policy: what diverges, what's recorded, what's deleted)
  └─ RD-02 (verification: how each conversion is proven behavior-safe)

Governs GitHub issues:  #115 (ui/forms dialogs) · #120 (files dialogs + grow-dialog deletion) · #110/#112 (demos/docs)
Out of scope:           #116 (datagrid col/row ports) · #117 (setLayout primitive)
```

## Suggested Implementation Order

| Phase | Documents / Issues | Description |
|-------|--------------------|-------------|
| **A: Tier 0 (MVP)** | RD-01 + RD-02 → part of #115 | Parity-safe, zero oracle cost: base `Dialog` `center()/at()`, 5 `cover()` overlays, `formDialog` body `cover()`, walkthrough demos. Proves the direction with no geometry risk. |
| **B: Tier 2 dialog bodies** | #120 then #115 | files rebuild + delete `grow-dialog.ts`/`grow.ts`; then ui message/editor + forms bodies. Re-derive the bounded oracle set (RD-02). |
| **C: Tier 3 maximal** | #110 / #112 | ~470 example/story/docs canvas conversions; zero oracle cost, didactic; kitchen-sink quality gate. |

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Divergence scope | Maximal (dialogs + demos), break TV parity | Enables machinery deletion + idiom convergence | 
| Oracle handling | Re-derive with a recorded decision | Parity break is an auditable requirement change |
| RD structure | Policy RD + non-functional RD | Feature is GitHub-issue-driven; issues carry per-package how-to |
| Tab-traversal order | Preserve exactly + per-dialog spec test | Traversal follows child add-order; a silent reorder is a behavior change |
| Non-faithful record | RD + CLAUDE.md carve-out | The RD is the record; CLAUDE.md is where a porter reads it |
| First slice | Tier 0 parity-safe first | Zero-risk proof before any oracle re-derivation |

## How to Use These Documents

1. Start with **RD-01** (the policy) → run the make_plan skill to produce the Tier-0 (Phase A) plan first.
2. Use **RD-02** as the verification contract for every plan/PR under this feature.
3. The GitHub issues (#115/#120/#110/#112) carry the per-file executable detail; each geometry-changing PR cites RD-01 and follows the RD-02 oracle protocol.
