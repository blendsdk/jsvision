/** Public keyboard input accepted by the code editor. */
export interface CodeEditorKey {
  readonly key: string;
  readonly text?: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
}

/** Stable command identifiers used by replaceable bindings. */
export type CodeEditorCommand =
  | 'cursor.documentEnd'
  | 'search.open'
  | 'search.next'
  | 'fold.toggle'
  | 'fold.collapse'
  | 'fold.expand'
  | 'fold.collapseAll'
  | 'fold.expandAll'
  | 'assist'
  | 'navigate'
  | 'format'
  | 'save'
  | 'close';

/** Converts a key into a canonical replaceable binding token. */
export function codeEditorKeyToken(key: CodeEditorKey): string {
  const parts: string[] = [];
  if (key.ctrl) parts.push('Ctrl');
  if (key.alt) parts.push('Alt');
  if (key.shift) parts.push('Shift');
  const canonical = canonicalCodeEditorKeyName(key.key);
  const name = canonical.length === 1 ? canonical.toUpperCase() : canonical;
  parts.push(name);
  return parts.join('+');
}

/** Normalizes public protocol names and lowercase terminal-decoder names to one spelling. */
export function canonicalCodeEditorKeyName(key: string): string {
  const lower = key.toLowerCase();
  const named: Readonly<Record<string, string>> = {
    arrowdown: 'ArrowDown',
    down: 'ArrowDown',
    arrowleft: 'ArrowLeft',
    left: 'ArrowLeft',
    arrowright: 'ArrowRight',
    right: 'ArrowRight',
    arrowup: 'ArrowUp',
    up: 'ArrowUp',
    backspace: 'Backspace',
    delete: 'Delete',
    end: 'End',
    enter: 'Enter',
    escape: 'Escape',
    home: 'Home',
    space: ' ',
    tab: 'Tab',
  };
  return named[lower] ?? (lower.startsWith('f') && /^f\\d{1,2}$/u.test(lower) ? lower.toUpperCase() : key);
}

/** Default keyboard-only command map. */
export const defaultCodeEditorKeyBindings: Readonly<Record<string, CodeEditorCommand>> = Object.freeze({
  'Ctrl+End': 'cursor.documentEnd',
  'Ctrl+F': 'search.open',
  F3: 'search.next',
  'Ctrl+[': 'fold.toggle',
  'Ctrl+ ': 'assist',
  F12: 'navigate',
  'Alt+Shift+F': 'format',
  'Ctrl+S': 'save',
  'Ctrl+W': 'close',
});
