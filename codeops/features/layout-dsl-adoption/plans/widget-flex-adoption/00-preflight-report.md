# Preflight Report — widget-flex-adoption

> ⚠️ **SAME-SESSION REVIEW** — this plan was authored by the same model in the same session. Five
> independent `preflight-auditor` dispatches (one per dimension cluster) were used as the
> counter-measure; the findings below are theirs, merged and de-duplicated.
> **Scanned**: 2026-07-19 · plan at `06e226f6` · branch `feat/dsl-adoptation`
> **Verdict**: ✅ **PASSED — all 27 findings resolved** (iteration 1 scanned BLOCKED; resolutions applied 2026-07-19)
> **Findings**: 27 (🔴 1 · 🟠 10 · 🟡 16)

## Resolution summary

The user ruled on the four blocking scope questions; the remaining 23 were corrections applied to
make the documents match verified reality.

| Finding | Resolution |
|---|---|
| PF-001 🔴 | `personalize-dialog.ts:391` **dropped from scope** (AR-7 revised) — restores issue #116's filed boundary rather than engineering around a break the issue had already predicted |
| PF-011, PF-008, PF-009 | AR-3 **re-ruled**: `grid-panels.ts` narrowed to 15 of 23. The four branch-accumulating containers and four `segLayout` branches are excluded — the issue's churn argument was correct |
| PF-007 | AR-11 **added**: `overlay.ts:125` preserved and pinned by new witness **ST-W7**, applying AR-1 uniformly to all three externally-reachable receivers |
| PF-012, PF-013 | AR-12 **added**: ST-W5/W6 become `*.impl.test.ts`; task 1.7 re-tagged complex |
| PF-002, PF-003 | `grid-lifecycle.ts:76` → `grow(col(...))`; `grid-panels.ts:255` → `fixed(row(), 1)`. A "the tagger writes only the props it owns" rule now heads 03-02 |
| PF-004 | Counts corrected throughout; final scope is 48 conversions + 3 preserved |
| PF-005 | AC-8's count replaced by a 22-site **residue allowlist** with per-site categories |
| PF-006 | Group C rationale replaced with the true one; task 4.4's stop-rule deleted |
| PF-010 | `application.ts:347`/`:353` specified as **relocated verbatim** into standalone guards |
| PF-014 | Non-vacuity clause (exact counts + non-zero rects) now mandatory for every characterization witness |
| PF-015 | Tasks 2.3/2.4/4.6 reworded to **add** the explaining comments |
| PF-016 | ST-W1 asserts the literal `1` |
| PF-017, PF-024 | Reasoning corrected in 03-01 and 00-index; conclusions unchanged |
| PF-018 | Task count corrected (35) |
| PF-019 | `filter-popup.ts:272` re-labelled a scope ruling, not a DSL limitation |
| PF-020 | Citations re-verified and corrected |
| PF-021 | `spacer` shadow recorded as staying with #114 |
| PF-022 | New task 5.5 — reconcile the issue bodies and roadmap before closing |
| PF-023 | AR-5 now names the adopted RD-02 subset (NFR-1/5/6/7) and states NFR-3 is deliberately inverted; NFR-6 added as AC-9 |
| PF-025, PF-026 | AC-1 and AC-6 reworded; AC-6 cites ST-W2 and is narrowed to its covered subjects |
| PF-027 | The AR-9 trade is now stated in `00-index.md` |

## The pattern behind most of this

The plan verified that the DSL builders merge (`{ ...view.layout, size }`) and correctly concluded
they add no nesting depth. It then applied that conclusion to the **site inventory without checking
each site's non-`size` properties**. Three sites carry a `direction` the prescribed tagger would
silently drop. PF-001, PF-002 and PF-003 are all instances of that one blind spot.

A second, independent blind spot: AR-1's public-receiver rule was applied to the receivers the
author happened to audit, and never run against `overlay.ts:125` — the one site that
*demonstrably reads the caller's pre-set layout* (PF-007).

A third: the plan overrode two of issue #116's filed exclusions with rationales that never engage
the reasons the issue actually gave (PF-011) — and one of those sites was excluded by the issue for
**precisely the defect PF-001 found**.

---

## 🔴 CRITICAL

### PF-001 — `at()` at `personalize-dialog.ts:391` drops `direction: 'col'`; no oracle guards it

**Found independently by 4 of 5 auditors.**

`packages/datagrid/src/personalize-dialog.ts:391-395` assigns
`{ direction: 'col', position: 'absolute', rect: {…} }`. `this.region` is a `ColumnRegion extends
Group` (`:203-206`) with no `layout` override, and `:391` is the **only** `.layout` write to it.
`at()` (`ui/src/view/dsl/absolute.ts:44`) writes only `position` + `rect`; `normalizeProps` defaults
`direction` to `'row'` (`ui/src/layout/types.ts:213`). So `at(this.region, …)` flips the column
region to horizontal flow.

`personalize.spec.test.ts` asserts model state only; `personalize.impl.test.ts` has no child-rect
assertion; neither ST-W5 nor ST-W6 covers this file. **The break would be silent.**

Worse: **issue #116 already out-scoped this site and named this exact blocker** — *"a load-bearing
absolute-extent seam … `at()` sets the rect but **not** the required `direction:'col'`"*. The plan
proposed converting it anyway, with a safety argument that contradicts the warning.

**Options:** (a) drop the site — restores #116's filed boundary; (b) keep it and specify
`ColumnRegion` carrying `override layout = { direction: 'col' }`, plus a witness pinning
`region.layout.direction`. **Recommend (a).**

---

## 🟠 MAJOR

### PF-002 — `grid-lifecycle.ts:76` carries `direction: 'col'`; "all size-only" is false
`03-02 §Group B` says `grid-lifecycle.ts`'s 5 sites are "all `size`-only → direct tagger
substitution". `:74-76` is `g.layout = { direction: 'col', size: fr 1 }`. `grow(g)` drops the
direction and the loading/error/empty placeholder shells flip to horizontal. 4 of the 5 sites *are*
size-only — which is what makes the exception dangerous.
**Fix:** reclassify `:76` as a container conversion (`grow(col(...))`); make ST-W5 assert the
shells' **children's** rects, not just the shell.

### PF-003 — `grid-panels.ts:255` carries `direction: 'row'`, filed under the mechanical pass
`bandRow()` assigns `{ direction:'row', size: fixed 1 }`. `fixed(g, 1)` drops the direction — it
survives only because `'row'` is the engine default. Same class as PF-002, benign by coincidence.
**Fix:** move to Pass 2 as `fixed(row(), 1)`; restate Pass 1 as 17 pure size-tag sites.

### PF-004 — `grid-panels.ts` has **23** sites, not 24; counts cascade to 47 / 59
**Found by all 5 auditors.** Verified line set: `208, 255, 441, 445, 448, 517, 522, 527, 536, 540,
544, 549, 553, 557, 566, 567, 578, 591, 619, 625, 637, 658, 674`. The plan's own Pass 1 (18) +
Pass 2 (5) already sums to 23 and contradicts every aggregate. `:547` (`const layout = segLayout(seg)`)
is the likely off-by-one source.
AC-2 ("All 48 #116 sites converted") is therefore **unsatisfiable**, and task 5.1's grep audit will
hunt a 24th site that does not exist. `02-current-state.md §4.1` also "corrects" the sweep memo's
count of 23 — but on the count the memo was **right**; only "only 3 convertible" was wrong.
**Fix:** 23 / 47 / 59 in six plan locations plus the roadmap; reword §4.1.

### PF-005 — AC-8's "6 documented exclusions" matches no set; the real residue is 11
Post-conversion `.layout =` residue across the 13 in-scope files: `application.ts:330, 335, 347,
353, 435`, `tab-view.ts:199, 254`, `data-grid.ts:89`, `filter-popup.ts:272`, `grid.ts:293`,
`button-row.ts:63` = **11**. "6" matches neither the 5 exclusions, nor 7 with the preserved sites,
nor 11. This is the only mechanical completeness gate for the whole refactor.
**Fix:** replace the count with an explicit 11-row allowlist (file:line + category); task 5.1's
oracle becomes "grep output equals this allowlist exactly".

### PF-006 — Group C's "all four mount into a live host" is false; task 4.4's stop-rule is incoherent
`grid.ts:508/511` are `new EditorOverlay()`, and `overlay.ts:142-145` sets `this.state.visible =
false` at construction — precisely the T-AO1 hidden-host shape the doc contrasts against. An executor
following task 4.4 halts on 2 of 4 sites; the fallback "leave it absolute" is also wrong (they are
`fill`, never absolute).
The conversion is nonetheless **inert** — `cover()` writes a byte-identical `position:'fill'` and the
engine ignores `size` on a fill box (`layout.ts:104-107`). This is an instruction defect, not a
geometry one.
**Fix:** replace the rationale with the true one and delete task 4.4's stop-rule.

### PF-007 — AR-1's public-receiver rule was never applied to `overlay.ts:125`
`mountCellOverlay` is barrel-exported (`datagrid/src/index.ts:161`) and reachable through the public
`filterPopup?: (ctx) => View` grid option (`grid.ts:180`). The function **explicitly reads the
caller's pre-set layout** (`:106-108`) and then clobbers it. Under `at()`, any other prop a custom
popup set (`padding`, `direction`, `gap`, `align`) would survive where today it is discarded — and
`filter-customization.spec.test.ts:96` already builds a popup that sets its own layout, while its
assertions check only `rect.width`/`height`, both of which `at()` overwrites. **No test would catch
it** — AR-1's own criterion for the hazard.
**Fix:** run `:125` through AR-1 and record the outcome — preserve the clobber with a pin test
(consistent), or accept the widening explicitly and pin the new contract.

### PF-008 — Four of five `grid-panels.ts` "container sites" cannot become builder expressions
`inner` (`:441`), `bodyRow` (`:445`), `freezeRowsRow` (`:448`) and `bodyStack` (`:578`) receive
children across ~230 lines of interleaved loops and conditionals (`:518…:676`), and `bodyStack` is an
**alias of `inner`** when lifecycle is off (`:577`). Only `host` is expressible. Task 3.3 says
"convert to `col`/`row`" under a *complex* tag — inviting a restructure of the branchiest function in
the package, the most likely way NFR-1 gets violated.
**Fix:** state that these are empty-builder substitutions only — every `.add()` and the alias stay
as-is — or drop them (zero payoff) and adjust counts.

### PF-009 — The four `segLayout` sites are runtime-branching, not mechanical substitutions
`segLayout` (`:475-476`) returns `fixed(panelBandWidth(...))` **or** `fr` depending on `seg.fixed`.
No single tagger expresses that. Sites `:549, 553, 557, 637` sit in Pass 1, whose whole safety
argument is "provably depth-neutral mechanical substitution".
**Fix:** introduce one `tagSeg(v, seg)` helper so the branch stays in one place, or move these four
to Pass 2 where they get their own verify gate.

### PF-010 — `application.ts:341-356` is declared both the conversion range and the exclusion range
`:347` and `:353` sit **inside the same `if` blocks that perform `root.add()`** (`:345-356`).
Converting to `col(...)` requires deleting those `if` wrappers, so the two sizing statements must be
lifted out and re-guarded — they cannot "stay exactly as-is" as `03-01:57` claims. The range also
swallows `:343-344` (`quitState`), which is unrelated.
**Fix:** narrow the range and state that `:347`/`:353` are *relocated verbatim* into standalone
guards, that being the boundary with #117.

### PF-011 — AR-3 and AR-7 override issue #116's filed exclusions on rationales that miss the issue's reasons
Issue #116 out-scopes `quick-filter-row.ts:155` and `personalize-dialog.ts:391` explicitly, and says
of `grid-panels.ts`: *"imperative band-assembly … that the DSL's expression sugar doesn't fit. Port
only the 3 clean wins and leave the other 20 (not worth the churn)."* The plan's correction —
"all sites are pure flex; the file contains no `position:'absolute'`" — is **true but rebuts a claim
the issue never made**. The issue's reason was fit and churn. PF-008 and PF-009 substantially
vindicate it.
**Fix:** re-confirm AR-3/AR-7 with the issue's actual rationale in evidence (see Decisions below).

---

## 🟡 MINOR

| # | Finding | Fix |
|---|---------|-----|
| PF-012 | ST-W5/ST-W6 freeze datagrid's internal band rects in **immutable** `.spec` oracles, obstructing the feature's own continued flex-elimination direction | name them `*.impl.test.ts`, or assert relationships not absolute rects |
| PF-013 | ST-W6 has no accessor seam (`GridBodyParts` exposes no band handles), must deep index-walk, yet is routed `standard` while being the sole structural guard for a 23-site file | re-tag task 1.6 `complex`; assert via a named walk, not raw index chains |
| PF-014 | ST-W2/W5/W6 expectations read "captured as-is" / "identical before and after" — vacuous; they pass even against an empty `children` array | add non-vacuity clauses (exact counts, non-zero rects) |
| PF-015 | FR-3 mandates explaining comments; tasks 2.3/2.4 say "leave `:254` **with its** comment" — the comments do not exist yet | reword to "**add** the comment" |
| PF-016 | ST-W1 asserts against `CHROME_ROW_HEIGHT`, which is module-private (`application.ts:182`) | assert the literal `1` |
| PF-017 | `03-01:36` claims `this.body` "carries no size today"; `TabBody` self-assigns `{direction:'col', size: fr 1, padding}` (`tab-view.ts:137`) | restate the reasoning; conclusion unchanged |
| PF-018 | Task count is 33, documents say 30 | 33 in both places |
| PF-019 | `filter-popup.ts:272` labelled the "#113 S6 deferral"; S6 is runtime-direction `flex()`. Also "the DSL cannot wrap it" is false — `at(this, …)` would work | re-label; restate as a scope ruling, not a capability limit |
| PF-020 | Citation drift: "15 `.layout.rect` reads" is 17–19; `app-shell.lifecycle.spec:92`→`:90`; `app-shell.menu.impl:41-44` is a test double; `data-grid.ts:150-151`→`:151-152` | re-run the greps |
| PF-021 | Issue #116 flags a local `spacer` shadowing the DSL `spacer()` at `grid-panels.ts:619`, conditional on the file adopting the DSL — now met, but unmentioned | add a rename task or record that it stays with #114 |
| PF-022 | No close-out task reconciles the #109/#116 bodies with executed scope | add task 5.x |
| PF-023 | AR-5 "adopting RD-02" is imprecise: RD-02 depends on RD-01; its NFR-3 re-derivation protocol is *inverted* by this plan's NFR-1; NFR-6 (security oracles unedited) is not carried over | name the adopted subset (NFR-1/5/6/7); add NFR-6 to §Verification |
| PF-024 | `00-index.md:21` claims datagrid imports nothing from ui's `table/`; `editable-grid-rows.ts:21` imports `GridRows` from `table/grid-rows.ts`. Conclusion survives, evidence is overbroad | restate precisely |
| PF-025 | AC-6 cites ST-W1 (which asserts no focus order) instead of ST-W2; the DataGrid and grid legs have no witness at all | cite ST-W2; narrow AC-6 or add a witness |
| PF-026 | AC-1 says "12 sites converted or preserved"; it is 12 converted **plus** 2 preserved = 14 touched | reword |
| PF-027 | AR-9 states the conflict is "surfaced to the user in the plan summary"; `00-index.md` does not mention it | add it to 00-index |

---

## Verified and could not be broken (no findings)

The tagger property itself (`flex.ts:170-193`), `at()`/`cover()` merge semantics (`absolute.ts:44,70`),
`col()` adding direct children with no wrapper and no injected `align`/`gap`/`padding`
(`flex.ts:87-107`), the S7 falsy-child skip, `Tab`/`TabViewOptions` exported, `buttonRow` **not**
exported, rebuild idempotency across `buildGridBody`'s two call sites, tag-before-vs-after-`add()`
ordering immateriality, shared-const aliasing safety, ST-W3/ST-W4 observability, every
`data-grid.ts`/`tab-view.ts`/`application.ts` line citation, the JSDoc CodeOps-ID ban compliance of
the proposed comments, the kitchen-sink obligation, model routing, and the branch/PR base.

**Security (Dimension 8): no findings** — a pure layout-descriptor refactor with no data flow,
parsing, I/O or privilege boundary; `security_profile` is `[]`. The datagrid security specs assert
via whole-frame `serialize()` scans and are geometry-independent.

**Dependency reality:** #122's traversal work is present on the branch and **PR #123 is MERGED**
(2026-07-19T18:31Z). No unmerged dependency.
