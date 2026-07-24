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

/** Returns the slowest sample after sorting five interaction measurements. */
function p95(samples: number[]): number {
  return samples.sort((left, right) => left - right)[4] ?? Number.POSITIVE_INFINITY;
}

describe('folded viewport performance', () => {
  it('keeps repeated fold, unfold, and projection within an interactive p95 budget', () => {
    const regionCount = 1_000;
    const text = Array.from({ length: regionCount }, (_, index) => `block_${index} {\n  value;\n}`).join('\n');
    const document = createDocumentModel({ text, languageId: 'typescript' });
    const controller = createCodeEditorController({ document });
    const editor = new CodeEditor({ controller, lineNumbers: true });
    controller.setLanguageResult({
      identity: document.identity,
      adapterId: 'typescript',
      generation: 1,
      state: 'ready',
      syntax: [],
      brackets: [],
      folds: Array.from({ length: regionCount }, (_, index) => ({
        from: Number(document.snapshot.line(index * 3).from),
        to: Number(document.snapshot.line(index * 3 + 2).to),
      })),
    });

    const measure = (): number => {
      const startedAt = performance.now();
      controller.toggleFoldLine(0);
      editor.project({ width: 80, height: 24, caps });
      return performance.now() - startedAt;
    };
    measure();
    const samples = Array.from({ length: 5 }, measure);

    expect(p95(samples)).toBeLessThanOrEqual(16);
  });
});
