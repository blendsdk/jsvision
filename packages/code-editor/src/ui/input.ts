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
  const name = key.key.length === 1 ? key.key.toUpperCase() : key.key;
  parts.push(name);
  return parts.join('+');
}

/** Default keyboard-only command map. */
export const defaultCodeEditorKeyBindings: Readonly<Record<string, CodeEditorCommand>> = Object.freeze({
  End: 'cursor.documentEnd',
  'Ctrl+F': 'search.open',
  Enter: 'search.next',
  'Ctrl+[': 'fold.toggle',
  'Ctrl+ ': 'assist',
  F12: 'navigate',
  'Alt+Shift+F': 'format',
  'Ctrl+S': 'save',
  'Ctrl+W': 'close',
});
