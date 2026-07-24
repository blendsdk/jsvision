import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import { createCodeEditorController } from '../controller.js';
import { createDocumentModel } from '../document/model.js';
import { CodeEditor } from './code-editor.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: '16' },
}).profile;

/** Measures one caret-follow and horizontally scrolled projection sample. */
function measureLongLine(editor: CodeEditor): number {
  const end = editor.controller.document.text.length;
  const startedAt = performance.now();
  editor.controller.document.setSelection({ anchor: end, head: end });
  editor.execute('cursor.documentEnd');
  editor.project({ width: 80, height: 4, caps });
  return performance.now() - startedAt;
}

/** Returns the largest of five already-sorted interaction samples. */
function p95(samples: number[]): number {
  return samples.sort((left, right) => left - right)[4] ?? Number.POSITIVE_INFINITY;
}

describe('long-line viewport performance', () => {
  it('keeps end-of-line caret following and projection within an interactive p95 budget', () => {
    const editor = new CodeEditor({
      controller: createCodeEditorController({
        document: createDocumentModel({ text: 'x'.repeat(1_000_000), languageId: 'plain' }),
      }),
    });
    measureLongLine(editor);
    const samples = Array.from({ length: 5 }, () => measureLongLine(editor));

    expect(p95(samples)).toBeLessThanOrEqual(16);
  });

  it.each([
    ['tab-heavy', '\t'.repeat(1_000_000)],
    ['wide-Unicode', '界'.repeat(500_000)],
    ['combining-mark', `a\u0301`.repeat(250_000)],
  ])('keeps %s end editing and projection within the interactive p95 budget', (_label, text) => {
    const editor = new CodeEditor({
      controller: createCodeEditorController({
        document: createDocumentModel({ text, languageId: 'plain' }),
      }),
    });
    measureLongLine(editor);
    const samples = Array.from({ length: 5 }, () => {
      const startedAt = performance.now();
      editor.insertText('x');
      editor.project({ width: 80, height: 4, caps });
      return performance.now() - startedAt;
    });

    expect(p95(samples)).toBeLessThanOrEqual(16);
  });
});
