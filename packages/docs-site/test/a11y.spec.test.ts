/**
 * Specification test (immutable oracle) — the always-in-DOM accessibility region.
 *
 * The terminal canvas is opaque to assistive tech, so the accessible content lives
 * beside it: a prose blurb and a real ARIA-labelled Play button. This oracle checks
 * the Play component renders the labelled button + the blurb, and (as example pages
 * land) that every registry example has a page mounting its Play component.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { EXAMPLES } from '../examples/index.js';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAY_VUE = readFileSync(join(PKG_ROOT, '.vitepress/theme/components/PlayExample.vue'), 'utf8');

/** Every `.md` under `dir` (recursive); `[]` if the directory is absent. */
function walkMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) out.push(...walkMarkdown(abs));
    else if (dirent.name.endsWith('.md')) out.push(abs);
  }
  return out;
}

const EXAMPLE_PAGES = ['components', 'apps']
  .flatMap((dir) => walkMarkdown(join(PKG_ROOT, dir)))
  .map((p) => readFileSync(p, 'utf8'));

test('ST-11: the Play component renders a real ARIA-labelled button', () => {
  expect(PLAY_VUE).toMatch(/<button[\s\S]*?aria-label/);
});

test('ST-11: the Play component renders the blurb (server-rendered, in the DOM without JS)', () => {
  expect(PLAY_VUE).toContain('props.blurb');
});

test('ST-11: every example page mounts its Play component', () => {
  for (const entry of EXAMPLES) {
    const page = EXAMPLE_PAGES.find((text) => text.includes(`<PlayExample id="${entry.id}"`));
    expect(page, `${entry.id}: a page with <PlayExample id="${entry.id}"> exists`).toBeTruthy();
  }
});
