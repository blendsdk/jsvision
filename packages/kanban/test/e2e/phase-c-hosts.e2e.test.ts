/**
 * Specification oracle for semantic pointer parity across direct, browser, PTY, and ConPTY hosts.
 *
 * The host adapters may encode input differently, but they must report the same bounded semantic
 * trace. Native evidence also identifies its real terminal transport so a pipe-backed child cannot
 * accidentally satisfy the PTY requirement.
 */
import { describe, expect, it } from 'vitest';

import * as kanbanTesting from '../../src/testing.js';

type Transport = 'direct' | 'browser-xterm' | 'unix-pty' | 'windows-conpty';

interface HostEvidence {
  readonly transport: Transport;
  readonly terminal: 'direct' | 'xterm-headless' | 'pty' | 'conpty';
  readonly pipeBacked: boolean;
  readonly platform: NodeJS.Platform;
}

interface SemanticTraceResult {
  readonly evidence: HostEvidence;
  readonly semantic: {
    readonly thresholdCrossed: boolean;
    readonly targetChanges: readonly string[];
    readonly autoscroll: readonly string[];
    readonly cancellations: readonly string[];
    readonly proposal: {
      readonly kind: 'card-move';
      readonly movedCardKeys: readonly (string | number)[];
      readonly columnId: string;
      readonly swimlaneId: string;
      readonly position: 'before' | 'after' | 'start' | 'end';
    };
  };
}

interface SemanticTraceApi {
  readonly createKanbanStandardPointerTrace: () => unknown;
  readonly replayKanbanSemanticPointerTrace: (
    trace: unknown,
    options: { readonly transport: Transport },
  ) => Promise<SemanticTraceResult>;
}

/** Reads the future public testing helpers while keeping the red oracle collectable. */
function traceApi(): SemanticTraceApi {
  const createTrace: unknown = Reflect.get(kanbanTesting, 'createKanbanStandardPointerTrace');
  const replayTrace: unknown = Reflect.get(kanbanTesting, 'replayKanbanSemanticPointerTrace');
  expect(createTrace, 'the testing entry must export the standard semantic trace builder').toBeTypeOf('function');
  expect(replayTrace, 'the testing entry must export the host-independent semantic trace replayer').toBeTypeOf(
    'function',
  );
  if (typeof createTrace !== 'function' || typeof replayTrace !== 'function') {
    throw new Error('Phase C semantic host helpers are unavailable.');
  }
  return {
    createKanbanStandardPointerTrace: () => Reflect.apply(createTrace, kanbanTesting, []),
    replayKanbanSemanticPointerTrace: (trace, options) =>
      Promise.resolve(Reflect.apply(replayTrace, kanbanTesting, [trace, options]) as SemanticTraceResult),
  };
}

/** Removes transport evidence before semantic equivalence comparisons. */
function semantics(result: SemanticTraceResult): SemanticTraceResult['semantic'] {
  return result.semantic;
}

describe('Phase C semantic host parity', () => {
  it('replays one standard trace equivalently through direct dispatch and the real browser/xterm path', async () => {
    const api = traceApi();
    const trace = api.createKanbanStandardPointerTrace();
    const direct = await api.replayKanbanSemanticPointerTrace(trace, { transport: 'direct' });
    const browser = await api.replayKanbanSemanticPointerTrace(trace, { transport: 'browser-xterm' });

    expect(direct.evidence).toMatchObject({ transport: 'direct', terminal: 'direct', pipeBacked: false });
    expect(browser.evidence).toMatchObject({
      transport: 'browser-xterm',
      terminal: 'xterm-headless',
      pipeBacked: false,
    });
    expect(semantics(browser)).toEqual(semantics(direct));
    expect(semantics(direct)).toEqual({
      thresholdCrossed: true,
      targetChanges: ['allowed:doing/alpha'],
      autoscroll: ['right:slow'],
      cancellations: ['focus-lost'],
      proposal: {
        kind: 'card-move',
        movedCardKeys: [1],
        columnId: 'doing',
        swimlaneId: 'alpha',
        position: 'after',
      },
    });
  });

  it.skipIf(process.platform === 'win32')(
    'runs the same semantic trace through a real Unix PTY rather than child-process pipes',
    async () => {
      const api = traceApi();
      const trace = api.createKanbanStandardPointerTrace();
      const direct = await api.replayKanbanSemanticPointerTrace(trace, { transport: 'direct' });
      const native = await api.replayKanbanSemanticPointerTrace(trace, { transport: 'unix-pty' });

      expect(native.evidence).toEqual({
        transport: 'unix-pty',
        terminal: 'pty',
        pipeBacked: false,
        platform: process.platform,
      });
      expect(semantics(native)).toEqual(semantics(direct));
    },
  );

  it.skipIf(process.platform !== 'win32')(
    'runs the same semantic trace through Windows ConPTY without accepting an unsupported skip',
    async () => {
      const api = traceApi();
      const trace = api.createKanbanStandardPointerTrace();
      const direct = await api.replayKanbanSemanticPointerTrace(trace, { transport: 'direct' });
      const native = await api.replayKanbanSemanticPointerTrace(trace, { transport: 'windows-conpty' });

      expect(native.evidence).toEqual({
        transport: 'windows-conpty',
        terminal: 'conpty',
        pipeBacked: false,
        platform: 'win32',
      });
      expect(semantics(native)).toEqual(semantics(direct));
    },
  );
});
