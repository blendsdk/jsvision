# Execution Plan: Async Loading + Baseline Rebase

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-07-16 12:47 (COMPLETE — all 16 tasks, full verify green)
> **Progress**: 16/16 tasks (100%) — Phase 1 ✅ · Phase 2 ✅
> **CodeOps Skills Version**: 3.8.0

## Overview

Implement RD-07 inside `@jsvision/forms`: an imperative `form.load(loader): Promise<boolean>` that,
on success, replaces every field value and rebases the whole baseline to the loaded raw record in one
`batch()` (pristine after load), plus a form-level `loading()`; concurrency via a generation counter
+ `AbortController` and disposal via a `disposed` flag; the async re-validation on load rides the
existing per-field effect. All inline in `create-form.ts` (AR-PL1) + one kitchen-sink `forms/load`
story. `@jsvision/core`/`@jsvision/ui` untouched (zero-dep); `zod` stays the only peer dep;
`async.ts`/the barrel/`surface.impl.test.ts` are deliberately unchanged (AR-PL7). Spec-first per phase.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | The load engine — surface · flow · rebase · `loading()` · dispose · concurrency · async-on-load | 8 |
| 2 | Security oracle · kitchen-sink `forms/load` story · final gate | 8 |

**Total: 16 tasks across 2 phases** (no hour estimates). `load` is one cohesive method, so the whole
engine lands in Phase 1 (all functional oracles ST-L1…L12 written red first, then the flow); Phase 2
is the render-path security oracle, the story, and the gate.

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task appears
> exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header + Last Updated** after EVERY task — never batch. Only `[x]` counts.
> 4. **Resume** by scanning top-to-bottom: first `[~]` resumed first, else first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.
> **Zero-ambiguity during execution:** if a detail is not covered by the plan docs or the register,
> STOP, get a user decision, record it in `00-ambiguity-register.md` tagged `(runtime)`, then resume.
> **Shipped-code rule:** no `codeops/`/`plans/`/`RD-`/`AR-` references in `packages/*/src` (JSDoc or
> comments) — restate the rationale in plain language.

---

## Phase 1: The load engine

Delivers the full `load`/`loading` surface and behaviour — replace + rebase, pristine, rejection,
`loading()` transitions, concurrency, disposal, and automatic async re-validation. All functional
oracles are written first; `load` is implemented once (cohesive method) and they all go green.

### Step 1.1: Spec first

**Reference**: `03-01 §A–§E` · `07` ST-L1…ST-L12 · AR-46…52, AR-PL2/PL8
**Objective**: Failing oracles for the whole load surface and behaviour.

- [x] 1.1 Write `load.spec.test.ts` with the `deferredLoader` helper and **ST-L1…ST-L12** (regression,
      replace+rebase, reset→loaded, reload, pristine, resolves-true/settle-order, rejection-untouched,
      `loading()` transitions both paths, concurrency stale-guard, disposal + AR-PL2, `asyncError`
      cleared on load, async re-run on sync-clean value) — `packages/forms/test/load.spec.test.ts` ✅ (completed: 2026-07-16 12:25)
- [x] 1.2 Red phase: `yarn workspace @jsvision/forms test` — confirm **ST-L2…ST-L12** fail (no
      `load`/`loading` surface); **ST-L1** stays green (a sync-only form never calls `load`) ✅ (completed: 2026-07-16 12:25 — 11 failed / 1 passed; ST-L1 green)

### Step 1.2: Implement the load flow (inline in `create-form.ts`)

**Reference**: `03-01 §A–§F`
**Objective**: The surface + flow + rebase + `loading()` + `disposed`-guarded dispose.

- [x] 1.3 Add `Form.loading(): boolean` and `Form.load(loader): Promise<boolean>` to `types.ts` (JSDoc
      + `@example`); **no** `CreateFormOptions` change, **no** barrel change — `packages/forms/src/types.ts`
      (AR-46/47/48/49/52, AR-PL7) ✅ (completed: 2026-07-16 12:28 — prose JSDoc, no per-member `@example` per §A)
- [x] 1.4 Implement in `create-form.ts` (`buildForm`): the `loading`/`loadGen`/`loadController`/
      `disposed` state beside `submitAttempted`; the `load` closure (entry `disposed` guard →
      `++loadGen` → abort prior → new controller → `loading.set(true)` → `try/await loader` /
      `catch`→`false` with the `!disposed && g===loadGen` loading-clear → `disposed || g!==loadGen`
      drop → `batch()` rebase `baseline[name] = clone(record[name])` + `valueSignal(name).set(clone(record[name]))`
      (**two independent clones** — PF-203) + clear touched + clear `submitAttempted` + `loading.set(false)`
      → `true`); the **root-body `onCleanup(() => { disposed = true; loadController?.abort(); })`** (fires on
      `form.dispose()` **and** enclosing-scope teardown — PF-201; add `onCleanup` to the `@jsvision/ui`
      import); add `loading`/`load` to the returned object (**`dispose` stays `disposeScope`**) —
      `packages/forms/src/create-form.ts` (AR-50/51/PL1/PL2/PL3; PF-001/PF-201/PF-203). Comments in
      shipped code are **plain language** — no `AR-`/`PF-`/`AC #` refs (PF-202). ✅ (completed: 2026-07-16 12:28)
- [x] 1.5 Extend the `createForm` class `@example` with a load → rebase → reset snippet (copy-pasteable;
      loader returns the raw shape; `reset()` returns to the loaded record) — `packages/forms/src/create-form.ts`
      (RD-07 AC #15) ✅ (completed: 2026-07-16 12:28)
- [x] 1.6 Green phase: `yarn workspace @jsvision/forms test` — ST-L1…ST-L12 pass; **store / async /
      adapters / bind-field / security / surface specs stay green** (`surface.impl.test.ts`'s 5-value
      lock unchanged); typecheck + lint + `check:docs` clean ✅ (completed: 2026-07-16 12:28 — 82/82 tests, typecheck+check:docs+lint+banned-grep clean)

### Step 1.3: Impl tests & hardening

**Reference**: `07 §Implementation tests` · AR-PL8, PF-005
**Objective**: Lock the internals the spec oracles don't reach.

- [x] 1.7 Write `load.impl.test.ts`: `ctx.signal` is a live `AbortSignal` firing on supersede,
      `form.dispose()`, **and enclosing-scope disposal**; the `disposed` guard on **both** settle paths
      (resolve/reject after dispose write nothing, don't clear `loading`); **PF-201** — a form built inside
      an outer `createRoot` whose disposer is called (not `form.dispose()`) aborts the in-flight load and
      no-ops its late settle; **PF-203** — after loading an array-typed field, an in-place `value().push(x)`
      does not change `baseline` (independent clones), so `dirty()` flips `true`; **AR-PL8** — an async
      field whose loaded value **equals** its current value does not clear its `asyncError` (equal write,
      `signal.ts:52`), a changed one does; **PF-005** — a loader omitting a key sets that field + baseline
      to `undefined` (`dirty()` false) — `packages/forms/test/load.impl.test.ts` ✅ (completed: 2026-07-16 12:33 — 6 impl tests)
- [x] 1.8 Verify — `yarn verify`; confirm `create-form.ts` size within the 200–500 target (≈ **280**
      lines; assert a **range with headroom**, ≤ 300 by true line count, not an exact value — PF-208) ✅ (completed: 2026-07-16 12:35 — full `yarn verify` green, 26/26 turbo tasks)

**Deliverables**:
- [x] `form.load`/`form.loading` shipped: replace + rebase, pristine, rejection→false, `loading()`
      transitions, generation+abort concurrency, `disposed`-guarded disposal, automatic async re-validation

**Verify**: `yarn verify`

---

## Phase 2: Security oracle · kitchen-sink story · final gate

### Step 2.1: Spec first — security + story smoke

**Reference**: `03-02` · `07` ST-L-SEC, ST-LS1 · AC #13/#14 · AR-53, AR-PL5
**Objective**: Failing oracles for control-byte sanitisation of a loaded value and the load story.

- [x] 2.1 Write `load-security.spec.test.ts` (ST-L-SEC): `await form.load(→ {text:'a\x00b\x1b[31mc\x07\r\n\x9b'})`;
      render a bound `Input` via `createRenderRoot`; scan the buffer — **no** cell cp `< 0x20`, `=== 0x7f`,
      or `0x80–0x9f` — `packages/forms/test/load-security.spec.test.ts` ✅ (completed: 2026-07-16 12:40 — ST-L-SEC green)
- [x] 2.2 Extend `kitchen-sink.smoke.spec.test.ts` with **ST-LS1** (build + mount `forms/load`; the
      buffer contains the story's stable marker) — `packages/examples/test/kitchen-sink.smoke.spec.test.ts` ✅ (completed: 2026-07-16 12:40)
- [x] 2.3 Red phase: ST-L-SEC **holds green** (the render path already sanitises — locks the promise);
      ST-LS1 fails (no `forms/load` story yet) ✅ (completed: 2026-07-16 12:40 — ST-L-SEC green, ST-LS1 red)

### Step 2.2: Implement the story

**Reference**: `03-02`
**Objective**: A live load → edit → dirty → reset-to-loaded story, green under the smoke test.

- [x] 2.4 Create `forms-load.story.ts` (`id: 'forms/load'`, `category: 'Forms'`, `rd: 'RD-07'`): a
      simulated `loadRecord(signal)` (abortable `sleep`), a `Load record` button
      (`disabled: () => form.loading()`), the `loading()` swap, a bound `Input`, and a `dirty` echo +
      `Reset` button showing `reset()`-to-loaded; an always-painted hint line —
      `packages/examples/kitchen-sink/stories/forms-load.story.ts` ✅ (completed: 2026-07-16 12:44)
- [x] 2.5 Register the story — one import + one entry in `packages/examples/kitchen-sink/stories/index.ts` ✅ (completed: 2026-07-16 12:44)
- [x] 2.6 Green phase: `yarn workspace @jsvision/examples test` — ST-LS1 + the generic smoke loop pass;
      ST-L-SEC green. Rebuild `@jsvision/forms` dist first if examples resolve the new surface by name ✅ (completed: 2026-07-16 12:44 — smoke 63/63 green, examples typecheck+lint clean)

### Step 2.3: Final gate

**Reference**: RD-07 AC #15 · project Prime directive · AR-PL6
**Objective**: `yarn verify` green across the branch; tree clean.

- [x] 2.7 Full `yarn verify` — `lint` → typecheck/build/test/`check:docs` green; the `createForm` class
      `@example` covers `load`/`loading`; **plain `grep`** for banned CodeOps/TV refs in `packages/forms/src`
      with a pattern that catches the shapes `check:docs` misses (PF-202) — e.g.
      `grep -rnE '\b(RD|PA|AR|PF|HR|GATE|AC|ST|ADR|DEF|FR|RT|PL)-|AC #|codeops/|plans/|requirements/' packages/forms/src`
      must return **nothing** (the scanner's `-\d+` anchor lets `AR-PL2`/`AC #8` slip through); `check:deps`
      zero native deps ✅ (completed: 2026-07-16 12:46 — verify 26/26 green, grep clean, check:deps 0 native)
- [x] 2.8 Run `yarn lint:fix`; stage what it changes. Commit via the active commit mode / `/gitcmp`
      (no raw git in this plan) ✅ (completed: 2026-07-16 12:47 — lint:fix no-op; auto-commit + push)

**Deliverables**:
- [x] Loaded-string control-byte oracle green; `forms/load` story green under smoke; `yarn verify`
      green; tree clean

**Verify**: `yarn verify`

---

## Dependencies

```
Phase 1 (the whole load engine — one cohesive method behind ST-L1…L12)
    ↓   the story + security oracle exercise the shipped surface
Phase 2 (security · story · gate)   ← runs last over the whole package
```

---

## Success Criteria

**Feature is complete when** (mapped 1:1 to RD-07 §Acceptance Criteria 1–15):

1. ✅ Regression: sync-only form unchanged (ST-L1) — AC 1
2. ✅ Replace + rebase; `dirty()` false (ST-L2) — AC 2
3. ✅ `reset()` targets the loaded record (ST-L3) — AC 3
4. ✅ Reload rebases again — re-invokable (ST-L4) — AC 4
5. ✅ Pristine after load (ST-L5) — AC 5
6. ✅ Resolves `true`; settles after apply (ST-L6) — AC 6
7. ✅ Rejection leaves state untouched; no `loadError()` (ST-L7) — AC 7
8. ✅ `loading()` transitions, both paths (ST-L8) — AC 8
9. ✅ Concurrency / stale-guard (ST-L9) — AC 9
10. ✅ Disposal aborts + no-op after teardown; load-after-dispose→false (ST-L10) — AC 10 · AR-PL2
11. ✅ `asyncError` cleared on load, unconditional (ST-L11) — AC 11
12. ✅ Async re-validation on a sync-clean loaded value (ST-L12) — AC 12
13. ✅ Kitchen-sink `forms/load` story + smoke (ST-LS1) — AC 13
14. ✅ Loaded-string control-byte sanitisation via a bound Input (ST-L-SEC) — AC 14
15. ✅ `yarn verify` + `check:docs` green; `@example` updated; no banned refs; `lint:fix` clean — AC 15

**Plus the plan-pinned decisions:** AR-PL1 inline placement · AR-PL2 load-after-dispose→false (ST-L10) ·
AR-PL3 root-body `onCleanup` teardown (fires on enclosing-scope disposal too — PF-201) · AR-PL7 no
barrel/`async.ts`/surface change · AR-PL8 changed-fields-only re-validation (impl test) · PF-203 two-clone
rebase · PF-202 plain-language shipped comments.
