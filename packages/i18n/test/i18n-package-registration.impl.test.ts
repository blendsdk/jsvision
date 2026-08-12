import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, test } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');
const scriptPath = join(repoRoot, 'scripts', 'check-i18n-literals.mjs');
const temporaryRoots: string[] = [];

function createFixture(packages: readonly { readonly name: string; readonly symbolPrefix: string }[]): string {
  const root = mkdtempSync(join(tmpdir(), 'jsvision-i18n-literals-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'tools'), { recursive: true });
  writeFileSync(
    join(root, 'tools', 'i18n-locale-exports.json'),
    `${JSON.stringify({ version: 1, locales: ['en'], packages }, null, 2)}\n`,
  );
  return root;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('configuration-driven literal source discovery', () => {
  test('keeps Kanban locale overlays in foundation, Phase B, then Phase C order', () => {
    const parsed: unknown = JSON.parse(readFileSync(join(repoRoot, 'tools', 'i18n-locale-exports.json'), 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) throw new TypeError('Missing locale export configuration.');
    const packages = Reflect.get(parsed, 'packages');
    if (!Array.isArray(packages)) throw new TypeError('Missing locale package configuration.');
    const kanban = packages.find(
      (entry) => typeof entry === 'object' && entry !== null && Reflect.get(entry, 'name') === 'kanban',
    );

    expect(kanban).toBeDefined();
    expect(Reflect.get(kanban!, 'symbolPrefix')).toBe('kanban');
    expect(Reflect.get(kanban!, 'overlaySymbolPrefixes')).toEqual(['kanbanPhaseB', 'kanbanPhaseC']);
  });

  test('scans the source root of a newly configured safe package', () => {
    const root = createFixture([{ name: 'future-widget', symbolPrefix: 'futureWidget' }]);
    const sourceRoot = join(root, 'packages', 'future-widget', 'src');
    mkdirSync(sourceRoot, { recursive: true });
    writeFileSync(join(sourceRoot, 'view.ts'), "new Button('Future action');\n");

    const result = spawnSync(process.execPath, [scriptPath, '--list'], {
      cwd: root,
      encoding: 'utf8',
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain('"path": "packages/future-widget/src/view.ts"');
    expect(result.stdout).toContain('"literal": "Future action"');
  });

  test('rejects duplicate or unsafe configured package roots before scanning', () => {
    const duplicateRoot = createFixture([
      { name: 'widget', symbolPrefix: 'widget' },
      { name: 'widget', symbolPrefix: 'widgetAgain' },
    ]);
    const unsafeRoot = createFixture([{ name: '../escape', symbolPrefix: 'escape' }]);

    for (const root of [duplicateRoot, unsafeRoot]) {
      const result = spawnSync(process.execPath, [scriptPath, '--list'], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Invalid i18n locale export package configuration.');
    }
  });
});
