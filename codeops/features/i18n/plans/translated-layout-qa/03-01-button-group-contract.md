# Specification: shared button-group geometry

> **Status**: Ready for implementation
> **Requirements**: RQ-1; AC-1 through AC-4
> **CodeOps Artifact Schema**: 1

## Public model

The shared model belongs under UI controls and is exported from `@jsvision/ui`. Exact final names
may follow repository naming conventions, but the semantic contract is fixed:

```ts
interface ButtonGroupOptions {
  minimumButtonWidth?: number;
  gap?: number;
  maxColumns?: number;
}

interface ButtonGroupMetrics {
  buttonWidth: number;
  columnCount: number;
  rowCount: number;
  width: number;
  height: number;
}

function measureButtonGroup(buttons: readonly Button[], options?: ButtonGroupOptions): ButtonGroupMetrics;
function buttonGroup(buttons: readonly Button[], options?: ButtonGroupOptions): Group;
function buttonColumn(buttons: readonly Button[], options?: ButtonGroupOptions): Group;
```

The implementation may separate an explicit measured-width input from options when that makes
cross-row reuse clearer. It must not introduce a generalized flex layout object or make group
composition depend on i18n/catalog types.

## Metric rules

1. Empty group: button width, columns, rows, width, and height are zero.
2. Non-empty group:
   - `buttonWidth = max(non-negative minimum, ...buttons.map(button => button.measure().width))`;
   - effective columns are `min(button count, positive maxColumns or button count)`;
   - rows are `ceil(button count / columns)`;
   - width is `columns * buttonWidth + (columns - 1) * gap`;
   - height is `rows * 2 + (rows - 1) * rowGap`, with a documented default row gap.
3. Negative, non-finite, or fractional cell options are rejected or normalized using the same
   explicit policy as adjacent public UI layout APIs. Tests fix the selected behavior before code.
4. Measurement does not mutate Buttons.
5. Composition preserves input order and applies one width measured across the complete input,
   never once per wrapped row.
6. Gap and minimum defaults preserve the calling component's established convention through
   explicit options: UI/Forms pairs use 10 and 2; Datagrid delegates use 0 and 1.

## Composition rules

- Horizontal groups contain equal-width buttons and retain centered/equal-cell behavior.
- `maxColumns` creates stable row-major wrapping. A five-button group with three columns becomes
  `[0,1,2]` then `[3,4]`; focus and accelerator traversal remain input order.
- Vertical columns use the same group-wide button width and a stable vertical gap.
- Built-in components may select `maxColumns` based on available width, but the pure shared helper
  never reads a viewport or global application state.
- Composition owns layout metadata for the supplied Button instances. Public documentation states
  that callers must not attach the same Button to multiple live parents or compositions.
- Explicit `at(...)` placement remains supported. A caller-provided rect is a hard bound; normal
  rendering clips deterministically and does not expand the rect behind the caller's back.

## Datagrid migration

`buttonCellWidth`, `buttonRowMinWidth`, and `buttonRow` remain available within Datagrid during this
change. They delegate to UI metrics/composition with the historical one-cell gap and no configured
minimum. Existing behavior and focused tests remain green. New Datagrid code should consume the UI
contract where doing so does not expose package-internal names to consumers.

## Failure and edge behavior

- Wide and combining text is measured only through `Button.measure()`.
- Malformed accelerator labels continue to follow the existing catalog fallback path before Button
  construction.
- Zero buttons never creates negative gap math.
- An infeasible hard bound clips through the existing render tree; it never overlaps siblings,
  changes commands, removes a focusable action, or throws during draw.
