import type { CodeEditorLspPresentation } from './types.js';

export interface SnippetInteractionState {
  readonly placeholders: readonly number[];
  readonly activePlaceholder: number;
  readonly ranges: ReadonlyMap<number, readonly [number, number]>;
}

export interface AssistanceKey {
  readonly key: string;
  readonly text?: string;
  readonly shift?: boolean;
}

export interface AssistanceKeyResult {
  readonly owner: 'completion' | 'snippet' | 'editor' | 'unhandled';
  readonly completion?: NonNullable<CodeEditorLspPresentation['completion']>;
  readonly snippet?: SnippetInteractionState;
  readonly acceptCompletion?: true;
}

/** Resolves assistance key precedence without mutating document or coordinator state. */
export function routeAssistanceKey(
  completion: CodeEditorLspPresentation['completion'],
  snippet: SnippetInteractionState | undefined,
  key: AssistanceKey,
): AssistanceKeyResult {
  if (snippet !== undefined && key.key === 'Tab') {
    const current = snippet.placeholders.indexOf(snippet.activePlaceholder);
    const next = key.shift ? Math.max(0, current - 1) : current + 1;
    return {
      owner: 'snippet',
      ...(next < snippet.placeholders.length
        ? {
            snippet: Object.freeze({
              ...snippet,
              activePlaceholder: snippet.placeholders[next] ?? snippet.placeholders[0] ?? 0,
            }),
          }
        : {}),
    };
  }
  if (completion === undefined) return { owner: 'unhandled' };
  if (key.key === 'Escape') return { owner: 'completion' };
  if (key.key === 'Enter' || key.key === 'Tab') return { owner: 'completion', acceptCompletion: true };
  if (key.key === 'ArrowDown' || key.key === 'PageDown') {
    const selected = Math.min(completion.items.length - 1, completion.selected + (key.key === 'PageDown' ? 5 : 1));
    return { owner: 'completion', completion: { ...completion, selected } };
  }
  if (key.key === 'ArrowUp' || key.key === 'PageUp') {
    const selected = Math.max(0, completion.selected - (key.key === 'PageUp' ? 5 : 1));
    return { owner: 'completion', completion: { ...completion, selected } };
  }
  if (typeof key.text === 'string' && key.text.length > 0) {
    return { owner: 'editor', completion: { ...completion, filter: completion.filter + key.text } };
  }
  return { owner: 'unhandled', completion };
}
