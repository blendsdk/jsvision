/**
 * Specification test (guard) — example pages must not hand-paste example source.
 *
 * The showcase pages describe a component in prose and run it live via the Play
 * component; they deliberately do NOT embed the example module's source (readers
 * follow the GitHub link for that). This guard keeps it that way: no example page
 * may paste an example module's `defineExample(...)` body into a fenced code block,
 * which would silently drift from the real module.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';

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

/** A page is an "example page" if it hosts the Play component. */
function isExamplePage(text: string): boolean {
  return /<PlayExample\b/.test(text);
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

test('example pages never hand-paste example module source in a fenced block', () => {
  for (const page of PAGES) {
    if (!isExamplePage(page.text)) continue;
    for (const body of fencedTsBlocks(page.text)) {
      expect(
        body.includes('defineExample('),
        `${page.path}: pasted example source in a fenced block — link to GitHub instead`,
      ).toBe(false);
    }
  }
});
