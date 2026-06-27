/**
 * Specification tests — Toolchain enforcement (RD-01, ST-8…ST-12).
 *
 * Immutable oracle: expectations derive from the acceptance criteria
 * (AC-2, AC-5, AC-6), the component specs (03-02, 03-03), and the Ambiguity
 * Register (PL-8) — never from reading the implementation. If a test here fails
 * after implementation, the implementation is wrong.
 *
 * All cases exercise real tools (tsc, the guard script, the test runner) against
 * real temp fixtures rather than mocking (testing standard: prefer real objects).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url)); // src/engine
const repoRoot = resolve(here, '..', '..');

/** Create a fresh temp directory; the caller is responsible for cleanup. */
function makeTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * A copy of the environment with `NODE_TEST_CONTEXT` removed. Spawning a nested
 * `node:test` run (e.g. `tsx --test`) from inside a test would otherwise trip
 * Node's recursion guard ("run() is being called recursively") and skip files.
 */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env['NODE_TEST_CONTEXT'];
  return env;
}

/** Resolve the local TypeScript compiler entry as a node-runnable script. */
function tscCli(): string {
  return require.resolve('typescript/bin/tsc');
}

/** Resolve the local tsx CLI entry from its package manifest (cross-platform). */
function tsxCli(): string {
  const pkgPath = require.resolve('tsx/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { bin: string | Record<string, string> };
  const rel = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin['tsx'];
  return resolve(dirname(pkgPath), rel);
}

/** Run the dependency-policy guard against a project root; never throws. */
function runGuard(rootDir: string): { status: number | null; stdout: string; stderr: string } {
  const scriptPath = resolve(repoRoot, 'scripts/check-no-native-deps.mjs');
  const res = spawnSync(process.execPath, [scriptPath, rootDir], { encoding: 'utf8' });
  return { status: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

// ST-8 (AC-5): an unused import fails typecheck under the project's compiler
// options (noUnusedLocals). The fixture tsconfig extends the real project config
// so the assertion proves the project posture, not an ad-hoc flag set.
test('ST-8: a source file with an unused import fails tsc', () => {
  const dir = makeTempDir('rd01-st8-');
  try {
    writeFileSync(join(dir, 'fixture.ts'), "import { readFileSync } from 'node:fs';\nexport const value = 1;\n");
    writeFileSync(
      join(dir, 'tsconfig.json'),
      JSON.stringify({
        extends: resolve(repoRoot, 'tsconfig.json'),
        compilerOptions: { noEmit: true, rootDir: '.', outDir: './out' },
        include: ['fixture.ts'],
      }),
    );
    const res = spawnSync(process.execPath, [tscCli(), '-p', join(dir, 'tsconfig.json')], { encoding: 'utf8' });
    assert.notEqual(res.status, 0, 'tsc should fail on an unused import');
    const output = `${res.stdout}${res.stderr}`;
    assert.ok(
      /6133|declared but never used|never read/.test(output),
      `expected an unused-symbol diagnostic, got:\n${output}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ST-9 (AC-6): the guard passes for a manifest with empty dependencies.
test('ST-9: guard exits 0 for empty dependencies', () => {
  const dir = makeTempDir('rd01-st9-');
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: {} }));
    const res = runGuard(dir);
    assert.equal(res.status, 0, `expected exit 0, got ${res.status}\n${res.stdout}${res.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ST-10 (AC-6): the guard fails and names the offending dep when a runtime dep
// declares a native install signal (gypfile:true on the installed manifest).
test('ST-10: guard fails and names a native runtime dependency', () => {
  const dir = makeTempDir('rd01-st10-');
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '1.0.0', dependencies: { nativelib: '1.0.0' } }),
    );
    const depDir = join(dir, 'node_modules', 'nativelib');
    mkdirSync(depDir, { recursive: true });
    writeFileSync(join(depDir, 'package.json'), JSON.stringify({ name: 'nativelib', version: '1.0.0', gypfile: true }));
    const res = runGuard(dir);
    assert.notEqual(res.status, 0, 'expected a non-zero exit for a native dependency');
    assert.ok(/nativelib/.test(`${res.stdout}${res.stderr}`), 'guard message must name the offending dependency');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ST-11 (AC-2 structure, AR-4, AR-23): the CI workflow covers the full matrix.
test('ST-11: ci.yml declares the 3×3 OS/Node matrix and runs verify', () => {
  const yml = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  for (const os of ['ubuntu-latest', 'macos-latest', 'windows-latest']) {
    assert.ok(yml.includes(os), `ci.yml must reference ${os}`);
  }
  for (const node of ['18', '20', '22']) {
    assert.ok(new RegExp(`(^|[^0-9])${node}([^0-9]|$)`, 'm').test(yml), `ci.yml must reference Node ${node}`);
  }
  assert.ok(/npm run verify/.test(yml), 'ci.yml must invoke npm run verify');
});

// ST-12 (PL-8): the test glob discovers both *.spec.test.ts and *.impl.test.ts.
test('ST-12: the test runner discovers both spec and impl globs', () => {
  const dir = makeTempDir('rd01-st12-');
  try {
    // Distinct test names per fixture: the runner's TAP output reports test
    // names (not file paths), so seeing both names proves both globs matched.
    const fixture = (name: string) => `import { test } from 'node:test';\ntest('${name}', () => {});\n`;
    writeFileSync(join(dir, 'a.spec.test.ts'), fixture('spec-fixture-ran'));
    writeFileSync(join(dir, 'b.impl.test.ts'), fixture('impl-fixture-ran'));
    const glob = join(dir, '**/*.{spec,impl}.test.ts');
    const res = spawnSync(process.execPath, [tsxCli(), '--test', glob], { encoding: 'utf8', env: childEnv() });
    const output = `${res.stdout}${res.stderr}`;
    assert.ok(output.includes('spec-fixture-ran'), `spec glob not discovered:\n${output}`);
    assert.ok(output.includes('impl-fixture-ran'), `impl glob not discovered:\n${output}`);
    assert.equal(res.status, 0, `runner exited non-zero:\n${output}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
