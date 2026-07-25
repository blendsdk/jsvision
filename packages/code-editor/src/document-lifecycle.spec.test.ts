import { describe, expect, it, vi } from 'vitest';

import {
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  type CodeEditorControllerHostEffect,
} from './index.js';

const uri = 'file:///workspace/lifecycle.ts';

function mutate(document: ReturnType<typeof createDocumentModel>, text: string) {
  const result = document.apply(
    document.createTransaction({
      base: document.identity,
      edits: [{ range: { from: 0, to: document.text.length }, text }],
      origin: 'typing',
    }),
  );
  expect(result).toMatchObject({ accepted: true });
}

function createLifecycleHarness(
  options: {
    readonly text?: string;
    readonly formatOnSave?: boolean;
    readonly formattingCapability?: boolean;
    readonly limits?: { readonly maxDocumentBytes?: number };
    readonly host?: (effect: CodeEditorControllerHostEffect) => Promise<boolean>;
  } = {},
) {
  const document = createDocumentModel({
    text: options.text ?? 'let value=1;\n',
    uri,
    languageId: 'typescript',
    limits: options.limits,
  });
  const session = createInProcessLspSession({
    capabilities: { documentFormatting: options.formattingCapability ?? true },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri,
    languageId: 'typescript',
    formatOnSave: options.formatOnSave,
  });
  const effects: CodeEditorControllerHostEffect[] = [];
  const host = vi.fn(async (effect: CodeEditorControllerHostEffect) => {
    effects.push(effect);
    return options.host?.(effect) ?? true;
  });
  const controller = createCodeEditorController({ document, lsp: coordinator, host });
  return { controller, coordinator, document, effects, host, session };
}

describe('host-owned save lifecycle', () => {
  it('keeps formatting opt-in and submits exact current text, revision, and session identity', async () => {
    // A default save skips provider work and gives the host an exact immutable current submission.
    const harness = createLifecycleHarness({ text: 'let value=1;\n' });
    await harness.coordinator.open();

    expect(await harness.controller.save()).toBe(true);

    expect(harness.session.requests).toHaveLength(0);
    expect(harness.effects).toHaveLength(1);
    expect(harness.effects[0]).toMatchObject({
      kind: 'save',
      originUri: uri,
      originRevision: harness.document.identity.revision,
      text: 'let value=1;\n',
      formatting: 'disabled',
    });
    expect(Number.isInteger(harness.effects[0]?.sessionGeneration)).toBe(true);
    expect(harness.document.modified).toBe(false);
  });

  it('submits valid current formatted text and revision when formatting is enabled', async () => {
    // Only a valid response for the active generation may become the text submitted to the host.
    const harness = createLifecycleHarness({ formatOnSave: true });
    await harness.coordinator.open();
    const pending = harness.controller.save();
    const request = harness.session.requests.at(-1);
    expect(request?.method).toBe('textDocument/formatting');
    harness.session.respond(request?.id, [
      {
        range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
        newText: ' ',
      },
    ]);

    expect(await pending).toBe(true);
    expect(harness.effects).toHaveLength(1);
    expect(harness.effects[0]).toMatchObject({
      kind: 'save',
      originUri: uri,
      originRevision: harness.document.identity.revision,
      text: 'let value =1;\n',
      formatting: 'applied',
    });
  });

  it.each(['missing', 'invalid', 'stale', 'cancelled', 'failed', 'timed-out'] as const)(
    'never blocks saving current unformatted text when formatting is %s',
    async (outcome) => {
      // Provider absence and every unusable response still result in one host save of current local text.
      const harness = createLifecycleHarness({
        formatOnSave: true,
        formattingCapability: outcome !== 'missing',
      });
      await harness.coordinator.open();
      const pending = harness.controller.save();
      const request = harness.session.requests.at(-1);

      if (outcome === 'invalid') {
        harness.session.respond(request?.id, [
          {
            range: { start: { line: -1, character: 0 }, end: { line: 0, character: 0 } },
            newText: 'invalid',
          },
        ]);
      }
      if (outcome === 'stale') {
        mutate(harness.document, 'let current=2;\n');
        harness.session.respond(request?.id, []);
      }
      if (outcome === 'cancelled') {
        await harness.coordinator.close();
      }
      if (outcome === 'failed') harness.session.fail(request?.id, new Error('provider failed'));
      if (outcome === 'timed-out') harness.session.timeout(request?.id);

      expect(await pending).toBe(true);
      expect(harness.effects).toHaveLength(1);
      expect(harness.effects[0]).toMatchObject({
        kind: 'save',
        originUri: uri,
        originRevision: harness.document.identity.revision,
        text: harness.document.text,
      });
      expect(harness.effects[0]?.formatting).not.toBe('applied');
    },
  );

  it('marks only the exact accepted submitted revision saved and preserves racing work as modified', async () => {
    // Host acceptance cannot mark a newer local revision clean.
    let accept!: (accepted: boolean) => void;
    const hostResult = new Promise<boolean>((resolve) => {
      accept = resolve;
    });
    const harness = createLifecycleHarness({
      host: async (effect) => (effect.kind === 'save' ? hostResult : true),
    });
    mutate(harness.document, 'submitted\n');
    const submittedRevision = harness.document.identity.revision;
    const pending = harness.controller.save();
    await vi.waitFor(() => expect(harness.effects).toHaveLength(1));
    mutate(harness.document, 'newer local work\n');
    const racingRevision = harness.document.identity.revision;
    accept(true);

    expect(await pending).toBe(true);
    expect(harness.effects[0]).toMatchObject({
      kind: 'save',
      originRevision: submittedRevision,
      text: 'submitted\n',
    });
    expect(racingRevision).not.toBe(submittedRevision);
    expect(harness.document.text).toBe('newer local work\n');
    expect(harness.document.modified).toBe(true);
  });

  it('retains modified state after rejection and clears it after exact acceptance', async () => {
    // Saved-state tracking follows the host result for the exact submitted identity.
    let accepted = false;
    const harness = createLifecycleHarness({
      host: async (effect) => (effect.kind === 'save' ? accepted : true),
    });
    mutate(harness.document, 'changed\n');

    expect(await harness.controller.save()).toBe(false);
    expect(harness.document.modified).toBe(true);
    accepted = true;
    expect(await harness.controller.save()).toBe(true);
    expect(harness.document.modified).toBe(false);
  });
});

describe('close and external-change decisions', () => {
  it('makes dirty close typed, host-confirmable, and non-destructive on rejection', async () => {
    // Closing a modified document reports that fact and returns the host confirmation unchanged.
    let accepted = false;
    const harness = createLifecycleHarness({
      host: async (effect) => (effect.kind === 'close' ? accepted : true),
    });
    mutate(harness.document, 'unsaved\n');

    expect(await harness.controller.requestClose()).toBe(false);
    expect(harness.effects.at(-1)).toMatchObject({ kind: 'close', modified: true });
    expect(harness.document.text).toBe('unsaved\n');
    expect(harness.document.modified).toBe(true);

    accepted = true;
    expect(await harness.controller.requestClose()).toBe(true);
    expect(harness.effects.at(-1)).toMatchObject({ kind: 'close', modified: true });
  });

  it('preserves clean and dirty local text for keep and compare until reload is explicit', async () => {
    // Keep and host-owned compare are locally inert for both clean and modified documents.
    for (const dirty of [false, true]) {
      const harness = createLifecycleHarness();
      if (dirty) mutate(harness.document, 'local unsaved\n');
      const before = {
        text: harness.document.text,
        identity: harness.document.identity,
        modified: harness.document.modified,
        undoDepth: harness.document.undoDepth,
      };

      expect(await harness.controller.resolveExternalChange({ text: 'external\n', decision: 'keep' })).toBe('kept');
      expect({
        text: harness.document.text,
        identity: harness.document.identity,
        modified: harness.document.modified,
        undoDepth: harness.document.undoDepth,
      }).toEqual(before);

      expect(await harness.controller.resolveExternalChange({ text: 'external\n', decision: 'compare' })).toBe(
        'compare-requested',
      );
      expect(harness.effects.at(-1)).toMatchObject({
        kind: 'external-change',
        decision: 'compare',
        originUri: uri,
        originRevision: before.identity.revision,
        text: 'external\n',
      });
      expect({
        text: harness.document.text,
        identity: harness.document.identity,
        modified: harness.document.modified,
        undoDepth: harness.document.undoDepth,
      }).toEqual(before);
    }
  });

  it('reloads only on an explicit reload decision and rejects excessive external text', async () => {
    // Explicit reload installs one bounded external document; rejected input overwrites nothing.
    const harness = createLifecycleHarness({
      text: 'base\n',
      limits: { maxDocumentBytes: 12 },
    });
    mutate(harness.document, 'local\n');
    const lineage = harness.document.identity.lineage;

    expect(await harness.controller.resolveExternalChange({ text: 'external\n', decision: 'reload' })).toBe('reloaded');
    expect(harness.document.text).toBe('external\n');
    expect(harness.document.identity.lineage).not.toBe(lineage);
    expect(harness.document.modified).toBe(false);

    const before = {
      text: harness.document.text,
      identity: harness.document.identity,
      modified: harness.document.modified,
    };
    expect(
      await harness.controller.resolveExternalChange({
        text: 'x'.repeat(13),
        decision: 'reload',
      }),
    ).toBe('rejected');
    expect({
      text: harness.document.text,
      identity: harness.document.identity,
      modified: harness.document.modified,
    }).toEqual(before);
  });

  it('reports compare rejection without changing or leaking the local document', async () => {
    // A rejected compare remains host-owned and cannot mutate local text or saved-state tracking.
    const harness = createLifecycleHarness({
      host: async (effect) => effect.kind !== 'external-change',
    });
    mutate(harness.document, 'private local text\n');
    const before = {
      text: harness.document.text,
      identity: harness.document.identity,
      modified: harness.document.modified,
      undoDepth: harness.document.undoDepth,
    };

    expect(await harness.controller.resolveExternalChange({ text: 'external\n', decision: 'compare' })).toBe(
      'rejected',
    );
    expect(harness.effects.at(-1)).toMatchObject({
      kind: 'external-change',
      decision: 'compare',
      text: 'external\n',
    });
    expect(JSON.stringify(harness.effects.at(-1))).not.toContain('private local text');
    expect({
      text: harness.document.text,
      identity: harness.document.identity,
      modified: harness.document.modified,
      undoDepth: harness.document.undoDepth,
    }).toEqual(before);
  });
});
