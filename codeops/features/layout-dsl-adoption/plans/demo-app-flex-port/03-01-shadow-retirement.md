# Shadow Retirement: demo-app-flex-port

> **Document**: 03-01-shadow-retirement.md
> **Parent**: [Index](00-index.md)
> **Covers**: GH #114, reachable slice · AR-6, AR-11, AR-12, AR-13

## Overview

Six local helpers in `@jsvision/examples` hand-roll placement the DSL already provides. Two of them
are *exported* and carry 411 call sites between them; four are file-local. This component retires all
six. The exported pair is the risky part and gets an audit; the four locals are mechanical.

## Architecture

### Current Architecture

`kitchen-sink/story.ts:69` and `datagrid-showcase/story.ts:68` hold byte-identical bodies:

```ts
export function at<T extends View>(view: T, x: number, y: number, width: number, height: number): T {
  const layout: LayoutProps = { position: 'absolute', rect: { x, y, width, height } };
  view.layout = layout;
  return view;
}
```

`@jsvision/ui`'s builder (`packages/ui/src/view/dsl/absolute.ts:42`) has a superset signature —
`at(view, x, y, w, h)` **or** `at(view, rect)` — and a different write:

```ts
view.setLayout({ position: 'absolute', rect });
```

### Proposed Changes

Delete both bodies; replace each with `export { at } from '@jsvision/ui';`. The four-number overload
is signature-compatible with every existing call, so no call site changes. Drop the now-unused
`LayoutProps` type import from each file (AR-11).

## Implementation Details

### The two behavioural deltas, and the audit that clears them

The swap changes exactly two things. Each reduces to a mechanical query, so the audit is a table of
**candidates surfaced by those queries** — not 411 rows.

**Delta A — replace → merge.** The shadow discards every pre-existing `layout` prop; the builder
keeps them. This is observable only where the argument view already carries a layout prop at call
time. Candidates are found by:

1. A view that is the target of a `.layout = …` / `.setLayout(…)` write, or an `override layout`
   field initializer in its class, **before** reaching `at()`.
2. A view that passes through another DSL tagger (`fixed`, `grow`, `cover`, `center`, `place`) before
   or after the `at()` call, in either order.
3. A `Group` built by `col(...)`/`row(...)` — these set `direction`, which the shadow would erase and
   the builder preserves — then handed to `at()`.

Query 3 is the one most likely to yield hits, and note its sign: where it hits, the **shadow is the
buggy one** (it silently drops the container's `direction`), so the swap is a fix. Any such row must
still be diff-checked, because "fixing" a demo changes its rendered output and would break the
zero-diff requirement in AR-7 — such a row is recorded as a deliberate, explained non-zero diff
rather than absorbed silently.

**Delta B — the added `invalidateLayout()`.** `setLayout` requests a reflow; the field write did not.
On an **unmounted** view (`host === null`) this is a no-op, and story `build(ctx)` runs before mount,
so the overwhelming majority of sites are unaffected. Candidates are `at()` calls reachable from an
event handler, a reactive effect, or any code path that runs after the story is mounted.

### Audit table (filled during execution, before any conversion)

| # | Query | Call sites surfaced | Site (`file:line`) | Prior layout state | Verdict |
|---|---|---|---|---|---|
| A1 | Prior `.layout =` / `.setLayout(…)` on the argument | **1** | `kitchen-sink/stories/layout.story.ts:31` → placed `:35` | `{ direction:'row', gap:1, align:'stretch' }` | ⛔ → **accepted fix** (see below) |
| A2 | `override layout` field initializer in the argument's class | **0** | — (`tabs.story.ts:61` investigated and cleared) | — | ✅ |
| A3 | Argument also passes through another DSL tagger | **0** | — | — | ✅ |
| A4 | Argument is a `col(...)` / `row(...)` result (carries `direction`) | **0** | — | — | ✅ |
| B1 | `at()` reachable after mount (handler / effect / callback) | **0** | — | — | ✅ |

**A2's near-miss, recorded so it is not re-investigated.** A grep attributed the `override layout`
at `packages/ui/src/tabs/tab-view.ts:138` (`direction:'col'`, `size: fr 1`,
`padding:{top:0,left:1,right:1,bottom:1}`) to `TabView`, making `tabs.story.ts:61` look like a
padding-preservation hazard. It belongs to the internal **`TabBody`** class declared at `:136`;
`TabView` itself starts at `:208` and declares no layout. `TabBody` is never passed to `at()`.
Confirmed by dumping the merged props: the `TabView` at that site ends up with
`{position:'absolute', rect}` and nothing else.

**Which preserved props can even matter.** Under `position:'absolute'` the solver drops the child
from flex flow and places it by `rect` alone (`packages/ui/src/layout/layout.ts:94`), so a preserved
`size` is inert. A preserved `direction` of `'row'` is the engine default. The genuinely load-bearing
one is **`padding`**, which insets the content-box origin for the view's own children
(`layout.ts:137-147`) — which is why the audit hunted padding-carrying arguments specifically.

**Totals: 410 ✅ convertible · 1 ⛔ handled.**

A ⛔ row is resolved one of three ways, in order of preference: (i) the site is left with an explicit
field write and a comment explaining why, (ii) the divergence is neutralised before the swap, or
(iii) the resulting diff is accepted and recorded as a deliberate fix. Never absorbed silently.

### The one ⛔ and its ruling — resolution (iii), accepted fix

`layout.story.ts:31` sets `{ direction:'row', gap:1, align:'stretch' }` on a `Group`, and `:35`
places that Group with `at()`. The retired shadow **replaced** the whole object, so the story's own
`gap: 1` never reached the engine; the builder merges, so it now does.

```
- fixed 16        fr 1              fr 2      before: the declared gap:1 is silently dropped
+ fixed 16         fr 1              fr 2     after:  one cell of gap, as written
```

Accepted as a deliberate fix rather than neutralised. This is the `foundations/layout` story, whose
stated job is teaching the flex engine and whose own caption advertises `gap` as a supported prop —
it was demonstrating the feature while not rendering it. One space, one line, one story. The
kitchen-sink smoke suite asserts only that a story paints, so nothing else moves.

### Measured blast radius of the whole swap

Not inferred — rendered. Every story in both showcases was built, mounted and serialized before and
after the swap, at two viewport sizes:

| Showcase | Renders compared | Differing |
|---|---|---|
| kitchen-sink (49 stories × 72×16 and 100×30) | 98 | **1** (`foundations/layout`, above) |
| datagrid-showcase (68 stories × both sizes) | 136 | **0** |

234 renders, zero build errors, one intended one-line change.

### The four local placers

| Site | Current | Change |
|---|---|---|
| `wizard-demo/main.ts:52` | `function place<T extends View>(view, x, y, width, height): T` — replaces `layout`, returns the view | Delete; import `at` from `@jsvision/ui`; call sites become `at(…)` |
| `wizard-demo/main.ts:178` | `const row = (label, value): Text => …` — shadows the DSL `row` builder | Rename → `fieldRow` |
| `themes-demo/main.ts:37` | `const place = (view, x, y, w, h): void => …` — **returns void**, mutates in place | Delete; call sites become `at(view, x, y, w, h)` and now *return* the view. Call sites are statements today, so the change is source-compatible |
| `tabs-demo/main.ts:43` | `function placed<T>(view, x, y): T` — hard-codes `width: 40, height: 1` | Delete; call sites become `at(view, x, y, 40, 1)` (AR-13) |
| `kitchen-sink/stories/wizard.story.ts:113` | `const row = (label, value): Text => …` | Rename → `fieldRow` |
| `forms/src/form-dialog.ts:58` | filed by #114 | **Already gone** — deleted by the `flex-dialog-bodies` plan. No action; the issue body is corrected at close-out (AR-12) |

`themes-demo` and `tabs-demo` are subject to the same Delta A/B audit as the exported pair, on their
own (much smaller) call-site sets.

`tabs-demo`'s `placed()` is generic over `{ layout: unknown }` rather than `View`, but every call site
passes a real view (`new Text(...)`, `new Button(...)`), so the narrower `at<V extends View>`
constraint accepts all of them. Confirm this in task 1.5.1's type-check sweep rather than by eye.

### Shadows this component does NOT retire (AR-16)

Three local `at`/`row` shadows survive elsewhere in the repo. They are named here so the phase's rule
reads honestly — **"no shadow survives in a file this plan touches"**, not "one `at()` in the repo":

| Site | Shape | Why it is deferred |
|---|---|---|
| `theme-designer/src/view/gallery.ts:32` | `function at<T>(g, view, x, y, w, h)` — replaces `layout` **and** calls `g.add(view)` | Different signature: retiring it rewrites every call site to `g.add(at(v, …))`. A conversion, not a re-export |
| `theme-designer/src/view/inspector-panel.ts:55` | Same shape | Same — and `host/walkthrough.ts` does not render the inspector, so there is no headless zero-diff vehicle for it today |
| `examples/keyboard-mouse-playground/main.ts:126` | `const row = (y, label, value): void => …` | A `row` name shadow in an FR-4 keep-absolute demo, outside every file this plan opens |

All three go on the follow-up issue filed in task 2.1.2.

### Integration Points

- `packages/examples/kitchen-sink/stories/*.ts` (300 calls) and
  `packages/examples/datagrid-showcase/stories/**/*.ts` (111 calls) import `at` from their local
  `story.ts`. The re-export keeps that import path valid.
- `packages/examples/test/kitchen-sink.smoke.spec.test.ts` and the two datagrid-showcase suites are
  the standing regression net and stay unedited.

## Code Examples

### After — `kitchen-sink/story.ts`

```ts
import { Group } from '@jsvision/ui';
import type { View } from '@jsvision/ui';

/**
 * The blessed absolute-placement builder, re-exported so every story keeps one import site.
 * It merge-preserves the view's other layout props, unlike the hand-rolled placer it replaces.
 */
export { at } from '@jsvision/ui';
```

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| A call site depends on the shadow's replace semantics to clear a prop | Surfaced by audit queries A1–A4; resolved per the three-way ⛔ rule above, never silently | AR-6 |
| An `at()` call on a mounted view now triggers a reflow | Surfaced by query B1. A reflow on a mounted view is the correct behaviour (the shadow's silence was the footgun); accepted unless the buffer diff shows a change | AR-6 |
| `LayoutProps` import becomes unused and fails lint | Dropped in the same edit | AR-11 |
| A converted `themes-demo` call site used `place()`'s void return in an expression | A type error — but **`themes-demo` is not in `packages/examples/tsconfig.json`'s `include`**, so the standing build will not see it. Task 1.5.1's one-shot `tsc --noEmit` sweep is the actual control | AR-6 |

## Testing Requirements

- Spec tests **ST-1, ST-2, ST-3a, ST-3b, ST-4** ([07](07-testing-strategy.md)) pin the re-exported
  `at()`'s contract from **both** story-module surfaces: merge preservation, the four-number form,
  chainability, and the reflow.
- Before/after zero-diff on the kitchen-sink shell and the datagrid-showcase walkthrough (AR-7).
- `kitchen-sink.smoke.spec.test.ts` (every story mounts and paints) must stay green **and unedited** —
  it is the only test that touches all 84 story files. Note what it does *not* prove: it asserts only
  `paintedCells(...) > 0`, so the audit table remains the primary control for the 411-site swap.
- The one-shot type-check sweep of task 1.5.1 — the ~300 kitchen-sink call sites are not covered by
  the standing build.
