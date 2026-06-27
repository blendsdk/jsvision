/**
 * End-to-end packaging spec test (RD-01, ST-13/ST-14).
 *
 * Immutable oracle: expectations derive from AC-1 / AR-6, not from the
 * implementation. Packs the real tarball, installs it into a throwaway consumer
 * project, and asserts:
 *   - ST-13: ESM `import { VERSION } from '@blendsdk/tui'` resolves and the
 *     installed package ships `.d.ts` declarations.
 *   - ST-14: CJS `require('@blendsdk/tui')` fails with an ESM-related error.
 *
 * This is heavier than the unit specs (real `npm pack` + `npm install`) and so
 * lives in `test/` outside the `src/**` unit glob; run it explicitly via
 * `tsx --test test/install.e2e.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // test/
const repoRoot = resolve(here, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

/** Build the tarball into `dest` and return its absolute path. */
function packInto(dest: string): string {
  const out = execFileSync(npm, ['pack', '--json', '--pack-destination', dest], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const json = out.slice(out.indexOf('['), out.lastIndexOf(']') + 1);
  const parsed = JSON.parse(json) as Array<{ filename: string }>;
  return join(dest, parsed[0].filename);
}

test('ST-13/ST-14: packed tarball installs; ESM import works, CJS require fails', () => {
  const work = mkdtempSync(join(tmpdir(), 'rd01-e2e-'));
  try {
    const tarball = packInto(work);

    // A minimal consumer project that installs the tarball.
    const consumer = join(work, 'consumer');
    mkdirSync(consumer, { recursive: true });
    writeFileSync(
      join(consumer, 'package.json'),
      JSON.stringify({ name: 'consumer', version: '1.0.0', private: true }),
    );
    execFileSync(npm, ['install', tarball, '--no-audit', '--no-fund', '--no-save'], {
      cwd: consumer,
      encoding: 'utf8',
    });

    // ST-13: the installed package ships its declaration file.
    const installedDts = join(consumer, 'node_modules', '@blendsdk', 'tui', 'dist', 'engine', 'index.d.ts');
    assert.ok(existsSync(installedDts), '.d.ts must be present in the installed package');

    // ST-13: ESM import resolves and yields the version.
    writeFileSync(join(consumer, 'esm.mjs'), "import { VERSION } from '@blendsdk/tui';\nconsole.log(VERSION);\n");
    const esm = spawnSync(process.execPath, ['esm.mjs'], { cwd: consumer, encoding: 'utf8' });
    assert.equal(esm.status, 0, `ESM import should succeed:\n${esm.stdout}${esm.stderr}`);
    assert.equal(esm.stdout.trim(), '0.1.0');

    // ST-14: CJS require fails with an ESM-related error.
    writeFileSync(join(consumer, 'cjs.cjs'), "require('@blendsdk/tui');\n");
    const cjs = spawnSync(process.execPath, ['cjs.cjs'], { cwd: consumer, encoding: 'utf8' });
    assert.notEqual(cjs.status, 0, 'CJS require of an ESM-only package must fail');
    assert.ok(
      /ERR_REQUIRE_ESM|ERR_PACKAGE_PATH_NOT_EXPORTED|require\(\) of ES Module|Must use import/i.test(cjs.stderr),
      `expected an ESM-related error, got:\n${cjs.stderr}`,
    );
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
