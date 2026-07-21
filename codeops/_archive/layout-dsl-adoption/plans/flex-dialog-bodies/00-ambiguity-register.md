# 00 — Ambiguity Register (Zero-Ambiguity Gate)

> **Plan**: layout-dsl-adoption/flex-dialog-bodies · **Implements**: RD-01 (Tier-2 ui/forms), RD-02
> **Status**: ✅ **GATE PASSED** — all items resolved
> **CodeOps Skills Version**: 3.9.0

This plan inherits the 13 requirements-level decisions in
[`../../requirements/00-ambiguity-register.md`](../../requirements/00-ambiguity-register.md) and the 8
Tier-0 plan-level decisions in [`../tier0-parity-safe/00-ambiguity-register.md`](../tier0-parity-safe/00-ambiguity-register.md).
Below are the decisions specific to the Tier-2 dialog-body rebuild, each grounded in the current code
(`file:line`) and the oracle classification from the current-state pass.

| # | Ambiguity | Options considered | Decision | Grounding / rationale |
|---|-----------|--------------------|----------|-----------------------|
| **AR-1** | Does this plan include the **app-overlay `cover()`** conversion (`application.ts:335/435`, the Tier-0 leftover deferred as PA-1)? | (a) include as a final phase; (b) dialog bodies only, track app-overlay separately | **(b) Dialog bodies only** — app-overlay tracked as a separate follow-up task under #115 | **User decision (this session).** App-overlay is a structural `absolute`→`fill` locator change rippling across ~7 app-shell test files (`app-shell.lifecycle.spec:90/92`, `.impl:42-43/51/59`, `app-shell.menu.spec:59`, `.menu.impl`×3, `menu-catcher.cover.impl`, `menu-flex.spec/impl`) — **not** in the RD-02 NFR-3 table — for a 2-line payoff, and carries app-shell menu-popup-positioning risk the dialog rebuilds don't. Keeping it out holds every spec-oracle edit inside NFR-3. |
| **AR-2** | `formDialog` body under flex: put the opaque caller body in a `col(grow(body), …)`? | (a) `col(grow(body), fixed(buttonRow))`; (b) keep `cover(body)`, flex only the buttons | **(b) keep `cover(body)`; flex only the buttons** | The caller body's children are the common all-absolute case (`form-dialog.ts:224-227` comment; the recorded zero-width-collapse footgun). In a `col`, `grow(body)`'s cross-axis (width) is `auto` → collapses to 0 → clips the body. `cover()` (`position:'fill'`) is the proven guard (shipped in Tier-0). Only the OK/Cancel pair moves to flex. |
| **AR-3** | Structure for the ui/editor dialog bodies (currently `padding:0` + flat absolute children on the `Dialog`). | (a) add a bare `col` child; (b) `cover(col({padding}, …))` | **(b) `cover(col({padding:1}, rows…, fixed(buttonRow, h)))`** | The `col` has in-flow children (text via `grow`, rows, a fixed button band) → it has intrinsic content and does **not** collapse; `cover()` gives it the full dialog content box and re-solves on resize. Frame gutter (old `x:3` insets) is reproduced by the col's `padding` + row gaps. |
| **AR-4** | `formDialog` button placement idiom after deleting `place`/`buttonRects`/`PAIR_WIDTH`. | (a) two `place()` calls (status quo); (b) `at(row({justify:'center',gap:2}, ok, cancel), bottomBand)` | **(b) one DSL `at()` on a centered `row` band** | Deletes the local `place`/`buttonRects`/`PAIR_WIDTH`/centering math (FR-5). The single **blessed DSL** `at()` (`view/dsl/absolute.ts`) anchors the button band to the bottom row — the sanctioned escape hatch for a dialog-frame anchor — while `row({justify:'center',gap:2})` replaces the manual `centerX` pair math. FR-5's intent (delete the local coordinate helpers + math) is met. |
| **AR-5** | Tab-order preservation under the new nested-group trees. | (a) trust review; (b) a per-dialog traversal-order spec test, written green-on-current-code first | **(b) per-dialog traversal spec test (NFR-2), green-on-current first** | RD-01 FR-3 / RD-02 NFR-2 mandate it. Each rebuild introduces nested `Group`s (`col`/`row`), so tab order now depends on the shipped **tree-order `Tab`** primitive (#122). The spec asserts the ordered focusable-descendant list equals the pre-conversion order. |
| **AR-6** | Per-file spec-oracle handling under the parity break. | per RD-02 NFR-3 + the current-state classification | **message-box.spec + .impl → survive; `editor-dialogs.spec:51,89` → re-baseline (child rects); `form-dialog.impl:80` → re-baseline (button block); everything else → survive** | Grounded in the oracle classification: message-box asserts only the dialog **width formula** + return/focus/validity (never child rects); `editor-dialogs.spec:51/89` assert `input`/`cluster`/`buttons` `.layout.rect`; `form-dialog.impl:80` asserts `position==='absolute'` + the 12-cell x-gap. `replacePrompt` (L123), `confirmBox` (L153), `form-dialog.spec` (14) + `form-dialog-security.spec` survive. |
| **AR-7** | `replacePrompt`: flex its inner body too, or leave it fully absolute? | (a) leave whole thing absolute; (b) keep the **outer** rect absolute (keep-absolute, FR-4), flex the inner Text + button row | **(b) outer rect stays absolute; inner body flexes** | FR-4 keep-absolute lists only `replacePrompt`'s **outer** caret-anchored frame. Its outer rect comes from the `Dialog` constructor `{ rect }` (`dialogs.ts:189`), untouched by deleting the local `at`/`tv`. Its inner children move to `cover(col(text, fixed(buttonRow)))`. `editor-dialogs.spec:123` asserts the **outer** window bounds → survives. |
| **AR-8** | CLAUDE.md "deliberately non-faithful" carve-out (FR-7). | add it / already present | **Already present** — no work in this plan | `CLAUDE.md:186-192` already names `messageBox`/`confirm`/`inputBox`/`findDialog`/`replaceDialog`/`confirmBox`/`errorBox`/`FileDialog`/`ChDirDialog`/`formDialog` (Tier-0 commit `7307f9af`). |
| **AR-9** | Verify command + non-regression gate. | detect from CLAUDE.md | **`TUI_SKIP_PERF=1 yarn verify` per phase; `yarn bench` no-regression; `yarn lint:fix` before the PR-bound push** | Project CLAUDE.md prime directive + the feature's established gate (mirrors `focus-traversal-primitive`). Inner loop per package: `yarn workspace @jsvision/ui test`, then rebuild ui before `@jsvision/forms` / `@jsvision/examples` tests (the "examples consume built ui" gotcha). |
| **AR-10** | Branch / PR strategy. | (a) own PR per package; (b) commit to the epic branch, defer PR | **(b) commit to `feat/dsl-adoptation`; PR deferred (rides in the epic's eventual PR)** | Matches the established pattern for this shared epic branch (as `focus-traversal-primitive` did). ui changes land first, forms after. |
| **AR-11** | Kitchen-sink obligation. | new story per dialog / none | **No new story** — the rebuild introduces no new visual component | Per CLAUDE.md kitchen-sink scope (RD-01 AR-8): a geometry-only refactor of existing components adds no component. `forms-dialog.story.ts` already covers `formDialog`; a manual render check confirms no clipping/color regression (NFR-4 spirit). |

> **Preflight amendment (PF-001 — see [00-preflight-report.md](00-preflight-report.md)).** AR-6's
> "everything else → survive" holds for **assertions**, but `form-dialog.impl:139/184` (and `:80`'s count
> lookup at L92) require a mechanical **button-locator** swap (`dlg.children.filter` → a `descendants()`
> walk) because the flex button band nests OK/Cancel one level deeper (they become grandchildren of the
> dialog). This changes no assertion and is **distinct** from the two RD-01 geometry re-baselines — it is
> not counted against the NFR-3 oracle-edit budget.
>
> **Preflight amendment (PF-002).** A messageBox/confirm/inputBox headless paint guard
> (`message-box.render.impl.test.ts`, ST-K2) is added — that family has no child-rect oracle, so a
> clip/collapse regression would otherwise be unguarded.

**Gate status:** every semantically-weighted decision above is resolved with an explicit decision and
code grounding; the app-overlay scope was decided by the user this session. **✅ GATE PASSED** (with the
two preflight amendments above folded in).
