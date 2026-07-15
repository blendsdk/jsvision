# Testing Strategy: Non-Functional (RD-04)

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

RD-04 adds three net-new test artifacts (a story smoke case, a render-path security oracle, a
barrel-surface lock) and **audits** the shipped RD-01/02/03 spec suites for per-AC coverage. It
introduces no new store/validation/binding behavior, so most of the "testing" here is verification
and traceability, not fresh oracles.

| Code type | Target |
| --------- | ------ |
| New security/surface behavior | 100% (both are single-assertion oracles) |
| Kitchen-sink story | Smoke (mounts + paints), per the showcase contract |
| RD-01/02/03 coverage | Every acceptance criterion traces to a passing spec test |

Test names state behavior (`should … when …` or a plain behavioral sentence). The `.js` extension in
import specifiers is required by NodeNext.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived exclusively from RD-04, its component specs (`03-01`, `03-02`), and the Ambiguity Register.
> Immutable oracles: if the implementation disagrees, the implementation is wrong. In-code
> traceability comments quote the behavior in **plain language** — never an `ST-`/`AR-`/`RD-` id or a
> `requirements/` path (standards' Documentation ban).

### Kitchen-sink story (FR-4.6)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-N1 | The registry after `formsStory` is added; `STORIES.find(s => s.id === 'forms/form')`; build + mount it headlessly at fixed caps | `forms/form` is present in `STORIES` (category `Forms`, truthy title/blurb) — guarding accidental de-registration — **and** paints a forms-specific signal (the `valid · dirty` echo text), not merely *some* non-blank cell (which the generic per-story smoke loop already asserts for every story) | RD-04 FR-4.6 / AR-P5 |

### Render-path security (FR-4.3)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-N2 | `createForm({ schema:{text:z.string()}, initial:{text:''} })`; set `field('text').value` to `'a\x00b\x1b[31mc\x07\r\n\x9b'`; bind a real `Input`; mount via `RenderRoot`; scan the buffer | No painted cell is a control byte: no code point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f`. The C1 clause (`0x80–0x9f`) is required — the fixture's `\x9b` (CSI, `155`) is `>= 0x20`, so a `>= 0x20`-only check would miss it | RD-04 FR-4.3 / AR-P2 / AR-22 |

### Barrel surface (FR-4.2)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-N3 | `import * as forms from '../src/index.js'`; read `Object.keys(forms)` | Sorted keys equal exactly `['FormFieldError','bindCheck','bindField','bindRadio','createForm']` (no internal helper; types are compile-time only) | RD-04 FR-4.2 / AR-P6 |

> **⚠️ AUTHORING RULE:** ST-N2's expectation (no C0/DEL/C1 control byte in the buffer) derives from
> AR-22's sanitization contract — `sanitize()` drops ESC/C0/C1 and `ScreenBuffer.set` spaces out
> C0/DEL — not from imagined output. ST-N3's key set derives from FR-4.2's enumerated surface.

## Coverage audit matrix (FR-4.5, AR-P3)

The audit fills this matrix during execution (Phase 3): every RD-01/02/03 acceptance criterion → the
spec test that covers it (file + `should…` name). A row with no covering test is a **gap** → add a
spec case (spec-first) to the listed existing file. Do **not** restate the ACs here — cite them by
their RD; the RDs own the criteria.

| RD | AC count | Expected owning spec file(s) | Covered? | Gap → action |
|----|----------|------------------------------|----------|--------------|
| RD-01 (store) | 8 | `store.spec.test.ts` | 8/8 ✅ (ST-01…10) | none — zero gaps |
| RD-02 (validation) | 7 | `validation.spec.test.ts` | 7/7 ✅ (ST-11…17) | none — zero gaps |
| RD-03 (binding) | 5 | `adapters.spec.test.ts`, `bind-field.spec.test.ts` | 5/5 ✅ (adapters ST-04…07 · bind-field ST-01…03) | none — zero gaps |

> **Mapping effort (recon 2026-07-15):** only the RD-03 spec files annotate AC IDs inline
> (`adapters.spec.test.ts`, `bind-field.spec.test.ts`). `store.spec`/`validation.spec` carry
> `ST-01…17` without inline RD-01/RD-02 AC IDs, and ST numbers are **not** globally unique (store
> `ST-01…10` vs bind-field `ST-01…03`). So the RD-01/RD-02 rows need a manual ST→AC mapping pass, and
> the AC counts (RD-01 8, RD-02 7, RD-03 5) must be re-verified against the RD files during the audit.

> **Audit result (completed 2026-07-15): zero gaps.** Every RD-01/02/03 acceptance criterion traces
> to a passing spec test (per-AC below). No spec case was added — the shipped oracles already cover
> the surface 1:1. ST numbers are not globally unique across files, so each is cited file-qualified.
> AC counts re-verified against the RD files: RD-01 = 8, RD-02 = 7, RD-03 = 5.

**RD-01 (store) — 8/8 → `store.spec.test.ts`:**

| RD-01 AC | Covering spec test |
| -------- | ------------------ |
| `createForm` returns `Form`; `field.value` + `values()` typed from initial | ST-01 (value is store-owned, two-way, stable) + ST-04 (values coerced/null); the static typings are held by `typecheck` |
| stable `field(name)` handle (`===`) | ST-02 |
| `rawValues()` snapshot; `values()` coerced-when-valid / `null`-when-invalid, no throw | ST-03 + ST-04 |
| `dirty()` element-wise for arrays; `reset()` clears dirty + touched | ST-05 + ST-06 |
| `isValid()` false all-empty → true pre-touch | ST-07 |
| `submit()` marks touched, `false` on invalid, awaits `onValid(coerced)` → `true` | ST-08 (+ `validation.spec` ST-17 for the mark-all-touched half) |
| `field('unknown')` throws `FormFieldError` | ST-09 |
| no `dispose()`, no effect leak on discard | ST-10 |

**RD-02 (validation) — 7/7 → `validation.spec.test.ts`:**

| RD-02 AC | Covering spec test |
| -------- | ------------------ |
| one `safeParse` per change; error/errors/isValid/values all reflect it | ST-11 |
| `field.error()` first issue by `path[0]` / `null`, live pre-touch | ST-12 |
| path-less `.refine` → `form.errors()`, not any field | ST-13 |
| field-routed `.refine({ path })` → that field's `error()` | ST-14 |
| `z.coerce.number()` `'42'`→`42`; `'x'`→ `error()` + `values() === null` | ST-15 |
| `isValid()` tracks `safeParse` success, ignores `touched` | ST-17 (+ `store.spec` ST-07 for pre-touch liveness) |
| surfaced messages are exactly the schema's | ST-16 |

**RD-03 (binding) — 5/5 → `adapters.spec.test.ts` + `bind-field.spec.test.ts`:**

| RD-03 AC | Covering spec test |
| -------- | ------------------ |
| `new Input({ value: field.value })` two-way, no adapter | `bind-field` ST-01 (text) + ST-02 (boolean) |
| `bindField` touched once on first focus-leave, never on mount, cleaned up on unmount | `bind-field` ST-03 |
| `bindRadio` `Signal<number>`: read `indexOf`, set idx→value, out-of-set → `-1` | `adapters` ST-04 |
| `bindCheck` `['x','z']` ⇄ `[true,false,true]`, toggling updates the array | `adapters` ST-05 |
| choice widgets keep the schema in domain terms (`z.enum`, `z.array(z.enum)`) | `adapters` ST-06 + ST-07 (pure lenses) |

## Test Categories

### Specification Tests (from ST-cases above)
> Filed as `*.spec.test.ts`, written before the code they pin.

| Test File | ST Cases Covered | Component |
| --------- | ---------------- | --------- |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (add a case) | ST-N1 | Story |
| `packages/forms/test/security.spec.test.ts` (new) | ST-N2 | Security / render path |
| existing `packages/forms/test/*.spec.test.ts` (audit; add cases only for gaps) | RD-01/02/03 ACs | Store / validation / binding |

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/forms/test/surface.impl.test.ts` (new) | Barrel exports exactly the runtime surface (ST-N3) | High |
| existing `packages/forms/test/security.impl.test.ts` | Store round-trips control bytes as opaque data (unchanged) | — |

### Integration Tests
ST-N2 is itself an integration oracle (store → bind → `Input` → buffer). ST-N1 mounts the whole story.

### End-to-End Tests
None added — the TUI showcase smoke test is the closest analogue and is covered by ST-N1.

## Test Data
### Fixtures Needed
- Control-byte string `'a\x00b\x1b[31mc\x07\r\n\x9b'` (inline in ST-N2, mirrors `security.impl.test.ts`).
- The story's schema/initial (inline in the story + ST-N1 mounts the real story).

### Mock Requirements
None — real `@jsvision/ui` widgets, real `RenderRoot`, real `zod`. No mocks (standards: real objects
over mocks).

## Verification Checklist
- [ ] ST-N1/N2/N3 defined with concrete input/output pairs (above)
- [ ] Each ST traces to an RD-04 FR / AR entry
- [ ] Spec tests written before their code (story registration; render oracle)
- [ ] Red phase observed where behavior is new (story not-yet-registered → ST-N1 red)
- [ ] All spec tests pass after implementation
- [ ] Coverage audit matrix completed; any gap-filling cases pass
- [ ] `surface.impl.test.ts` passes
- [ ] No regressions in existing forms/examples tests
- [ ] `yarn verify` green; `yarn lint:fix` clean
