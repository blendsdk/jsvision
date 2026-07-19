# Testing Strategy — widget-flex-adoption

## The shape of spec-first for a behavior-preserving refactor

There is no new behavior to specify. The oracle for "did this refactor change anything" is the
**existing** suite, which must stay green **and unedited** (NFR-1). Spec-first here means closing the
coverage gaps *before* touching source, so the conversion is falsifiable rather than merely
plausible.

Every witness below is written against **unmodified** source and is expected to pass immediately.
That is the point: a green-first witness records what the system does today, so a later red proves
the conversion moved something.

## Specification test cases

### ST-W1 — app-shell root composition (new: `app-shell.composition.spec.test.ts`)

| Input | Expected |
|-------|----------|
| `createApplication({ menuBar, content, statusLine })` | `root.children` is exactly `[menuBar, content, statusLine, overlay]`, in that order |
| same | `overlay.layout.position === 'absolute'` and `overlay` is a **direct** child of `root` |
| same | `menuBar.bounds.height === statusLine.bounds.height === CHROME_ROW_HEIGHT` |
| `createApplication({ content })` (no chrome) | `root.children` is exactly `[content, overlay]` |
| `createApplication({ menuBar, content })` | `root.children` is exactly `[menuBar, content, overlay]` |

Closes the gap that leaves `application.ts`'s conditional child assembly unasserted, and pins the
overlay-locator premise four existing test files depend on (02-current-state §1). Traces to FR-4, AC-6.

### ST-W2 — app-shell tab order (same file)

| Input | Expected |
|-------|----------|
| a full shell with two focusable views in `content` | the ordered focus ring, captured by name, is identical before and after conversion |

Traces to FR-4, AC-6.

### ST-W3 — the TabView content clobber contract (new: `tabs.content-layout.spec.test.ts`)

| Input | Expected |
|-------|----------|
| a tab whose `content` has `layout = { padding: 2, size: { kind: 'fixed', cells: 3 } }` set **before** being passed to `TabView` | after mount, `content.layout` is exactly `{ size: { kind: 'fr', weight: 1 } }` — the caller's `padding` **and** `size` are discarded |

**This is the most important test in the plan.** It pins the behavior AR-1 chose to preserve at a
public API boundary. Without it, a future reader sees a lone wholesale assignment surrounded by
taggers and "fixes" it — silently changing what a published API does to caller-supplied views.
Traces to FR-3, AC-5.

### ST-W4 — the createApplication content clobber contract (same file or `app-shell.composition`)

| Input | Expected |
|-------|----------|
| `createApplication({ content })` where `content.layout = { padding: 1, direction: 'row' }` was set first | after mount, `content.layout` is exactly `{ size: { kind: 'fr', weight: 1 } }` |

Traces to FR-3, AC-5.

### ST-W5 — datagrid auxiliary composition (new: `aux-composition.spec.test.ts` in datagrid)

| Input | Expected |
|-------|----------|
| `buttonRow([a, b], 10)` | row is `direction:'row'`, height `BUTTON_HEIGHT`; each button width 10; the cell centers |
| `grid-lifecycle` placeholder / spinner / error views | each shell's solved child rects, captured as-is |
| `ValueList` popup | solved rects of search label, input, scrollbar, list, status |

Closes the coverage gap on the three modules with no composition oracle today. Traces to AC-2.

### ST-W6 — grid-panels band geometry (new: `panel-bands.spec.test.ts`)

| Input | Expected |
|-------|----------|
| a grid with left/center/right freeze segments + footer + quick-filter + message band | the solved rect of every band row and every per-segment panel, captured before conversion |

`golden-screen.spec` and `a11y-golden.spec` already guard the rendered result; this guards the
*structure* underneath, so a failure names the band that moved instead of showing a screen diff.
Traces to AC-2, AC-4.

## The zero-edit contract

| Rule | Enforcement |
|------|-------------|
| No geometry/golden assertion is edited in any `*.spec.test.ts` or `*.impl.test.ts` | `git diff --stat` on `**/test/**` reviewed at each phase close; AC-3 |
| `golden-screen.spec.test.ts` + `a11y-golden.spec.test.ts` show **zero** diff | AC-4 |
| A locator edit is permitted only where nesting genuinely changed | Logged as a deviation with old/new locator and cause (NFR-2) |
| A failing geometry oracle means the **code** is wrong | Project standard; spec tests are immutable |

## Verification

Per phase: `TUI_SKIP_PERF=1 yarn verify` (AR-6). Additionally at close-out: `yarn check:deps`,
the kitchen-sink smoke test (NFR-5), `yarn bench` under the 16 ms ceiling, and a grep audit proving
every in-scope `.layout =` site is converted or is one of the six documented exclusions (AC-8).

**Build-order rule (NFR-4):** rebuild `packages/ui` before running datagrid or examples tests after
any Phase-2 change.
