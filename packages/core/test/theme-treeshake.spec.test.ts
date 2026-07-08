/**
 * Specification test (immutable oracle) — jsvision-ui RD-22 theming tree-shake (ST-26).
 *
 * Source: RD-22 AC-17 → ST-26 (plans/theming/07-testing-strategy.md; 03-04-presets-and-governance.md).
 * Presets are plain-data named exports, so importing one must let a real bundler drop the others. We
 * bundle the BUILT ESM entry importing only `nordTheme` and assert the other curated presets'
 * canonical background hexes are absent from the bundle text (their initializers were tree-shaken).
 *
 * Depends on `dist/` existing; `verify` builds before test. The `.js` dist specifier is the real
 * shipped path; esbuild resolves it against the repo root.
 */
import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Bundle a one-line ESM entry against the built engine and return the (un-minified) output text. */
async function bundleText(importLine: string): Promise<string> {
  const out = await build({
    stdin: { contents: importLine, resolveDir: repoRoot, loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
  });
  return out.outputFiles[0].text;
}

test('ST-26: importing only nordTheme tree-shakes the other curated presets out of the bundle', async () => {
  const text = await bundleText(`import { nordTheme } from './dist/engine/index.js'; console.log(nordTheme);`);
  expect(text.includes('#2e3440'), 'nord background retained').toBe(true);
  for (const hex of ['#282a36', '#002b36', '#282828']) {
    expect(text.includes(hex), `${hex} (another preset) dropped`).toBe(false);
  }
});
