# Current State: docs-example-modernization

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

Everything in this document was **measured**, not inferred. A throwaway probe run during planning
extracted every `@example` block with the TypeScript compiler API and typechecked them in one
program; preflight iteration 1 rebuilt that extraction independently and corrected two systematic
errors in it. The figures below are the **corrected** ones — read the callout in §Measured baseline
before trusting any number here against a real harness run.

## Existing Implementation

### What exists

`@example` blocks are governed by CLAUDE.md's documentation directive — *"treat every example as
executable spec: realistic, correct, copy-pasteable"* — and enforced by
`scripts/check-jsdoc.mjs`. That script does two things: it greps for banned CodeOps/TV references,
and at `:130-133` it checks `ts.getJSDocTags(node).some(tag => tag.tagName.escapedText ===
'example')`. That is a **presence** check. The body is never read, never parsed, never compiled.

`scripts/api-extract.mjs` does read JSDoc via the compiler API (`:24-36`, `extractPackageApi` at
`:195`), but only to pull
the lead sentence and signature for the plugin API reference. Confirmed side-effect: because
`gen-plugin-api.mjs:131-135` emits *lead + signature only*, editing an `@example` body does **not**
drift the committed plugin API snapshot — this plan avoids the `plugin:sync --fix` step that
usually accompanies JSDoc edits.

### Relevant files

| File | Purpose | Changes needed |
|---|---|---|
| `packages/ui/src/view/group.ts:47,51,53` | Flex `@example` — `direction:'row'` + two `fr` children | Rewrite with `row()`/`grow()` (FR-3) |
| `packages/ui/src/editor/indicator.ts:38,39,40` | Flex `@example` — `direction:'col'` + `fr`/`fixed` | Rewrite with `col()`/`grow()`/`fixed()` (FR-3) |
| 37 files across `packages/{ui,files,datagrid,forms}/src` | 53 `position:'absolute'` `@example` lines | → `at()` (FR-4) |
| `packages/ui/src/split/split-view.ts:109` | `split.layout = { position: 'fill' }` | → `cover()` (FR-5) |
| `packages/ui/src/{tree/tree,tabs/tab-view,table/data-grid}.ts` | `createEventLoop` arity defect | Fix (FR-6) |
| `packages/ui/src/app/application.ts:275` | Imports a non-existent export | Fix (FR-6) |
| `packages/docs-site/examples/**` (7 files) | Local `at()` shadow helpers, 38 call sites | Re-export (FR-7) |
| `packages/docs-site/examples/containers/list-box.ts` | Three `at()` calls | → `col()` composition (FR-8) |
| `packages/docs-site/test/` | Regression net + guard home | Guard added; **existing files unedited** |

### Code analysis — the two flex examples

`group.ts` and `indicator.ts` are the only flex-shaped `@example`s in the entire shipped surface. A
sweep for `^ \* .*direction:` in `packages/*/src` returns **eight** hits, and they account for
exactly as follows: **two** are those subject blocks (`group.ts:47`, `indicator.ts:38`) — the ones
FR-3 rewrites; **four** are prose or the DSL's own documentation (`flex.ts:110,130`, `types.ts:61`,
`button-row.ts:60`); **one** is the layout solver documenting raw `LayoutBox` literals
(`layout.ts:44` — correctly raw, it *is* the raw API); and **one** is `split-view.ts:103`, a
**`SplitView` constructor option**, not a layout prop. The issue's "Do" list was therefore exactly
right. *(An earlier draft said "six of which are prose" and then listed four, leaving the
paragraph's own subject outside its own sweep.)*

### Code analysis — the docs-site shadows

Seven files each carry a byte-identical local helper:

```ts
/** Absolutely place a view within the example's box. */
function at<V extends View>(view: V, x: number, y: number, width: number, height: number): V {
  view.layout = { position: 'absolute', rect: { x, y, width, height } };   // REPLACE
  return view;
}
```

This is the same helper `packages/examples/kitchen-sink/story.ts:69` and
`datagrid-showcase/story.ts:68` carried until #114 retired them. The blessed builder at
`packages/ui/src/view/dsl/absolute.ts:42-50` **merges** via `setLayout()` and requests a reflow, so
the swap carries the same two behavioural deltas and gets the same audit before migration — owned by
[03-03](03-03-docs-site-shadow-retirement.md).

One material difference from #114, in this plan's favour: `packages/docs-site/tsconfig.json`
includes `examples/**/*.ts`, so these conversions **are** covered by the standing `yarn typecheck`.
#114 had to run a one-shot `tsc` sweep because `packages/examples/tsconfig.json` excluded its
targets.

## Measured baseline

### The blocks

> **⚠️ Read this before comparing any number here to a harness run.** The planning probe's headline
> figures — "451 blocks, 192 failures" — were **both wrong**, each for a distinct reason that
> preflight reproduced. They are corrected below. No count in this document is a gate; task 1.3.1
> produces the only authoritative numbers.

**Correction 1 — the block count was a multi-count.** `ts.getJSDocTags(node)` returns the *same* tag
for every node the JSDoc binds to: for an `export const` that is three nodes (`VariableStatement` →
`VariableDeclaration` → `Identifier`), each with a different `node.name`. Walking naively yields
**451 attributions over only 393 distinct tags** (a raw `grep -c "@example"` gives 395). Reproduced
on `packages/core/src/engine/color/presets.ts:37`, where one tag yields both
`presets.ts::classicTheme` and `presets.ts::(anonymous)` — and `(anonymous)` is produced 15 times in
that one file. **The harness must de-duplicate by tag position (`file` + `tag.pos`) and resolve the
symbol from the outermost declaration that owns the JSDoc.**

**Correction 2 — the failure count was measured with different compiler options.**
`tsconfig.base.json:8-9` sets `noUnusedLocals` and `noUnusedParameters`. Compiling 300 import-less
blocks both ways:

| options | failing | per package |
|---|---|---|
| base **minus** the unused-checks | 160 | ui 93 · web 4 · files 7 · forms 1 |
| base **as written** | 209 | ui 120 · web 11 · files 10 · forms 1 |

The loose row reproduces the probe's per-package numbers **exactly**, which is how we know the probe
ran with those checks off. AR-14 rules that the guard does the same — so ~160, not 192, is the
expected order of magnitude.

| Package | distinct `@example` blocks | (probe claimed) |
|---|---|---|
| core | 72 | 110 |
| ui | 171 | 176 |
| web | 12 | 11 |
| files | 18 | 20 |
| datagrid | 98 | 108 |
| forms | 6 | 6 |
| **Total (AR-15 roots)** | **377** | — |
| theme-designer *(out of scope, AR-15)* | 17 | 20 |

### ✅ Measured for real — task 1.3.1, 2026-07-20

The estimates above are superseded by the harness's own run over the six AR-15 roots, on the
pre-sweep repo, with the AR-14 options and the AR-16 in-memory host:

| | blocks | failing |
|---|---|---|
| core | 72 | 4 |
| ui | 171 | 93 |
| web | **11** | 4 |
| files | 18 | 7 |
| datagrid | 98 | 56 |
| forms | 6 | 1 |
| **Total** | **376** | **165** |

Wall-clock **5.4 s** for all 376 blocks in one `ts.createProgram` (the ~1.9 s planning figure covered
300 blocks and excluded `core`/`datagrid`). Comfortably inside the package's existing 60 s vitest
timeout.

The estimates were sound: 376 against a projected 377 (`web` has 11 blocks, not 12), and the failure
count lands where AR-14 predicted. The four packages the 300-block options probe *did* cover
reproduce its loose row **exactly** — ui 93 · web 4 · files 7 · forms 1 — which retires any remaining
doubt that `noUnusedLocals` had to be off. `core` (4) and `datagrid` (56) were outside that probe and
account for the rest.

All nine layout blocks from the table below are present and keyed as recorded, as is
`application.ts::syncOverlayVisible` (`codes: [2304, 2305]` — the `TS2305` barrel miss plus a
`TS2304` on an ambient `myPopup`).

Dominant failure cause is `TS2304 Cannot find name`: blocks written as **fragments** that reference
an ambient `dialog`, `app`, `loop` or `term`. That is a legitimate documentation style, not a defect
— which is precisely why the guard grandfathers rather than demands zero (AR-5). A smaller class is
permanently unfixable *as examples*: a literal `{ ... }` elision
(`core/engine/capability/index.ts:75,123`, `TS1128`) and a top-level `return`
(`datagrid/src/validation.ts:83`, `TS1108`).

Three extraction requirements were established by measurement and are **not** optional:

- **Fence stripping (AR-12)** — unconditional and package-agnostic. Measured fence distribution:
  datagrid 85 · ui 8 · forms 2 · theme-designer 0.
- **Source-relative resolution (AR-13)** — a block must compile *as if* it sat in its source's own
  directory, or relative specifiers such as `'./button-row.js'` fail (~22 phantom `TS2307`s) and the
  37 top-level-`await` blocks lose their `type: module` context. AR-16 preserves this with a virtual
  path rather than a real file.
- **Comment-terminator un-escaping** — `packages/datagrid/src/format.ts:27` contains a JSDoc-escaped
  `*\/` that `getTextOfJSDocComment` emits verbatim, producing `TS1010`. This is an extraction
  defect, not a documentation defect: un-escape `*\/` → `*/`.

### The layout surface this plan edits

43 blocks contain a `.layout =` write. **34 compile clean today.** The nine that do not:

| File | Symbol | Line | Recorded error |
|---|---|---|---|
| `packages/ui/src/dialog/buttons.ts` | `cancelButton` | 41 | `TS2304 Cannot find name 'dialog'` |
| `packages/ui/src/dialog/buttons.ts` | `okCancelButtons` | 80 | `TS2304 Cannot find name 'dialog'` |
| `packages/ui/src/dialog/buttons.ts` | `yesNoButtons` | 96 | `TS2304 Cannot find name 'dialog'` |
| `packages/ui/src/feedback/spinner.ts` | `Spinner` | 83 | `TS2304 Cannot find name 'app'` † |
| `packages/forms/src/form-dialog.ts` | `formDialog` | 156 | `TS2304 Cannot find name 'app'` |
| `packages/datagrid/src/editable-grid-rows.ts` | `EditableGridRows` | 187 | `TS2345` options-type mismatch |
| `packages/ui/src/table/data-grid.ts` | `DataGrid` | 69 | `TS2554 Expected 2 arguments, but got 1` |
| `packages/ui/src/tabs/tab-view.ts` | `TabView` | 177 | `TS2554 Expected 2 arguments, but got 1` |
| `packages/ui/src/tree/tree.ts` | `Tree` | 66 | `TS2554 Expected 2 arguments, but got 1` |

† Under base options *as written* this block's first diagnostic is `TS6133` (unused local), not
`TS2304`. AR-14 drops the unused-checks, which restores the `TS2304` recorded above — this row is
the reason that decision has to be made before task 1.3.1 runs, not after.

The last three are FR-6 defects. They **do** enter the allowlist at task 1.3.1, because Phase 1
generates it from the **pre-sweep** repo where all three genuinely fail; task 2.3.1 then fixes them
and removes their entries, and AR-11's stale-entry rule enforces that removal. The other six are
grandfathered and stay. This table is the oracle for **AC-6** — which counts the *end* state: six
remain, three leave. *(An earlier draft of this paragraph said the three "never enter the
allowlist", which contradicted task 2.3.1's instruction to remove them and would have led an
executor to hand-prune a correctly-generated list, turning Phase 1's own verify red.)*

> Producing this table also exercised AR-10's key design: the enclosing declaration's name was
> recoverable for all nine blocks. It did **not** exercise the collision cases — `input.ts` carries
> two `@example`s on the same `class Input`, 39 blocks are keyed by a bare member name, and
> `packages/files/src/fs/node-fs.ts:9` is genuinely anonymous. See the amended AR-10.

### Live defects

Four public examples are wrong **today**. They are documentation the repo actively invites people
and agents to copy.

**The `createEventLoop` arity — `tree.ts:66`, `tab-view.ts:177`, `table/data-grid.ts:69`.** All
three document:

```ts
const loop = createEventLoop({ width: 40, height: 10 });   // TS2554 — needs 2 arguments
```

The real signature is `createEventLoop(viewport, opts)` (`packages/ui/src/event/event-loop.ts:622`)
and `caps` is the **only** required option (`packages/ui/src/event/types.ts:37-39`), so
`createEventLoop({ width: 40, height: 10 }, { caps })` is the whole fix. Correct in-repo siblings to
copy: `packages/ui/src/dialog/dialog.ts:72` and `packages/ui/src/dialog/buttons.ts:29`. *(An earlier
draft cited `group.ts:57` — that block documents `createRenderRoot`, a different API. It is still
the right model for how to obtain `caps` via `resolveCapabilities`, but it is not a
`createEventLoop` sibling.)*

**The unreachable export — `application.ts:275`.** The example does
`import { … syncOverlayVisible … } from '@jsvision/ui'` and fails `TS2305`. But the symbol is **not
a phantom**: `syncOverlayVisible` exists at `packages/ui/src/app/application.ts:288`, carries a full
public-style JSDoc with its own `@example`, is exported from `packages/ui/src/app/index.ts:8`, is
consumed cross-subsystem by `packages/ui/src/menu/controller.ts`, and is pinned by a ui spec test
(`packages/ui/test/dropdown.seams.spec.test.ts:26`). It is missing from exactly one place — the root
barrel `packages/ui/src/index.ts`, which re-exports only `createApplication` as a value from
`./app/`. So the live question is not "what happened to this symbol" but "**is the root-barrel
omission the defect?**" — which task 2.3.2 surfaces for a ruling rather than assuming. See
[03-02](03-02-jsdoc-example-modernization.md) §FR-6.

## Gaps identified

### Gap 1: `@example` blocks have no oracle

**Current behaviour:** `check:docs` passes as long as the `@example` tag exists. A block can import
a non-existent symbol, call a function with the wrong arity, or reference an undefined variable, and
every gate in the repo stays green.
**Required behaviour:** a block that does not compile fails the build unless it is explicitly,
visibly grandfathered.
**Fix required:** [03-01](03-01-example-compile-guard.md).

### Gap 2: 53 public examples teach the raw field write

**Current behaviour:** they demonstrate `view.layout = { position: 'absolute', rect: … }`, the
idiom the whole #108 epic exists to retire, in the highest-visibility place in the codebase.
**Required behaviour:** they demonstrate `at()`.
**Fix required:** [03-02](03-02-jsdoc-example-modernization.md).

### Gap 3: the docs-site re-invented the shadow #114 just deleted

**Current behaviour:** seven copies of a replace-semantics `at()` that silently discards any layout
prop the call does not name.
**Required behaviour:** one import of the merge-semantics builder.
**Fix required:** [03-03](03-03-docs-site-shadow-retirement.md).

## Dependencies

### Internal

- `@jsvision/ui`'s DSL: `at`/`cover`/`col`/`row`/`grow`/`fixed`/`spacer`
  (`view/dsl/absolute.ts`, `view/dsl/flex.ts`). All shipped by #113 and #122; nothing to build.
- Built `dist/` for every `@jsvision/*` package — `packages/ui/package.json:33-39` points `types` at
  `dist/index.d.ts`, so extracted examples cannot resolve without a build.
  `turbo.json`'s `test dependsOn build` already provides this.
- `typescript` — root devDependency `^5.7.2`, and direct in `packages/docs-site/package.json:36`.

### External

None. No new dependency of any kind.

## Risks and concerns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| A scratch `.ts` beside a real source races turbo's unordered `typecheck`/`build`, or leaks | — | — | **Eliminated by AR-16** — the harness writes nothing. This was the plan's top-rated hazard and it is now structural rather than guarded. **AC-9** stays as the regression check against a filesystem write being reintroduced |
| The harness's true failure count differs from the recorded ~160, blowing up the allowlist | High | Low | Expected and harmless. The allowlist is generated in task 1.3.1 from whatever the real harness reports. **No count in this plan gates anything** — the corrections above removed the "stop if higher" rule that made one executable. The only load-bearing figures are the nine layout blocks (AC-6) |
| `ts.createProgram` over ~377 modules is slow, or times out on a CI runner | Low | Medium | Measured at **~1.9 s** for 300 blocks against the full `@jsvision/*` typings — comfortable inside docs-site's 60 s vitest timeout, and the package already runs a full `ts.createProgram` in `api-barrel-exports.spec`. AR-7 keeps it off the Windows/macOS cells via `verify:shipped`. Task 1.3.3 records the wall-clock so a regression is visible |
| The `at()` sweep silently changes a rendered example | Low | Low | These are comments — nothing renders them. The one real behavioural surface is docs-site (03-03), whose primary control is the rendered before/after at task 3.4.1; `paint-smoke` is a liveness backstop only (AC-7) |
| Line-number churn from the sweep invalidates allowlist entries | Certain | None | AR-10: entries are keyed by symbol, not line. This is exactly why |
| A newly-introduced error hides behind an existing allowlist entry with the same code | Medium | **High** | Five of the six allowlisted blocks the sweep edits are grandfathered on `TS2304`, and a forgotten `at` import is *also* `TS2304`. Mitigated by matching the **set** of diagnostic codes plus the identifier named for `TS2304` — see [03-01](03-01-example-compile-guard.md) §"The allowlist contract" |
| `syncOverlayVisible` turns out to need a root-barrel export | Medium | Low | Not pre-judged. Task 2.3.2 rules between the four branches in [03-02](03-02-jsdoc-example-modernization.md) §FR-6 and records the outcome as AR-R1 |
