import { describe, expect, it } from 'vitest';

import {
  createLanguageScheduler,
  indentLines,
  inspectInvisibleCharacters,
  LanguageRegistry,
  toggleLineComments,
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

describe('local language features', () => {
  it('selects launch languages deterministically', () => {
    const registry = createRegistry();

    expect(registry.resolve({ explicitId: 'typescript', filename: 'query.sql' }).id).toBe('typescript');
    expect(registry.resolve({ filename: 'QUERY.PGSQL' }).id).toBe('postgresql');
    expect(registry.resolve({ filename: 'module.mjs' }).id).toBe('javascript');
    expect(registry.resolve({ filename: 'unknown.txt' }).id).toBe('plain');
  });

  it('keeps language switching independent from document state', async () => {
    const registry = createRegistry();
    const scheduler = createLanguageScheduler();
    const text = 'const value: number = 1;';
    const javascript = await scheduler.analyze(registry.get('javascript'), text, {
      lineage: 'document',
      revision: 0,
    });
    const typescript = await scheduler.analyze(registry.get('typescript'), text, {
      lineage: 'document',
      revision: 0,
    });

    expect(javascript.identity).toEqual(typescript.identity);
    expect(javascript.adapterId).toBe('javascript');
    expect(typescript.adapterId).toBe('typescript');
  });

  it('returns bounded semantic syntax for valid and incomplete launch-language source', async () => {
    const registry = createRegistry();
    const scheduler = createLanguageScheduler();

    for (const [id, text] of [
      ['javascript', 'function greet(name) { return "hi " + name'],
      ['typescript', 'type User = { name: string'],
      ['postgresql', 'SELECT id, name FROM users WHERE'],
    ] as const) {
      const result = await scheduler.analyze(registry.get(id), text, { lineage: id, revision: 0 });
      expect(result.state).toBe('ready');
      expect(result.syntax.length).toBeGreaterThan(0);
      expect(result.syntax.every((span) => span.from >= 0 && span.to <= text.length && span.from < span.to)).toBe(true);
    }
  });

  it('produces equivalent current results after incremental and clean analysis', async () => {
    const registry = createRegistry();
    const scheduler = createLanguageScheduler();
    const adapter = registry.get('javascript');
    const initial = await scheduler.analyze(adapter, 'const value = 1;', { lineage: 'doc', revision: 0 });
    const incremental = await scheduler.analyze(adapter, 'const value = 12;', { lineage: 'doc', revision: 1 }, initial);
    const clean = await createLanguageScheduler().analyze(adapter, 'const value = 12;', {
      lineage: 'doc',
      revision: 1,
    });

    expect(incremental.syntax).toEqual(clean.syntax);
    expect(incremental.folds).toEqual(clean.folds);
    expect(incremental.brackets).toEqual(clean.brackets);
  });

  it('isolates invalid adapter output and preserves plain analysis', async () => {
    const scheduler = createLanguageScheduler({ maxResults: 4 });
    const result = await scheduler.analyze(
      {
        contractVersion: 1,
        id: 'hostile',
        extensions: [],
        analyze: () => ({ syntax: [{ from: -1, to: 99, category: 'keyword' }], folds: [], brackets: [] }),
      },
      'safe',
      { lineage: 'doc', revision: 0 },
    );

    expect(result.state).toBe('degraded');
    expect(result.syntax).toEqual([]);
  });

  it('provides language-aware indentation and line comments without corrupting text', () => {
    const registry = createRegistry();
    const javascript = registry.get('javascript');

    expect(indentLines('one\n  two', [0, 1], { unit: '  ', direction: 'indent' })).toBe('  one\n    two');
    expect(toggleLineComments('  one\n    two', [0, 1], javascript.comments)).toBe('  // one\n  //   two');
    expect(toggleLineComments('  // one\n  //   two', [0, 1], javascript.comments)).toBe('  one\n    two');
  });

  it('preserves hostile invisible code units while exposing safe warning labels', () => {
    const text = `safe\u202Ename\u200B\u001B`;
    const warnings = inspectInvisibleCharacters(text);

    expect(warnings.map((warning) => warning.codePoint)).toEqual(['U+202E', 'U+200B', 'U+001B']);
    expect(warnings.every((warning) => !warning.label.includes('\u001B'))).toBe(true);
    expect(text).toContain('\u202E');
  });
});
