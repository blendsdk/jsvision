import { describe, expect, it, vi } from 'vitest';

import { createKanbanActionKeymap, createKanbanActionRegistry } from '../src/index.js';
import type { KanbanActionDefinition } from '../src/index.js';

/** Builds one valid application action with optional default chords. */
function extension(index: number, bindings: readonly string[] = []): KanbanActionDefinition {
  const id = `acme.action-${index}`;
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

describe('Kanban action registry implementation', () => {
  it('rejects unnamespaced, duplicate, package-reserved, and over-limit extensions', () => {
    const executePackageAction = () => ({ kind: 'handled' as const });
    expect(() =>
      createKanbanActionRegistry({ executePackageAction, extensions: [{ ...extension(1), id: 'export' }] }),
    ).toThrow();
    expect(() =>
      createKanbanActionRegistry({
        executePackageAction,
        extensions: [{ ...extension(1), id: 'kanban.application.export' }],
      }),
    ).toThrow();
    expect(() =>
      createKanbanActionRegistry({ executePackageAction, extensions: [extension(1), extension(1)] }),
    ).toThrow();
    expect(() =>
      createKanbanActionRegistry({
        executePackageAction,
        extensions: Array.from({ length: 257 }, (_, index) => extension(index)),
      }),
    ).toThrow();
  });

  it('does not invoke accessors and detaches caller-owned binding arrays', () => {
    const bindings = ['primary+k'];
    const action = extension(1, bindings);
    const accessor = vi.fn(() => bindings);
    Object.defineProperty(action, 'bindings', { enumerable: true, get: accessor });

    expect(() =>
      createKanbanActionRegistry({ executePackageAction: () => ({ kind: 'handled' }), extensions: [action] }),
    ).toThrow();
    expect(accessor).not.toHaveBeenCalled();

    const detachedBindings = ['primary+k'];
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [extension(2, detachedBindings)],
    });
    detachedBindings[0] = 'primary+x';
    expect(registry.action('acme.action-2')?.bindings).toEqual(['primary+k']);
  });

  it('keeps replacement atomic across malformed requests and subscriber failures', () => {
    const registry = createKanbanActionRegistry({
      executePackageAction: () => ({ kind: 'handled' }),
      extensions: [extension(1)],
    });
    const keymap = createKanbanActionKeymap({ registry, host: { kind: 'terminal', platform: 'linux' } });
    const before = keymap.snapshot();
    expect(() => keymap.replace({ bindings: [{ chord: 'not-a-named-key', actionId: 'acme.action-1' }] })).toThrow();
    expect(keymap.snapshot()).toBe(before);

    const later = vi.fn();
    keymap.subscribe(() => {
      throw new Error('presentation-secret');
    });
    keymap.subscribe(later);
    expect(keymap.replace({ bindings: [{ chord: 'primary+k', actionId: 'acme.action-1' }] })).toBe(true);
    expect(later).toHaveBeenCalledOnce();
    expect(keymap.help('acme.action-1')).toBe('Ctrl+K');
  });
});
