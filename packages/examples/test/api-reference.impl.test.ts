import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

import { extractPackageApi } from '../../../scripts/gen-plugin-api.mjs';

test('interface extraction preserves optional method markers', () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), 'jsvision-api-extract-'));
  const entry = join(fixtureDir, 'index.ts');
  writeFileSync(
    entry,
    [
      'export interface TerminalAdapter {',
      '  attachCustomKeyEventHandler?(handler: (key: string) => boolean): void;',
      '  focus?(): void;',
      '  dispose?(): void;',
      '}',
    ].join('\n'),
    'utf8',
  );

  try {
    const terminal = extractPackageApi(entry, fixtureDir).find((item) => item.name === 'TerminalAdapter');
    expect(terminal?.fields?.map((field) => field.sig)).toEqual([
      'attachCustomKeyEventHandler?(handler: (key: string) => boolean): void',
      'focus?(): void',
      'dispose?(): void',
    ]);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
