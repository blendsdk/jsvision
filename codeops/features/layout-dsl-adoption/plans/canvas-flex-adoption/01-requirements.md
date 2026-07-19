# Requirements — canvas-flex-adoption

> **Source**: GitHub [#110](https://github.com/blendsdk/jsvision/issues/110) + [#111](https://github.com/blendsdk/jsvision/issues/111) · governed by [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md) FR-6, verification [RD-02](../../requirements/RD-02-non-functional-and-verification.md)

## Functional requirements

**FR-1 — example demos compose with the DSL (#110).** The **25** in-scope sites across 6
`packages/examples` files ([02-current-state §1](02-current-state.md)) use `col`/`row` builders and
`grow`/`fixed` taggers. Converted demos model the recommended idiom, since these files are the first
thing a reader meets (RD-01 FR-6 — "this is didactic").

**FR-2 — theme-designer panels compose with the DSL (#111).** The **7** in-scope sites across 3
`packages/theme-designer/src` files use the DSL, and each panel's stacking direction moves **into its
own builder** rather than being applied from `app.ts`.

**FR-3 — every dropped property is re-established.** At the 13 sites carrying a property beyond
`size`, that property is carried on the builder's props object. A bare tagger at any of those sites
is a defect, including where the lost value coincides with an engine default.

**FR-4 — the three preserved sites stay assignments.** `router-demo:59` and `drill-down:29`
(`this.layout` inside a `Group` subclass constructor — no builder can produce an existing `this`) and
`app.ts:308` (`sizeWorkspace`'s per-resize re-assignment) keep their wholesale form. Each gains a
comment in plain language stating why, with no plan or issue identifiers, per CLAUDE.md's
documentation directive.

**FR-5 — no new nesting, and identical child order.** No conversion may introduce a Group between a
container and any child. Focus/tab order through every converted demo is unchanged.

## Non-functional requirements

**NFR-1 — rendered output is unchanged.** Both issues state the ported artifacts must render
identically. RD-01 FR-6 *permits* geometric divergence for these canvases, but this plan does not
exercise that permission: any movement is treated as a transcription error, not a re-derivation.
If a genuine divergence proves unavoidable at some site, it stops the phase and becomes a recorded
decision rather than an oracle edit.

**NFR-2 — the witnesses are written first and pass first.** Every witness in Phase 1 is authored
against unmodified source and is green before any conversion. A witness that has to be adjusted to
make a conversion pass is a failed conversion.

**NFR-3 — non-vacuity is mandatory.** Every witness asserts an exact child count and at least one
absolute rect per container. Relations between two solved values (`b.x === a.x + a.width`) are
banned as a sole assertion — they hold when both collapse to zero. This is a direct carry-over from
the defect the sibling plan's review found in its own witnesses.

**NFR-4 — zero regression, verify-green per phase.** `TUI_SKIP_PERF=1 yarn verify` green at every
phase boundary (AR-11); `yarn check:deps` green.

**NFR-5 — the kitchen-sink story stays green.** `drill-down.story.ts` must keep passing
`kitchen-sink.smoke.spec.test.ts` unchanged. No new story is owed — no new components.

**NFR-6 — no source outside the 9 files.** These two packages are `private: true` and nothing in the
monorepo depends on them, so the blast radius is dev-only by construction. Any diff touching
`packages/{core,ui,datagrid,files,forms,web}/src` means the plan went wrong.

## Acceptance criteria

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | All 25 #110 conversions landed | 02-current-state §1 tables · grep audit |
| AC-2 | All 7 #111 conversions landed | 02-current-state §2 tables · grep audit |
| AC-3 | All 13 extra-property sites carry their property on a builder | ST-C1…C9 assert `padding`/`gap`/`direction` effects |
| AC-4 | The 3 preserved sites unchanged, each commented | grep audit · code review |
| AC-5 | Nine green-first witnesses pass against unmodified source, then still pass after conversion | Phase 1 verify log · Phase 2–3 verify |
| AC-6 | The 5 demo e2e tests + walkthrough e2e + kitchen-sink smoke pass **unedited** | `git diff` on `**/test/**` |
| AC-7 | `TUI_SKIP_PERF=1 yarn verify` green at every phase boundary | verify log |
| AC-8 | The `.layout =` grep over the 9 files returns exactly the residue allowlist below | task 4.1 |
| AC-9 | No file under another package's `src/` is touched (NFR-6) | `git diff --stat` |

## Residue allowlist

After this plan, `grep -nE "\.layout\s*=[^=]"` across the 9 touched files must return **exactly**
these 3 statements and no others.

**Match on file + statement, not line number** — conversions collapse lines above every listed site.

| File | Statement | Category |
|---|---|---|
| `examples/router-demo/main.ts` | `this.layout = { direction:'col', padding:1, gap:1 }` | preserved — Group subclass self-config (FR-4, AR-6) |
| `examples/kitchen-sink/stories/drill-down.story.ts` | `this.layout = { direction:'col', padding:1, gap:1 }` | preserved — Group subclass self-config (FR-4, AR-6) |
| `theme-designer/src/app.ts` | `workspace.layout = { position, rect, direction:'row' }` inside `sizeWorkspace` | preserved — per-resize re-assignment (FR-4, AR-4) |

Note `chrome-bars-demo/main.ts:88` is `win.layout.rect =`, a sub-property mutation, so it does not
appear in this grep. `inspector-panel.ts:56` and `kitchen-sink/story.ts:70` are outside the 9 files.
