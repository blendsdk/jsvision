/**
 * Code Editor safety-boundary specifications.
 *
 * Documentation fixtures must remain bounded, sanitize hostile protocol presentation, authorize
 * simulated host effects explicitly, and avoid importing the standalone showcase registry.
 */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_MODULE = new URL('../src/example-fixtures/code-editor/safety.js', import.meta.url).href;

interface SafetyFixtureModule {
  readonly MAX_DOCS_DOCUMENT_BYTES: number;
  readonly HOSTILE_PROTOCOL_TEXT: string;
  readonly createBoundedLargeDocument: (lines: number) => string;
  readonly sanitizeProtocolText: (text: string) => string;
}

/** Narrow an unknown module namespace without bypassing the type system. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSafetyFixture(value: unknown): value is SafetyFixtureModule {
  return (
    isRecord(value) &&
    typeof value.MAX_DOCS_DOCUMENT_BYTES === 'number' &&
    typeof value.HOSTILE_PROTOCOL_TEXT === 'string' &&
    typeof value.createBoundedLargeDocument === 'function' &&
    typeof value.sanitizeProtocolText === 'function'
  );
}

describe('bounded Code Editor fixtures', () => {
  test('large-document fixtures enforce a small documentation-only ceiling', async () => {
    const candidate: unknown = await import(FIXTURE_MODULE);
    if (!isSafetyFixture(candidate)) throw new TypeError('invalid Code Editor safety fixture');
    expect(candidate.MAX_DOCS_DOCUMENT_BYTES).toBeLessThanOrEqual(256_000);
    expect(() => candidate.createBoundedLargeDocument(2_001)).toThrow(/bounded/u);
    expect(Buffer.byteLength(candidate.createBoundedLargeDocument(2_000), 'utf8')).toBeLessThanOrEqual(
      candidate.MAX_DOCS_DOCUMENT_BYTES,
    );
  });

  test('hostile protocol text is sanitized before terminal presentation', async () => {
    const candidate: unknown = await import(FIXTURE_MODULE);
    if (!isSafetyFixture(candidate)) throw new TypeError('invalid Code Editor safety fixture');
    const safe = candidate.sanitizeProtocolText(candidate.HOSTILE_PROTOCOL_TEXT);
    expect(safe).not.toMatch(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u);
    expect(safe).not.toContain('\u001b');
    expect(safe).not.toContain('\u202e');
    expect(safe.length).toBeLessThanOrEqual(80);
    expect(safe).toContain('diagnostic');
  });
});

describe('lazy and isolated implementation boundary', () => {
  test('Code Editor registry uses lazy imports and never imports the standalone scenario registry', async () => {
    const source = await readFile(join(PACKAGE_ROOT, 'src/example-registry/code-editor.ts'), 'utf8');
    expect(source).toContain('load: () => import(');
    expect(source).not.toContain('code-editor-demo');
    expect(source).not.toMatch(/^import\s+.*examples\/code-editor/mu);
  });

  test('host and LSP examples avoid workspace internals, network APIs, process launch, and file writes', async () => {
    for (const exampleId of [
      'lsp-completion',
      'lsp-diagnostics',
      'lsp-navigation',
      'safe-terminal-text',
      'host-recovery',
    ]) {
      const source = await readFile(join(PACKAGE_ROOT, `examples/code-editor/${exampleId}.ts`), 'utf8');
      expect(source).not.toContain('packages/');
      expect(source).not.toContain('/src/');
      expect(source).not.toContain('code-editor-demo');
      expect(source).not.toMatch(/\bfetch\s*\(/u);
      expect(source).not.toMatch(/\b(?:spawn|exec|writeFile)\s*\(/u);
    }
  });
});
