# Data Grid Escape-to-Revert Implementation Plan

> **Feature**: Escape restores a trapped Data Grid row through an atomic rollback contract
> **Status**: Planning Complete
> **Created**: 2026-08-03
> **CodeOps Artifact Schema**: 1

## Overview

`validateRow` intentionally commits individually valid cell edits before it evaluates a cross-field
row rule. When the row fails, navigation is trapped so the user can complete a multi-field
correction. GitHub issue #100 identifies the missing recovery path: after the editor closes, Escape
cannot restore the row's last valid values.

This standalone plan adds a bounded row edit-session journal, a remappable body-level Escape action,
and an atomic `onRevertRow` persistence seam. It preserves the existing commit-then-trap contract,
editor Escape priority, stable-key behavior, and the host application's authority over persistence
(AR-1, AR-3..AR-12).

## Document Index

| # | Document | Description |
|---|----------|-------------|
| AR | [Ambiguity Register](00-ambiguity-register.md) | User-confirmed scope and design decisions |
| 00 | [Index](00-index.md) | Overview and navigation |
| 01 | [Requirements](01-requirements.md) | Owning feature requirements and acceptance criteria |
| 02 | [Current State](02-current-state.md) | Verified implementation, tests, docs, and gaps |
| 03-01 | [Row Edit Sessions](03-01-row-edit-sessions.md) | Baseline journal, trap lifecycle, and invalidation |
| 03-02 | [Rollback Transaction and Input](03-02-rollback-transaction-and-input.md) | Public callback, async flow, keymap, and feedback |
| 03-03 | [Documentation and Distribution](03-03-documentation-and-distribution.md) | Showcase, docs-site, API, locales, and plugin synchronization |
| 07 | [Testing Strategy](07-testing-strategy.md) | Specification cases and verification matrix |
| 99 | [Execution Plan](99-execution-plan.md) | Specification-first phased task checklist |

## Quick Reference

### Usage Example

```ts
import { EditableDataGrid } from '@jsvision/datagrid';
import type { OnRevertRow } from '@jsvision/datagrid';

const onRevertRow: OnRevertRow<Booking> = async (change) => {
  return bookings.rollbackColumns(change.rowKey, change.cells);
};

const grid = new EditableDataGrid({
  columns,
  source,
  validateRow: validateBooking,
  onCommit: persistCell,
  onRevertRow,
});
```

The callback and payload contract are owned by
[03-02 § Public transaction contract](03-02-rollback-transaction-and-input.md#public-transaction-contract).

### Key Decisions

| Decision | Outcome |
|----------|---------|
| Row baseline | Earliest value per successfully committed column; never clone `T` (AR-6) |
| Revert eligibility | Only a session that has failed a row leave; cleared by successful leave (AR-3) |
| Persistence | One atomic `onRevertRow`; no per-cell replay or persistence bypass (AR-5, AR-8) |
| Keyboard | Default `escape → revertRow`, with editor priority and caller remapping (AR-4, AR-12) |
| Async failure | Optimistic apply, compensation on veto, retryable trap (AR-10) |
| Distribution | Public API, all official locales, showcase/docs, canonical skill, generated plugin (AR-13, AR-14) |

## Related Files

- `packages/datagrid/src/row-revert.ts`
- `packages/datagrid/src/editing.ts`
- `packages/datagrid/src/validation.ts`
- `packages/datagrid/src/editable-grid-rows.ts`
- `packages/datagrid/src/grid.ts`
- `packages/datagrid/src/keymap.ts`
- `packages/datagrid/src/i18n/`
- `packages/datagrid/src/index.ts`
- `packages/datagrid/test/`
- `packages/examples/datagrid-showcase/stories/validation-lifecycle/row-gate.story.ts`
- `packages/docs-site/src/example-fixtures/data-grid/`
- `packages/docs-site/components/data-grid/validation-and-lifecycle.md`
- `tools/jsvision-skill/references/datagrid.md`
- generated API and plugin outputs owned by `yarn plugin:update`
