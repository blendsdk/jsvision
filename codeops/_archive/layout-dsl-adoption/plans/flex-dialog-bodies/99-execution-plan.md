# 99 — Execution Plan

> **Plan**: layout-dsl-adoption/flex-dialog-bodies · **Implements**: RD-01 (Tier-2 ui/forms), RD-02 · **GitHub**: #115
> **Progress**: 14/14 tasks (100%)
> **Last Updated**: 2026-07-19 17:05
> **CodeOps Skills Version**: 3.9.0

Spec-first, behavior-invariant rebuild. Order per family: **traversal spec (green-on-current) → [geometry
re-baseline red] → implement → green (witnesses unedited) → verify**. The RD-01 re-derivation exception
(NFR-3) applies to exactly two geometry blocks (`editor-dialogs.spec:51,89`, `form-dialog.impl:80`); every
other behavioral + security oracle passes unedited. Verify = `TUI_SKIP_PERF=1 yarn verify` (+ `yarn bench`
no-regression). Commit via **/gitcm**; before the PR-bound push run `yarn lint:fix` then **/gitcmp**.

> **Commit boundaries (spec-first + auto-commit).** The geometry-re-baseline RED tasks (2.2, 3.1) pass
> through an intentionally red suite and are not independently committable; the first green committable
> state of each phase is its green task. Auto-commit fires only at green boundaries: **1.4, 2.4, 3.3, 4.3**.

## Phase 1 — messageBox family (`ui/dialog/message-box.ts`) · spec 03-01

> **Phase ref**: 1bd705b262c8c11dbe030620052b9dbe3045c760 · **Status**: ✅ complete (2026-07-19)
>
> **Phase review:** perf auditor — no findings. Phase reviewer — 1 major + 4 minor, all accepted and
> fixed (`7d5ddb5a`); re-review clean. The major: `col({padding:1})` over the `padding:0` dialog left
> zero side gutter, so body text painted against the frame. Fix — drop the now-vestigial `padding:0`
> override (letting `cover()` take the dialog's real interior) and give the body an explicit inset;
> this restores the **original child geometry exactly** (body `x:3,y:2,w-6`, field `y:3`, band `y:6`/`y:4`).
> Also: buttons re-pinned to a uniform 10-cell face, a `buttonBand()` helper extracted (reuse it in
> Phases 2–3), and the new tests switched to the `Commands` constants.

- [x] **1.1 (Spec)** Add `message-box.traversal.spec.test.ts` (ST-T1: `[OK]`/`[OK,Cancel]`/`[Yes,No]`/`[Input,OK,Cancel]`). Confirm **green on current code** (characterizes today's order). ✅ (completed: 2026-07-19 16:02 — 4/4 green on current code)
- [x] **1.2 (Guard)** Add `message-box.render.impl.test.ts` (ST-K2, PF-002): each of messageBox/confirm/inputBox mounts headless, `flush()`es, a known body string paints, and every button solves to non-zero `bounds`. Confirm **green on current code**. ✅ (completed: 2026-07-19 16:03 — 4/4 green on current code)
- [x] **1.3 (Impl)** Rebuild `messageBox`/`confirm`/`inputBox` to `cover(col(…, fixed(row({justify:'center'}, …buttons))))`; delete local `at`/`centerX`/`PAIR_WIDTH`. Preserve width/height formulas + the `Label(label, input)` link + validator veto. ✅ (completed: 2026-07-19 16:05)
  - *Mechanical correction:* `Label` and `Input` report no natural size, so both take an explicit `fixed(…, 1)` (a bare `Label` child, as the 03-01 sample showed, would collapse to `{0,0}` and be clipped away). `BUTTON`/`PAIR_WIDTH` replaced by `BUTTON_BAND_HEIGHT`/`BUTTON_GAP` — the old `BUTTON.width` became meaningless once buttons self-size.
- [x] **1.4 (Green)** ST-T1 + ST-K2 green; `message-box.spec` (7) + `.impl` (5) green **unedited**; `yarn workspace @jsvision/ui test` green; `tsc` clean; no local helper left (`grep`). ✅ (completed: 2026-07-19 16:05 — ui suite 1759/1759, typecheck clean) *(commit boundary)*

## Phase 2 — editor dialogs (`ui/editor/dialogs.ts`) · spec 03-02

> **Phase ref**: 7d5ddb5aa217175f3739f0f33ef83eb254a3510c
>
> **Plan correction (runtime).** The documented focus orders for find/replace were **wrong**: they list
> `History` as a Tab stop, but `History extends View` and never overrides `focusable` (default `false`),
> so it has never been in the Tab order. Verified empirically — the traversal spec is green on
> pre-conversion code with `History` absent. True orders: findDialog `[input, cluster, OK, Cancel]`;
> replaceDialog `[findInput, newInput, cluster, OK, Cancel]`. This corrects 02-current-state, 03-02 and
> ST-T2; no behavior changes.
>
> **Re-baseline note.** The re-derived blocks also had to switch from `layout.rect` to the SOLVED layout
> (`renderRoot.originOf` + `bounds`) — a flex child carries no static rect. Same root cause as PF-001.

- [x] **2.1 (Spec)** Add `editor-dialogs.traversal.spec.test.ts` (ST-T2: the four focusable orders). Confirm **green on current code**. ✅ (completed: 2026-07-19 16:20 — 4/4 green; History is not focusable, see the correction above)
- [x] **2.2 (Spec / re-baseline)** Re-derive `editor-dialogs.spec:51` (input L63 / cluster L65 / buttons L67-70) and `:89` (inputs L106-109 / cluster L111 / buttons L113-116) child rects to the intended flex geometry → **RED** against current absolute code. Keep the outer-bounds + record round-trip + `replacePrompt`/`confirmBox` blocks unedited. Also rewrite the file **header comment (L5-14)** to record the RD-01 flex re-derivation (child rects now solve from the `col`/`row` tree, not the TV decode; outer bounds stay decode-faithful) — PF-005. ✅ (completed: 2026-07-19 16:25 — RED confirmed: exactly the 2 re-baselined tests failed)
- [x] **2.3 (Impl)** Rebuild `findDialog`/`replaceDialog`/`confirmBox` and `replacePrompt`'s **inner** body to `cover(col(rows…, fixed(buttonRow)))`; delete local `tv`/`at`. Keep `replacePrompt`'s **outer** rect + anchor formula (keep-absolute). ✅ (completed: 2026-07-19 16:30 — shares the Phase-1 `buttonBand()` + `DIALOG_BODY_PADDING`; adds a local `fieldRow()`)
- [x] **2.4 (Green)** ST-T2 + re-baselined `:51/:89` green; `:80/:123/:145/:153` green **unedited**; ui suite green; no local `tv`/`at` left (`grep`). ✅ (completed: 2026-07-19 16:32 — ui 1763/1763, typecheck clean; hand-derived rects were exact first try) *(commit boundary — PR body notes the deliberate re-derivation citing RD-01)*

## Phase 3 — formDialog buttons (`forms/form-dialog.ts`) · spec 03-03

> **Phase ref**: 9dcf2a15
>
> **Note.** The re-baselined `:80` block was re-derived to behavioural invariants (same row, OK left of
> Cancel, centred pair) rather than to literal numbers, so it is green **before and after** rather than
> red-then-green. That is a stronger oracle than the plan anticipated. PF-001 was confirmed live: the
> `dlg.children` locator in `:80`/`:139`/`:184` had to become a `descendants()` walk, exactly as the
> preflight predicted — without it `:139` crashes and `:184` fails.

- [x] **3.1 (Spec / re-baseline)** Re-derive `form-dialog.impl:80` (L95-98) from a `position:'absolute'` predicate + rect-delta to the flex-row behavioral geometry (2 buttons, same `bounds.y`, OK left of Cancel, centered) → **RED** against current `place()` code. Add/extend ST-T3 (Tab reaches OK → Cancel), green-on-current. Also swap the **button locator** in `:80`/`:139`/`:184` from `dlg.children.filter(...)` to a `descendants()` walk (the buttons are now grandchildren via the band; assertions unchanged), and add a `renderRoot.flush()` before `:80` reads solved `bounds` (PF-001).
- [x] **3.2 (Impl)** Replace the two `place(ok/cancel, buttonRects())` with `at(row({justify:'center',gap:2}, ok, cancel), bottomBand)`; **keep `cover(body)`** and `cancel.grabsFocus=false`; delete local `place`/`buttonRects`/`PAIR_WIDTH`.
- [x] **3.3 (Green)** **Rebuild `@jsvision/ui` first**, then `form-dialog.impl:80` + ST-T3 green; `:59`/`:104` + all 14 `form-dialog.spec` + `form-dialog-security.spec` green **unedited**, `:139`/`:184` green (assertions unedited, locator swap only); `yarn workspace @jsvision/forms test` green; no local helper left (`grep`). *(commit boundary — PR body notes the re-derivation citing RD-01)*

## Phase 4 — Non-regression sweep, render check, wrap

- [x] **4.1 (Sweep)** Full `TUI_SKIP_PERF=1 yarn verify` across the monorepo green (rebuild ui before examples). `yarn bench` no-regression (no new per-frame alloc on resize). Confirm no behavioral test flipped and no public-JSDoc drift (`check-plugin` PASS — expected, since no exported signature/JSDoc changed). ✅ (2026-07-19 — verify 30/30; bench compose+diff median 4.34ms p95 5.92ms, well under the 16ms ceiling; check-plugin PASS)
- [x] **4.2 (Render / kitchen-sink)** `forms-dialog.story` + any dialog-bearing demo mount headlessly and paint (ST-K1); a recorded manual pass confirms no clipped text / color regression. No new visual component → no new story required (AR-11). ✅ (2026-07-19 — examples 284/284 incl. kitchen-sink smoke; headless render of find/replace/confirmBox/replacePrompt + the messageBox family shows correct 2-cell gutters, no clipped text, uniform button faces)
- [x] **4.3 (Wrap)** `yarn lint:fix`, commit whatever it changes, full verify green, push to `feat/dsl-adoptation` (**PR deferred** — rides in the epic's eventual PR, AR-10). Record the **app-overlay `cover()` follow-up** as a task row on the feature roadmap and update the #115 row/note (Tier-2 bodies done; app-overlay remaining).

## Done when

All 14 boxes checked; ST-T1/T2/T3 + ST-K2 green; the only **geometry-oracle** edits are
`editor-dialogs.spec:51,89` + `form-dialog.impl:80` (each PR-recorded as a deliberate re-derivation citing
RD-01), plus the mechanical **button-locator swap** in `form-dialog.impl:80/139/184` (no assertion change,
PF-001) and the `editor-dialogs.spec` header-comment update (PF-005); every other behavioral + security
oracle green **unedited**; the local `at`/`tv`/`place`/`centerX`/`PAIR_WIDTH`/`buttonRects` helpers gone
from the three files; `TUI_SKIP_PERF=1 yarn verify` + `check:docs` green; `yarn bench` no-regression; the
app-overlay follow-up recorded on the roadmap.
