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
    const regionCount = 5_000;
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

    controller.foldAll();
    const measure = (): number => {
      const startedAt = performance.now();
      editor.project({ width: 80, height: 24, caps });
      return performance.now() - startedAt;
    };
    measure();
    const samples = Array.from({ length: 5 }, measure);

    expect(p95(samples)).toBeLessThanOrEqual(16);
  });

  it('validates deeply nested fold identities without retaining complete ancestor paths', () => {
    const depth = 3_000;
    const text = `${'{\n'.repeat(depth)}value\n${'}\n'.repeat(depth)}`;
    const document = createDocumentModel({ text, languageId: 'typescript' });
    const controller = createCodeEditorController({ document });
    const startedAt = performance.now();

    controller.setLanguageResult({
      identity: document.identity,
      adapterId: 'typescript',
      generation: 1,
      state: 'ready',
      syntax: [],
      brackets: [],
      folds: Array.from({ length: depth }, (_, index) => ({
        from: Number(document.snapshot.line(index).from),
        to: Number(document.snapshot.line(depth * 2 - index).to),
      })),
    });

    expect(performance.now() - startedAt).toBeLessThanOrEqual(100);
    expect(controller.foldableRegions).toHaveLength(depth);
  });

  it('finds a visible target through many collapsed siblings within one frame budget', () => {
    const regionCount = 50_000;
    const text = Array.from({ length: regionCount }, (_, index) => `block_${index} {\n  value;\n}`).join('\n');
    const document = createDocumentModel({ text: `${text}\ntail`, languageId: 'typescript' });
    const controller = createCodeEditorController({ document });
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
    controller.foldAll();
    // Resolve the target once so the benchmark measures fold-index lookup rather than full source
    // materialization through the document's convenience `text` getter.
    const targetOffset = document.snapshot.length;
    const measure = (): number => {
      const startedAt = performance.now();
      expect(controller.revealOffset(targetOffset)).toBe(false);
      return performance.now() - startedAt;
    };
    measure();
    const samples = Array.from({ length: 5 }, measure);

    expect(p95(samples)).toBeLessThanOrEqual(16);
  });
});
