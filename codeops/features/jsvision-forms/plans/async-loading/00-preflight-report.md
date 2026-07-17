# Preflight Report — async-loading (RD-07 implementation plan)

> **Artifact**: `codeops/features/jsvision-forms/plans/async-loading/` (8 docs)
> **Branch**: `feat/form-remains`
> **Date**: 2026-07-16
> **CodeOps Skills Version**: 3.8.0
> **Reviewer**: preflight (13-dimension, codebase-grounded) + 1 independent challenger
> **Tier**: ✅ PASSED — all 8 findings applied (2 MAJOR · 4 MINOR · 2 OBSERVATION), 2026-07-16

> ⚠️ **SAME-SESSION REVIEW.** This plan was authored earlier in the same session that is reviewing it.
> Systematic authoring blind spots are likely, so an **independent challenger subagent** re-audited the
> highest-risk area (the `load` flow + oracle mapping) from scratch. It converged with the lead pass on
> the core correctness and independently raised two findings the lead pass under-weighted or missed
> (PF-201 upgraded from OBSERVATION→MAJOR; PF-202 new). For full independence, a fresh-session re-read
> is still worthwhile.

---

## Codebase Context Summary

The plan targets `@jsvision/forms` — a headless form store on `@jsvision/ui`'s fine-grained reactive
core. Every `file:line` the plan cites was verified against the tree:

- **`create-form.ts`** (215 lines) — `buildForm` seeds `baseline` (`:99`, written `:103`), `valueSignals`/
  `touchedSignals` (`:100-105`), `submitAttempted` (`:110`, write-only per its own comment `:108-110`),
  `fieldDirty` (`:142`), `reset` (`:174-182`), the returned object (`:203-214`) with `dispose: disposeScope`
  (`:213`); `clone` copies arrays / passes scalars (`:11-13`); `eq` is element-wise for arrays (`:16-21`).
  `createForm` wraps `createRoot((disposeScope) => buildForm(...))` (`:86`) — **the form scope nests under
  whatever owner is active at call time.**
- **`async.ts`** (166 lines) — one standing trigger effect per async field (`:110-144`), subscribed to its
  own value (`:112`); `firstRun` skip (`:114`); on a real change it bumps gen + aborts + `validating→false`
  + `asyncError→null` (`:125-128`, **before** the sync-clean gate `:132`); `run`'s generation guard (`:104`).
- **Reactive core** — `batch()` runs `flush()` **synchronously** at `batchDepth===0` (`scheduler.ts:299-323`,
  `:232`), so effects fire inside the load batch, before the promise resolves; `signal` skips an equal write
  (`signal.ts:52-56`); `dispose(owner)` bumps **no** counter, removes observer edges, fires cleanups, and
  **recurses into child scopes** (`owner.ts:163-194`, children at `:168`, owner cleanups at `:185`) — but
  never calls the returned `form.dispose` wrapper; `onCleanup` in a root body registers on `owner.cleanups`
  and fires on any disposal (`:141-153`).
- **`check-jsdoc.mjs`** — Check A ban regex `/\b(?:RD|PA|AR|…|PL)-\d+/g` (`:52`) matches `<PREFIX>-<digit>`
  only; Check B requires `@example` only on public **value** exports, type-only/interface members exempt
  (`:97`, `:164-194`).
- **Story/test precedent** — `forms-async.story.ts` (Button `disabled: () => …` thunk `:94`; abortable
  `sleep` `:21-33`; `rd:` metadata `:48`); `kitchen-sink.smoke.spec.test.ts` generic loop mounts+disposes
  the **parent** root (`:344-355`); `surface.impl.test.ts` locks the barrel to 5 runtime values (`:16-20`).

**Verdict on the core:** the `load` state machine is correct on a live form (loading cleared only by the
current non-disposed run; superseded/disposed settles return before touching state); AC #6 settle-ordering
and AC #8 transitions hold; async-on-load (ST-L11/L12) holds against real batch/flush timing and the
equal-write skip; the barrel/surface lock (AR-PL7) stays green. The findings below are around the edges.

---

## Findings

### PF-201 — 🟠 MAJOR — the `dispose` wrapper is not equivalent to an `onCleanup`; scope-disposal neither aborts nor guards the load
- **Where**: `00-ambiguity-register.md` AR-PL3; `03-01-load-orchestration.md` §E.
- **Grounding**: `create-form.ts:86` (the form's `createRoot` nests under the active owner); `owner.ts:163-194`
  (a parent `dispose()` recurses into children and fires their `owner.cleanups` — but never invokes the
  returned `form.dispose` wrapper); contrast `async.ts:138-143` (the async layer cleans up via an owned-effect
  `onCleanup`, so it **does** fire on parent disposal); `kitchen-sink.smoke.spec.test.ts:347-353` (disposes the
  **parent** root — `form.dispose()` is never called).
- **Defect**: AR-PL3 calls the wrapper "equivalent to an `onCleanup(() => { disposed = true; loadController?.abort(); })`
  in the root body … with no reliance on cleanup-fire timing." That equivalence is **false** for the
  parent-scope-disposal path. The wrapper sets `disposed`/aborts **only** on an explicit `form.dispose()`. When
  an enclosing scope is torn down (the smoke test; a future RD-08 dialog that owns the form by nesting), the
  form's child scope is disposed through the owner tree and the async effects clean up — but the wrapper never
  runs, so `disposed` stays `false` and `loadController` is never aborted.
- **Failure scenario**: a `load()` is in flight → the enclosing scope is disposed (no `form.dispose()`) → the
  loader's `AbortSignal` never fires (leaked fetch/timer), and when the loader later settles,
  `if (disposed || g !== loadGen) return false` sees `disposed===false`, `g===loadGen`, so it **falls through
  and writes every value, rebases the baseline, and clears `loading()` on a torn-down form** — precisely what
  RD-07 §Disposal says the `disposed` flag exists to prevent. The writes reach no live observer, but a retained
  form read afterward sees corrupted state, and the un-aborted loader is a real resource leak. **Untested** —
  ST-L10 exercises only direct `form.dispose()`. Note the asymmetry: the plan swapped the **RD's own suggested
  seam** ("register both in the root body via `onCleanup`, which fires once at disposal, `owner.ts:141`") for a
  wrapper, and the swap is what opens the gap.
- **Options**:
  - **(a) Register `onCleanup(() => { disposed = true; loadController?.abort(); })` in `buildForm`'s root body,
    keep `dispose: disposeScope`.** Fires on any teardown (direct or parent), matches the async layer's own
    pattern and the RD's explicit suggestion, closes the leak. *(Recommended.)*
  - (b) Keep the wrapper, and document that `form.dispose()` is mandatory before/instead of disposing an
    enclosing scope. Weaker guarantee; leaves the false "equivalent" claim to correct and the RD-08 nesting
    footgun live.
- **Recommendation**: **(a)** — it is the RD-ratified mechanism, is strictly more robust, removes the false
  justification, and costs nothing (`disposeScope` is already idempotent, `owner.ts:164`). Correct AR-PL3 and
  §E accordingly; optionally add an impl-test for parent-scope disposal aborting an in-flight load.
- **Confidence**: High that the equivalence is false and the gap is real. **Hardening**: independent challenger
  raised this at MAJOR; the lead pass had it at OBSERVATION and was reconciled **up** after confirming the
  nesting (`create-form.ts:86` + `owner.ts:168`) and the RD's own onCleanup suggestion — a textbook same-session
  blind spot the challenger caught.

### PF-202 — 🟠 MAJOR — the §C reference code seeds banned CodeOps IDs that `check:docs` cannot catch
- **Where**: `03-01-load-orchestration.md` §B/§C/§E code blocks (inline comments); `99-execution-plan.md` task 2.7 / AR-PL6 grep.
- **Grounding**: `check-jsdoc.mjs:52` — the ban regex is `/\b(?:RD|PA|AR|…|PL)-\d+/g`, i.e. `<PREFIX>-<digit>` only.
- **Defect**: §C is presented as the code to write, and its comments carry process IDs. The **digit-suffixed** ones
  (`(AR-48)`, `(AR-50)`, `(AR-51)`, `(AR-52)`, `PF-001`) **are** caught — a verbatim paste fails `check:docs`, which
  is a working safety net. But two shapes present in §C/§E **evade the scanner entirely**: `AR-PL2`/`AR-PL8` (a
  letter follows `AR-`, and there is no `PL-<digit>` substring) and `AC #8` / `AC #11/#12` (space + `#`, no
  hyphen-digit). Both are banned CodeOps IDs per the CLAUDE.md directive, yet would ship with a **green
  `check:docs`**. AR-PL6's "plain grep" only closes this if its pattern matches bare `AR-`/`AC`/`#` — the plan never
  pins the pattern, and a grep mirroring the scanner's `-\d+` would miss them too.
- **Failure scenario**: the executor pastes §C, runs `check:docs`, fixes only the tokens it flags (`AR-48`, `PF-001`,
  …), and ships `create-form.ts` with `// AR-PL2 …` / `(AC #8)` comments still in place — a NON-NEGOTIABLE
  shipped-code-ban violation past a green gate.
- **Options**:
  - **(a) Rewrite §B/§C/§E's code blocks now so the reference an executor pastes shows the *actual shipped
    comments* in plain language (per the "semantic rewrite, not delete" rule), and move the AR-/PF-/AC-
    traceability into the surrounding prose; also pin AR-PL6's grep to literal `AR-`, `AC`, `PF`, `PL`, `#\d`,
    `codeops/`.** *(Recommended.)*
  - (b) Leave §C as-is and rely on the mandated grep, tightening only its pattern. Cheaper, but still hands the
    executor code pre-seeded with violations.
- **Recommendation**: **(a)** — the plan should never hand the executor reference code that ships banned refs;
  plain-language comments + prose traceability is the house style and removes the risk at the source. *(Impact is
  compliance/docs, not runtime — calibrate accordingly, but the rule is NON-NEGOTIABLE and the gate demonstrably
  has the hole.)*
- **Confidence**: High — the regex hole is verified against `check-jsdoc.mjs:52` (both token shapes tested).
  **Hardening**: independent challenger finding; lead pass confirmed by reading the scanner source.

### PF-203 — 🟡 MINOR — §C shares one clone between `baseline` and the value signal
- **Where**: `03-01-load-orchestration.md` §C (`const v = clone(record[name]); baseline[name] = v; valueSignal(name).set(v);`).
- **Grounding**: RD-07 §"load flow" step 4 specifies **two** clones; the construction seed clones twice
  (`create-form.ts:103` and `:104`); `clone` copies arrays / passes scalars (`:11-13`); `eq` is element-wise (`:16-21`).
- **Defect / scenario**: harmless for scalars, but for an **array-typed field** (a check-group; `ArraySchema`
  exists in `fixtures.ts` but no load oracle uses it) `baseline[name]` and the value signal end up holding the
  **same array reference**. An in-place mutation of the value array then mutates the baseline too, so `dirty()`
  compares the array to itself → silently `false` and `reset()` is a no-op. The plan is *less* defensive than both
  the RD it implements and the surrounding construction code, and no oracle would catch it.
- **Recommendation**: clone twice, matching the RD and `:103-104`:
  `baseline[name] = clone(record[name]); valueSignal(name).set(clone(record[name]));`. Optionally add an
  array-field load oracle. **Confidence**: High (both lead + challenger converged independently).

### PF-204 — 🟡 MINOR — "each with … an `@example`" on the interface members is non-idiomatic and unnecessary
- **Where**: `03-01-load-orchestration.md` §A ("Add two members … each with JSDoc + an `@example`"); echoed in `01`/`02`.
- **Grounding**: `check-jsdoc.mjs:97` + `:164-194` — `@example` is required only on public **value** exports; type-only
  exports and interface members are never inspected. `types.ts:59-98` — **no** existing `Form` member (`field`,
  `submit`, `reset`, `dispose`, …) carries a per-member `@example`, and §A's own code sample shows none either.
- **Defect / scenario**: the instruction contradicts §A's own code, §F's class-level-`@example` approach, and the
  established style; an executor following it literally adds non-idiomatic per-member examples. `check:docs` is
  satisfied by the `createForm` class `@example` (§F) alone.
- **Recommendation**: drop the per-member `@example` instruction; keep member JSDoc + the `createForm` `@example`.
  **Confidence**: High (grounded in the scanner + the existing interface).

### PF-205 — 🟡 MINOR — ST-L1 cannot "stay green" at the red phase as claimed
- **Where**: `07-testing-strategy.md` ST-L1 row ("*Stays green through implementation*"); `99-execution-plan.md` task 1.2 ("ST-L1 stays green").
- **Grounding**: ST-L1's expectations include `loading()===false`, but `Form.loading` does not exist until task 1.4.
- **Defect / scenario**: at the red phase (1.2), `form.loading()` throws `TypeError` → **ST-L1 fails**, not "stays green."
- **Recommendation**: either accept ST-L1 also goes red until 1.4 (correct the claim), or move the `loading()`
  assertion out of the pure-regression oracle (AC #8 / ST-L8 already covers `loading()` defaulting `false`), leaving
  ST-L1 to assert only the pre-existing surface — which genuinely stays green. **Confidence**: High.

### PF-206 — 🟡 MINOR — ST-L9 never asserts `loading()` across the supersede/settle
- **Where**: `07-testing-strategy.md` ST-L9.
- **Grounding**: ST-L9 checks `signals[*].aborted` and `rawValues()` only.
- **Defect / scenario**: a concurrency-specific regression — the dropped older settle wrongly clearing `loading()`,
  or the newer settle failing to clear it — would pass ST-L9 (ST-L8 only exercises a single load).
- **Recommendation**: add `loading()===true` after the two overlapping calls, `===false` after the newer resolve, and
  still `===false` after the older (dropped) resolve. **Confidence**: Medium-High (incremental coverage over ST-L8).

### PF-207 — 🔵 OBSERVATION — AC #5's "submit-attempted cleared" clause is unobservable
- **Grounding**: `submitAttempted` is write-only (`create-form.ts:108-110`, "nothing reads it yet").
- **Note**: ST-L5 can assert `touched()` clears but cannot verify the submit-attempted half of AC #5 — no accessor
  reads it (a pre-existing limitation shared with RD-04/RD-06). Flag so coverage is not over-claimed; no action needed
  beyond wording ST-L5 to claim only what it verifies.

### PF-208 — 🔵 OBSERVATION — the file-size estimate is slightly optimistic
- **Grounding**: `create-form.ts` is 215 lines; the additions (4 state lines + ~30-line `load` + wrapper + 3
  returned-object lines + ~12-line `@example`) land nearer **~265** than the "~255" in `03-01`/`07`/task 1.8.
- **Note**: immaterial (well under the 500 ceiling), but the task-1.7/1.8 size assertion should allow slack rather
  than pin ≈255.

---

## Solid dimensions (verified, not assumed)

- `loading()` state machine on a live form (success/reject/superseded/disposed) — correct; cannot stick true or
  falsely clear.
- Async-on-load timing (ST-L11 unconditional clear even for a sync-invalid loaded value; ST-L12 sync-clean gate) —
  holds against real `batch`→`flush` synchronicity and the equal-write skip.
- Barrel / surface lock (AR-PL7) — `load`/`loading` are `Form` methods + type-only members; the 5-value runtime
  lock stays green.
- Every `file:line` citation in `02-current-state.md` — accurate.
- AC → oracle mapping — all 15 ACs map to an oracle (subject to PF-205/206 strengthening).

---

## Decisions

| Finding | Severity | Recommendation | Decision |
|---------|----------|----------------|----------|
| PF-201 | 🟠 MAJOR | `onCleanup` in root body; drop the wrapper | ✅ applied (AR-PL3, `03-01` §D/§E, `00-index`, `01`, `02`, task 1.4/1.7) |
| PF-202 | 🟠 MAJOR | Rewrite §B/§C/§E comments to plain language now + pin the grep | ✅ applied (`03-01` §C block, task 2.7 grep) |
| PF-203 | 🟡 MINOR | Clone twice (match RD + seed) | ✅ applied (`03-01` §C + Notes, task 1.4, impl test) |
| PF-204 | 🟡 MINOR | Prose JSDoc on members; class `@example` covers surface | ✅ applied (`03-01` §A) |
| PF-205 | 🟡 MINOR | Correct "stays green" / move `loading()` to ST-L8 | ✅ applied (`07` ST-L1) |
| PF-206 | 🟡 MINOR | Add `loading()` assertions to ST-L9 | ✅ applied (`07` ST-L9) |
| PF-207 | 🔵 OBS | Word ST-L5 to claim only `touched()` | ✅ applied (`07` ST-L5) |
| PF-208 | 🔵 OBS | Allow slack in the size assertion | ✅ applied (`03-01`, `07`, task 1.8) |

**Tier**: ✅ **PASSED** — all 8 findings applied (2 MAJOR · 4 MINOR · 2 OBSERVATION) on 2026-07-16. The roadmap
RD-07 row advances 📋 Plan Created → 🔬 Plan Preflighted.
