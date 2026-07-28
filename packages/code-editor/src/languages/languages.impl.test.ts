import { describe, expect, it } from 'vitest';

import {
  createLanguageScheduler,
  inspectInvisibleCharacters,
  LanguageRegistry,
  querySyntaxViewport,
} from '../index.js';
import { javascriptLanguageAdapter } from './javascript.js';
import { postgresqlLanguageAdapter } from './postgresql.js';
import { typescriptLanguageAdapter } from './typescript.js';
import { plainLanguageAdapter } from './builtins.js';

function createRegistry(): LanguageRegistry {
  return new LanguageRegistry([
    plainLanguageAdapter,
    javascriptLanguageAdapter,
    typescriptLanguageAdapter,
    postgresqlLanguageAdapter,
  ]);
}

describe('language implementation boundaries', () => {
  it('rejects incompatible adapter contracts', () => {
    expect(
      () =>
        new LanguageRegistry([
          // @ts-expect-error This deliberately exercises the runtime major-version boundary.
          { contractVersion: 2, id: 'future', extensions: [], analyze: () => ({}) },
        ]),
    ).toThrow();
  });

  it('discards a generation superseded before its parser starts', async () => {
    const scheduler = createLanguageScheduler();
    const adapter = createRegistry().get('javascript');
    const first = scheduler.analyze(adapter, 'const first = 1;', { lineage: 'doc', revision: 0 });
    const second = scheduler.analyze(adapter, 'const second = 2;', { lineage: 'doc', revision: 1 });

    expect((await first).state).toBe('degraded');
    expect((await second).state).toBe('ready');
  });

  it('cancels cooperative parser work before its next slice', async () => {
    let slices = 0;
    const adapter = {
      contractVersion: 1 as const,
      id: 'cooperative',
      extensions: [],
      async syntax(_text: string, context: { yieldControl(): Promise<void> }) {
        slices += 1;
        await context.yieldControl();
        slices += 1;
        return { items: [] };
      },
    };
    const scheduler = createLanguageScheduler();
    const first = scheduler.analyze(adapter, 'first', { lineage: 'doc', revision: 0 });
    await Promise.resolve();
    const second = scheduler.analyze(adapter, 'second', { lineage: 'doc', revision: 1 });

    expect((await first).state).toBe('degraded');
    expect((await second).state).toBe('ready');
    expect(slices).toBe(3);
  });

  it('runs independently optional language capabilities', async () => {
    const result = await createLanguageScheduler().analyze(
      {
        contractVersion: 1,
        id: 'syntax-only',
        extensions: [],
        syntax: async () => ({ items: [{ from: 0, to: 4, category: 'keyword' as const }] }),
      },
      'word',
      { lineage: 'doc', revision: 0 },
    );

    expect(result.state).toBe('ready');
    expect(result.syntax).toHaveLength(1);
    expect(result.folds).toEqual([]);
    expect(result.brackets).toEqual([]);
  });

  it('rejects capability output produced beyond the shared ceiling', async () => {
    const result = await createLanguageScheduler({ maxResults: 1 }).analyze(
      {
        contractVersion: 1,
        id: 'excessive',
        extensions: [],
        brackets: async () => ({
          items: [
            { open: 0, close: 1 },
            { open: 2, close: 3 },
          ],
        }),
      },
      '()()',
      { lineage: 'doc', revision: 0 },
    );

    expect(result.state).toBe('degraded');
    expect(result.brackets).toEqual([]);
  });

  it('rejects adapter getters without evaluating them', async () => {
    let evaluated = false;
    const adapter = Object.defineProperty({ contractVersion: 1, id: 'getter', extensions: [] }, 'syntax', {
      get() {
        evaluated = true;
        throw new Error('hostile getter');
      },
    });
    const result = await createLanguageScheduler().analyze(adapter, 'safe', {
      lineage: 'doc',
      revision: 0,
    });

    expect(result.state).toBe('degraded');
    expect(evaluated).toBe(false);
  });

  it('excludes brackets inside strings and comments', async () => {
    const scheduler = createLanguageScheduler();
    const adapter = createRegistry().get('javascript');
    const result = await scheduler.analyze(adapter, 'const text = "{"; // [\nfunction run() { return 1; }', {
      lineage: 'doc',
      revision: 0,
    });

    expect(result.brackets).toEqual([
      expect.objectContaining({ open: expect.any(Number), close: expect.any(Number) }),
      expect.objectContaining({ open: expect.any(Number), close: expect.any(Number) }),
    ]);
  });

  it('does not match malformed cross-nested brackets', async () => {
    const result = await createLanguageScheduler().analyze(createRegistry().get('javascript'), '([)]', {
      lineage: 'doc',
      revision: 0,
    });

    expect(result.brackets).toEqual([]);
  });

  it('uses PostgreSQL parser locations for bounded multiline statement folds', async () => {
    const result = await createLanguageScheduler().analyze(postgresqlLanguageAdapter, 'SELECT\n  1;', {
      lineage: 'sql',
      revision: 0,
    });

    expect(result.state).toBe('ready');
    expect(result.folds).toContainEqual({ from: 0, to: 10 });
  });

  it('rejects hostile fold and bracket coordinates', async () => {
    const result = await createLanguageScheduler().analyze(
      {
        contractVersion: 1,
        id: 'hostile-structure',
        extensions: [],
        analyze: () => ({
          syntax: [],
          folds: [{ from: 0, to: 99 }],
          brackets: [{ open: 2, close: 1 }],
        }),
      },
      'safe',
      { lineage: 'doc', revision: 0 },
    );

    expect(result.state).toBe('degraded');
    expect(result.folds).toEqual([]);
    expect(result.brackets).toEqual([]);
  });

  it('bounds viewport syntax queries without changing source spans', async () => {
    const result = await createLanguageScheduler().analyze(
      createRegistry().get('typescript'),
      'const first = 1;\nconst second: number = 2;',
      { lineage: 'doc', revision: 0 },
    );
    const visible = querySyntaxViewport(result.syntax, 17, 42, 0);

    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((span) => span.to > 17 && span.from < 42)).toBe(true);
  });

  it('reports Unicode security controls by UTF-16 offset', () => {
    expect(inspectInvisibleCharacters('😀\u202Ename')).toEqual([
      { offset: 2, codePoint: 'U+202E', label: 'warning U+202E' },
    ]);
  });
});
