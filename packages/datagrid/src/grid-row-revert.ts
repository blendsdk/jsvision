/**
 * Container integration for bounded row-edit sessions and their optimistic revert transaction.
 *
 * The core session and transaction controllers remain view-free in `row-revert.ts`. This adapter owns
 * the repetitive Data Grid wiring: source identity lookup, dirty/error registries, localized feedback,
 * and the distinction between the raw validation message exposed by `activeMessage()` and the recovery
 * hint rendered in the message band.
 */
import type { I18n } from '@jsvision/i18n';
import type { OnRevertRow } from './commit.js';
import type { GridDataSource } from './data-source.js';
import type { DirtyRegistry } from './editing.js';
import { cellKey } from './editing.js';
import type { ErrorRegistry } from './error-registry.js';
import { DATAGRID_ENGLISH_CATALOG } from './i18n/catalog.js';
import { createRowRevertController, createRowRevertTransactionController } from './row-revert.js';
import type { AcceptedCellCommit } from './row-revert.js';
import type { Key } from './selection.js';

/** Live container dependencies needed by the row-revert integration. */
interface GridRowRevertDeps<T> {
  readonly enabled: boolean;
  readonly source: GridDataSource<T>;
  readonly display: () => T[];
  readonly i18n: I18n;
  readonly onRevertRow?: OnRevertRow<T>;
  readonly internalAllowed: boolean;
  readonly focusedRow: () => T | undefined;
  readonly focusedKey: () => Key | undefined;
  readonly bodyFocused: () => boolean;
  readonly dirty: DirtyRegistry;
  readonly errors: ErrorRegistry;
  readonly bumpVersion: () => void;
}

/** Thin surface consumed by the grid constructor, row gate, body, and mutation methods. */
export interface GridRowRevert<T> {
  /** Record a successfully accepted editable-cell commit. */
  recordCommit(change: AcceptedCellCommit<T>): void;
  /** Whether the exact focused visit contains accepted edits. */
  isTouched(rowKey: Key, row: T): boolean;
  /** Mark an exact edited row trapped after validation blocks a leave. */
  markTrapped(rowKey: Key, row: T): void;
  /** Release an exact session after validation permits the leave. */
  release(rowKey: Key, row: T): void;
  /** Whether the exact row can currently start a revert. */
  canStart(rowKey: Key, row: T): boolean;
  /** Start the exact eligible row's transaction. */
  start(rowKey: Key, row: T): void;
  /** Whether the transaction currently serializes grid-owned input. */
  isPending(): boolean;
  /** Reconcile session and presentation ownership with the newly focused exact row. */
  reconcile(rowKey: Key | undefined, row: T | undefined): void;
  /** Invalidate selected keys before row mutation. */
  invalidate(keys: ReadonlySet<Key>): void;
  /** Dispose session and transaction ownership. */
  dispose(): void;
  /** Capture a sanitized raw validation message and its localized band presentation. */
  trapMessage(message: string): string;
  /** Resolve the message band's visible value without changing the public raw active message. */
  displayMessage(active: string | null): string | null;
}

/** Find the exact row currently published by a source, independent of a derived display cache. */
function sourceRow<T>(source: GridDataSource<T>, rowKey: Key): T | undefined {
  for (let index = 0; index < source.length(); index += 1) {
    const row = source.rowAt(index);
    if (row !== undefined && source.rowKey(row) === rowKey) return row;
  }
  return undefined;
}

/** Resolve one package-owned message with its canonical English fallback. */
function text(i18n: I18n, key: keyof typeof DATAGRID_ENGLISH_CATALOG.messages): string {
  return i18n.t(key, { defaultMessage: DATAGRID_ENGLISH_CATALOG.messages[key] });
}

/** Create the Data Grid adapter around the view-free row-revert controllers. */
export function createGridRowRevert<T>(deps: GridRowRevertDeps<T>): GridRowRevert<T> {
  const sessions = createRowRevertController<T>(deps.enabled);
  let trapped: { readonly raw: string; readonly display: string } | undefined;
  const transaction = createRowRevertTransactionController({
    sessions,
    onRevertRow: deps.onRevertRow,
    internalAllowed: deps.internalAllowed,
    sourceRow: (key) => sourceRow(deps.source, key),
    displayedRow: (key) => deps.display().find((row) => deps.source.rowKey(row) === key),
    focusedRow: deps.focusedRow,
    focusedKey: deps.focusedKey,
    bodyFocused: deps.bodyFocused,
    addDirty: deps.dirty.add,
    deleteDirty: deps.dirty.delete,
    clearError: deps.errors.clear,
    activeMessage: deps.errors.active,
    note: deps.errors.note,
    bumpVersion: deps.bumpVersion,
    cellKey,
    messages: {
      pending: text(deps.i18n, 'datagrid.revert.pending'),
      failed: text(deps.i18n, 'datagrid.revert.failed'),
      unavailable: text(deps.i18n, 'datagrid.revert.unavailable'),
    },
  });

  return {
    recordCommit: sessions.recordCommit,
    isTouched: sessions.isTouched,
    markTrapped: sessions.markTrapped,
    release(rowKey, row): void {
      trapped = undefined;
      sessions.release(rowKey, row);
    },
    canStart: sessions.isTrapped,
    start(rowKey, row): void {
      transaction.start(rowKey, row);
    },
    isPending: transaction.isPending,
    reconcile(rowKey, row): void {
      transaction.reconcile(rowKey, row);
      sessions.reconcileFocus(rowKey, row);
      if (rowKey === undefined || row === undefined) trapped = undefined;
    },
    invalidate(keys): void {
      transaction.invalidate(keys);
      sessions.invalidate(keys);
    },
    dispose(): void {
      transaction.dispose();
      sessions.dispose();
      trapped = undefined;
    },
    trapMessage(message): string {
      trapped = {
        raw: message,
        display: deps.i18n.t('datagrid.validation.row-trapped', {
          defaultMessage: DATAGRID_ENGLISH_CATALOG.messages['datagrid.validation.row-trapped'],
          params: { message },
        }),
      };
      return message;
    },
    displayMessage(active): string | null {
      return trapped !== undefined && active === trapped.raw ? trapped.display : active;
    },
  };
}
