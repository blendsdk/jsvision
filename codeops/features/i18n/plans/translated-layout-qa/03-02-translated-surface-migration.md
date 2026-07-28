# Specification: translated surface migration

> **Status**: Ready for implementation
> **Requirements**: RQ-2; AC-5 through AC-8
> **CodeOps Artifact Schema**: 1

## Sweep method

Build the inventory from canonical catalog keys and their production call sites, then classify every
visible framework-owned translation as:

1. intrinsic/cell-correct already;
2. fixed but translation-independent;
3. requires width/height migration;
4. requires placement/hit-zone migration;
5. intentionally clipped at a documented hard bound.

The audit artifact belongs in tests or durable docs, not production comments. A path is complete only
when a specification demonstrates its classification.

## UI dialogs and surfaces

- Replace the internal `buttonBand` duplication with the public shared contract.
- Derive message/input/find/editor dialog widths from `stringWidth` of visible framework/caller text,
  action group minimum, border, and body padding.
- Treat existing compact widths/maxima as preferred compatibility bounds, not permission to clip an
  action. Expand within the desktop extent; when the action band cannot fit, choose stable whole-button
  wrapping and add its row height.
- Body text remains wrappable/clippable according to the existing `Text` contract. Actions, their hit
  zones, and focus order remain intact.
- Audit dropdown captions, popup labels, switches, status/surface titles, and editor dialogs. Change
  only paths whose geometry uses code-unit or hard-coded translated widths.

## Forms

- Remove duplicated button constants and consume shared group metrics/composition.
- `width` and `height` remain required because the caller body is opaque. They are requested minimum
  dimensions; the factory expands them for actions/frame within the host viewport.
- The absolute caller body remains bounded to the resolved content area. Framework action rows may
  wrap without intercepting body clicks, changing async submit sealing, or making Cancel grab focus.
- If the viewport is smaller than the functional minimum, retain deterministic clipping while every
  action remains in the focus tree.

## Files

- File and change-directory dialogs measure the complete vertical action set once and apply one
  shared width.
- Resolved dialog minimum width is the maximum of action rail, translated labels/fields/status,
  content minima, padding, and frame.
- Error dialog message sizing uses display cells and the shared OK action requirement.
- Preserve filesystem behavior, path ownership, async loading, commands, and selection state.

## Calendar and DatePicker

- Resolve localized month names, weekday labels, and Today before geometry.
- Compute renderer-cell widths with the existing `stringWidth`; use cell-aware padding/clipping
  helpers rather than `.length`, `slice`, or `padStart`.
- Preferred content width is at least the day grid width, navigation arrows plus the widest
  `month + year` header, and footer echo/Today requirements for the selected density.
- One `CalendarMetrics` result defines `measure()`, header/footer draw offsets, arrow/Today hit zones,
  and DatePicker popup bounds. DatePicker must not precompute English metrics for a localized Calendar.
- Under a hard smaller host, arrows and Today remain valid hit targets; lower-priority header/footer
  text is deterministically cell-clipped without splitting wide glyphs.

## Datagrid

### Filter and value-list popup

- A pure desired-size calculation includes the widest translated operator, field captions,
  editor/date-picker minimum, status/value-list requirements, shared action width, padding, and frame.
- The grid clamps desired width and height to its available overlay viewport before anchored
  placement, including right-edge cases.
- Layout selects the preferred horizontal action row or a stable stacked/wrapped mode against actual
  width. Apply/Clear/Select All and related value-list actions retain one shared width.
- Reactive changes such as `between` and async distinct values re-evaluate desired bounds and
  re-clamp both axes.

### Personalization

- Measure all five variant actions before deciding one row versus 3/2 wrapping.
- Every wrapped row receives the same complete-group button width.
- Translated headers/status receive flexible or display-cell-clipped allocation without overwriting
  adjacent controls.
- OK/Cancel consumes the shared UI metric with Datagrid's chosen gap convention.

## Compatibility

- Existing English snapshots remain exact where intrinsic dimensions do not need to grow.
- Command IDs, accelerators, focus traversal, modal results, validators, and caller-data values do
  not change.
- No catalog key or public locale entry is renamed.
