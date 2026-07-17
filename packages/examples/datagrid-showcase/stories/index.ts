/**
 * The datagrid-showcase **story registry** — the aggregated list the shell + smoke test read.
 *
 * Explicit aggregation (no import-side-effects): adding a demo to the showcase = write its `*.story.ts`
 * under `stories/<cluster>/` and add it to this array. Entries are grouped by category and ordered as
 * they should appear in the navigator; the category order is first-seen here.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Story } from '../story.js';

// Foundation (RD-01)
import { sizingStory } from './foundation/sizing.story.js';
import { valueFormatParseStory } from './foundation/value-format-parse.story.js';
import { dataSourceStory } from './foundation/data-source.story.js';
import { readOnlyStory } from './foundation/read-only.story.js';
import { themingStory } from './foundation/theming.story.js';

// Editing (RD-02)
import { perCellEditStory } from './editing/per-cell-edit.story.js';
import { commitVetoStory } from './editing/commit-veto.story.js';
import { dirtyTrackingStory } from './editing/dirty-tracking.story.js';
import { cursorNavStory } from './editing/cursor-nav.story.js';
import { overlayStory } from './editing/overlay.story.js';

// Cell editors (RD-03) — one per CellEditorKind
import { editorTextStory } from './editors/text.story.js';
import { editorIntegerStory } from './editors/integer.story.js';
import { editorDecimalStory } from './editors/decimal.story.js';
import { editorBooleanStory } from './editors/boolean.story.js';
import { editorDateStory } from './editors/date.story.js';
import { editorEnumStory } from './editors/enum.story.js';
import { editorLookupStory } from './editors/lookup.story.js';
import { editorReadonlyStory } from './editors/readonly.story.js';
import { editorCustomStory } from './editors/custom.story.js';

// Formatting & rendering (RD-04)
import { fmtNumberStory } from './formatting/number.story.js';
import { fmtCurrencyStory } from './formatting/currency.story.js';
import { fmtPercentStory } from './formatting/percent.story.js';
import { fmtDateStory } from './formatting/date.story.js';
import { fmtBooleanStory } from './formatting/boolean.story.js';
import { fmtLabelsStory } from './formatting/labels.story.js';
import { fmtParseRoundtripStory } from './formatting/parse-roundtrip.story.js';
import { fmtRenderStyleStory } from './formatting/render-style.story.js';

// Sorting (RD-05)
import { sortingSingleStory } from './sorting/single.story.js';
import { sortingMultiStory } from './sorting/multi.story.js';
import { sortingValueAwareStory } from './sorting/value-aware.story.js';
import { sortingCollatorStory } from './sorting/collator.story.js';
import { sortingPushDownStory } from './sorting/push-down.story.js';

// Filtering (RD-06)
import { filteringQuickFilterStory } from './filtering/quick-filter.story.js';
import { filteringConditionTextStory } from './filtering/condition-text.story.js';
import { filteringConditionNumDateStory } from './filtering/condition-num-date.story.js';
import { filteringValueListStory } from './filtering/value-list.story.js';
import { filteringNofMStory } from './filtering/n-of-m.story.js';
import { filteringPushDownStory } from './filtering/push-down.story.js';

// Columns & layout (RD-07)
import { layoutFrozenPanelsStory } from './columns-layout/frozen-panels.story.js';
import { layoutResizeReorderStory } from './columns-layout/resize-reorder.story.js';
import { layoutShowHideStory } from './columns-layout/show-hide.story.js';
import { layoutFrozenRowsStory } from './columns-layout/frozen-rows.story.js';
import { layoutDensityStory } from './columns-layout/density.story.js';

// Rows & selection (RD-08)
import { selectionMultiStory } from './rows-selection/multi-select.story.js';
import { selectionCheckboxStory } from './rows-selection/checkbox-column.story.js';
import { selectionGutterStory } from './rows-selection/row-gutter.story.js';
import { selectionCrudStory } from './rows-selection/row-crud.story.js';
import { selectionNullStory } from './rows-selection/null-policy.story.js';

// Footer & aggregation (RD-09)
import { footerAggregatesStory } from './footer-master-detail/aggregates.story.js';
import { footerWidgetsStory } from './footer-master-detail/widgets.story.js';
import { footerStickyStory } from './footer-master-detail/sticky.story.js';
import { footerHonestyStory } from './footer-master-detail/honesty.story.js';
import { footerMasterDetailStory } from './footer-master-detail/master-detail.story.js';

// Roadmap — the "coming soon" panels (RD-10…RD-14)
import { placeholders } from './placeholders.js';

/** Every registered demo, in navigator order (six shipped clusters, then the roadmap band). */
export const STORIES: readonly Story[] = [
  // Foundation (RD-01) · 5
  sizingStory,
  valueFormatParseStory,
  dataSourceStory,
  readOnlyStory,
  themingStory,

  // Editing (RD-02) · 5
  perCellEditStory,
  commitVetoStory,
  dirtyTrackingStory,
  cursorNavStory,
  overlayStory,

  // Cell editors (RD-03) · 9
  editorTextStory,
  editorIntegerStory,
  editorDecimalStory,
  editorBooleanStory,
  editorDateStory,
  editorEnumStory,
  editorLookupStory,
  editorReadonlyStory,
  editorCustomStory,

  // Formatting & rendering (RD-04) · 8
  fmtNumberStory,
  fmtCurrencyStory,
  fmtPercentStory,
  fmtDateStory,
  fmtBooleanStory,
  fmtLabelsStory,
  fmtParseRoundtripStory,
  fmtRenderStyleStory,

  // Sorting (RD-05) · 5
  sortingSingleStory,
  sortingMultiStory,
  sortingValueAwareStory,
  sortingCollatorStory,
  sortingPushDownStory,

  // Filtering (RD-06) · 6
  filteringQuickFilterStory,
  filteringConditionTextStory,
  filteringConditionNumDateStory,
  filteringValueListStory,
  filteringNofMStory,
  filteringPushDownStory,

  // Columns & layout (RD-07) · 5
  layoutFrozenPanelsStory,
  layoutResizeReorderStory,
  layoutShowHideStory,
  layoutFrozenRowsStory,
  layoutDensityStory,

  // Rows & selection (RD-08) · 5
  selectionMultiStory,
  selectionCheckboxStory,
  selectionGutterStory,
  selectionCrudStory,
  selectionNullStory,

  // Footer & aggregation (RD-09) · 5
  footerAggregatesStory,
  footerWidgetsStory,
  footerStickyStory,
  footerHonestyStory,
  footerMasterDetailStory,

  // Roadmap — coming soon (RD-10…RD-14) · 5
  ...placeholders,
];
