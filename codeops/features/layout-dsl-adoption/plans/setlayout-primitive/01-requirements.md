# Requirements — setlayout-primitive

> **Source**: GitHub [#117](https://github.com/blendsdk/jsvision/issues/117) · sibling of the
> builder-layer work in #113; **outside** the RD-01 deliberate-divergence set — this plan is
> behaviour-preserving except for one named, ruled-on exception (FR-4).
> **Revised 2026-07-20** after preflight — see [`00-preflight-report.md`](00-preflight-report.md).

## Functional requirements

**FR-1 — `View.setLayout(patch)` exists and is the preferred write path.** A single method taking a
`Partial<LayoutProps>`, performing a **shallow** merge into the existing props and requesting a
reflow. One method only: no `setLayout(full)` replace variant, which would re-expose the very
footgun being removed.

**FR-2 — the merge is shallow, by design, and must stay that way.** `LayoutProps.size` is a
discriminated union (`{kind:'fixed',cells} | {kind:'fr',weight,min?} | {kind:'auto'}`). A deep merge
would recurse into it and leave the previous variant's fields behind — switching `fixed`→`fr` would
yield the corrupt token `{kind:'fr', weight:1, cells:1}`. Shallow merge swaps `size`/`rect`
atomically. Pinned by ST-S2, which exists to fail if anyone ever "improves" this to a deep merge.

**FR-2a — an explicit `undefined` in the patch resets that prop to its layout default.**
`tsconfig.base.json` does not set `exactOptionalPropertyTypes`, so `setLayout({ size: undefined })`
compiles, and shallow-spread semantics clear the key. The layout engine handles this coherently —
`normalizeProps` (`packages/ui/src/layout/types.ts:206-221`) uses `??` / `=== undefined` throughout
and never `in`/`hasOwnProperty`, so `normalizeSize(undefined) → {kind:'auto'}` and
`position ?? 'flow'`. This is therefore a **supported reset**, not undefined behaviour; it is
documented as such (FR-3's JSDoc) and pinned by an impl test. The related un-set path the issue
documents also holds: `setLayout({ position:'flow' })` drops back to flow and the now-stale `rect` is
ignored, because `normalizeProps` only reads `rect` when `position === 'absolute'` (`types.ts:211-221`).

**FR-3 — the `layout` field stays a plain, public, settable field.** No getter, no `_layout` backing
store (AR-7). Its JSDoc names `setLayout` as the preferred way to write, in prose, without an
`@deprecated` tag (AR-6). The 17 read sites are untouched. `setLayout`'s own JSDoc must state three
things a caller cannot infer: the shallow-merge contract and *why* it is shallow, the reset
semantics of FR-2a, and the constructor constraint — **a `setLayout` call in a constructor is
overwritten by any subclass that declares `override layout = {…}`**, so prefer it after construction
or in `onMount` (AR-3's second facet).

**FR-4 — the DSL builders write through `setLayout`, and thereby gain auto-invalidation.** All **14**
sites in `dsl/absolute.ts`, `dsl/flex.ts` and `dsl/stack.ts` ([02 §2](02-current-state.md)) — nine
already-spreads and five fresh-object writes, including `flex.ts:217` (`spacer()`), whose wrapped
assignment is invisible to a naive grep.

This is a deliberate behaviour change (AR-5): a tagger applied to an already-mounted view now
requests a reflow where today it silently does not. **No tagger site observes it today** — the two
genuine tagger-on-mounted-view paths already reflow, `split-view.ts:186-190` through its own
`bind(…, {relayout:true})` and `grid-panels.ts:563-564` through the `Group.add`/`Group.remove` inside
`rebuildBody()` (its bind at `grid.ts:689` is repaint-only). The new call is redundant and harmless
at both. It is retained as a **correctness default for future callers**: the alternative, a
conditional invalidate, re-opens the footgun FR-1 exists to close.

**FR-4a — one converted site does gain a real reflow, and it is not a tagger.** `window.ts:161`
(`commitPlacement()`, FR-5) does not invalidate today and runs on a **mounted** window at gesture
start (`desktop.ts:213,222,235`), so converting it adds an earlier, coalesced reflow request. The
delta is benign — `commitPlacement` writes `bounds` back into `layout.rect`, so the extra reflow
recomputes identical geometry — but it is recorded rather than absorbed into FR-4's "no site observes
it". The full invalidation-delta table is [02 §3a](02-current-state.md).

**FR-5 — the 9 self-layout sites migrate.** [02 §3](02-current-state.md). The 7 `this.layout =`
sites: four are already spreads and convert mechanically; two sit on `Group` subclasses where replace
and merge are indistinguishable; one (`dialog.ts:109`) starts from a non-empty object and is safe for
a traced reason, not an assumed one ([02 §4](02-current-state.md)). Plus the **2 sites handed to #117
by name** by the completed widget-adoption plan and orphaned when #109 closed —
`app/application.ts:343` and `:347`, a foreign-receiver merge each. **`application.ts:333` is not
swept**: the sibling plan preserved it deliberately as an intentional wholesale replace.

**FR-6 — every migrated site is audited for replace-dependence before it converts (P3).** For each
site **two** questions are asked, and both answers are recorded with their reasoning in
[03-02 §audit](03-02-migration.md) (AR-8), **one row per site, verdict blank until the audit runs**:

1. *"Does anything downstream depend on the replace having cleared a prop?"* — the replace-semantics
   question.
2. *"Is the view mounted at call time, and does anything on that path already request a reflow?"* —
   the **invalidation-delta** question. It is what distinguishes a redundant new invalidate from a
   real behaviour change, and it is the question whose absence let two separate misclassifications
   through: `filter-popup.ts:285` (claimed as a defect it did not have) and `window.ts:161` (a real
   delta that went unenumerated). Asking only about *shape* cannot surface either. A site whose answer is
"yes" does **not** convert — it stays a wholesale assignment with a plain-language comment, exactly
as this feature's earlier plans handled their preserved sites.

## Non-functional requirements

**NFR-1 — no rendered output changes.** Beyond the extra reflow *requests* of FR-4 and FR-4a (which
coalesce into the same frame and recompute identical geometry), every converted site must produce
identical layout. The falsifiable form of this,
and the one the gate actually checks: **every existing suite that observes a converted site stays
green and unedited.** A required edit to an existing assertion is a defect, not a re-derivation.

**NFR-2 — spec-first.** `setLayout`'s contract is specified and red before it is implemented. The
merge/shallow/invalidate behaviours are oracles derived from FR-1/FR-2/FR-4, never from the
implementation that ends up satisfying them. Contract oracles live in `*.spec.test.ts`; witnesses
derived from *current implementation output* live in `*.impl.test.ts` (see 07).

**NFR-3 — no measurable layout-pass cost.** `setLayout` allocates one object per call — the same as
the spread it replaces at the nine merge sites, and one more than the bare assignment at the five
fresh-object sites, which is negligible. Invalidation is a flag write into a coalescing scheduler
([02 §1](02-current-state.md)); the hottest converted path is `split-view.ts`'s per-drag-frame
`grow()` (via `applyWeights`), and there `markRelayout`'s early-return (`render-root.ts:326-327`)
makes repeat calls free. **No oracle in this repo measures the `ui` layout pass**: `yarn bench` runs
`packages/core/bench/frame-bench.mjs`, which measures compose/diff/serialize on `ScreenBuffer` and
never imports `@jsvision/ui`. This NFR therefore rests on the analytical argument above, not on a
measurement — stated plainly rather than left to imply a gate that does not exist.

**NFR-4 — zero regression, verify-green per phase.** `TUI_SKIP_PERF=1 yarn verify && yarn workspace
@jsvision/examples test:e2e` green at every phase boundary (AR-4), **after task 1.0 makes the
`TUI_SKIP_PERF` prefix actually reach the test processes**; `yarn check:deps` green.

**NFR-5 — the public API surface stays coherent.** `setLayout` is exported behaviour on a public
class, so it carries JSDoc with an `@example`. Note this is **not** mechanically gated:
`check-jsdoc.mjs`'s missing-`@example` check inspects only classes and functions re-exported from a
package barrel (`:15-17,161-187`) and never descends into class members, so `yarn check:docs` will
pass whether or not the `@example` is there. The requirement rests on CLAUDE.md's documentation
directive and on review. Separately, **adding a public member to `View` drifts the committed plugin
API-reference snapshot** (`api-extract.mjs` emits member signatures — `classMemberSig`, `:86-101`),
which `check-plugin` does gate; `yarn plugin:sync --fix` is part of the work.

**NFR-6 — scope containment.** No `src/` outside `packages/{ui,forms,datagrid}` is modified.
In scope beyond that: `packages/ui/test/**` (the new tests), the `tools/claude-plugin/**`
API-reference snapshot (regenerated, not hand-edited), and `turbo.json` (task 1.0).
`packages/spike-data-studio` is explicitly excluded (AR-9).

## Acceptance criteria

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | `setLayout(patch)` merges shallowly and requests a reflow | ST-S1, ST-S2, ST-S3, ST-S4 |
| AC-1a | An explicit `undefined` resets that prop to its layout default (FR-2a) | ST-S9 (a spec oracle — it derives from FR-2a, not from observed output) |
| AC-1b | `window.ts:161`'s new reflow request changes no geometry (FR-4a) | The existing window/desktop suites stay green and unedited; 03-02 audit row 18 records the delta |
| AC-2 | All **14** DSL sites write through `setLayout` | `grep -rnE "^\s*[A-Za-z_.]+\.layout\s*=([^=]\|$)" packages/ui/src/view/dsl/` → **0** (currently 14) |
| AC-3 | A tagger on a mounted view requests a reflow | ST-S5 |
| AC-4 | All 9 self-layout sites converted, or preserved with a recorded reason (FR-6) | `grep -rnE "this\.layout\s*=([^=]\|$)" packages/{ui,forms,datagrid}/src` → **0** (currently 7) · plus `application.ts:343,347` converted and `:333` untouched — the latter mechanically guarded by the existing **ST-W4** (`app-shell.composition.spec.test.ts:151-160`), which asserts `content.layout` `toEqual` the bare `{size:{kind:'fr',weight:1}}` and goes red if `:333` becomes a merge · 03-02 §audit |
| AC-5 | Every site's replace-dependence is recorded with reasoning before it converts | 03-02 §audit — **one row per site**, no collapsed rows, no blanks, mounted-at-call-time recorded |
| AC-6 | Rendered output unchanged | Every existing `ui`/`forms`/`datagrid` suite and the examples e2e stay green **and unedited** — in particular the five files named in [02 §7](02-current-state.md) |
| AC-7 | `TUI_SKIP_PERF=1 yarn verify` **and** the examples e2e green at every phase boundary | verify log (with the prefix actually effective — task 1.0) |
| AC-8 | `layout` remains a settable public field; the **10** field initializers still compile | `yarn typecheck` |
| AC-9 | No file under `packages/spike-data-studio`, and no `src/` outside `packages/{ui,forms,datagrid}`, is touched | `git diff --stat` |
| AC-10 | The plugin API-reference snapshot is in sync | `yarn verify` (check-plugin) |

## Explicitly out of scope

- **P4 — making `layout` read-only** (AR-1). Blocked on the **59** remaining executable writes (46
  once the spike is deleted), on the **10** field initializers, on the **9 in-place property
  mutations** a getter would not stop, and on the test/example write population — all enumerated in
  [02 §6](02-current-state.md) so the next planner does not rediscover them.
- **The remaining composition writes** (AR-2) — owned by the open adoption issues, with the two
  `application.ts` exceptions now taken into scope by FR-5.
- **The 10 `override layout` field initializers** (AR-3) — left declarative.
- **No kitchen-sink story.** `setLayout` is non-visual layout math, which `codeops/kitchen-sink-gate.md`
  §Scope places in the "story only when meaningful to show" bucket. Recorded explicitly so the
  silence is not read as an oversight; the existing kitchen-sink and layout-dsl-playground smoke
  suites must still pass **unedited**, since FR-4 changes tagger runtime behaviour.
