/**
 * Implementation hardening for docs-only Code Editor host, safety, and recovery fixtures.
 */
import { createRoot } from '@jsvision/ui';
import { CodeEditor } from '@jsvision/code-editor';
import { describe, expect, test } from 'vitest';
import hostRecovery from '../examples/code-editor/host-recovery.js';
import safeTerminalText from '../examples/code-editor/safe-terminal-text.js';
import themes from '../examples/code-editor/themes.js';
import {
  HOSTILE_PROTOCOL_TEXT,
  MAX_DOCS_DOCUMENT_BYTES,
  createBoundedLargeDocument,
  sanitizeProtocolText,
} from '../src/example-fixtures/code-editor/safety.js';
import { buildLabExample, dispatchExampleAction, frameText, viewsIn } from './example-lab-harness.js';

/** Resolve the target-owned probe shared by the focused examples. */
function probeIn(dialog: ReturnType<typeof buildLabExample>['dialog']) {
  const probe = viewsIn(dialog).find(
    (view): view is typeof view & { read(name: string): string | number | boolean | undefined } =>
      'read' in view && typeof view.read === 'function',
  );
  if (probe === undefined) throw new Error('Code Editor implementation example is missing its probe');
  return probe;
}

describe('Code Editor safety fixtures', () => {
  test.each([0, -1, 2_001, Number.NaN])('rejects invalid or excessive line requests: %s', (lines) => {
    expect(() => createBoundedLargeDocument(lines)).toThrow(/bounded/u);
  });

  test('keeps the largest accepted fixture under the docs-only byte ceiling', () => {
    expect(Buffer.byteLength(createBoundedLargeDocument(2_000), 'utf8')).toBeLessThanOrEqual(MAX_DOCS_DOCUMENT_BYTES);
  });

  test('sanitization is deterministic, printable, and preserves useful words', () => {
    const first = sanitizeProtocolText(HOSTILE_PROTOCOL_TEXT);
    expect(sanitizeProtocolText(HOSTILE_PROTOCOL_TEXT)).toBe(first);
    expect(first).toContain('diagnostic');
    expect(first).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
    expect(first).not.toContain('\u202e');
    expect(first.length).toBeLessThanOrEqual(80);
  });
});

describe('Code Editor host recovery examples', () => {
  test('safe presentation paints no hostile terminal controls', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('code-editor/safe-terminal-text', safeTerminalText);
      try {
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        app.loop.renderRoot.flush();
        expect(frameText(app)).not.toContain('\u001b');
        expect(probeIn(dialog).read('terminal-safe')).toBe(true);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('failed state becomes ready only through the focused authorization action', async () => {
    await createRoot(async (dispose) => {
      const { app, dialog } = buildLabExample('code-editor/host-recovery', hostRecovery);
      try {
        const probe = probeIn(dialog);
        const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
        if (editor === undefined) throw new Error('host recovery example is missing its Code Editor');
        expect(
          editor.controller.degradation.snapshot().features.find((feature) => feature.feature === 'hostCallback'),
        ).toMatchObject({ status: 'degraded', reason: 'failure' });
        expect(probe.read('service-state')).toBe('degraded');
        expect(editor.controller.publicState.serviceState).toBe('degraded');
        expect(probe.read('host-effects')).toBe('none');
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        for (let turn = 0; turn < 5; turn += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        expect(
          editor.controller.degradation.snapshot().features.find((feature) => feature.feature === 'hostCallback'),
        ).toMatchObject({ status: 'enabled', reason: 'recovered' });
        expect(probe.read('service-state')).toBe('ready');
        expect(editor.controller.publicState.serviceState).toBe('ready');
        expect(probe.read('host-effects')).toContain('authorized navigate');

        dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
        for (let turn = 0; turn < 5; turn += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        expect(
          editor.controller.degradation.snapshot().features.find((feature) => feature.feature === 'hostCallback'),
        ).toMatchObject({ status: 'degraded', reason: 'failure' });
        expect(probe.read('service-state')).toBe('degraded');
        expect(probe.read('host-effects')).toBe('none');

        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        await Promise.resolve();
        dispatchExampleAction(app, { kind: 'key', key: 'c', modifiers: ['Alt'] });
        dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
        for (let turn = 0; turn < 5; turn += 1) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        expect(probe.read('service-state')).toBe('ready');
        expect(
          editor.controller.degradation.snapshot().features.find((feature) => feature.feature === 'hostCallback'),
        ).toMatchObject({ status: 'enabled', reason: 'recovered' });
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });

  test('theme gallery cycles dark, light, and Classic-compatible palettes', () => {
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample('code-editor/themes', themes);
      try {
        const editor = viewsIn(dialog).find((view): view is CodeEditor => view instanceof CodeEditor);
        if (editor === undefined) throw new Error('theme gallery is missing its editor');
        const names: string[] = [];
        for (let index = 0; index < 3; index += 1) {
          dispatchExampleAction(app, { kind: 'key', key: 'r', modifiers: ['Alt'] });
          names.push(editor.themeInspection.fallbackSource);
        }
        expect(names).toEqual(['dark', 'light', 'classic']);
      } finally {
        app.loop.dispose();
        dispose();
      }
    });
  });
});
