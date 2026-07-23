# Preflight Report — non-functional (RD-04)

> **Artifact**: `codeops/features/jsvision-forms/plans/non-functional/` (full plan)
> **Date**: 2026-07-15
> **Iteration**: 1
> **Scanner**: preflight 3.7.0
> **Result**: ✅ PASSED — all 4 findings resolved and applied to the plan docs (2026-07-15)

> ⚠️ **SAME-SESSION REVIEW** — this plan was authored earlier in the *same* session that is now
> reviewing it. Systematic blind spots are likely; findings below were forced through fresh
> codebase reconnaissance (three read-only recon agents) rather than re-reading the plan's own
> prose. Consider a new-session re-scan for full independence.

## Codebase Context Summary

Reconnaissance (read-only) covered the three subsystems the plan touches, mapping every document
reference to real code:

- **examples / kitchen-sink** — `Story` is exactly `{ id, category, title, blurb, rd?, build(ctx): Group }`
  (`packages/examples/kitchen-sink/story.ts:37-56`); `at(view, x, y, width, height)` sets
  `view.layout = { position:'absolute', rect }` (`story.ts:69-73`). The smoke test
  (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`) runs BOTH a generic per-story loop
  (`test.ts:221-232`) and hand-written per-story cases (e.g. data-grid `test.ts:65-75`); the generic
  loop already asserts id/category/title/blurb truthy (`test.ts:48-54`), id-uniqueness (`test.ts:58-61`),
  and paints ≥1 non-blank cell (`paintedCells`, `test.ts:41-46`). Mount harness:
  `createRoot`, `at(...)`, `createRenderRoot({width,height},{caps})`, `rr.mount`, `rr.buffer().rows()`,
  `cell.char` — exactly the shapes the plan reuses. Registration is a `STORIES` array (`stories/index.ts:56-97`);
  categories are derived from each story's `category` field, not declared centrally. `packages/examples/package.json`
  currently depends on core/files/ui/web — **`zod` and `@jsvision/forms` are both absent** (confirms the add-deps task).
- **ui widgets + render path** — all of `Input/Switch/RadioGroup/CheckGroup/Button/Label/Text/Group/signal/createRoot/createRenderRoot`
  are exported from `@jsvision/ui` under the exact names the plan uses; every constructor signature the
  story assumes matches (`Input{value,validator?}`, `Switch{value,label,onLabel,offLabel,disabled?}`,
  `RadioGroup{labels,value:Signal<number>}`, `CheckGroup{labels,value:Signal<boolean[]>}`,
  `Button(label,{default?,disabled?,onClick?})`, `Label(text,view)`, `Text(string|()=>string)`).
  Control-byte sanitization lives in **two layers**: `sanitize()` (`packages/core/src/engine/render/sanitize.ts:35-56`)
  DROPS ESC, C0 (except tab/newline), and the **C1 range 0x80–0x9F** (incl. 0x9B); `ScreenBuffer.set()`
  (`buffer.ts:151-177`) replaces C0/DEL (`<0x20 || ===0x7f`) with a space but does **not** touch C1.
  Every real text write goes through `ctx.text → sanitize → buffer.set`.
- **forms package** — barrel exports exactly the 5 runtime keys + 3 types the plan locks
  (`packages/forms/src/index.ts:1-5`). All four spec files the plan's coverage matrix names
  (`store/validation/adapters/bind-field.spec.test.ts`) EXIST. `submit(onValid): Promise<boolean>`
  marks all fields touched then returns false on invalid (`create-form.ts:145-155`). `CreateFormOptions.initial`
  types each value as `unknown` (`types.ts:61-72`); `field.value` is per-field `Signal<T>` where `T` is
  inferred from `initial` (`types.ts:14`, `field<K>(name): Field<I[K]>`).

**No phantom references** — every file, export, and signature the plan cites was confirmed present
and correctly named. The findings below are about test-oracle strength and one type-inference gap,
not missing/renamed code.

## Findings

| # | Severity | Dimension | Summary |
|---|----------|-----------|---------|
| PF-001 | 🟠 MAJOR | Testability / Security | Render-path oracle (ST-N2) assertion `>= 0x20` cannot detect a C1 leak — the exact byte (`\x9b`) it includes to test C1 sanitization |
| PF-002 | 🟠 MAJOR | Codebase Alignment | Story's `initial: { …, features: [] }` (bare) diverges from the shipped cast precedent; weakens or breaks `bindCheck` typing → risks the FR-4.8 typecheck gate |
| PF-003 | 🟡 MINOR | Testability | ST-N1 re-asserts what the smoke test's generic per-story loop already covers; add a forms-specific assertion |
| PF-004 | 🔵 OBSERVATION | Testability | Coverage-audit ST↔AC mapping effort understated for RD-01/RD-02 (only RD-03 specs annotate AC IDs inline) |

---

### PF-001 🟠 MAJOR — Render-path security oracle under-proves its own C1 case

**Where**: `03-02 §Render-path security` (code snippet, lines 27-53); `07 §Render-path security` ST-N2.

**Evidence**: The oracle's fixture is `'a\x00b\x1b[31mc\x07\r\n\x9b'` and its assertion is
`expect(cell.char.charCodeAt(0)).toBeGreaterThanOrEqual(0x20)` for every cell. `\x9b` (0x9B = 155)
is a single-byte C1 CSI — deliberately included to exercise C1 sanitization. But `155 >= 0x20` is
**true**, so the assertion can never fail on a C1 byte. Ground truth: `sanitize()` DROPS C1
(`sanitize.ts:52`) so the test is green *today*, but if C1 stripping ever regressed and a raw 0x9B
leaked into the buffer, the assertion would **still pass** (155 ≥ 0x20). FR-4.3's whole purpose is a
regression guard ("a control-byte value cannot escape sanitization on render") — an oracle that
passes when the guarded behavior regresses is materially deficient. Secondary: `ScreenBuffer.set()`
alone (`buffer.ts:158`) guards only `<0x20 || ===0x7f`, confirming C1 is not caught at the buffer
layer either.

**Options**:
- **(A, recommended)** Strengthen the assertion to reject C0 **and** DEL **and** C1: assert no cell
  code point is `< 0x20 || === 0x7f || (>= 0x80 && <= 0x9f)`. Keeps `\x9b` in the fixture and makes
  the test actually prove C1 stripping.
- **(B)** Assert the rendered text equals the printable projection of `sanitize(nasty)` (exact
  expected-string oracle). Strongest, but couples the test to sanitize's drop-vs-replace policy.
- **(C)** Drop `\x9b` from the fixture and scope the oracle to C0/DEL only. Rejected — abandons the
  C1 coverage FR-4.3/AR-22 intend.

**Recommendation**: **(A)**. One-line assertion change; keeps the fixture honest; directly guards the
C1 contract the plan claims to test. *(While editing, also confirm the bare-`Input` mount renders —
the smoke test always mounts a `Group` via `at(...)`; if a bare `Input` paints nothing, wrap it in a
`Group` like the smoke harness does.)*
**Confidence**: High — grounded in `sanitize.ts:52`, `buffer.ts:154-161`. **Hardening**: in-context
self-challenge only (advisor unavailable this session).
**Decision**: ✅ **Applied (A)** — `03-02` oracle assertion now rejects `< 0x20 || === 0x7f || 0x80–0x9f`; the Assertion bullet, Error-Handling row, `07` ST-N2, and the authoring rule updated to the C0/DEL/C1 contract; harness note now says to wrap a bare `Input` in a `Group` if it paints nothing.

---

### PF-002 🟠 MAJOR — Bare `features: []` initial diverges from the shipped cast precedent

**Where**: `00-index §Usage Example` (line 59); `03-01 §Story spec` (line 51); `01-requirements`
(references the same snippet). All show `initial: { …, features: [] }` with no annotation.

**Evidence**: `CreateFormOptions.initial` types each value as `unknown` (`types.ts:61-72`), and
`field<K>(name): Field<I[K]>` derives the field's value type from what `initial` infers. For an
array field, `bindCheck<T>(field: Field<T[]>, options: readonly T[])` needs the element type `T`
from the field. A **bare** `[]` infers a degenerate element type (`never[]`/`any[]`), so
`form.field('features')` is **not** `Field<Array<'Logs'|'Metrics'|'Tracing'>>`. The only shipped
empty-array-initial precedent casts it explicitly:
`initial: { styles: [] as Array<'bold' | 'italic'> }` (`adapters.spec.test.ts:101`). Two outcomes,
both bad: if inference yields `never[]`, `bindCheck(field, ['Logs',…])` fails typecheck and breaks
the FR-4.8 green gate; if it yields `any[]`, it compiles but silently strips the domain typing the
story exists to showcase. (The non-array fields are fine: `port:''`→`Field<string>` matches the
shipped `port:'8080'` pattern in `fixtures.ts:20`; `mode:'Dev'`→`Field<string>`; `tls:false`→`Field<boolean>`.)

**Options**:
- **(A, recommended)** Annotate the array initial in all three snippets:
  `features: [] as Array<'Logs' | 'Metrics' | 'Tracing'>` — matching `adapters.spec.test.ts:101`.
- **(B)** Type the whole `initial` object explicitly. More verbose; unnecessary since only the empty
  array is ambiguous.
- **(C)** Seed `features` non-empty (e.g. `['Logs']`). Changes the demo's teaching point (the
  `.min(1,'Pick one')` error would not show initially). Rejected.

**Recommendation**: **(A)**. Trivial, matches the shipped precedent, preserves the type-safe-binding
story, removes the FR-4.8 typecheck risk. Catch it in the plan now rather than as a green-phase
surprise at task 1.2.4.
**Confidence**: High — grounded in `adapters.spec.test.ts:101` + `types.ts:61-72`. **Hardening**:
in-context self-challenge (advisor unavailable).
**Decision**: ✅ **Applied (A)** — `features: []` annotated `as Array<'Logs' | 'Metrics' | 'Tracing'>` in `00-index`, `03-01` (+ a rationale note), and `00-ambiguity-register` AR-P5.

---

### PF-003 🟡 MINOR — ST-N1 duplicates the generic smoke-loop assertions

**Where**: `07` ST-N1; `99` tasks 1.1.1/1.2.4.

**Evidence**: The smoke test's generic loop already asserts, for *every* registered story,
id/category/title/blurb truthy (`test.ts:48-54`), id-uniqueness (`test.ts:58-61`), and paints ≥1
non-blank cell (`test.ts:221-232`). ST-N1 as specified (id==='forms/form', category 'Forms', truthy
title/blurb, paints) re-states those once the story is registered. Per-story named tests ARE an
established pattern (data-grid `test.ts:65-75`), so ST-N1 is idiomatic — but it should assert
something the generic loop can't.

**Recommendation**: Keep ST-N1, but narrow it to a **forms-specific** guarantee: (a) `forms/form` is
present in `STORIES` (guards accidental de-registration), and (b) a form-specific painted signal
appears (e.g. the `valid · dirty` echo text or a field label), proving the story wired up — not just
that *some* cell painted. Low stakes.
**Decision**: ✅ **Applied** — `07` ST-N1 and `99` task 1.1.1 narrowed to `forms/form` present in `STORIES` + a forms-specific painted signal (the `valid · dirty` echo), beyond the generic loop.

---

### PF-004 🔵 OBSERVATION — RD-01/RD-02 coverage-audit mapping is more manual than the matrix implies

**Where**: `07 §Coverage audit matrix`; `02` risk table ("audit surfaces a real uncovered AC late —
Med/Low").

**Evidence**: Only the RD-03 spec files annotate inline AC IDs (`adapters.spec.test.ts:3-5`,
`bind-field.spec.test.ts:4`). `store.spec`/`validation.spec` carry `ST-01…17` derived "from the
requirements" but do NOT annotate individual RD-01/RD-02 AC IDs, and ST numbers are not globally
unique (store `ST-01…10` vs bind-field `ST-01…03`). So the audit must manually map ST→AC for the 13
RD-01/RD-02 ACs — a little more work than the three tidy matrix rows imply, though still low-risk
(the suites clearly correspond to the functional areas). Also verify the matrix's AC counts (RD-01
8, RD-02 7, RD-03 5) against the RD files during the audit.

**Recommendation**: Add a one-line note in `07` that RD-01/RD-02 need a manual ST→AC mapping pass
(RD-03 is pre-annotated). No structural change.
**Decision**: ✅ **Applied** — `07 §Coverage audit matrix` gained a "Mapping effort" note (RD-01/RD-02 manual ST→AC pass; re-verify the 8/7/5 AC counts against the RD files).

---

## Dimension coverage (13)

1. Ambiguities — clean. 2. Implicit assumptions — PF-002 (empty-array inference assumed benign).
3. Contradictions — clean. 4. Completeness — clean. 5. Dependencies — clean (examples→forms→ui, no
cycle; zod add is planned). 6. Feasibility — clean (all APIs confirmed present). 7. Testability —
PF-001, PF-003, PF-004. 8. Security — PF-001. 9. Edge cases — PF-002 (empty array). 10. Scope creep —
clean (plan is deliberately narrow). 11. Ordering — clean (spec-first preserved). 12. Consistency —
clean (snippets consistent across docs; the `features: []` form is consistently *wrong*, per PF-002).
13. Codebase alignment — no phantom refs; PF-002 is the one alignment gap.
