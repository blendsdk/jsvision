# Requirements — widget-flex-adoption

> **Source**: GitHub [#109](https://github.com/blendsdk/jsvision/issues/109) + [#116](https://github.com/blendsdk/jsvision/issues/116) · verification [RD-02](../../requirements/RD-02-non-functional-and-verification.md) (AR-5)

## Functional requirements

**FR-1 — ui widget composition (#109).** `packages/ui/src/table/data-grid.ts`,
`tabs/tab-view.ts` and `app/application.ts` compose their internal view trees with the layout DSL
instead of hand-assigned descriptors, at the 12 sites enumerated in
[02-current-state.md](02-current-state.md) §1.

**FR-2 — datagrid composition (#116).** All 48 in-scope sites across the 10
`packages/datagrid/src` modules listed in [02-current-state.md](02-current-state.md) §2 use the DSL:
flex containers via `col`/`row`, size tags via `grow`/`fixed`, anchored placement via `at()` (AR-7),
and fill placement via `cover()` (AR-8).

**FR-3 — the public-clobber contract is preserved and pinned.** At `tab-view.ts:254` and
`application.ts:330` the wholesale assignment **stays**, because an external caller can reach those
receivers and today's behavior discards any layout they set (AR-1, AR-9). Each site carries a comment
stating why it is deliberately not converted, and each is pinned by a spec test (ST-W3, ST-W4) so the
contract survives a future reader's good intentions.

**FR-4 — no new nesting in a focusable path.** Conversions must not add a Group between a container
and a focusable leaf. #122's tree-order traversal makes such nesting survivable, but this plan is
behavior-preserving: tab order must be identical, not merely still-working.

## Non-functional requirements

**NFR-1 — geometry is frozen (AR-4).** Every geometry, golden-screen and a11y assertion in every
`*.spec.test.ts` and `*.impl.test.ts` stays **byte-identical and unedited**. A failing geometry
oracle means the conversion is wrong.

**NFR-2 — locator edits are bounded and logged (AR-4).** A child-index locator may be re-expressed
structurally *only* where nesting genuinely changed, never weakened, and each edit is recorded as a
plan deviation naming the file, the old and new locator, and why the change was unavoidable. The
expectation the locator guards must not change.

**NFR-3 — zero regression, verify-green per phase (RD-02).** `TUI_SKIP_PERF=1 yarn verify` green at
every phase boundary (AR-6). `yarn check:deps` green. Bench compose+diff median stays under the
16 ms ceiling.

**NFR-4 — build-order discipline.** `packages/datagrid` and `packages/examples` tests import
`@jsvision/ui` **by name, resolving to built `dist`**. `packages/ui` must be rebuilt after any Phase-2
change before datagrid tests are trusted, or a stale-dist failure gets misattributed to the datagrid
conversion.

**NFR-5 — kitchen-sink stories stay green.** Every component touched here already ships a story;
no new story is required (the components are not new). The showcase smoke test must pass unchanged —
if a story's rendering shifts, NFR-1 has been violated.

## Acceptance criteria

| # | Criterion | Oracle |
|---|-----------|--------|
| AC-1 | All 12 #109 sites converted or explicitly documented as preserved | grep audit + 03-01 table |
| AC-2 | All 48 #116 sites converted | grep audit + 03-02 table |
| AC-3 | Zero `*.spec.test.ts` geometry/golden assertion edited | `git diff` review at close-out |
| AC-4 | `golden-screen.spec` + `a11y-golden.spec` green **and untouched** | verify + diff |
| AC-5 | The two public clobber sites unchanged and pinned | ST-W3, ST-W4 |
| AC-6 | Tab order through `DataGrid`, `TabView`, the app shell and the grid unchanged | ST-W1, existing tabs.spec ST-7/8/37/38 |
| AC-7 | `TUI_SKIP_PERF=1 yarn verify` green at every phase boundary | verify log |
| AC-8 | No `.layout =` assignment remains in the 13 in-scope files except the 6 documented exclusions | grep audit |

## Explicitly out of scope

Listed once in [00-index.md](00-index.md#out-of-scope) — JSDoc examples (#112), the T-AO1 overlay,
the `{...spread}` sites (#117), and `filter-popup.ts:272` (S6 self-config).
