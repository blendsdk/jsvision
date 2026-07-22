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
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(PKG_ROOT, '..', '..');
/**
 * The agent-facing plugin skill tree. It is teaching material like these pages, but nothing compiles
 * it and no other test reads it, so a snippet there can teach a dead idiom indefinitely — which is
 * exactly what happened to it once already.
 */
const PLUGIN_SKILLS = join(REPO_ROOT, 'tools', 'claude-plugin', 'skills');
/**
 * The scaffolder's app templates. These are the highest-stakes teaching surface in the repo: their
 * rendered output is the first file a new user ever opens. A `.tmpl` is not TypeScript, so no
 * compiler reads it directly — the scaffolder's own oracle now type-checks the rendered `main.ts`,
 * but the other templates and the prose beside them are still unchecked, which is how a banned
 * idiom lived in all four starters undetected.
 */
const PLUGIN_TEMPLATES = join(REPO_ROOT, 'tools', 'claude-plugin', 'templates');
const SKIP_DIRS = new Set(['node_modules', 'dist', 'cache', '.git']);

/**
 * Every teaching file under a directory, as absolute paths.
 * @param dir Directory to walk (defaults to the docs package).
 * @param exts File extensions to collect.
 */
function markdownPages(dir: string = PKG_ROOT, exts: readonly string[] = ['.md']): string[] {
  const out: string[] = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(dirent.name)) continue;
    const abs = join(dir, dirent.name);
    if (dirent.isDirectory()) out.push(...markdownPages(abs, exts));
    else if (exts.some((ext) => dirent.name.endsWith(ext))) out.push(abs);
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

/** The docs pages, the plugin skill tree, and the app templates — every surface that teaches this framework. */
const TEACHING_PAGES = [
  ...markdownPages(),
  ...markdownPages(PLUGIN_SKILLS),
  ...markdownPages(PLUGIN_TEMPLATES, ['.md', '.tmpl', '.txt']),
].map((p) => ({
  path: p,
  text: readFileSync(p, 'utf8'),
}));

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

// A documentation snippet is a teaching artifact, so it is held to the idiom the framework permits.
// `view.layout = {…}` no longer compiles, and unlike shipped source no compiler ever reads these
// pages — a stale snippet would sit here teaching a dead idiom until a reader tried it.
//
// Whole pages, not just fenced blocks: half the offenders this caught were inline prose describing
// the assignment as the way to place a window. And the plugin skill tree is included because its
// audience is an AI agent writing this framework, which makes a dead idiom there costlier than
// anywhere else — it gets reproduced rather than merely read.
const LAYOUT_ASSIGNMENT = /\.layout(\.\w+)*\s*=[^=]/;

test('no teaching page assigns the layout field directly', () => {
  const offenders: string[] = [];
  for (const page of TEACHING_PAGES) {
    // The generated API reference states the field's type (`layout: Readonly<LayoutProps>`) and
    // reproduces its JSDoc, which names the closed spellings; it documents the contract rather than
    // teaching a call, so it is not a snippet surface. This is also the only escape hatch: because
    // the scan covers whole pages, a page cannot show the assignment even as a labelled
    // anti-pattern. Separators are normalized first, or the exemption silently stops matching on
    // Windows, where CI also runs this project.
    if (page.path.split(sep).join('/').includes('/references/api/')) continue;
    page.text.split('\n').forEach((line, i) => {
      if (LAYOUT_ASSIGNMENT.test(line)) offenders.push(`${page.path}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(offenders, 'write these with setLayout({ … }) — the layout field is read-only').toEqual([]);
});
