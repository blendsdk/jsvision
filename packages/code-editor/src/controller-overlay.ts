import type { CodeEditorLimits } from './limits.js';
import type { CodeEditorLspStateSnapshot } from './lsp/types.js';
import { renderSafeMarkdown, sanitizeProtocolText } from './lsp/validation.js';
import type { CodeEditorOverlayPresentation } from './presentation.js';

/** Action returned by pure overlay key routing for the controller facade to execute. */
export type CodeEditorOverlayAction =
  | { readonly kind: 'dismiss' }
  | { readonly kind: 'choose-navigation'; readonly index: number }
  | { readonly kind: 'choose-symbol'; readonly index: number };

/** Pure result of routing one key against a non-completion assistance overlay. */
export interface CodeEditorOverlayKeyResult {
  readonly owner: 'completion' | 'dismissal' | 'unhandled';
  readonly overlay?: CodeEditorOverlayPresentation;
  readonly action?: CodeEditorOverlayAction;
}

/** Creates a terminal-safe one-row diagnostic detail overlay. */
export function createDiagnosticOverlay(
  severity: 'error' | 'warning' | 'information' | 'hint',
  message: string,
  width: number,
): CodeEditorOverlayPresentation {
  const detail = renderSafeMarkdown(message, width).text;
  return Object.freeze({
    kind: 'diagnostic',
    items: Object.freeze([`[${severity}] ${detail}`]),
    selected: 0,
  });
}

/**
 * Projects the highest-priority non-completion protocol surface into the shared terminal popup.
 *
 * Existing diagnostic detail remains visible until a caret, document, or diagnostics transition
 * explicitly dismisses it.
 */
export function synchronizeCodeEditorOverlay(
  state: CodeEditorLspStateSnapshot | undefined,
  current: CodeEditorOverlayPresentation | undefined,
  limits: Pick<CodeEditorLimits, 'completionItems' | 'popupWidth'>,
): CodeEditorOverlayPresentation | undefined {
  const presentation = state?.presentation;
  if (presentation?.navigationChooser !== undefined) {
    const selected = current?.kind === 'navigation' ? current.selected : 0;
    return Object.freeze({
      kind: 'navigation',
      items: Object.freeze(
        presentation.navigationChooser.items.map(
          (item) =>
            `${sanitizeProtocolText(item.uri, limits.popupWidth) ?? ''}:${item.range.start.line + 1}:${
              item.range.start.character + 1
            }`,
        ),
      ),
      selected: Math.min(selected, Math.max(0, presentation.navigationChooser.items.length - 1)),
    });
  }
  if (presentation?.symbolChooser !== undefined) {
    const selected = current?.kind === 'symbols' ? current.selected : 0;
    return Object.freeze({
      kind: 'symbols',
      items: Object.freeze(presentation.symbolChooser.items.map((item) => item.label)),
      selected: Math.min(selected, Math.max(0, presentation.symbolChooser.items.length - 1)),
    });
  }
  if (presentation?.hover !== undefined) {
    return Object.freeze({
      kind: 'hover',
      items: Object.freeze(presentation.hover.text.split('\n').slice(0, limits.completionItems)),
      selected: 0,
    });
  }
  if (presentation?.signature !== undefined) {
    return Object.freeze({
      kind: 'signature',
      items: presentation.signature.lines,
      selected: 0,
    });
  }
  return current?.kind === 'diagnostic' ? current : undefined;
}

/** Routes chooser navigation and dismissal without touching controller or protocol state. */
export function routeCodeEditorOverlayKey(
  overlay: CodeEditorOverlayPresentation | undefined,
  key: { readonly key: string },
): CodeEditorOverlayKeyResult {
  if (overlay === undefined) return Object.freeze({ owner: 'unhandled' });
  if (key.key === 'Escape') {
    return Object.freeze({ owner: 'dismissal', action: Object.freeze({ kind: 'dismiss' }) });
  }
  const chooser = overlay.kind === 'navigation' || overlay.kind === 'symbols';
  if (chooser && (key.key === 'ArrowDown' || key.key === 'PageDown' || key.key === 'ArrowUp' || key.key === 'PageUp')) {
    const delta = key.key === 'ArrowDown' ? 1 : key.key === 'PageDown' ? 5 : key.key === 'ArrowUp' ? -1 : -5;
    return Object.freeze({
      owner: 'completion',
      overlay: Object.freeze({
        ...overlay,
        selected: Math.max(0, Math.min(overlay.items.length - 1, overlay.selected + delta)),
      }),
    });
  }
  if (chooser && (key.key === 'Enter' || key.key === 'Tab')) {
    return Object.freeze({
      owner: 'completion',
      action: Object.freeze({
        kind: overlay.kind === 'navigation' ? 'choose-navigation' : 'choose-symbol',
        index: overlay.selected,
      }),
    });
  }
  return Object.freeze({ owner: 'unhandled', overlay });
}
