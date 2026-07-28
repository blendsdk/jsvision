import { describe, expect, it, vi } from 'vitest';

import {
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  type CodeEditorControllerEvent,
  type CodeEditorControllerHostEffect,
} from './index.js';

/** Creates one modified document and its host effect recorder. */
function createHarness(
  host?: (effect: CodeEditorControllerHostEffect) => Promise<boolean>,
  hostEffectTimeoutMs?: number,
) {
  const document = createDocumentModel({
    text: 'local\n',
    uri: 'file:///lifecycle-implementation.txt',
    languageId: 'plain',
  });
  const effects: CodeEditorControllerHostEffect[] = [];
  const controller = createCodeEditorController({
    document,
    host: async (effect) => {
      effects.push(effect);
      return host?.(effect) ?? true;
    },
    ...(hostEffectTimeoutMs === undefined ? {} : { hostEffectTimeoutMs }),
  });
  return { controller, document, effects };
}

describe('document lifecycle implementation boundaries', () => {
  it('should reject hostile external-change records without invoking accessors or the host', async () => {
    const { controller, effects } = createHarness();
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'text', {
      enumerable: true,
      get() {
        throw new Error('must not execute');
      },
    });
    Object.defineProperty(hostile, 'decision', { enumerable: true, value: 'compare' });

    await expect(controller.resolveExternalChange(hostile as never)).resolves.toBe('rejected');
    expect(effects).toHaveLength(0);
  });

  it('should isolate host failures and retain modified state', async () => {
    const { controller, document } = createHarness(async () => {
      throw new Error('confidential host failure');
    });
    expect(
      controller.applyMutation({
        edits: [{ range: { from: 0, to: 0 }, text: 'changed ' }],
        origin: 'external',
      }),
    ).toMatchObject({ accepted: true });

    await expect(controller.save()).resolves.toBe(false);
    expect(document.modified).toBe(true);
    expect(controller.degradation.snapshot().notices).toEqual(
      expect.arrayContaining([expect.objectContaining({ feature: 'hostCallback' })]),
    );
  });

  it('should publish one external document event after an explicit reload', async () => {
    const { controller, document } = createHarness();
    const events: CodeEditorControllerEvent[] = [];
    controller.subscribe((event) => events.push(event));

    await expect(controller.resolveExternalChange({ text: 'external\n', decision: 'reload' })).resolves.toBe(
      'reloaded',
    );
    await vi.waitFor(() => expect(events).toHaveLength(1));

    expect(events[0]).toMatchObject({
      kind: 'document',
      mutation: { origin: 'external' },
    });
    expect(document.text).toBe('external\n');
    expect(document.modified).toBe(false);
  });

  it('should reject a close authorization when the document changes while confirmation is pending', async () => {
    let authorize: ((accepted: boolean) => void) | undefined;
    const { controller } = createHarness(
      async () =>
        new Promise<boolean>((resolve) => {
          authorize = resolve;
        }),
    );

    const close = controller.requestClose();
    controller.applyMutation({ edits: [{ range: { from: 0, to: 0 }, text: 'new ' }], origin: 'typing' });
    authorize?.(true);

    await expect(close).resolves.toBe(false);
  });

  it('should queue an external reload event before a later local edit event', async () => {
    const { controller } = createHarness();
    const events: CodeEditorControllerEvent[] = [];
    controller.subscribe((event) => events.push(event));

    const reload = controller.resolveExternalChange({ text: 'external\n', decision: 'reload' });
    controller.applyMutation({ edits: [{ range: { from: 0, to: 0 }, text: 'new ' }], origin: 'typing' });
    await reload;
    await vi.waitFor(() => expect(events).toHaveLength(2));

    expect(events[0]?.kind).toBe('document');
    expect(events[1]?.kind).toBe('document');
    if (events[0]?.kind === 'document' && events[1]?.kind === 'document') {
      expect(events[0].mutation.after).toEqual(events[1].mutation.before);
      expect(events[1].mutation.origin).toBe('typing');
    }
  });

  it('should release later host actions after one callback exceeds its deadline', async () => {
    let calls = 0;
    const { controller } = createHarness(async () => {
      calls += 1;
      if (calls === 1) return new Promise<boolean>(() => undefined);
      return true;
    }, 5);

    await expect(controller.save()).resolves.toBe(false);
    await expect(controller.requestClose()).resolves.toBe(true);
    expect(calls).toBe(2);
  });

  it('should keep formatted save text paired with the identity that produced it', async () => {
    const document = createDocumentModel({
      text: 'let x=1;\n',
      uri: 'file:///format-race.ts',
      languageId: 'typescript',
    });
    const session = createInProcessLspSession({ capabilities: { documentFormatting: true } });
    const coordinator = createCodeEditorLspCoordinator({
      document,
      session,
      uri: 'file:///format-race.ts',
      languageId: 'typescript',
      formatOnSave: true,
    });
    const effects: CodeEditorControllerHostEffect[] = [];
    const controller = createCodeEditorController({
      document,
      lsp: coordinator,
      host: async (effect) => {
        effects.push(effect);
        return true;
      },
    });
    await coordinator.open();

    const save = controller.save();
    const request = session.requests.at(-1);
    session.respond(request?.id, [
      { range: { start: { line: 0, character: 5 }, end: { line: 0, character: 5 } }, newText: ' ' },
    ]);
    controller.applyMutation({ edits: [{ range: { from: 0, to: 0 }, text: 'new ' }], origin: 'typing' });

    await expect(save).resolves.toBe(true);
    expect(effects.at(-1)).toMatchObject({ kind: 'save', text: 'let x =1;\n', originRevision: 1 });
    expect(document.modified).toBe(true);
  });

  it('should cap direct host-effect concurrency and settle owned deadlines during disposal', async () => {
    const { controller, effects } = createHarness(async () => new Promise<boolean>(() => undefined), 30_000);
    const pending = Array.from({ length: 8 }, () => controller.save());

    await expect(controller.save()).resolves.toBe(false);
    expect(effects).toHaveLength(8);

    controller.dispose();
    await expect(Promise.all(pending)).resolves.toEqual(Array.from({ length: 8 }, () => false));
  });
});
