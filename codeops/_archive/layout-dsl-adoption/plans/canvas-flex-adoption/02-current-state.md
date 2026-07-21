# Current State — canvas-flex-adoption

Every line below was verified against the working tree on 2026-07-19, not taken from the issue
bodies. Where the issues and the code disagreed, the code won — noted in §4.

## 1. `#110` — `packages/examples` (27 sites, 6 files: 25 conversions + 2 preserved)

### `editor-demo/main.ts` — 3 sites, the cleanest in the plan

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:67` | `root` | `{ direction:'col' }` | `col(...)` |
| `:68` | `ed` | `{ size: fr 1 }` | `grow(ed)` |
| `:69` | `ind` | `{ size: fixed 1 }` | `fixed(ind, 1)` |

### `event-demo/main.ts` — 8 sites, three of them carrying extras

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:103` | `header` | `{ size: fixed 1 }` | `fixed(header, 1)` |
| `:107` | `b` (loop over `[btnOk, btnOpen]`) | `{ size: fr 1 }` | folded into `:109`'s inline `grow(btnOk)` / `grow(btnOpen)` — the loop existed only to apply one shared descriptor |
| `:109` | `body` | **`{ direction:'row', size: fixed 1, gap: 2 }`** | `fixed(row({ gap: 2 }, grow(btnOk), grow(btnOpen)), 1)` |
| `:114` | `dialogLabel` | `{ size: fixed 1 }` | `fixed(dialogLabel, 1)` |
| `:116` | `btnClose` | `{ size: fixed 1 }` | `fixed(btnClose, 1)` |
| `:119` | `dialog` | **`{ direction:'col', size: fixed 2 }`** | `fixed(col({ background:'dialog' }, …), 2)` |
| `:124` | `status` | `{ size: fixed 1 }` | `fixed(status, 1)` |
| `:128` | `root` | **`{ direction:'col', padding: 1 }`** | `col({ padding:1, background:'desktop' }, header, body, dialog, status)` |

`dialog.background = 'dialog'` (`:118`) and `root.background = 'desktop'` (`:127`) are separate field
assignments that fold into the builder props (AR-12).

### `controls-demo/main.ts` — 2 sites

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:95` | `form` | **`{ direction:'col', padding:1, gap:0 }`** | `col({ padding:1, gap:0, background:'window' })`, children still `add()`ed by the loop |
| `:107` | `view` (loop over tuples) | `{ size: fixed rows }` | `form.add(fixed(view, rows))`, loop kept |

The data-driven loop is the point of this demo and stays a loop.

### `router-demo/main.ts` — 7 sites (6 conversions + 1 preserved)

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:59` | `this` (`DetailScreen extends Group`) | `{ direction:'col', padding:1, gap:1 }` | **PRESERVED** — AR-6 |
| `:63` | `title` | `{ size: fixed 1 }` | `fixed(title, 1)` |
| `:65` | `hint` | `{ size: fixed 1 }` | `fixed(hint, 1)` |
| `:67` | `back` | `{ size: fixed 2 }` | `fixed(back, 2)` |
| `:101` | `screen` | **`{ direction:'col', padding:1, gap:0 }`** | `col({ padding:1, gap:0, background:'window' }, …)` |
| `:104` | `title` | `{ size: fixed 1 }` | `fixed(title, 1)` |
| `:111` | `listView` | `{ size: fr 1 }` | `grow(listView)` |

`:101`/`:104`/`:111` are inside the `list` route's `build:` closure. `listView` is declared `let` in
the outer scope (`:92`) and assigned inside the closure — the tag goes where the assignment is.

### `chrome-bars-demo/main.ts` — 1 site

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:99` | `body` | `{ size: fr 1 }` | `grow(body)` |

Already imports `spacer` + `fixed` (`:21-36`) and uses them for the status line, so this is a
one-line consistency fix. `:88` is `win.layout.rect = …`, a sub-property mutation, not a `.layout =`
site — out of scope.

### `kitchen-sink/stories/drill-down.story.ts` — 6 sites (5 conversions + 1 preserved)

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:29` | `this` (`DetailScreen extends Group`) | `{ direction:'col', padding:1, gap:1 }` | **PRESERVED** — AR-6 |
| `:32` | `title` | `{ size: fixed 1 }` | `fixed(title, 1)` |
| `:34` | `meta` | `{ size: fixed 1 }` | `fixed(meta, 1)` |
| `:36` | `back` | `{ size: fixed 2 }` | `fixed(back, 2)` |
| `:69` | `screen` | **`{ direction:'col' }`** | `col({ background:'window' }, …)` |
| `:77` | `list` | `{ size: fr 1 }` | `grow(list)` |

The story's own `at()` placement infrastructure stays absolute and untouched (AR-8).

## 2. `#111` — `packages/theme-designer/src` (8 sites, 3 files: 7 conversions + 1 preserved)

### `view/roles-panel.ts` — 2 sites

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:72` | `title` | `{ size: fixed 1 }` | folded into the builder |
| `:73` | `list` | `{ size: fr 1 }` | folded into the builder |

Tail (`:69-76`) becomes `const view = col({ background:'dialog' }, fixed(title, 1), grow(list));`,
which also absorbs `view.background = 'dialog'` (`:71`) and the `direction:'col'` that currently
lives in `app.ts:288`. The existing comment "the app sizes the panel's width and sets
`direction: 'col'`" becomes wrong and must be rewritten — the panel now owns its direction.

### `view/preview-panel.ts` — 2 sites

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:24` | `title` | `{ size: fixed 1 }` | folded into the builder |
| `:26` | `scroller` | `{ size: fr 1 }` | folded into the builder |

Tail becomes `return col(fixed(title, 1), grow(scroller));`.

### `app.ts` — 4 sites (3 conversions + 1 preserved)

| Line | Receiver | Literal | Target |
|------|----------|---------|--------|
| `:288` | `rail.view` | **`{ size: fixed 28, direction:'col' }`** | `fixed(rail.view, 28)` — direction moves into `roles-panel`'s `col()` |
| `:290` | `preview` | **`{ size: fr 1, direction:'col' }`** | `grow(preview)` — direction moves into `preview-panel`'s `col()` |
| `:303` | `inspector` | **`{ size: fixed 32, direction:'col' }`** | `fixed(inspector, 32)` — direction **dropped**, verified vestigial (AR-7) |
| `:308-312` | `workspace` (inside `sizeWorkspace`) | `{ position:'absolute', rect: {…}, direction:'row' }` | **PRESERVED** — AR-4 |

`workspace` itself becomes `row(fixed(rail.view, 28), grow(preview), fixed(inspector, 32))` at its
construction site (`:306`). `sizeWorkspace` then keeps clobbering it on every resize, re-writing
`direction:'row'` itself — which is why the builder's direction being overwritten is harmless.

**The load-bearing ordering constraint.** `:288`/`:290` may only drop their `direction:'col'`
*after* the corresponding panel builder has been converted to `col()`. Doing `app.ts` first leaves
both panels flowing horizontally with nothing to catch it. Phase order enforces this.

## 3. Property-drop exposure

**13 of 35 sites carry a property beyond `size`** — 37%, against 8% in the sibling
`widget-flex-adoption` plan. The taggers write only `size`; `cover()` only `position`; a bare
`row()`/`col()` only `direction`. Everything else is silently dropped unless re-established through
the builder's props object.

| Property | Sites |
|---|---|
| `direction` only | `editor-demo:67`, `event-demo:119`, `drill-down:69`, `app.ts:288`, `:290`, `:303` |
| `direction` + `gap` | `event-demo:109` |
| `direction` + `padding` | `event-demo:128` |
| `direction` + `padding` + `gap` | `controls-demo:95`, `router-demo:59`†, `:101`, `drill-down:29`† |
| `position` + `rect` + `direction` | `app.ts:308`‡ |

† preserved (AR-6) · ‡ preserved (AR-4)

`Flex` is `Omit<LayoutProps,'direction'> & { grow?, fixed?, fill?, background? }` (`flex.ts:41-53`),
so `padding`, `gap` and `background` are all expressible through the props object.

## 4. Existing coverage — and why it does not count

| Harness | What it actually asserts |
|---|---|
| `theme-designer/test/walkthrough.e2e.test.ts` | exit 0, stdout contains step headings, `/\+-{5,}\+/`, `Contrast`, `"version": 1`, `Done.` |
| `examples/test/{editor,event,controls,router}-demo.e2e.test.ts` | exit 0 plus rendered substrings (`══`, `1:1`, `Undo ×2`, …) — **four**, not five |
| `chrome-bars-demo` | **no test file exists** — its one site's only oracle is ST-C8 |
| `theme-designer/test/roles-panel.spec.test.ts` | label strings and the `targets` array |
| `theme-designer/test/app.{spec,impl}.test.ts` | **zero** occurrences of `layout`, `direction`, `rect`, `children[`, `workspace`, `resize` |
| `examples/test/kitchen-sink.smoke.spec.test.ts` | the story mounts, paints something, has a unique id |
| `preview-panel.ts` | **no test file exists** |

Not one references `bounds`, `.layout`, `rect` or `children[`. A panel that flowed sideways would
still print its text, still match `+---+`, still exit 0. `inspector-panel.spec.test.ts:52-58` is the
only geometry-adjacent assertion in either package — a painted colour at `x=6,y=10`, coupled to the
inspector's hard-coded absolute rects, which this plan does not touch.

**This is the gap Phase 1 closes.** Nothing here is a regression oracle for composition.

## 5. Corrections to the issue bodies

1. **#111 "one PR across three files"** — correct, but the *ordering* between the panel builders and
   `app.ts` is load-bearing and the issue does not say so (see §2).
2. **#111's `sizeWorkspace` caveat** ("must keep re-applying `direction:'row'`") — it already does,
   unconditionally, on every call. The caveat is real but already satisfied.
3. **#110 lists `layout.story.ts` under judgment calls partly because "the local variable is literally
   named `row`"** — the actual collision in that file's neighbourhood is broader: `story.ts:69`
   exports a local `at` that shadows the DSL's `at` with the same signature but clobber-instead-of-
   merge semantics. Both are out of scope here (AR-2, AR-8).
4. **The roadmap describes #111 as "independent" while listing #110 under RD-01 governance.** FR-6
   names both in one sentence; they are the same governance class.
