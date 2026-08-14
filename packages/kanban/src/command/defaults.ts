import { createKeymap } from '@jsvision/core';

/** Host facts used to resolve semantic `Primary` bindings. */
export interface KanbanActionKeymapHost {
  /** Browser hosts can preserve Command/Meta; terminal hosts cannot. */
  readonly kind: 'browser' | 'terminal';
  /** Lowercase operating-system platform name such as `linux` or `darwin`. */
  readonly platform: string;
  /** Host-reserved chords that cannot reliably reach the application. */
  readonly unavailableChords?: readonly string[];
}

/** Concrete modifier used for semantic `Primary` on one host. */
export type KanbanPrimaryModifier = 'ctrl' | 'meta';

/** Stable presentation order for the conservative package-owned default bindings. */
export const KANBAN_DEFAULT_ACTION_CHORDS = Object.freeze([
  'left',
  'right',
  'up',
  'down',
  'home',
  'end',
  'pageup',
  'pagedown',
  'primary+home',
  'primary+end',
  'enter',
  'space',
  'shift+left',
  'shift+right',
  'shift+up',
  'shift+down',
  'primary+a',
  'primary+f',
  'insert',
  'alt+m',
  'escape',
  'shift+f10',
  'f1',
  'primary+z',
  'primary+y',
] as const);

/** Resolves Command only where a macOS browser can preserve it, and Ctrl everywhere else. */
export function resolveKanbanPrimaryModifier(host: KanbanActionKeymapHost): KanbanPrimaryModifier {
  return host.kind === 'browser' && host.platform.toLowerCase() === 'darwin' ? 'meta' : 'ctrl';
}

/**
 * Resolves and canonicalizes one semantic chord using the same grammar as Core keymaps.
 *
 * Constructing a one-entry Core keymap performs the authoritative grammar validation. The local
 * canonical form is then used for deterministic conflict reporting and visible help.
 */
export function normalizeKanbanActionChord(chord: string, primary: KanbanPrimaryModifier): string {
  createKeymap({ [chord]: 'validated' }, { primary });
  const parts = chord.toLowerCase().split('+');
  const key = parts.at(-1) ?? '';
  const modifiers = new Set(parts.slice(0, -1));
  if (modifiers.has('primary')) modifiers.add(primary);
  modifiers.delete('primary');
  return `${modifiers.has('ctrl') ? 'ctrl+' : ''}${modifiers.has('alt') ? 'alt+' : ''}${modifiers.has('shift') ? 'shift+' : ''}${modifiers.has('meta') ? 'meta+' : ''}${key}`;
}

/** Human-friendly names for non-character keys shown in contextual help. */
const KEY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  escape: 'Esc',
  enter: 'Enter',
  space: 'Space',
  insert: 'Insert',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  tab: 'Tab',
  backspace: 'Backspace',
});

/** Formats one already-normalized concrete chord for visible help and menus. */
export function formatKanbanActionChord(chord: string): string {
  const parts = chord.split('+');
  const key = parts.at(-1) ?? '';
  const modifiers = parts.slice(0, -1).map((modifier) => {
    if (modifier === 'ctrl') return 'Ctrl';
    if (modifier === 'alt') return 'Alt';
    if (modifier === 'shift') return 'Shift';
    if (modifier === 'meta') return 'Command';
    return modifier;
  });
  const keyLabel = KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key.toUpperCase());
  return [...modifiers, keyLabel].join('+');
}
