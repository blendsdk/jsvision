# 00 — Ambiguity Register (Zero-Ambiguity Gate)

> **Feature**: jsvision-forms/RD-05 — Comprehensive Forms Showcase
> **CodeOps Skills Version**: 3.8.0
> **Gate status**: ✅ GATE PASSED — every item Resolved with an explicit user decision; zero deferred.
> **Last Updated**: 2026-07-16

RD-05 has **no standalone requirements document** (unlike RD-06…09); its scope is the roadmap row
plus the design vetted in GH #85. The user chose to plan directly (AR-PL1), so this register + the
plan's `01-requirements.md` are the disambiguated scope of record. All five semantic forks were
resolved by the user in the planning interview; the rest are grounded derivations.

## Categories reviewed (12)

Scope · Behavior · Data/State · Error handling · Naming · File structure · UX/copy · Dependencies ·
Testing · Security · Performance · Edge cases. No unresolved item in any category — a showcase story
over an already-shipped engine has a narrow surface; the load-bearing decisions are structural
(what the story is) and presentational (how the variants read), all captured below.

## Register

| # | Category | Ambiguity | Resolution | Status | Source |
|---|----------|-----------|------------|--------|--------|
| **AR-PL1** | Scope/process | RD-05 has no RD doc — author one first, or plan directly? | **Plan directly.** Capture the showcase scope in this plan's `01-requirements.md` via the interview + this gate. Proportional for example/demo code (no shippable library surface); the roadmap row + GH #85 already sketch the design. | ✅ Resolved | User |
| **AR-PL2** | File structure | Is the showcase one story, several, or an edit of `forms/form`? | **One flagship grand-tour story** `forms/showcase` (a new `stories/forms-showcase.story.ts` + one registry line). The four existing capability stories (`forms/form`, `forms/async`, `forms/load`, `forms/dialog`) stay **untouched**. | ✅ Resolved | User |
| **AR-PL3** | Scope/behavior | Which capabilities must the deliverable demonstrate? | **All four:** (a) live state inspector (`rawValues`/`values`/`errors`/`isValid`/`dirty`/`validating`/`loading`); (b) amber app-advisory warnings; (c) right/below error-layout variants; (d) inline async validation + `form.load()` + `formDialog()` — an end-to-end tour. | ✅ Resolved | User |
| **AR-PL4** | UX/data | What valid-but-risky condition fires the amber advisory? | **Privileged port (`1 ≤ port < 1024`)** → an amber `Text.severity:'warning'` reading "privileged port — needs elevated rights". Valid input; no engine change. | ✅ Resolved | User |
| **AR-PL5** | UX/behavior | How are the right-vs-below error-layout variants presented? | **A live toggle** (a `RadioGroup` "Errors: right │ below") that reflows the form's error placement through the `col`/`row` DSL. Compact (fits the narrow canvas), interactive, and shows the DSL directly. | ✅ Resolved | User |
| **AR-PL6** | Testing | What is the verify command, and what tests gate the story? | **`yarn verify`.** The story is gated by one immutable smoke oracle **ST-SS1** in `kitchen-sink.smoke.spec.test.ts` (registered · category `Forms` · metadata · paints its characteristic strings) — matching the sibling stories' single-oracle pattern (ST-N1/AS1/LS1/DS1). No impl test: a story encapsulates its form, and reactive affordances are guarded structurally by always-painted hints (as the siblings do). | ✅ Resolved | Derived + confirmed |
| **AR-PL7** | Scope boundary | Does RD-05 touch `@jsvision/forms`/core/ui? | **No.** Purely `packages/examples/kitchen-sink/`. Every accessor the inspector reads and every capability demoed already ships (`rawValues`/`values`/`errors`/`isValid`/`dirty`/`validating`/`loading`, `asyncValidators`, `form.load`, `formDialog`, `Text.severity:'warning'`). No new dependency anywhere. | ✅ Resolved | Derived (roadmap guardrail) |
| **AR-PL8** | Edge/rendering | The real story canvas is narrow (the shell subtracts the 24-col navigator sidebar). How does the two-column form+inspector fit, and how does the smoke oracle assert reactive strings? | Target a comfortable width (`Math.max(64, ctx.width-2)`) and lay the form+inspector out with the `col`/`row` DSL so it reflows; below the split, an **always-painted hint line** carries the demonstration literals (privileged-port advisory, the toggle) so the 72×16 headless smoke oracle finds them even though the live advisory only paints on `port < 1024`. Mirrors `forms/async`/`forms/load`/`forms/dialog`. | ✅ Resolved | Derived (grounded in the smoke harness `WIDTH=72,HEIGHT=16`) |

## Gate closure

All eight items Resolved; the user confirmed AR-PL1…PL5 explicitly in the interview and AR-PL6…PL8
are grounded derivations with no semantic choice left open. **✅ GATE PASSED — plan documents may be
written.**
