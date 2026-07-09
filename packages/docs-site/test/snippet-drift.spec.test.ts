/**
 * Specification test (immutable oracle) — shown code is running code.
 *
 * Every example's docs page must embed its source with VitePress's whole-file
 * region import (`<<< @/examples/<category>/<name>.ts`), never a hand-pasted
 * fenced block. Because the whole file is embedded, the code a reader sees is
 * provably the exact module that runs — no line ranges to drift, no copy to fall
 * behind. This oracle asserts the directive is present for every registry entry
 * and that no example page smuggles in a pasted copy of the source.
 *
 * The registry is empty until the seed examples land; the checks engage
 * automatically as entries + pages are added.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { EXAMPLES } from '../examples/index.js';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'cache', '.git']);

/** Every markdown page under the docs package, as absolute paths. */
function markdownPages(dir: string = PKG_ROOT): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(dirent.name)) continue;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) out.push(...markdownPages(abs));
    else if (dirent.name.endsWith('.md')) out.push(abs);
  }
  return out;
}

/** A page is an "example page" if it embeds any example or hosts the Play component. */
function isExamplePage(text: string): boolean {
  return /<<<\s+@\/examples\//.test(text) || /<PlayExample\b/.test(text);
}

/** The bodies of every fenced TypeScript code block in a page. */
function fencedTsBlocks(text: string): string[] {
  const bodies: string[] = [];
  const re = /```(?:ts|typescript)\b[^\n]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) bodies.push(m[1]);
  return bodies;
}

const PAGES = markdownPages().map((p) => ({ path: p, text: readFileSync(p, 'utf8') }));

test('ST-3: every example embeds its whole source via the <<< directive on exactly one page', () => {
  for (const entry of EXAMPLES) {
    const directive = `<<< @/${entry.sourcePath}`;
    const hosting = PAGES.filter((p) => p.text.includes(directive));
    expect(hosting.length, `${entry.id}: expected exactly one page embedding ${entry.sourcePath}`).toBe(1);
    // The directive must be the whole-file form — no line range or #region marker appended.
    const line = hosting[0].text.split('\n').find((l) => l.includes(directive)) ?? '';
    expect(line.trim(), `${entry.id}: whole-file embed only (no line-range/region)`).toBe(directive);
  }
});

test('ST-3: no example page hand-pastes example source in a fenced block', () => {
  for (const page of PAGES) {
    if (!isExamplePage(page.text)) continue;
    for (const body of fencedTsBlocks(page.text)) {
      expect(
        body.includes('defineExample('),
        `${page.path}: pasted example source in a fenced block — embed with <<< instead`,
      ).toBe(false);
    }
  }
});
