# Preflight Report: Accelerator Aliases

> **Artifact**: `codeops/features/theme-accelerators/plans/accelerator-aliases/` (implementation plan)
> **Iteration 1**: 2026-07-13 12:09 — ✅ PASSED (same-session), PF-001…PF-004 applied.
> **Iteration 2**: 2026-07-13 — fresh-session independent re-scan (the independence the iteration-1
> note recommended). Found 1 MAJOR (PF-005), 1 minor (PF-006), 1 observation (PF-007); the
> iteration-1 "parity oracle" conclusion was **factually wrong**. **All three resolved and applied to
> the plan** (2026-07-13). **Outcome: ✅ PASSED.** See the **Iteration 2** section at the bottom.

---

## Iteration 1 (2026-07-13 12:09)

> **Date**: 2026-07-13 12:09
> **Outcome**: ✅ PASSED — 0 critical/major · 4 findings (3 minor + 1 observation), all **applied** to the plan
> **⚠️ SAME-SESSION REVIEW** — the plan was authored in this session. Same-agent blind spots are
> likely; every claim below was re-verified against the actual code (`file:line` cited), not from
> memory. Consider a fresh-session re-scan for full independence.

## Codebase Context Summary

The plan targets `packages/core/src/engine/color/` (the theming tier) + `packages/theme-designer/`.
Verified against the real code:

- **The 10 hotkey references are the complete set.** `rolesFromAliases` uses `c.danger` at
  `roles.ts:41,42,108,109` and `c.warning` at `roles.ts:53,57,60,64,86,87` — and nowhere else.
  Grep for `.danger`/`.warning` property reads across `packages/*/src` + `packages/examples`:
  **zero** hits outside the color module. No hidden consumer relies on these aliases. (Focus 3 ✓)
- **`danger`/`warning` byte-parity values confirmed:** nord `warning:'#ebcb8b'` / `danger:'#bf616a'`
  (`preset-seeds.ts:34-35`), dracula `warning:'#f1fa8c'` / `danger:'#ff5555'` (`:56-57`) — matching
  ST-6. (Focus 2 ✓)
- **All 11 `createTheme`-generated presets pass only `mode`/`accent`/`neutral`/`overrides`** — no
  `roleOverrides`, so no preset patches a `hotkey` field directly (`preset-seeds.ts`). The explicit
  per-preset pin fully reproduces the current output. `presets.impl.test.ts:44` round-trips every
  preset with `toStrictEqual` — the global byte-parity oracle, green iff parity holds. (Focus 1 ✓)
- **Only one spec freezes the alias count:** `create-theme.spec.test.ts:45` (`toBe(16)`). Every other
  `toBe(16)` in the suite is unrelated (`PALETTE` length, `ANSI16_ORDER`, `HISTORY_MAX_ENTRIES`, …).
  (Focus 5 ✓)
- **The entire UI hotkey-color test suite pins against the untouched `defaultTheme` literal**, not
  the alias-derived path: `controls.text-label.spec:106`, `controls.button.spec:57`,
  `controls.cluster.spec:53`, `tab-strip.spec:107`, and the `*-theme.spec` fixtures use
  `defaultTheme.*` / `PALETTE.yellow`. `color-palette-theme.spec.test.ts:84-118` decodes
  `defaultTheme`'s roles against the TV cpGrayDialog source. Since `defaultTheme` is **not** touched,
  all of these stay green untouched. (Focus 5 ✓)
- **`ThemeColors` required-field breakage is contained.** The only literals are the spec `SAMPLE`
  and the `rolesFromAliases` `@example` (both updated by the plan). The designer never constructs a
  literal — `resolvedAliases()` = `{ ...aliasesFromSeeds(seeds), ...aliasOverrides }`
  (`model.ts:138`), so it inherits the two new fields automatically once `aliasesFromSeeds` returns
  them. At v0.2.0 the added required fields are semver-acceptable. (Focus 4 ✓)

**Verdict on the five focus areas: all confirmed sound.** The plan's scoping (update one core spec +
one designer spec; leave serialization, the UI suite, and `presets.impl` untouched) is correct.

## Findings

### 🟡 PF-001 (MINOR · Test Impact / Completeness)

`02-current-state.md` does not explain why the large UI hotkey-color test suite is unaffected. An
executor grepping `warning`/`hotkey` will find `tab-strip.spec:107`, `controls.*`, and the
`*-theme.spec` fixtures and may fear a regression — or worse, "fix" a passing spec.

**Recommendation:** Add one line to `02-current-state.md`: *all UI hotkey-color assertions pin
against the untouched `defaultTheme` literal (not `createTheme`/`rolesFromAliases`), so they are
unaffected and MUST NOT be edited.* Confidence: High. Hardening: verified against 8 test files.

### 🟡 PF-002 (MINOR · Testability)

ST-8 asserts "no role field equals `#010203`/`#040506`" — a *probabilistic* inertness oracle (a
derived color could, in theory, collide). Vanishingly unlikely, but not deterministic.

**Recommendation:** Strengthen ST-8 to a deterministic equality: a theme built with
`overrides:{ danger:X, warning:Y }` must `toStrictEqual` the same theme built without them (same
seeds). Because no role reads `danger`/`warning`, the two outputs are byte-identical — a clean proof
of inertness with no probability. Keep the randomized-hex check as the `impl` complement.
Confidence: High.

### 🟡 PF-003 (MINOR · Codebase Alignment)

Task 2.2.6 edits `CLAUDE.md`, but its four "16 alias" mentions (`CLAUDE.md:92,96,271`) live in the
**auto-generated** `## Project structure` block and an `analyze_project` refresh marker (`:271`). A
hand edit there is fragile — the next `/analyze_project` (which `exec_plan` may trigger as its
post-completion re-analysis) regenerates those sections.

**Recommendation:** Drop task 2.2.6; let `analyze_project` refresh the count. If you want it correct
immediately, run `/analyze_project` after execution rather than hand-editing an auto-section.
Confidence: High.

### 🔵 PF-004 (OBSERVATION · Consistency)

The two new fields' placement in `ThemeColors` affects only `Object.keys` order — i.e. the designer
rail row order and ST-1's key list — never serialization (roles-based) or parity. Worth deciding
explicitly rather than by accident.

**Recommendation:** Add them as their own `// --- accelerator (2) ---` group immediately after the
`accent (2)` group (hotkey accents are conceptually accent-adjacent), keeping the rail's grouping
legible. Optional.

## Adversarial checklist (same-session safeguard)

- *Did I assume "danger/warning only feed hotkeys" from memory?* — No; re-grepped, zero other reads.
- *Did I assume the UI suite tests generated themes?* — Checked; it pins `defaultTheme`.
- *Did I assume required fields are safe without counting literals?* — Counted: two, both updated.
- *Is the parity oracle real?* — Yes; `presets.impl.test.ts:44` `toStrictEqual` per preset.

## Pass Determination

No 🔴/🟠 findings. All four findings were **applied** to the plan (2026-07-13):

- **PF-001** → `02-current-state.md`: added the "UI hotkey-color suite pins `defaultTheme` — do not edit" note.
- **PF-002** → `07-testing-strategy.md`: ST-8 is now a deterministic `toStrictEqual` inertness proof.
- **PF-003** → `99`/`03-02`/`02`/register: dropped the `CLAUDE.md` hand-edit (task count 19→18); deferred to `/analyze_project`.
- **PF-004** → `03-01`/`99`: explicit `accelerator (2)` field group after `accent (2)`.

**Outcome: ✅ PASSED.** The plan is ready for `exec_plan`.

---

## Iteration 2 (2026-07-13 — fresh-session independent re-scan)

> **Status**: ✅ PASSED — 3 findings (0 critical, **1 major**, 1 minor, 1 observation), all resolved & applied
> **Previous iteration**: 4 findings, all applied. **Carried forward**: none open.
> **This iteration**: PF-005 (major), PF-006 (minor), PF-007 (observation) — all resolved 2026-07-13.
> **Independence note**: This scan ran in a fresh session with no memory of the authoring. Its central
> finding (PF-005) **overturns** the iteration-1 adversarial-checklist conclusion *"Is the parity
> oracle real? — Yes"*, which was mistaken. PF-005 was independently confirmed by a challenger agent
> asked only neutral, falsifiable questions.

### Codebase Context Summary (re-verified)

- **Tech stack:** yarn+turbo TS monorepo; the change is confined to `packages/core/src/engine/color/`
  (pure data/mapping) + one `packages/theme-designer/src/view/` edit.
- **The core finding holds.** `c.danger` is read only at `roles.ts:41,42,108,109` and `c.warning`
  only at `roles.ts:53,57,60,64,86,87` — 10 hotkey references, nothing else. A repo-wide grep for
  `.danger`/`.warning` property reads across `packages/*/src` + `packages/examples`: **zero** hits
  outside the color module. R4/R8 inertness is real.
- **The default mapping is correct.** `aliasesFromSeeds` defaults `warning:'#f59e0b'`, `danger:'#ef4444'`
  (`create-theme.ts:112,111`). The plan's `accelerator` default `#f59e0b` (feeds the 6 control hotkeys
  that were `c.warning`) and `menuAccelerator` default `#ef4444` (feeds the 4 chrome hotkeys that were
  `c.danger`) match today's values byte-for-byte — no transposition in the plan.
- **`ThemeColors` literal impact is contained.** The only value literals are the spec `SAMPLE`
  (`create-theme.spec.test.ts:22`) and the `rolesFromAliases` `@example` — both updated by the plan.
  The designer's `resolvedAliases()` is a spread `{ ...aliasesFromSeeds(s.seeds), ...s.aliasOverrides }`
  (`model.ts:138`) and auto-inherits the two new fields. No designer test asserts a fixed alias count.
- **CHANGELOG.md exists** (root, `## [Unreleased]`) — task 2.2.4 is real. `contrast.ts` iterates a
  role-pair list (`contrast.ts:19`), not aliases — unaffected, as the plan claims.

**Verdict:** the plan's *design* is sound and its mapping is correct. The failure is in its
**verification strategy** — the byte-parity guarantee (R7/AR-04, a *hard* requirement) is claimed to
be covered by an oracle that cannot detect the regression it is meant to catch.

---

### 🟠 PF-005: The byte-parity "oracle" cannot detect a preset regression — 8 of 10 curated presets are silently unguarded (MAJOR)

**Dimension:** Testability / Completeness Gap / Codebase Alignment (Test Impact)
**Location:** `01-requirements.md:95`, `02-current-state.md:78-81,135`, `03-01…:127`,
`07-testing-strategy.md:37,78-82`, `99-execution-plan.md:66,138`; and `00-ambiguity-register.md` AR-16.
**Codebase Evidence:** `packages/core/test/presets.impl.test.ts:44-48`;
`packages/core/src/engine/color/create-theme.ts:36,151`; `preset-seeds.ts` (10 curated `overrides`).

**The Problem:** The plan repeatedly designates the `presets.impl.test.ts` serialize/parse round-trip
as *"our strongest parity oracle"* / *"byte-identical role output for all 13 presets"* / *"green iff
parity holds"* (and AR-16 rests the whole preset-parity strategy on it). But that test is
`expect(parseTheme(serializeTheme(theme))).toStrictEqual(theme)` — a **self round-trip**. It compares
each *post-change* preset to *itself* after a serialize/parse cycle; it proves serialization is
lossless and knows **nothing** about the pre-change (historical) values.

Concretely, if an executor forgets (or transposes) the `accelerator`/`menuAccelerator` pin in, say,
`gruvboxDark`:
- **No compile error** — `overrides` is `Partial<ThemeColors>` (`create-theme.ts:36`), so omitting the
  two fields is type-valid; the required-field obligation is satisfied by `aliasesFromSeeds`.
- `gruvboxDarkTheme.labelShortcut.fg` silently drifts from `#d79921` (its `warning`) to the generic
  accelerator default `#f59e0b`; the 4 chrome hotkeys drift from `#cc241d` to `#ef4444`.
- The round-trip test **PASSES** (both sides are the same regressed object).
- **No other test catches it either.** ST-6 (planned) spot-checks **only nord + dracula**; ST-22
  pins background/accent, not hotkeys; the UI hotkey suite pins the untouched `defaultTheme`, not the
  generated presets. So **8 of the 10 curated presets** (solarizedDark, gruvboxDark, janus, warp,
  solstice, platinum, workbench, horizon) have **no** hotkey-parity guard.

This defeats a **hard** requirement (R7/AR-04: "byte-identical for every shipped preset") and
invalidates two of the three mitigations the plan's own risk table (`02-current-state.md:135`) lists
for its Med/Med "curated preset hotkey silently regresses" risk (the round-trip oracle + ST-6).
*Independently confirmed by a challenger agent given only neutral questions.*

**Related:** AR-16 records "`presets.impl.test.ts` round-trip is the parity oracle and stays
unchanged." New information invalidates that premise — the round-trip is a *serialization-fidelity*
guard, not a *value-parity* guard. This is a correction of a factual error, not a re-litigation.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A (rec) | Make ST-6 a **data-driven loop over all curated presets**: for each `PRESET_SEEDS[name]` with `overrides`, assert `theme.labelShortcut.fg === overrides.warning` **and** `theme.menuBar.hotkey === overrides.danger` (each accelerator-fed role = historical warning; each menuAccelerator-fed role = historical danger). | Complete + deterministic; self-maintaining (reads historical values from the same source); ~10 lines; catches omission *and* transposition on every preset. | Slightly more test code than the 2-preset spot check. |
| B | Assert at the pin site instead: for each preset with `overrides`, `overrides.accelerator === overrides.warning && overrides.menuAccelerator === overrides.danger`. Relies on ST-2/ST-3 to prove roles read the new aliases. | Cheapest; directly guards the edit an executor makes. | Indirect (proves parity transitively, not at the rendered role); a future role-map change could weaken the link. |
| C | Checked-in **golden snapshot** of all 13 preset objects captured before the change; diff after. | Most airtight; catches *any* drift, not just hotkeys. | Heavier ceremony; a new fixture to maintain; overkill given A/B fully cover the actual risk. |

**Recommendation:** **Option A.** It turns "byte-identical for every preset" from an aspiration into a
real, complete oracle at the cost of a handful of lines, and it reads the expected values from the
presets' own `warning`/`danger` so it never drifts out of date. Update `07-testing-strategy.md` ST-6,
`02-current-state.md`'s risk-table mitigation wording, the "byte-parity oracle" claims in
`01`/`03-01`/`99`, and AR-16 to reflect that the round-trip guards *serialization*, while ST-6 (now
all-preset) guards *parity*. **Confidence: High.** **Hardening:** independent challenger confirmed the
regression passes every existing and planned test except the nord/dracula ST-6 rows; the `Partial`
type and the `#d79921`→`#f59e0b` drift were traced to `file:line`.

**User Decision:** ✅ Resolved — User chose **Option A** (data-driven ST-6 over all curated presets).
Applied 2026-07-13 to: `07-testing-strategy.md` (ST-6 + regression-table + numbering note),
`02-current-state.md` (§serialize + risk row), `01-requirements.md` (AC #2), `03-01` (regression +
error-handling rows), `99-execution-plan.md` (tasks 1.1.2 / 1.2.5 + Success Criterion #3),
`00-ambiguity-register.md` (AR-16 corrected).

---

### 🟡 PF-006: The R10 doc-accuracy sweep misses the theme-designer package's stale "16 aliases" JSDoc (MINOR)

**Dimension:** Codebase Alignment (Convention/Doc accuracy) / Completeness Gap
**Location:** `03-02-designer-and-docs.md` §"Docs & Governance" table; `99-execution-plan.md` Step 2.2.
**Codebase Evidence:** stale "16 aliases" mentions the plan does **not** scope —
`packages/theme-designer/src/model/types.ts:32`, `packages/theme-designer/src/view/roles-panel.ts:2`,
`packages/theme-designer/src/view/roles-panel.ts:17`, `packages/theme-designer/src/model/model.ts:41`.
Also `packages/core/src/engine/color/roles.ts` has **three** "16" mentions (`:2,:15,:24`), where the
table entry says only "'16 semantic aliases' wording" (singular).

**The Problem:** R10 requires "Public JSDoc reflects the 18-token vocabulary." The Docs & Governance
table enumerates only core files + CLAUDE.md + CHANGELOG + kitchen-sink. The plan *does* edit
`roles-panel.ts` (for "(reserved)") but never flags its own "16 semantic aliases" comments, nor the
`types.ts`/`model.ts` ones. `check-jsdoc.mjs` bans plan refs and requires `@example` — it does **not**
catch a stale *number*, so after execution the theme-designer would describe "16 aliases" in 4 places
while rendering 18 rows, and `yarn verify` would stay green. R10 would be reported satisfied while
four shipped doc comments contradict it.

**Options:** One dominant path (no viable alternative worth a column): extend the Docs & Governance
table (and a task under Step 2.2) to include the four theme-designer mentions and to say "all three"
for `roles.ts`. Considered and dropped: "leave it to `/analyze_project`" — rejected because these are
hand-written JSDoc in `packages/*/src`, not the auto-generated `CLAUDE.md` block that PF-003 deferred;
`analyze_project` does not touch package source JSDoc.

**Recommendation:** Add `theme-designer/src/{model/types.ts,view/roles-panel.ts,model/model.ts}` to
the R10 sweep (4 mentions) and correct the `roles.ts` row to "3 mentions (`:2,:15,:24`)". Trivial, and
it makes R10 actually true. **Confidence: High** (grep-enumerated).

**User Decision:** ✅ Resolved — User chose **Add to sweep**. Applied 2026-07-13: `03-02` Docs &
Governance table gains the 3 theme-designer rows + the corrected `roles.ts` "3 mentions" row;
`02-current-state.md` relevant-files table updated; `99-execution-plan.md` gains task 2.2.6 (count 18→19).

---

### 🔵 PF-007: The plan's ST-1…ST-9 numbering collides with the existing ST-7…ST-11 in the same target file (OBSERVATION)

**Dimension:** Consistency / Ordering & Sequencing (clarity for spec-first execution)
**Location:** `07-testing-strategy.md:32-45,60-68`; target file
`packages/core/test/create-theme.spec.test.ts` (existing tests titled `ST-7:`…`ST-11:`).
**Codebase Evidence:** `create-theme.spec.test.ts:43` (`ST-7: … exactly 16 tokens`),
`:51` (`ST-8: rolesFromAliases returns a full Theme`), `:64,:79,:97` (`ST-9…ST-11`).

**The Problem:** The plan adds tests it calls ST-1…ST-5, **ST-7, ST-8** to a file that already
contains tests literally titled `ST-7:` and `ST-8:` — but the plan's ST-7 (`aliasesFromSeeds`
defaults) and ST-8 (danger/warning inertness) are *different* tests than the file's existing ST-7
(count) and ST-8 (full-Theme). The plan disambiguates once (`07:67` "existing ST-8…ST-11 there stay
intact") and the standards mean new tests get plain-language names (no literal `ST-` id, so no runtime
duplicate), but an executor doing spec-first could still misread which "ST-8" to modify vs. keep.

**Recommendation:** Add one line to `07-testing-strategy.md`: *"the ST-ids here are a fresh local
sequence; new tests carry plain-language descriptions (no `ST-` prefix) per the docs standard, so they
do not collide with the file's existing `ST-7…ST-11`. The only existing test that changes is the
'exactly 16 tokens' oracle (→ 18); all others stay verbatim."* Optional; purely clarity.

**User Decision:** ✅ Resolved — User chose **Add clarifying note**. Applied 2026-07-13: the numbering
note added to `07-testing-strategy.md` after the ST-1-supersedes paragraph.

---

### Adversarial checklist (fresh-session safeguard)

- *Did I confirm the round-trip claim by reading, not memory?* — Yes; `presets.impl.test.ts:44-48`
  read in full; a challenger agent independently traced the `#d79921`→`#f59e0b` drift and confirmed
  no test catches it.
- *Did I assume the plan's default mapping without checking for a transposition?* — Checked:
  `accelerator`←warning's `#f59e0b`, `menuAccelerator`←danger's `#ef4444`; correct.
- *Did I re-verify the "danger/warning only feed hotkeys" premise independently?* — Yes; re-grepped,
  zero reads outside the color module.
- *Did I miss any `ThemeColors` literal that +2 required fields would break?* — Enumerated: two, both
  updated; the designer uses a spread.

### Pass Determination — Iteration 2

**✅ PASSED** — the one MAJOR (PF-005) and both lesser findings were resolved and **applied to the
plan** on 2026-07-13 (Option A for PF-005; add-to-sweep for PF-006; clarifying note for PF-007). Zero
🔴/🟠 remain open. Post-fix consistency re-check confirmed no stale "round-trip = parity oracle" claim
survives anywhere in the plan, the task count is coherent (19), and ST-6 is uniformly described as the
data-driven all-preset parity guard. The plan is ready for `exec_plan`.

**User Decisions:** PF-005 → Option A (applied) · PF-006 → Add to sweep (applied) · PF-007 → Add
clarifying note (applied).
