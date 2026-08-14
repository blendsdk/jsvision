/** Specification oracle for conflict-safe semantic-Primary Kanban keymaps and reactive help. */
import { describe, expect, it, vi } from 'vitest';

import { createKanbanActionKeymap, createKanbanActionRegistry } from '../src/index.js';
import type { KanbanActionDefinition, KanbanActionKeyEvent } from '../src/index.js';

/** Produces a normalized raw key event without relying on a host event loop. */
function key(
  value: string,
  modifiers: Partial<Pick<KanbanActionKeyEvent, 'ctrl' | 'alt' | 'shift' | 'meta'>> = {},
): KanbanActionKeyEvent {
  return {
    type: 'key',
    key: value,
    ctrl: modifiers.ctrl ?? false,
    alt: modifiers.alt ?? false,
    shift: modifiers.shift ?? false,
    meta: modifiers.meta ?? false,
  };
}

/** Builds one immutable namespaced application action for conflict and override tests. */
function extension(id: string, bindings: readonly string[]): KanbanActionDefinition {
  return {
    id,
    category: 'application',
    labelMessageId: `${id}.label`,
    helpMessageId: `${id}.help`,
    target: 'board',
    capability: id,
    bindings,
    handler: () => ({ kind: 'handled' }),
  };
}

describe('Kanban action keymap', () => {
  it('owns the complete conservative default table without binding destructive configuration actions', () => {
    const registry = createKanbanActionRegistry({ executePackageAction: () => ({ kind: 'handled' }) });
    const keymap = createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'linux' } });

    const defaults = [
      ['left', 'kanban.navigation.left'],
      ['right', 'kanban.navigation.right'],
      ['up', 'kanban.navigation.up'],
      ['down', 'kanban.navigation.down'],
      ['home', 'kanban.navigation.cell-first'],
      ['end', 'kanban.navigation.cell-last'],
      ['pageup', 'kanban.navigation.page-up'],
      ['pagedown', 'kanban.navigation.page-down'],
      ['ctrl+home', 'kanban.navigation.board-first'],
      ['ctrl+end', 'kanban.navigation.board-last'],
      ['enter', 'kanban.card.activate'],
      ['space', 'kanban.selection.toggle'],
      ['shift+left', 'kanban.selection.extend-left'],
      ['shift+right', 'kanban.selection.extend-right'],
      ['shift+up', 'kanban.selection.extend-up'],
      ['shift+down', 'kanban.selection.extend-down'],
      ['ctrl+a', 'kanban.selection.select-all'],
      ['ctrl+f', 'kanban.search.focus'],
      ['insert', 'kanban.card.create'],
      ['alt+m', 'kanban.card.grab'],
      ['escape', 'kanban.transient.cancel'],
      ['shift+f10', 'kanban.context.open'],
      ['f1', 'kanban.help.open'],
      ['ctrl+z', 'kanban.history.undo'],
      ['ctrl+y', 'kanban.history.redo'],
    ] as const;
    expect(keymap.snapshot().bindings.map(({ chord, actionId }) => [chord, actionId])).toEqual(defaults);
    expect(keymap.snapshot().bindings.some(({ actionId }) => actionId.includes('delete'))).toBe(false);
    expect(keymap.snapshot().bindings.some(({ actionId }) => actionId.includes('configure'))).toBe(false);
  });

  it('resolves semantic Primary to Meta on capable macOS browsers and Ctrl elsewhere', () => {
    const registry = createKanbanActionRegistry({ executePackageAction: () => ({ kind: 'handled' }) });
    const mac = createKanbanActionKeymap({ registry, host: { kind: 'browser', platform: 'darwin' } });
    const terminal = createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'darwin' } });

    expect(mac.resolve(key('f', { meta: true }))).toBe('kanban.search.focus');
    expect(mac.resolve(key('f', { ctrl: true }))).toBeUndefined();
    expect(mac.help('kanban.search.focus')).toBe('Command+F');
    expect(terminal.resolve(key('f', { ctrl: true }))).toBe('kanban.search.focus');
    expect(terminal.resolve(key('f', { meta: true }))).toBeUndefined();
    expect(terminal.help('kanban.search.focus')).toBe('Ctrl+F');
  });

  it('rejects exact conflicts with both IDs and the normalized chord', () => {
    const first = extension('acme.first', ['primary+k']);
    const second = extension('acme.second', ['PRIMARY+K']);
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [first, second],
    });

    try {
      createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'linux' } });
      throw new Error('Expected a keymap conflict.');
    } catch (error) {
      expect(error).toMatchObject({
        name: 'KanbanActionKeymapConflictError',
        conflict: { chord: 'ctrl+k', actionIds: ['acme.first', 'acme.second'] },
      });
    }
  });

  it('requires a targeted override and atomically replaces routing plus visible help', () => {
    const applicationSearch = extension('acme.search', []);
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [applicationSearch],
    });
    const keymap = createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'linux' } });
    const snapshots = vi.fn();
    keymap.subscribe(snapshots);

    expect(() => keymap.replace({ bindings: [{ chord: 'primary+f', actionId: 'acme.search' }] })).toThrow();
    expect(keymap.resolve(key('f', { ctrl: true }))).toBe('kanban.search.focus');
    expect(snapshots).not.toHaveBeenCalled();

    expect(
      keymap.replace({
        bindings: [{ chord: 'primary+f', actionId: 'acme.search' }],
        overrides: [{ chord: 'primary+f', replaceActionId: 'kanban.search.focus' }],
      }),
    ).toBe(true);
    expect(keymap.resolve(key('f', { ctrl: true }))).toBe('acme.search');
    expect(keymap.help('acme.search')).toBe('Ctrl+F');
    expect(keymap.help('kanban.search.focus')).toBeUndefined();
    expect(snapshots).toHaveBeenCalledOnce();
    expect(snapshots.mock.calls[0]?.[0]).toMatchObject({ revision: 2 });
  });

  it('keeps the prior route and help snapshot when replacement validation fails', () => {
    const applicationSearch = extension('acme.search', []);
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [applicationSearch],
    });
    const keymap = createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'linux' } });
    const before = keymap.snapshot();

    expect(() =>
      keymap.replace({
        bindings: [{ chord: 'primary+f', actionId: 'acme.search' }],
        overrides: [{ chord: 'primary+f', replaceActionId: 'kanban.help.open' }],
      }),
    ).toThrow();
    expect(keymap.snapshot()).toBe(before);
    expect(keymap.resolve(key('f', { ctrl: true }))).toBe('kanban.search.focus');
    expect(keymap.help('kanban.search.focus')).toBe('Ctrl+F');
  });
});
