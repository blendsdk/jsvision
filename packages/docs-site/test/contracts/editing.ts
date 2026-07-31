import { defineBehaviorContract } from './_contract.js';
import type { StandardProbe } from './_contract.js';

/** Observable state exposed by the surface, editing, and terminal family runner. */
export type EditingProbe =
  | StandardProbe
  | 'surface-width'
  | 'surface-height'
  | 'surface-delta-x'
  | 'surface-view-text'
  | 'editor-text'
  | 'editor-modified'
  | 'editor-can-undo'
  | 'memo-value'
  | 'window-width'
  | 'edit-window-scroll-bars-visible'
  | 'terminal-visible-text';

/** Surface behavior covers sanitized drawing, preserved resize, and clear. */
export const SURFACE_CONTRACT = defineBehaviorContract<
  'offscreen-drawing' | 'preserving-resize' | 'sanitized-cells' | 'clear',
  EditingProbe
>({
  exampleId: 'surface/surface',
  capabilities: ['offscreen-drawing', 'preserving-resize', 'sanitized-cells', 'clear'],
  cases: [
    {
      id: 'grow-preserves-content',
      covers: ['offscreen-drawing', 'preserving-resize', 'sanitized-cells'],
      initial: [
        { probe: 'surface-width', operator: 'equals', value: 28 },
        { probe: 'rendered-text', operator: 'contains', value: 'SAFE CELL' },
      ],
      actions: [{ kind: 'key', key: 'g', modifiers: ['Alt'] }],
      expected: [
        { probe: 'surface-width', operator: 'equals', value: 36 },
        { probe: 'rendered-text', operator: 'contains', value: 'SAFE CELL' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'clear-buffer',
      covers: ['clear'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: 'SAFE CELL' }],
      actions: [{ kind: 'key', key: 'c', modifiers: ['Alt'] }],
      expected: [
        { probe: 'surface-view-text', operator: 'excludes', value: 'SAFE CELL' },
        { probe: 'rendered-text', operator: 'contains', value: 'Surface cleared' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** SurfaceView behavior covers viewport clipping, clamped panning, and reset. */
export const SURFACE_VIEW_CONTRACT = defineBehaviorContract<
  'viewport-clipping' | 'clamped-panning' | 'reactive-delta',
  EditingProbe
>({
  exampleId: 'surface/surface-view',
  capabilities: ['viewport-clipping', 'clamped-panning', 'reactive-delta'],
  cases: [
    {
      id: 'pan-viewport',
      covers: ['viewport-clipping', 'clamped-panning', 'reactive-delta'],
      initial: [
        { probe: 'surface-delta-x', operator: 'equals', value: 0 },
        { probe: 'surface-view-text', operator: 'contains', value: '00  0123456789' },
      ],
      actions: [{ kind: 'key', key: 'p', modifiers: ['Alt'] }],
      expected: [
        { probe: 'surface-delta-x', operator: 'equals', value: 8 },
        { probe: 'surface-view-text', operator: 'contains', value: '456789012345' },
        { probe: 'surface-view-text', operator: 'excludes', value: '00  0123456789' },
        { probe: 'rendered-text', operator: 'contains', value: 'Offset: 8,2' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Editor behavior covers text input, selection clipboard, undo, and reset. */
export const EDITOR_CONTRACT = defineBehaviorContract<
  'multiline-editing' | 'undo-redo' | 'shared-clipboard' | 'reactive-state',
  EditingProbe
>({
  exampleId: 'editor/editor',
  capabilities: ['multiline-editing', 'undo-redo', 'shared-clipboard', 'reactive-state'],
  cases: [
    {
      id: 'type-and-undo',
      covers: ['multiline-editing', 'undo-redo', 'reactive-state'],
      initial: [{ probe: 'editor-modified', operator: 'equals', value: false }],
      actions: [
        { kind: 'key', key: 'x', modifiers: [] },
        { kind: 'key', key: 'z', modifiers: ['Ctrl'] },
      ],
      expected: [
        { probe: 'editor-text', operator: 'contains', value: 'Edit this document' },
        { probe: 'editor-can-undo', operator: 'equals', value: false },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'copy-and-paste',
      covers: ['shared-clipboard'],
      initial: [{ probe: 'editor-text', operator: 'contains', value: 'Edit this document' }],
      actions: [
        { kind: 'key', key: 'a', modifiers: ['Ctrl'] },
        { kind: 'key', key: 'c', modifiers: ['Ctrl'] },
        { kind: 'key', key: 'end', modifiers: ['Ctrl'] },
        { kind: 'key', key: 'v', modifiers: ['Ctrl'] },
      ],
      expected: [{ probe: 'editor-text', operator: 'contains', value: 'navigation.Edit this document' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Memo behavior covers two-way signal binding and dialog-friendly focus traversal. */
export const MEMO_CONTRACT = defineBehaviorContract<
  'two-way-binding' | 'external-replacement' | 'tab-traversal',
  EditingProbe
>({
  exampleId: 'editor/memo',
  capabilities: ['two-way-binding', 'external-replacement', 'tab-traversal'],
  cases: [
    {
      id: 'edit-bound-value',
      covers: ['two-way-binding'],
      initial: [{ probe: 'memo-value', operator: 'equals', value: 'Initial notes' }],
      actions: [{ kind: 'key', key: '!', modifiers: [] }],
      expected: [{ probe: 'memo-value', operator: 'contains', value: '!' }],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'replace-and-tab-away',
      covers: ['external-replacement', 'tab-traversal'],
      initial: [{ probe: 'focused-view', operator: 'equals', value: 'Memo' }],
      actions: [
        { kind: 'key', key: 'r', modifiers: ['Alt'] },
        { kind: 'key', key: 'tab', modifiers: [] },
      ],
      expected: [
        { probe: 'memo-value', operator: 'equals', value: 'Replaced from the signal' },
        { probe: 'focused-view', operator: 'equals', value: 'Button' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** EditWindow behavior covers hosted editing, indicator state, and window zoom. */
export const EDIT_WINDOW_CONTRACT = defineBehaviorContract<
  'hosted-editor' | 'scroll-gadgets' | 'indicator' | 'zoom',
  EditingProbe
>({
  exampleId: 'editor/edit-window',
  capabilities: ['hosted-editor', 'scroll-gadgets', 'indicator', 'zoom'],
  cases: [
    {
      id: 'edit-and-zoom',
      covers: ['hosted-editor', 'scroll-gadgets', 'indicator', 'zoom'],
      initial: [
        { probe: 'editor-modified', operator: 'equals', value: false },
        { probe: 'rendered-text', operator: 'contains', value: '1:1' },
        { probe: 'edit-window-scroll-bars-visible', operator: 'equals', value: true },
      ],
      actions: [
        { kind: 'key', key: 'x', modifiers: [] },
        { kind: 'key', key: 'z', modifiers: ['Alt'] },
      ],
      expected: [
        { probe: 'editor-modified', operator: 'equals', value: true },
        { probe: 'window-width', operator: 'greater-than', value: 50 },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Indicator behavior covers passive caret/modified presentation. */
export const INDICATOR_CONTRACT = defineBehaviorContract<
  'caret-position' | 'modified-marker' | 'passive-view',
  EditingProbe
>({
  exampleId: 'editor/indicator',
  capabilities: ['caret-position', 'modified-marker', 'passive-view'],
  cases: [
    {
      id: 'update-indicator',
      covers: ['caret-position', 'modified-marker', 'passive-view'],
      initial: [{ probe: 'rendered-text', operator: 'contains', value: '1:1' }],
      actions: [{ kind: 'key', key: 'n', modifiers: ['Alt'] }],
      expected: [
        { probe: 'rendered-text', operator: 'contains', value: '12:34' },
        { probe: 'rendered-text', operator: 'contains', value: '*' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Terminal behavior covers safe streaming, bounded history, wheel scrollback, and clearing. */
export const TERMINAL_CONTRACT = defineBehaviorContract<
  'streaming-writer' | 'safe-text' | 'scrollback' | 'clear',
  EditingProbe
>({
  exampleId: 'terminal/terminal',
  capabilities: ['streaming-writer', 'safe-text', 'scrollback', 'clear'],
  cases: [
    {
      id: 'append-safe-output',
      covers: ['streaming-writer', 'safe-text'],
      initial: [{ probe: 'terminal-visible-text', operator: 'excludes', value: 'job complete' }],
      actions: [{ kind: 'key', key: 'w', modifiers: ['Alt'] }],
      expected: [
        { probe: 'terminal-visible-text', operator: 'contains', value: 'job complete' },
        { probe: 'terminal-visible-text', operator: 'contains', value: 'newest output' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'scroll-back',
      covers: ['scrollback'],
      initial: [{ probe: 'terminal-visible-text', operator: 'contains', value: 'newest output' }],
      actions: [{ kind: 'mouse', gesture: 'wheel', at: { x: 20, y: 10 }, delta: -1 }],
      expected: [
        { probe: 'terminal-visible-text', operator: 'contains', value: 'history line 1' },
        { probe: 'terminal-visible-text', operator: 'excludes', value: 'newest output' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
    {
      id: 'clear-output',
      covers: ['clear'],
      initial: [{ probe: 'terminal-visible-text', operator: 'contains', value: 'newest output' }],
      actions: [{ kind: 'key', key: 'c', modifiers: ['Alt'] }],
      expected: [
        { probe: 'terminal-visible-text', operator: 'excludes', value: 'history line' },
        { probe: 'terminal-visible-text', operator: 'excludes', value: 'newest output' },
        { probe: 'rendered-text', operator: 'contains', value: 'Terminal cleared' },
      ],
      reset: 'rebuild-example',
      dispose: 'after-case',
    },
  ],
});

/** Exact ordered surface, editing, and terminal example population. */
export const EDITING_EXAMPLE_IDS = [
  'surface/surface',
  'surface/surface-view',
  'editor/editor',
  'editor/memo',
  'editor/edit-window',
  'editor/indicator',
  'terminal/terminal',
] as const;

/** Exact ordered surface, editing, and terminal catalog population. */
export const EDITING_CATALOG_ENTRY_IDS = EDITING_EXAMPLE_IDS;

/** Complete immutable behavior-contract set for this family. */
export const EDITING_CONTRACTS = [
  SURFACE_CONTRACT,
  SURFACE_VIEW_CONTRACT,
  EDITOR_CONTRACT,
  MEMO_CONTRACT,
  EDIT_WINDOW_CONTRACT,
  INDICATOR_CONTRACT,
  TERMINAL_CONTRACT,
] as const;
