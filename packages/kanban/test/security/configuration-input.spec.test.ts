/** Immutable security requirements for board-configuration input and callback boundaries. */
import { describe, expect, it, vi } from 'vitest';

import {
  buildKanbanColumnAddProposal,
  buildKanbanColumnDeleteProposal,
  createKanbanConfigurationSnapshot,
  normalizeKanbanConfigurationName,
} from '../../src/index.js';

/** Creates a small authoritative structure used by hostile builder tests. */
function structure() {
  return createKanbanConfigurationSnapshot({
    revision: 'structure-r1',
    columns: [
      { columnId: 'todo', label: 'To do', revision: 'column-r1' },
      { columnId: 'doing', label: 'Doing', revision: 'column-r1' },
    ],
    swimlanes: [],
  });
}

describe('Kanban configuration input security', () => {
  // Names and definition text are terminal-facing, so whole escape sequences and bidi controls are removed.
  it('sanitizes hostile names and definition-of-done text before proposal publication', () => {
    const proposal = buildKanbanColumnAddProposal({
      snapshot: structure(),
      draft: {
        columnId: 'review',
        label: ' \u001b[31mＲＥＶＩＥＷ\u001b[0m\u202e\n ',
        definitionOfDone: {
          summary: '\u001b]8;;https://invalid.example\u0007Peer reviewed\u001b]8;;\u0007',
          details: 'Tests pass\u202e\nwithout exceptions',
        },
      },
      position: { kind: 'end' },
    });

    expect(proposal).toEqual({
      kind: 'column-add',
      draft: {
        columnId: 'review',
        label: 'REVIEW',
        definitionOfDone: {
          summary: 'Peer reviewed',
          details: 'Tests pass without exceptions',
          indicator: 'configured',
        },
      },
      position: { kind: 'end' },
    });
    expect(JSON.stringify(proposal)).not.toMatch(/[\u001b\u202a-\u202e\u2066-\u2069]/u);
  });

  // Duplicate opt-in is safe only when the application supplies a visible, non-empty disambiguator.
  it('requires and sanitizes a visible disambiguator when duplicate names are explicitly allowed', () => {
    expect(() =>
      buildKanbanColumnAddProposal({
        snapshot: structure(),
        draft: { columnId: 'todo-copy', label: 'TO DO' },
        position: { kind: 'end' },
        duplicateName: { disambiguator: ' \u001b[32m\u202e ' },
      }),
    ).toThrow();

    expect(
      buildKanbanColumnAddProposal({
        snapshot: structure(),
        draft: { columnId: 'todo-copy', label: 'TO DO' },
        position: { kind: 'end' },
        duplicateName: { disambiguator: ' Europe \u001b[0m' },
      }),
    ).toEqual({
      kind: 'column-add',
      draft: { columnId: 'todo-copy', label: 'TO DO', disambiguator: 'Europe' },
      position: { kind: 'end' },
    });
  });

  // Oversize input and callback failures produce fixed diagnostics that never echo rejected content.
  it('bounds configuration text and keeps callback failures payload-free', () => {
    const secret = 'private-configuration-token';
    for (const value of [`${secret}${'x'.repeat(20_000)}`, `\u001b[31m${secret}`]) {
      try {
        normalizeKanbanConfigurationName(value);
      } catch (error) {
        expect(String(error)).not.toContain(secret);
      }
    }

    const build = vi.fn(() => {
      throw new Error(secret);
    });
    try {
      buildKanbanColumnDeleteProposal({
        snapshot: structure(),
        columnId: 'doing',
        occupancy: { quality: 'exact', count: 2 },
        policy: { kind: 'custom', build },
      });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
      expect(JSON.stringify(error)).not.toContain(secret);
    }
    expect(build).toHaveBeenCalledOnce();
  });

  // Descriptor inspection must reject accessors and hostile proxies without executing application getters.
  it('rejects extra members, accessors, and hostile proxies without invoking application values', () => {
    const getter = vi.fn(() => 'must-not-run');
    const column = { columnId: 'todo', label: 'To do', revision: 'column-r1' };
    Object.defineProperty(column, 'applicationField', { enumerable: true, get: getter });

    expect(() =>
      createKanbanConfigurationSnapshot({ revision: 'structure-r1', columns: [column], swimlanes: [] }),
    ).toThrow();
    expect(getter).not.toHaveBeenCalled();

    const proxy = new Proxy(
      { revision: 'structure-r1', columns: [], swimlanes: [] },
      {
        ownKeys() {
          throw new Error('private-proxy-token');
        },
      },
    );
    try {
      createKanbanConfigurationSnapshot(proxy);
    } catch (error) {
      expect(String(error)).not.toContain('private-proxy-token');
    }

    expect(structure()).toMatchObject({ revision: 'structure-r1' });
  });
});
