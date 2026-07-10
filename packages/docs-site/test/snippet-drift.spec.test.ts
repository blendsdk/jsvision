/**
 * Specification test (immutable oracle) — shown code is running code.
 *
 * Every example's docs page frames its source two ways, both via VitePress's
 * `<<<` file-import directive (never a hand-pasted fenced block, which would
 * drift):
 *  - the **`#example` region** (`<<< @/<sourcePath>#example`) — the composition
 *    body shown by default, minus the top JSDoc header + imports; and
 *  - the **whole module** (`<<< @/<sourcePath>`) — behind a collapsible details
 *    block, so nothing is hidden.
 * Because both come from the compiled module, the shown code is provably the
 * exact code that runs. Each example module carries a matching
 * `// #region example` / `// #endregion example` pair so the region embed always
 * resolves to real lines.
 */
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
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

test('ST-D1: every example page embeds the #example region AND the whole module, on exactly one page', () => {
  for (const entry of EXAMPLES) {
    const region = `<<< @/${entry.sourcePath}#example`; // may carry a `{ts}` lang suffix
    const full = `<<< @/${entry.sourcePath}`; // the whole-file form — no `#region`
    const hostsRegion = PAGES.filter((p) => p.text.split('\n').some((l) => l.trim().startsWith(region)));
    expect(hostsRegion.length, `${entry.id}: exactly one page embeds the #example region`).toBe(1);
    // The same page must also embed the whole module (the details block) as an exact whole-file line.
    const hasFull = hostsRegion[0].text.split('\n').some((l) => l.trim() === full);
    expect(hasFull, `${entry.id}: the region page must also embed the whole module (details block)`).toBe(true);
  }
});

test('ST-D2: every example module carries a matching #region example / #endregion example pair', () => {
  for (const entry of EXAMPLES) {
    const src = readFileSync(join(PKG_ROOT, entry.sourcePath), 'utf8');
    expect(src, `${entry.sourcePath}: missing '// #region example'`).toContain('// #region example');
    expect(src, `${entry.sourcePath}: missing '// #endregion example'`).toContain('// #endregion example');
  }
});

test('ST-D1: no example page hand-pastes example source in a fenced block', () => {
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
