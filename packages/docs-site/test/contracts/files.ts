import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';

/** Observable state exposed by the forms and files family runner. */
export type FileComponentProbe =
  | StandardProbe
  | 'dialog-count'
  | 'active-dialog-title'
  | 'form-status'
  | 'file-entry-names'
  | 'directory-value'
  | 'filename-value'
  | 'file-info-text'
  | 'editor-text'
  | 'editor-modified'
  | 'error-status';

/** Form-dialog teaching behavior separates the schema preview from the real modal lifecycle. */
export const FORM_DIALOG_CONTRACT = defineBehaviorContract<
  'modal-launch' | 'schema-validation-preview' | 'coercion-preview' | 'modal-cancel',
  FileComponentProbe
>({
  exampleId: 'controls/form-dialog',
  capabilities: ['modal-launch', 'schema-validation-preview', 'coercion-preview', 'modal-cancel'],
  cases: [
    {
      id: 'launch-modal',
      covers: ['modal-launch'],
      initial: [{ probe: 'dialog-count', operator: 'equals', value: 1 }],
      actions: [{ kind: 'key', key: 'o', modifiers: ['Alt'] }],
      expected: [
        { probe: 'dialog-count', operator: 'equals', value: 2 },
        { probe: 'active-dialog-title', operator: 'contains', value: 'Profile form' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'validate-and-coerce',
      covers: ['schema-validation-preview', 'coercion-preview'],
      initial: [{ probe: 'form-status', operator: 'contains', value: 'ready' }],
      actions: [
        { kind: 'paste', text: 'Ada' },
        { kind: 'key', key: 'tab', modifiers: [] },
        { kind: 'paste', text: '42' },
        { kind: 'key', key: 's', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'form-status', operator: 'contains', value: 'Ada · 42' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'cancel-form',
      covers: ['modal-cancel'],
      initial: [{ probe: 'dialog-count', operator: 'equals', value: 1 }],
      actions: [
        { kind: 'key', key: 'o', modifiers: ['Alt'] },
        { kind: 'key', key: 'escape', modifiers: [] },
      ],
      expected: [{ probe: 'dialog-count', operator: 'equals', value: 1 }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** FileDialog lab behavior covers its composed picker, real modal launch, filtering, and read failures. */
export const FILE_DIALOG_CONTRACT = defineBehaviorContract<
  'composed-picker' | 'wildcard-filter' | 'modal-launch' | 'read-error',
  FileComponentProbe
>({
  exampleId: 'files/file-dialog',
  capabilities: ['composed-picker', 'wildcard-filter', 'modal-launch', 'read-error'],
  cases: [
    {
      id: 'browse-virtual-tree',
      covers: ['composed-picker', 'wildcard-filter'],
      initial: [{ probe: 'file-entry-names', operator: 'contains', value: 'README.md' }],
      actions: [{ kind: 'key', key: 'f', modifiers: ['Alt'] }],
      expected: [
        { probe: 'file-entry-names', operator: 'contains', value: 'main.ts' },
        { probe: 'directory-value', operator: 'contains', value: '/src' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'launch-real-dialog',
      covers: ['modal-launch'],
      initial: [{ probe: 'dialog-count', operator: 'equals', value: 1 }],
      actions: [{ kind: 'key', key: 'o', modifiers: ['Alt'] }],
      expected: [{ probe: 'dialog-count', operator: 'equals', value: 2 }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'show-read-error',
      covers: ['read-error'],
      initial: [{ probe: 'error-status', operator: 'contains', value: 'ready' }],
      actions: [{ kind: 'key', key: 'e', modifiers: ['Alt'] }],
      expected: [{ probe: 'error-status', operator: 'contains', value: 'access denied' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Change-directory lab behavior covers its reactive tree, real modal launch, preview, and faults. */
export const CHDIR_DIALOG_CONTRACT = defineBehaviorContract<
  'reactive-tree' | 'revert-preview' | 'modal-launch' | 'denied-path',
  FileComponentProbe
>({
  exampleId: 'files/chdir-dialog',
  capabilities: ['reactive-tree', 'revert-preview', 'modal-launch', 'denied-path'],
  cases: [
    {
      id: 'navigate-and-revert',
      covers: ['reactive-tree', 'revert-preview'],
      initial: [{ probe: 'directory-value', operator: 'equals', value: '/workspace' }],
      actions: [
        { kind: 'key', key: 'n', modifiers: ['Alt'] },
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'directory-value', operator: 'equals', value: '/workspace' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'launch-real-dialog',
      covers: ['modal-launch'],
      initial: [{ probe: 'dialog-count', operator: 'equals', value: 1 }],
      actions: [{ kind: 'key', key: 'o', modifiers: ['Alt'] }],
      expected: [{ probe: 'dialog-count', operator: 'equals', value: 2 }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'reject-denied-directory',
      covers: ['denied-path'],
      initial: [{ probe: 'error-status', operator: 'contains', value: 'ready' }],
      actions: [{ kind: 'key', key: 'e', modifiers: ['Alt'] }],
      expected: [{ probe: 'error-status', operator: 'contains', value: 'access denied' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** FileList behavior covers reactive scans, hidden files, filtering, and empty error state. */
export const FILE_LIST_CONTRACT = defineBehaviorContract<
  'reactive-scan' | 'hidden-files' | 'wildcard-filter' | 'empty-error',
  FileComponentProbe
>({
  exampleId: 'files/file-list',
  capabilities: ['reactive-scan', 'hidden-files', 'wildcard-filter', 'empty-error'],
  cases: [
    {
      id: 'filter-and-show-hidden',
      covers: ['reactive-scan', 'hidden-files', 'wildcard-filter'],
      initial: [{ probe: 'file-entry-names', operator: 'excludes', value: '.env' }],
      actions: [{ kind: 'key', key: 'h', modifiers: ['Alt'] }],
      expected: [{ probe: 'file-entry-names', operator: 'contains', value: '.env' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'empty-on-error',
      covers: ['empty-error'],
      initial: [{ probe: 'file-entry-names', operator: 'contains', value: 'README.md' }],
      actions: [{ kind: 'key', key: 'e', modifiers: ['Alt'] }],
      expected: [{ probe: 'file-entry-names', operator: 'equals', value: '' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** DirList behavior covers tree derivation, navigation, rerooting, and unreadable directories. */
export const DIR_LIST_CONTRACT = defineBehaviorContract<
  'directory-tree' | 'reactive-reroot' | 'ancestor-only-error',
  FileComponentProbe
>({
  exampleId: 'files/dir-list',
  capabilities: ['directory-tree', 'reactive-reroot', 'ancestor-only-error'],
  cases: [
    {
      id: 'reroot-directory',
      covers: ['directory-tree', 'reactive-reroot'],
      initial: [{ probe: 'directory-value', operator: 'equals', value: '/workspace' }],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [{ probe: 'directory-value', operator: 'equals', value: '/workspace/src' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'empty-on-error',
      covers: ['ancestor-only-error'],
      initial: [{ probe: 'file-entry-names', operator: 'contains', value: 'workspace' }],
      actions: [{ kind: 'key', key: 'e', modifiers: ['Alt'] }],
      expected: [
        { probe: 'file-entry-names', operator: 'contains', value: 'missing' },
        { probe: 'error-status', operator: 'contains', value: 'I/O error' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** FileInput behavior covers file/directory mirroring and preserving user edits while focused. */
export const FILE_INPUT_CONTRACT = defineBehaviorContract<
  'file-mirroring' | 'directory-preview' | 'focused-edit-preservation',
  FileComponentProbe
>({
  exampleId: 'files/file-input',
  capabilities: ['file-mirroring', 'directory-preview', 'focused-edit-preservation'],
  cases: [
    {
      id: 'mirror-directory',
      covers: ['file-mirroring', 'directory-preview'],
      initial: [{ probe: 'filename-value', operator: 'equals', value: 'README.md' }],
      actions: [{ kind: 'key', key: 'd', modifiers: ['Alt'] }],
      expected: [{ probe: 'filename-value', operator: 'equals', value: 'src/*.ts' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'preserve-user-edit',
      covers: ['focused-edit-preservation'],
      initial: [{ probe: 'filename-value', operator: 'equals', value: 'README.md' }],
      actions: [
        { kind: 'key', key: 'i', modifiers: ['Alt'] },
        { kind: 'key', key: 'end', modifiers: [] },
        { kind: 'key', key: '!', modifiers: [] },
        { kind: 'key', key: 'd', modifiers: ['Alt'] },
      ],
      expected: [{ probe: 'filename-value', operator: 'contains', value: '!' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** FileInfoPane behavior covers path expansion, metadata, reactive focus, and broken links. */
export const FILE_INFO_CONTRACT = defineBehaviorContract<
  'search-path' | 'metadata' | 'reactive-focus' | 'broken-link',
  FileComponentProbe
>({
  exampleId: 'files/file-info-pane',
  capabilities: ['search-path', 'metadata', 'reactive-focus', 'broken-link'],
  cases: [
    {
      id: 'change-focused-entry',
      covers: ['search-path', 'metadata', 'reactive-focus'],
      initial: [{ probe: 'file-info-text', operator: 'contains', value: 'README.md' }],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [{ probe: 'file-info-text', operator: 'contains', value: 'main.ts' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'show-broken-link-name-only',
      covers: ['broken-link'],
      initial: [{ probe: 'file-info-text', operator: 'contains', value: 'README.md' }],
      actions: [{ kind: 'key', key: 'b', modifiers: ['Alt'] }],
      expected: [{ probe: 'file-info-text', operator: 'contains', value: 'missing-link' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** FileEditor behavior covers loading, exact saves, backups, write errors, and modified state. */
export const FILE_EDITOR_CONTRACT = defineBehaviorContract<
  'load' | 'save' | 'backup' | 'write-error' | 'modified-state',
  FileComponentProbe
>({
  exampleId: 'files/file-editor',
  capabilities: ['load', 'save', 'backup', 'write-error', 'modified-state'],
  cases: [
    {
      id: 'edit-and-save',
      covers: ['load', 'save', 'backup', 'modified-state'],
      initial: [{ probe: 'editor-modified', operator: 'equals', value: false }],
      actions: [
        { kind: 'key', key: 'end', modifiers: ['Ctrl'] },
        { kind: 'key', key: '!', modifiers: [] },
        { kind: 'key', key: 's', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'editor-modified', operator: 'equals', value: false },
        { probe: 'rendered-text', operator: 'contains', value: 'backup ready' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'report-write-error',
      covers: ['write-error'],
      initial: [{ probe: 'error-status', operator: 'contains', value: 'ready' }],
      actions: [{ kind: 'key', key: 'e', modifiers: ['Alt'] }],
      expected: [{ probe: 'error-status', operator: 'contains', value: 'write failed' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Exact ordered forms/files example and catalog population. */
export const FILE_EXAMPLE_IDS = [
  'controls/form-dialog',
  'files/file-dialog',
  'files/chdir-dialog',
  'files/file-list',
  'files/dir-list',
  'files/file-input',
  'files/file-info-pane',
  'files/file-editor',
] as const;

/** Exact ordered catalog population for the forms/files migration. */
export const FILE_CATALOG_ENTRY_IDS = FILE_EXAMPLE_IDS;

/** Complete immutable behavior-contract set for the forms/files family. */
export const FILE_CONTRACTS = [
  FORM_DIALOG_CONTRACT,
  FILE_DIALOG_CONTRACT,
  CHDIR_DIALOG_CONTRACT,
  FILE_LIST_CONTRACT,
  DIR_LIST_CONTRACT,
  FILE_INPUT_CONTRACT,
  FILE_INFO_CONTRACT,
  FILE_EDITOR_CONTRACT,
] as const;
