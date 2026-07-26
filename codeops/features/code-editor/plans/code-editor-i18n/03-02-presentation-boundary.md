# Presentation boundary: Code Editor internationalization

> **Document**: 03-02-presentation-boundary.md
> **Parent**: [Index](00-index.md)

## Overview

This component localizes editor-owned terminal copy without making controller, document, search,
degradation, or language-analysis semantics locale-dependent. It adds compatible structured
metadata, pure projectors, bounded search chrome, and display-cell-correct clipping per FR-3
through FR-7 and FR-10. *(AR-2, AR-3, AR-5, AR-8, AR-11)*

## Structured diagnostic projection

Extend `CodeEditorOverlayPresentation` additively with optional diagnostic metadata:

```ts
/** Locale-neutral diagnostic wrapper metadata retained until final view projection. */
readonly diagnostic?: {
  readonly severity: 'error' | 'warning' | 'information' | 'hint';
  readonly detail: string;
};
```

`createDiagnosticOverlay()` continues producing the compatible English `items` row and additionally
stores the already normalized detail and stable severity. `CodeEditor.#syncAssistance()` uses a
pure projector when this metadata is present; every other overlay continues using `items`.

The projector translates only the severity label, then concatenates `[<label>] ` with normalized
detail. The detail is never passed as a translation parameter or template. It budgets the prefix
in display cells and clips the composed row without splitting a wide glyph. *(AR-3, AR-5, AR-11)*

## Degradation projection

Keep `CodeEditorDegradationNotice.message` and its historical English values for compatibility.
Export:

```ts
/** Formats one editor-owned degradation notice with an explicit or isolated English service. */
export function formatCodeEditorDegradationNotice(
  notice: CodeEditorDegradationNotice,
  i18n?: I18n,
): string | undefined;
```

The function maps only recognized stable `reason` values that currently own messages:

- `missing-adapter`, `unavailable`, and `failure` → feature unavailable.
- `retry` and `operation` → operation pending.
- `limit` → `undefined` because the existing semantic counts have no historical prose wrapper.

It does not inspect errors or external content. Unknown hostile runtime input fails closed to
`undefined` without invoking accessors. *(AR-3, AR-7, AR-11)*

## Invisible-character projection

Keep `InvisibleCharacterWarning.label` as compatible English output and export:

```ts
/** Formats an invisible-character warning without changing detected source text. */
export function formatInvisibleCharacterWarning(
  warning: InvisibleCharacterWarning,
  i18n?: I18n,
): string;
```

The projector validates the warning's existing `U+` code-point token against the detector's stable
format and uses it as the `${codePoint}` parameter. Invalid runtime input returns the safe English
fallback without reading source text. Detection offsets and source remain untouched. *(AR-3,
AR-11)*

## Inline search/replace presentation

### State ownership

`CodeEditorSearchSession` remains the only mutable search owner. Presentation reads its immutable
snapshot after the existing interaction revision changes. No translated value is stored in the
session. *(AR-2, AR-3)*

### Geometry

Add an editor-owned search view or equivalent isolated presentation module. When closed it consumes
zero rows. Find consumes one bottom row; replace consumes two. The document projection and viewport
height exclude those rows, so source/caret content is not painted beneath the surface and scroll
ranges update in the same interaction tick.

At widths below the existing useful document minimum, the surface still clamps safely and never
writes outside its bounds. At ordinary widths it uses this priority:

1. active field label and bounded caller query/replacement value;
2. localized plural match count;
3. localized case state;
4. stable key token plus localized action hints.

Lower-priority segments disappear as space contracts. Required segments clip in display cells with
an ellipsis only when the ellipsis itself fits. Query and replacement bytes remain caller content;
they are never translated, normalized for matching, or inserted into a message template. *(AR-2,
AR-5, AR-8, AR-11)*

### Interaction

Existing `routeKey`, `execute`, `setSearchQuery`, `setReplacementText`, and
`setSearchCaseSensitive` behavior remains authoritative. The presentation adds no button commands
or alternate state machine. `Tab`, Enter, Shift+Enter, Backspace, Escape, F3, and stable command IDs
retain existing semantics. *(AR-2, AR-7)*

### Match messages and numbers

The match-count projector calls `i18n.t('code-editor.search.matches', { params: { count } })` with
the canonical English plural as `defaultMessage`. Displayed count/position numbers use
`i18n.number()` where a position is shown; `CodeEditorSearchState.current/total` remain plain
numbers. Search never uses `i18n.compare` or locale casing. *(AR-6, AR-7)*

## Status presentation

The window status renderer:

- preserves the exact language ID;
- translates the line/column labels;
- formats the one-based numeric values through `i18n.number()`;
- composes and display-cell clips the status row to its actual bounds;
- retains line and column values before lower-priority language text when width is constrained.

The complete cross-locale minimum-size policy remains part of #185; this plan guarantees bounded,
cell-correct Code Editor output. *(AR-5, AR-8)*

## Assistance width

Replace `item.length` sizing with `stringWidth(item)`. Replace code-unit truncation used for
display limits with a bounded display-cell clip helper that iterates Unicode code points, retains
combining sequences when their base fits, never emits half of a wide glyph, and preserves original
item identity outside the rendered/truncated row. Existing item-count and height limits remain
unchanged. *(AR-8, AR-11)*

## Lifecycle isolation

Every constructed `CodeEditor` owns only its passed/resolved service and view state. Disposing it
releases existing search, assistance, modal, pending, and subscriptions. Reconstructing with
another service creates clean state; no locale mutation API is added. *(AR-4)*

## Error handling

| Error case | Strategy | AR Ref |
|---|---|---|
| Missing diagnostic metadata from an older/custom overlay | Render compatible `items` unchanged | AR-3, AR-7 |
| Hostile diagnostic detail | Existing normalization before metadata; bounded cell clipping after prefix | AR-11 |
| Unsupported degradation reason | Return `undefined`, retaining semantic state | AR-3, AR-11 |
| Invalid invisible warning object | Safe fallback; no accessor/source inspection | AR-11 |
| Zero/tiny viewport | Clamp rows and skip segments/drawing outside bounds | AR-8 |
| Long override or wide/combining text | Cell-aware priority, clipping, and bounds | AR-8, AR-11 |

## Testing requirements

- Diagnostic prefix translation with exact normalized external detail.
- Degradation/invisible projector fallback and hostile-input behavior.
- Search zero/one/many plural categories, active fields, case state, hints, and unchanged matching.
- Wide glyph, combining mark, long override, and tiny/ordinary viewport projection.
- Clean reconstruction with a different locale and disposal isolation.
