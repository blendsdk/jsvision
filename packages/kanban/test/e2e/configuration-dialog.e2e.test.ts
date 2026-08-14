/** End-to-end requirements for responsive package-owned board-configuration dialogs. */
import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Commands, Group, Input, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanConfigurationSnapshot,
  openKanbanColumnConfigurationDialog,
  openKanbanSwimlaneConfigurationDialog,
} from '../../src/index.js';
import type { KanbanConfigurationSnapshot } from '../../src/index.js';

const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Builds a live modal host and records mounted/removal state. */
function host(width = 80, height = 24) {
  const root = new Group();
  const loop = createEventLoop({ width, height }, { caps: CAPS });
  loop.mount(root);
  const added: View[] = [];
  const removed: View[] = [];
  return {
    loop,
    added,
    removed,
    value: {
      i18n: createI18n(),
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width, height },
        addWindow(view: View): void {
          added.push(view);
          root.add(view);
        },
        removeWindow(view: View): void {
          removed.push(view);
          root.remove(view);
        },
      },
    },
  };
}

/** Creates a replaceable authoritative configuration source. */
function source() {
  let current = createKanbanConfigurationSnapshot({
    revision: 'structure-r1',
    columns: [
      { columnId: 'todo', label: 'To do', revision: 'column-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'column-r1' },
      { columnId: 'done', label: 'Done', revision: 'column-r1' },
    ],
    swimlanes: [{ swimlaneId: 'team-a', label: 'Team A', revision: 'swimlane-r1', mode: 'explicit' }],
  });
  let listener: ((snapshot: KanbanConfigurationSnapshot) => void) | undefined;
  return {
    value: {
      resolve: async () => current,
      subscribe: (next: (snapshot: KanbanConfigurationSnapshot) => void) => {
        listener = next;
        return () => {
          if (listener === next) listener = undefined;
        };
      },
    },
    publish(snapshot: KanbanConfigurationSnapshot): void {
      current = snapshot;
      listener?.(snapshot);
    },
  };
}

/** Allows async resolution and modal mounting one event-loop turn. */
const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Returns the complete rendered frame as plain terminal text. */
function frame(loop: ReturnType<typeof createEventLoop>): string {
  loop.renderRoot.flush();
  return loop.renderRoot
    .buffer()
    .rows()
    .map((row) => row.map((cell) => cell.char).join(''))
    .join('\n');
}

/** Replaces the focused one-line field through public keyboard input. */
function replaceInput(loop: ReturnType<typeof createEventLoop>, value: string): void {
  expect(loop.getFocused()).toBeInstanceOf(Input);
  loop.dispatch({ type: 'key', key: 'a', ctrl: true, alt: false, shift: false });
  for (const key of value) loop.dispatch({ type: 'key', key, ctrl: false, alt: false, shift: false });
}

describe('Kanban configuration dialogs', () => {
  it('returns one add proposal on Apply and no proposal on Cancel', async () => {
    const h = host();
    const records = source();
    const request = vi.fn(() => ({ kind: 'rejected' as const, operationId: 'column-1', code: 'retry' }));
    const cancelled = openKanbanColumnConfigurationDialog(h.value, {
      source: records.value,
      operation: { kind: 'add', columnId: 'review', position: { kind: 'end' } },
      completion: { kind: 'authority', authority: { request } },
    });
    await mounted();
    h.loop.emitCommand(Commands.cancel);
    await expect(cancelled).resolves.toEqual({ kind: 'cancelled' });
    expect(request).not.toHaveBeenCalled();

    const applied = openKanbanColumnConfigurationDialog(h.value, {
      source: records.value,
      operation: { kind: 'add', columnId: 'review', position: { kind: 'end' } },
      completion: { kind: 'result-only' },
    });
    await mounted();
    replaceInput(h.loop, 'Review');
    h.loop.emitCommand(Commands.ok);
    await expect(applied).resolves.toEqual({
      kind: 'proposal',
      proposal: {
        kind: 'column-add',
        draft: { columnId: 'review', label: 'Review' },
        position: { kind: 'end' },
      },
    });
  });

  it('retains draft and focus after rejection, then exposes stale Reload and Cancel', async () => {
    const h = host();
    const records = source();
    const request = vi.fn(() => ({ kind: 'rejected' as const, operationId: 'column-1', code: 'conflict' }));
    const pending = openKanbanColumnConfigurationDialog(h.value, {
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
      completion: { kind: 'authority', authority: { request } },
      confirm: async () => true,
    });
    await mounted();
    replaceInput(h.loop, 'In uitvoering');
    const focused = h.loop.getFocused();
    h.loop.emitCommand(Commands.ok);
    await mounted();

    expect(request).toHaveBeenCalledOnce();
    expect(h.loop.getFocused()).toBe(focused);
    expect(frame(h.loop)).toContain('conflict');
    records.publish(
      createKanbanConfigurationSnapshot({
        revision: 'structure-r2',
        columns: [
          { columnId: 'todo', label: 'To do', revision: 'column-r1' },
          { columnId: 'doing', label: 'Remote', revision: 'column-r2' },
          { columnId: 'done', label: 'Done', revision: 'column-r1' },
        ],
        swimlanes: [],
      }),
    );
    expect(frame(h.loop)).toMatch(/Reload|changed/u);
    h.loop.emitCommand(Commands.cancel);
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('preserves input and reachability through narrow resize, maximize, and restore', async () => {
    const h = host(48, 14);
    const records = source();
    const pending = openKanbanColumnConfigurationDialog(h.value, {
      source: records.value,
      operation: { kind: 'update', columnId: 'doing' },
      completion: { kind: 'result-only' },
      confirm: async () => true,
    });
    await mounted();
    replaceInput(h.loop, 'Lange Nederlandse kolomnaam');
    const dialog = h.added[0];
    if (dialog === undefined) throw new Error('Expected mounted configuration dialog.');
    dialog.bounds = { ...dialog.bounds, width: 34, height: 10 };
    h.loop.renderRoot.resize({ width: 100, height: 32 });
    dialog.bounds = { x: 0, y: 1, width: 100, height: 31 };
    h.loop.renderRoot.resize({ width: 48, height: 14 });
    dialog.bounds = { x: 4, y: 2, width: 40, height: 11 };

    expect(frame(h.loop)).toMatch(/Save|Apply/u);
    expect(h.loop.getFocused()).toBeInstanceOf(Input);
    h.loop.emitCommand(Commands.cancel);
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('produces the same neighbor proposal for keyboard, button, and pointer reorder routes', async () => {
    const origins = ['keyboard', 'button', 'pointer'] as const;
    const proposals = [];
    for (const origin of origins) {
      const h = host();
      const records = source();
      const pending = openKanbanSwimlaneConfigurationDialog(h.value, {
        source: records.value,
        operation: { kind: 'reorder', swimlaneId: 'team-a' },
        completion: { kind: 'result-only' },
      });
      await mounted();
      h.loop.dispatch({
        type: 'command',
        command: 'kanban.configuration.move-after',
        arg: { origin, swimlaneId: 'team-a' },
      });
      h.loop.emitCommand(Commands.ok);
      const result = await pending;
      if (result.kind !== 'proposal') throw new Error('Expected a reorder proposal.');
      proposals.push(result.proposal);
    }

    expect(proposals).toEqual([
      { kind: 'swimlane-reorder', swimlaneId: 'team-a', position: { kind: 'end' } },
      { kind: 'swimlane-reorder', swimlaneId: 'team-a', position: { kind: 'end' } },
      { kind: 'swimlane-reorder', swimlaneId: 'team-a', position: { kind: 'end' } },
    ]);
  });
});
