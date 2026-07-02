# Preflight Report: glyph-auto-swap

> **Status**: ✅ PREFLIGHT PASSED — all 7 findings resolved (0 critical, 1 major, 4 minor, 2 observation)
> **Iteration**: 2 (fixes applied per recommendations + re-scan verified — see Iteration 2 at the end)
> **Artifact**: Implementation plan at `codeops/features/jsvision-ui/plans/glyph-auto-swap/`
> **Codebase Grounded**: 18 source files + 10 test files examined; 31 references verified (29 accurate, 2 defective — PF-001, PF-002)
> **Last Updated**: 2026-07-02

> ⚠️ SAME-AGENT NOTE: the plan was authored earlier today, likely by the same model, but in a
> **prior session** (this review runs in a fresh session — reasonable independence). The PF-001
> recommendation was additionally hardened via an independent challenger agent (verdict: CONFIRMED).

## Codebase Context Summary

**Tech Stack:** TypeScript ESM (NodeNext, strict), yarn 1.x + Turborepo monorepo, vitest, zero runtime deps.
**Architecture:** `@jsvision/core` engine (capability / render / host / input / safety / color subsystems, single entry `src/engine/index.ts`); `@jsvision/ui` widget framework threading host options through `createApplication`/`run()`.
**Key Files Examined:** `host/{width-probe,host,types,signals,terminal-query,index}.ts`, `render/{glyphs,serialize}.ts`, `capability/{profile,defaults,detect,index}.ts`, `ui/src/app/{run,application}.ts`, tests `width-probe.{spec,impl}`, `host-width-warn.impl`, `render-glyphs.{spec,impl}`, `api-stability.spec`, `treeshake.spec`, ui `app-shell.lifecycle.*`, examples `kitchen-sink/main.ts`, `tvision-demo/main.ts`, `capability-probe/taxonomy.ts`, `DEFERRED.md`, feature roadmap.

**Reference Verification highlights (all confirmed accurate):**
- `AMBIGUOUS_PROBE_GLYPHS` at width-probe.ts:62, `WIDTH_WARNING_MESSAGE` :65, 200 ms budget :40, CPR caps :43/:46; `warnIfAmbiguousWide` already returns the result (:241-251).
- host.ts: caps captured :62, probe window :176-183, `probeWidthAndWarn` :142-151 (result discarded), `serialize(next, prev, {caps})` :239.
- `GlyphCaps` profile.ts:54-57; `CONSERVATIVE_DEFAULTS.glyphs` defaults.ts:30; `ResolveOptions.env` profile.ts:119; deep-merge is leaf-wise (detect.ts:120-134 + `deepMerge`), so `override.glyphs` partials preserve a defaulted `ambiguousWide` — ST-04 is feasible.
- AR-15 evidence verified: no env/table layer ever sets `glyphs` (only detect.ts's default+overlay resolution); kitchen-sink/main.ts:32 and tvision-demo/main.ts:128 do pass `override.glyphs`.
- New map keys (U+25B2/25BC/25C4/25BA/2022/2191/2195/00D7) are disjoint from `BOX_FALLBACK`/`BLOCK_SHADE` (glyphs.ts:18-52) — confirmed.
- `warnAmbiguousWidth` threading: types.ts:64 → run.ts:37/:59 → application.ts:56/:198 (plan cites :52 — trivial JSDoc-range drift).
- width-probe oracles: 9 spec + 7 impl = 16 (AR-16's count ✓); host-width-warn.impl has exactly 4 cases ✓.
- DEF-23/24 rows already present in DEFERRED.md (:42-43) and the feature roadmap (:40) — matches task 4.1.3's premise.
- No test constructs a full `CapabilityProfile` literal (all go through `resolveCapabilities` + `DeepPartial` overrides) — the new required `GlyphCaps` field has zero compile blast-radius outside `defaults.ts`.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | (with PF-001) | 🟠 |
| 4 | Completeness Gaps | 1 (PF-004) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-005) | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 1 (PF-003) | 🟡 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-006, PF-007) | 🔵 |
| 13 | Codebase Alignment | 2 (PF-001, PF-002) | 🟠 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | all resolved |
| MINOR | 4 | all resolved |
| OBSERVATION | 2 | all resolved |

---

### PF-001: SIGCONT resume repaint serializes with the ORIGINAL caps — adaptation silently undone after suspend/resume 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption), + 3 — Logical Contradiction (vs FR-4's intent)
**Location:** `03-01-core-glyph-swap.md` §Architecture/Proposed — "Decode, mode strings, restore, and signals keep the original `caps` — glyph flags play no role there"; `01-requirements.md` FR-4 — "Only the host's `serialize` calls use effective caps".
**Codebase Evidence:** `packages/core/src/engine/host/signals.ts:110-122` — the `'continue'` (SIGCONT) handler full-repaints the last buffer via `serialize(last, null, { caps: ctx.caps })` (line 118); `host.ts:186-201` passes the **original** `caps` into `installSignals`. Glyph flags absolutely play a role there — this is the second frame-content serialize call site (the only one besides `host.ts:239`; verified by sweep, `restore.ts` writes only precomputed mode strings).
**The Problem:** Under the plan as written, an adapted host (probe-adapted **or** `JSVISION_ASCII`-forced) that is suspended (Ctrl-Z) and resumed (`fg`) repaints the whole screen with un-swapped Unicode glyphs — full-screen shear on exactly the terminals this plan exists to fix. And it does not self-heal: `render()`'s `prev` (host.ts:245) holds the same *logical* chars, so the next app frame diffs clean and never re-emits those cells; wide glyphs also spill into neighbor columns, corrupting subsequent absolute-positioned partial repaints on those rows. One suspend/resume cycle silently undoes the feature. Suspend/resume is a first-class, tier-3-tested host flow.
**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Thread effective caps into `installSignals` via a getter (`getSerializeCaps: () => effectiveCaps`, mirroring the existing `getLastBuffer` seam); signals.ts:118 uses it. Fix the 03-01 sentence to "Decode, mode strings, and restore keep the original caps; the signals resume repaint uses the effective serialize caps." Add an oracle (resume repaint emits swapped glyphs on an adapted host). | Robust even if `effectiveCaps` were ever reassigned later; mirrors an existing seam pattern | One extra context field |
| B | Pass `effectiveCaps` by value to `installSignals` (adapt at host.ts:176-184 runs before install at :186, so ordering works today) | Smallest diff | Fragile against future reordering of `start()`; the ordering constraint becomes invisible |

**Recommendation:** Option A — the getter is the same seam style `getLastBuffer` already uses and makes the correctness independent of `start()`'s internal ordering.
**Confidence:** High. **Hardening:** independent challenger agent CONFIRMED (verified (a) no path delivers adapted caps to the repaint under the plan as written, (b) the persistence claim is correct, (c) no legitimate reason for original caps there, (d) no other missed serialize site).
**User Decision:** ✅ Resolved — user accepted recommendation (Option A). Applied 2026-07-02: 03-01 architecture + §4 + error table, FR-4, 02-current-state (facts + files + risk row), new oracle **ST-15**, exec-plan tasks 3.1.1/3.1.3 (+ `host/signals.ts` in file lists), 00-index.

---

### PF-002: `api-stability.spec.test.ts` does not assert the export surface — the plan's governance claim and task 4.1.1 edit are misdirected 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumption)
**Location:** `02-current-state.md` §Risks ("Governance suites assert export/API surface (`api-stability.spec.test.ts`)"); `03-01-core-glyph-swap.md` §6 ("Governance suites (`api-stability.spec.test.ts`) updated accordingly"); `99-execution-plan.md` task 4.1.1; `07-testing-strategy.md` §Integration/governance.
**Codebase Evidence:** `packages/core/test/api-stability.spec.test.ts:24-35` — the suite asserts only that `CHANGELOG.md` has `[Unreleased]`/`[0.1.0]` headings and `README.md` has a "Versioning & stability" section. It enumerates **no** exports. `treeshake.spec.test.ts:46-47` imports only `VERSION`. No test in the repo asserts the probe symbols' presence.
**The Problem:** Task 4.1.1's "update `api-stability.spec.test.ts` expectations" is a no-op, and the risk-table row overstates a constraint that doesn't exist. Harmless to execution, but the plan makes a false claim about the codebase, and an executor will burn time hunting for surface expectations that aren't there. (The 4.1.2 CHANGELOG entry alone keeps the suite green.)
**Recommendation (single viable path):** Correct the three passages — task 4.1.1 becomes "add public exports (`host/index.ts`, `engine/index.ts`); governance suites need no expectation edits (api-stability asserts CHANGELOG/README headings only — satisfied by 4.1.2)"; drop or reword the risk row. Considered and dropped: adding a real export-surface oracle — new governance scope this plan doesn't need.
**Confidence:** High (direct file read).
**User Decision:** ✅ Resolved — user accepted recommendation. Applied 2026-07-02: 03-01 §6, 02-current-state risk row, 07 governance table, exec-plan 4.1.1 + checklist (api-stability edit dropped).

---

### PF-003: `isAsciiSafe` ignores `unicode.utf8` — the probe runs (and can spuriously warn) on terminals whose output is already fully ASCII 🟡 MINOR

**Dimension:** 9 — Edge Cases (+ 4 Completeness)
**Location:** `03-01-core-glyph-swap.md` §3 — `isAsciiSafe = !glyphs.boxDrawing && !glyphs.halfBlocks && glyphs.ambiguousWide`; `01-requirements.md` FR-6.
**Codebase Evidence:** `packages/core/src/engine/render/glyphs.ts:76-79` — with `utf8: false`, every glyph above U+007F already emits `?`; output is fully ASCII regardless of the three glyph flags. Under `CONSERVATIVE_DEFAULTS` (utf8 off, ambiguousWide false), `isAsciiSafe` returns `false` → the probe runs, writing raw multi-byte UTF-8 probe glyphs to a terminal resolved as non-UTF-8: a Latin-1 terminal advances ~3 columns per glyph → a false "wide" verdict → flag flips with zero output effect plus a spurious warning (and a momentary mojibake artifact before cleanup).
**The Problem:** The skip predicate misses the strongest "nothing to learn or swap" case (AR-13's own rationale). Today's warn-only probe shares the exposure, so it's not a regression — but the plan is introducing the predicate and should get it right.
**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | `isAsciiSafe = !caps.unicode.utf8 \|\| (!boxDrawing && !halfBlocks && ambiguousWide)`; add an ST case (utf8-off caps → zero probe bytes) | Fixes probe waste, mojibake, and spurious warning in one line; true to AR-13's rationale | None of substance |
| B | Keep as spec'd; document utf8-off as accepted noise | No change | Knowingly ships a wrong skip predicate the plan itself introduces |

**Recommendation:** Option A. Also add one clarifying sentence near AC-3: `JSVISION_ASCII` ASCII-safety covers **chrome** (serialize fallback); app **content** Unicode passes through by design.
**Confidence:** High.
**User Decision:** ✅ Resolved — user accepted recommendation (Option A). Applied 2026-07-02: 03-01 `isAsciiSafe` definition + skip-cases + error-table row, FR-6, AC-3 clarifier, new oracle **ST-16**.

---

### PF-004: The fate of `WidthProbeOptions.glyphs` under the two-group amendment is unspecified 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-01-core-glyph-swap.md` §3 (amends the result shape and probe constants, silent on the options shape); `01-requirements.md` FR-3.
**Codebase Evidence:** `packages/core/src/engine/host/width-probe.ts:90-95` — `WidthProbeOptions.glyphs?: string` is the shipped single-probe-string override, exported via `host/index.ts:27` and used by the existing spec/impl oracles being amended in task 2.1.1.
**The Problem:** With two probe strings, a single `glyphs` option is incoherent — does it override group 1 only, both, or disappear? The oracle-amendment task hits this undefined edge immediately.
**Recommendation (single viable path):** Specify in 03-01 §3: replace `glyphs?` with `arrowGlyphs?: string` / `boxGlyphs?: string` (both defaulted to the exported constants), preserving the test-injection purpose under the same AR-16 in-place amendment. Considered and dropped: keeping `glyphs?` as group-1-only (silently misleading) and removing injection entirely (worsens testability of custom widths).
**Confidence:** High.
**User Decision:** ✅ Resolved — user accepted recommendation. Applied 2026-07-02: 03-01 §3 (`arrowGlyphs?`/`boxGlyphs?` paragraph), FR-3.

---

### PF-005: ST-14 cites a ui observation seam that doesn't exist; the observable needs to be specified 🟡 MINOR

**Dimension:** 7 — Testability
**Location:** `07-testing-strategy.md` ST-14 — "observable via the same injection seam the existing `warnAmbiguousWidth` ui tests use".
**Codebase Evidence:** The only existing ui usages pass `warnAmbiguousWidth: false` to *skip* the probe (`packages/ui/test/app-shell.lifecycle.impl.test.ts:31`, `.spec.test.ts:56`, `app-shell.integration.impl.test.ts:94`) — no ui test observes what the host *received*. Also `run.ts:51-75` does not thread `onWidthWarning`, so the warning-variant observable is unavailable at ui level (default sink is `process.stderr`).
**The Problem:** The named precedent is phantom; as written, the spec-test author (who must not read the implementation) has no defined observable for "the created host receives `adaptAmbiguousWidth: true`".
**Recommendation (single viable path):** Amend ST-14 with the concrete observable: inject a TTY-true `FakeInput` + `CaptureStream` (doubles exist), pass `warnAmbiguousWidth: false`; adapt unset (default `true`) ⇒ CPR request bytes (`\x1b[6n`) appear in the captured output; explicit `adaptAmbiguousWidth: false` ⇒ no probe bytes. Feed a scripted CPR (or note the 200 ms timeout) so the test stays fast. Considered and dropped: threading `onWidthWarning` through ui just for the test — API surface added for observability the probe-bytes check gets for free.
**Confidence:** High.
**User Decision:** ✅ Resolved — user accepted recommendation. Applied 2026-07-02: ST-14 rewritten with the concrete probe-bytes observable + scripted-CPR note; exec-plan 3.1.1 annotated.

---

### PF-006: Warning-text drift — "a font" vs "a monospaced font" 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location:** `03-01-core-glyph-swap.md` §Warning messages — `WIDTH_ADAPTED_MESSAGE` says "use a **monospaced** font with full Unicode coverage"; the revised `WIDTH_WARNING_MESSAGE` says "use a font with full Unicode coverage".
**Codebase Evidence:** The shipped text (`width-probe.ts:66-69`) says "use a **monospaced** font…" — the revision silently drops the word in one variant only.
**Recommendation:** Restore "monospaced" in the warn-only variant (one word; stays within AR-10's approved intent).
**User Decision:** ✅ Resolved — user accepted recommendation. Applied 2026-07-02: 03-01 `WIDTH_WARNING_MESSAGE` text. (AR-10's register entry stays as-is — it referenced "the existing message", which already says "monospaced".)

---

### PF-007: `◄`/`►` (U+25C4/U+25BA) are East-Asian **Neutral**, not Ambiguous — doc labeling only 🔵 OBSERVATION

**Dimension:** 12 — Consistency (doc accuracy; zero functional impact)
**Location:** Throughout (plan + shipped code) the 8-glyph set is labeled "East-Asian-Ambiguous chrome glyphs".
**The Problem:** Per recollection of Unicode `EastAsianWidth.txt` (ranges 25B2..25B3;A, 25B6..25B7;A, 25BC..25BD;A, 25C0..25C1;A — 25BA/25C4 absent → N), 2 of the 8 group-1 glyphs are Neutral. Functionally irrelevant: the probe measures actual rendering, and font-fallback (the common case) is EAW-agnostic; under a pure ambiguous-wide locale group 1 still measures >8 and the whole-group swap keeps alignment. ⚠️ Unable to verify against the full standard text in this session — flag for a quick `EastAsianWidth.txt` check if wording precision matters.
**Recommendation:** Optionally soften the label to "ambiguous/fallback-prone chrome glyphs" in the new JSDoc; or dismiss as cosmetic.
**User Decision:** ✅ Resolved — user accepted recommendation. Applied 2026-07-02: 03-01 §1 `GlyphCaps` JSDoc + §2 `AMBIGUOUS_FALLBACK` comment softened to "fallback-prone (mostly EAW-Ambiguous)". Shipped-code JSDoc gets the same wording during Phase 2 (it is being amended anyway).

---

## What was checked and found CLEAN

Ambiguities (terms, gate conditions, message-variant selection — all pinned); implicit assumptions (AR-15's "no layer sets glyphs" — verified true; deep-merge leaf semantics — verified, ST-04 feasible); dependencies (phase order matches the real import graph); feasibility (dual-CPR over one `TerminalQuery` iterator + shared 200 ms budget — sound, impl tests planned; ST-05 column math checks out); security (CPR untrusted-input posture preserved; `JSVISION_ASCII` presence-only, never parsed/logged); scope (tight; non-goals explicit; no creep); Ambiguity Register (17/17 genuinely resolved, no re-litigation warranted); tracking (DEF-23/24 + roadmap rows already in place exactly as task 4.1.3 assumes).

---

## Iteration 2 — re-scan after fixes (2026-07-02)

> **Previous Iteration**: 7 findings — all resolved (user: "fix all per your recommendations")
> **This Iteration**: 0 new findings
> **Carried Forward**: none

**Fix verification (all 7 confirmed in the documents):**
- PF-001 — 03-01 architecture diagram gains the `getSerializeCaps()` resume-repaint line; §4 specifies the `installSignals` seam + `signals.ts:118` switch; error-handling table row added; FR-4 rewritten ("ALL frame-emitting serialize calls"); 02-current-state facts/files/risks updated; **ST-15** oracle added; exec-plan 3.1.1/3.1.3 + file lists include `host/signals.ts`.
- PF-002 — 03-01 §6, 02 risk row, 07 governance row, exec-plan 4.1.1 + checklist all corrected (no api-stability edits).
- PF-003 — `isAsciiSafe` now `!unicode.utf8 || (…)` with rationale; FR-6 + AC-3 clarified; **ST-16** oracle added; error-handling row added.
- PF-004 — `WidthProbeOptions.glyphs` → `arrowGlyphs?`/`boxGlyphs?` specified in 03-01 §3 + FR-3.
- PF-005 — ST-14 carries the concrete probe-bytes observable (TTY-true doubles, scripted CPR, `\x1b[6n` present/absent).
- PF-006 — "monospaced" restored in the warn-only text.
- PF-007 — both JSDoc labels softened to "fallback-prone (mostly EAW-Ambiguous)".

**Regression check:** oracle range ST-01…ST-16 consistent across 00-index, AC-7, 03-01, 07 (tables + checklist), 99 (overview, 3.1.1, master checklist); task count unchanged (0/20 — ST-15/16 fold into task 3.1.1, no new tasks); AR-10's register entry remains accurate as an audit record; ST-16's fixture (utf8 off, box/half on) is coherent with the new predicate; ST-12/ST-13 semantics unaffected by the predicate change (`degradeCapsFully` output satisfies either form). No contradictions introduced.

**Final status: ✅ PREFLIGHT PASSED — all 7 findings resolved.** Roadmap: DEF-23 row advanced to Plan Preflighted 🔬.
