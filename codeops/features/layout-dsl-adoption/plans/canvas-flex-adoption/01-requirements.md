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

**FR-3 — every dropped property is re-established, at the sites that convert.** 13 sites carry a
property beyond `size` ([02 §3](02-current-state.md)), but only **9** of them convert: three are
preserved wholesale (FR-4) and `app.ts:303`'s `direction` is deliberately discarded as verified-
vestigial (AR-7). At each of those **9**, the property is carried on the builder's props object. A
bare tagger there is a defect, including where the lost value coincides with an engine default —
the AR-7 drop is the single recorded exception, and it is an exception because the property was
proven to have no effect, not because a default happens to match.

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

**NFR-2 — the witnesses observe the real artifact, are written first, and pass first.** Every
witness in Phase 1 is authored against unmodified source and is green before any conversion. A
witness that has to be adjusted to make a conversion pass is a failed conversion. **And a witness
may never assert a view tree it constructed itself** — a reconstruction passes after the conversion
by construction, whatever the conversion did. Per-file seams are fixed in [07 §seam rule](07-testing-strategy.md).

**NFR-3 — non-vacuity is mandatory, in one of two admissible forms.** A *frame* witness asserts
literal row strings (position and count are inherent in the characters). An *importing* witness
asserts an exact child count and at least one literal absolute rect, after forcing a flush so it
never captures an unsolved `{0,0,0,0}`. In both forms, a relation between two solved values
(`b.x === a.x + a.width`) is banned as a sole assertion — it holds when both collapse to zero. A
direct carry-over from the defect the sibling plan's review found in its own witnesses, and from
this plan's own first draft. Forms and rationale: [07 §non-vacuity](07-testing-strategy.md).

**NFR-4 — zero regression, verify-green per phase.** `TUI_SKIP_PERF=1 yarn verify && yarn workspace
@jsvision/examples test:e2e` green at every phase boundary (AR-11, AR-17); `yarn check:deps` green.
The second command is required, not optional: `yarn verify` runs only the `unit` vitest project,
which excludes `*.e2e.test.ts` — where seven of the ten witnesses live.

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
| AC-3 | All **9** convertible extra-property sites carry their property on a builder; the 3 preserved keep theirs in the assignment; `app.ts:303`'s is dropped per AR-7 | ST-C1…C10 for the observable effects; **code review** for the `gap:0` halves of `controls-demo:95` and `router-demo:101`, which equal the engine default (`types.ts:216`) and are therefore inert and unobservable |
| AC-4 | The 3 preserved sites unchanged, each commented | grep audit · code review |
| AC-5 | Every witness observes the **real** artifact (never a tree it built itself — 07 §seam rule), passes green-first, and still passes after conversion | Phase 1 verify log · Phase 2–3 verify |
| AC-6 | The **4** demo e2e tests + walkthrough e2e + kitchen-sink smoke keep every existing case **unedited** (frame snapshots are appended as new cases) | `git diff` on `**/test/**` |
| AC-7 | `TUI_SKIP_PERF=1 yarn verify` **and** `yarn workspace @jsvision/examples test:e2e` green at every phase boundary | verify log |
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
