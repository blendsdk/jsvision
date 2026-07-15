# Ambiguity Register — non-functional (RD-04)

> Phase 1C gate for the RD-04 (non-functional) plan. RD-04 is a **cross-cutting reconciliation**
> slice: most of its surface was satisfied incrementally by RD-01/02/03, so this register only
> resolves the **plan-local** decisions. The packaging/security-posture/performance/validation
> decisions it rests on are already owned by the requirements register
> (`../../requirements/00-ambiguity-register.md`, AR-02/16/22/23) and are **imported as resolved**,
> not re-litigated.

## Imported — already resolved (owned by the requirements register)

| AR | Decision | Where owned |
|----|----------|-------------|
| AR-02 | Zod used directly; `zod` a required **peer** dependency; core/ui stay zero-dep | requirements AR-02 |
| AR-16 | `@jsvision/forms` packaging: dep `@jsvision/ui` + peer `zod`, ESM-only, single barrel | requirements AR-16 |
| AR-22 | Security posture — engine never bypasses the widgets' control-byte sanitization; no `eval`/dynamic code; no secrets/PII/network/FS | requirements AR-22 |
| AR-23 | Performance — eager whole-object `safeParse`; no debounce this slice; no perf gate | requirements AR-23 |

## Plan-local — resolved (this plan)

| AR | Question | Decision | Status |
|----|----------|----------|--------|
| AR-P1 | Plan slug / folder name | `non-functional` — matches the RD title; sibling of `form-store` / `widget-binding`. | ✅ Resolved |
| AR-P2 | FR-4.3 asks a control-byte value "cannot escape sanitization **on render**", but the shipped `security.impl.test.ts` only pins the store *round-trip* ("the store never renders"). How is the render path proven? | **Add a render-path spec test** (`security.spec.test.ts`): bind a text field to a real `Input`, set a control-byte-laden value, mount through a `RenderRoot`, and assert every painted cell is a printable glyph (no raw control byte). Directly demonstrates the FR-4.3 AC end-to-end. *(Rejected: leaning solely on `@jsvision/ui`'s own sanitization tests — leaves the forms package never demonstrating its own AC.)* | ✅ Resolved |
| AR-P3 | FR-4.5 requires "spec tests exist for every RD-01…03 acceptance criterion and pass." The package already ships extensive spec+impl suites. How deep is the reconciliation? | **Audit + fill real gaps** — map each RD-01/02/03 acceptance criterion to its existing spec test in `07-testing-strategy.md`; write new spec cases only where a criterion is genuinely uncovered. No churn to the immutable spec oracles. *(Rejected: "trust the existing suite by construction" — no per-AC traceability.)* | ✅ Resolved |
| AR-P4 | The kitchen-sink form has a submit-gated button but no backend. What does a valid submit do? | **Echo the submitted values** — on valid submit show `✓ Submitted: {…}`; the form keeps its values (mirrors a real form's post-submit state). An invalid submit marks all fields touched (per RD-01 FR-1.10), revealing every error — that IS the visible submit gate. *(Rejected: reset-on-submit; minimal boolean flag.)* | ✅ Resolved |
| AR-P5 | Concrete story design — which fields/schema/widgets (FR-4.6 fixes the field *kinds*: text + coerced number + switch + radio + checks)? | A **server-connection** form: `name z.string().min(1,'Required')` → `Input`; `port z.coerce.number().int().gte(1,'Port ≥ 1').lte(65535,'Port ≤ 65535')` → `Input`; `tls z.boolean()` → `Switch`; `mode z.enum(['Dev','Staging','Prod'])` → `RadioGroup` via `bindRadio`; `features z.array(z.enum(['Logs','Metrics','Tracing'])).min(1,'Pick one')` → `CheckGroup` via `bindCheck`. `initial = { name:'', port:'', tls:false, mode:'Dev', features:[] as Array<'Logs'|'Metrics'|'Tracing'> }`. Per-field errors are touched-gated; a `valid · dirty` echo; every field gets `bindField`. See `03-01 §Story spec`. | ✅ Resolved |
| AR-P6 | FR-4.2 AC — "importing anything not in the [barrel] list fails." The barrel is already exactly the FR-4.2 set; is a test needed? | **Add an impl test** asserting the built barrel's exported keys equal exactly `{ createForm, FormFieldError, bindField, bindRadio, bindCheck }` (runtime values) — a surface-lock regression guard. Types (`Form`/`Field`/`CreateFormOptions`) are compile-time only and not runtime keys. | ✅ Resolved |
| AR-P7 | Verify command for every plan Verify line | `yarn verify` (root; = `yarn lint` then `turbo run typecheck build test check:docs`), per the project `CLAUDE.md`. Story smoke + forms suites run under it. | ✅ Resolved |

## Gate status — ✅ PASSED (2026-07-15)

- [x] Imported decisions (AR-02/16/22/23) are already resolved in the requirements register; not re-opened.
- [x] Every plan-local item (AR-P1…AR-P7) has an explicit, user-confirmed decision.
- [x] Zero deferred within-scope items.
- [x] User reviewed and confirmed the complete scope + register (2026-07-15).
