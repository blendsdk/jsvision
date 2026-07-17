// Generator for the jsvision Claude Code plugin's API reference (references/api/*.md).
//
// Turns the compact export digests from api-extract.mjs into per-category markdown pages an agent can
// consult INSTEAD of grepping the SDK source: every public export of @jsvision/ui, @jsvision/web, and
// @jsvision/files with its lead sentence and its call surface (constructor + own members, options
// fields, type definition, or function/const signature). Output is deterministic (stable order, no
// timestamps) so the plugin gate can diff a fresh generation against the committed files and flag
// drift — the same discipline the recipe snippets use.
//
// Pure ESM. `generateApiDocs()` returns the file map (for the gate + tests); `writeApiDocs()` is the
// `--fix` path; `main()` is guarded so importing this module has no side effects.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { extractPackageApi } from './api-extract.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const API_DIR = join('tools', 'claude-plugin', 'skills', 'jsvision', 'references', 'api');

/** The three packages an app author imports, and each barrel's entry point. */
export const PACKAGES = [
  { pkg: 'ui', entry: join('packages', 'ui', 'src', 'index.ts') },
  { pkg: 'web', entry: join('packages', 'web', 'src', 'index.ts') },
  { pkg: 'files', entry: join('packages', 'files', 'src', 'index.ts') },
];

/** Category order + titles. Every export lands in exactly one; the slug is the page file name. */
export const CATEGORIES = [
  { slug: 'reactivity', title: 'Reactivity', blurb: 'Signals, computeds, effects, and reactive control flow.' },
  {
    slug: 'layout-views',
    title: 'Layout & view system',
    blurb: 'The `col`/`row`/`stack` DSL, `View`/`Group`, layout props, and the render root.',
  },
  { slug: 'controls', title: 'Controls', blurb: 'Leaf input widgets and the `Input` validators.' },
  {
    slug: 'containers',
    title: 'Containers, scrolling, lists & tabs',
    blurb: 'Scroll bars, scrollers, list views, dialogs, dropdowns, tabs, and split panes.',
  },
  { slug: 'data-views', title: 'Data views', blurb: 'The `DataGrid` table and the `Tree` outline.' },
  { slug: 'feedback', title: 'Feedback', blurb: 'Progress bars and spinners.' },
  {
    slug: 'date-color',
    title: 'Date & color pickers',
    blurb: 'Calendars, date pickers, color swatches, and color pickers.',
  },
  {
    slug: 'surfaces-terminal',
    title: 'Surfaces & terminal',
    blurb: 'Offscreen surfaces and the scrollback terminal view.',
  },
  { slug: 'text-editing', title: 'Text editing', blurb: 'The multi-line `Editor`, `Memo`, and edit-window chrome.' },
  {
    slug: 'app-shell',
    title: 'App shell',
    blurb: 'Application, desktop, windows, menus, status line, and the event loop.',
  },
  {
    slug: 'core-essentials',
    title: 'Core essentials',
    blurb: 'Capabilities, input, keymaps, and style re-exported from `@jsvision/core`.',
  },
  {
    slug: 'web',
    title: '@jsvision/web — browser runtime',
    blurb: 'Mount an app in an xterm.js terminal; the in-memory browser file system.',
  },
  {
    slug: 'files',
    title: '@jsvision/files — file dialogs & editor',
    blurb: 'File/dir dialogs, the file-system seam, and the openers.',
  },
];

/** `@jsvision/ui` source segment → category slug. Anything unmapped in ui falls to `core-essentials`. */
const UI_SEGMENT_CATEGORY = {
  reactive: 'reactivity',
  layout: 'layout-views',
  view: 'layout-views',
  controls: 'controls',
  scroll: 'containers',
  list: 'containers',
  dropdown: 'containers',
  dialog: 'containers',
  tabs: 'containers',
  split: 'containers',
  table: 'data-views',
  tree: 'data-views',
  feedback: 'feedback',
  date: 'date-color',
  color: 'date-color',
  surface: 'surfaces-terminal',
  terminal: 'surfaces-terminal',
  editor: 'text-editing',
  app: 'app-shell',
  desktop: 'app-shell',
  window: 'app-shell',
  menu: 'app-shell',
  status: 'app-shell',
  event: 'app-shell',
};

/**
 * The category slug an export belongs to. `@jsvision/web` and `@jsvision/files` each map to a single
 * package page; `@jsvision/ui` maps by its source segment, with core re-exports (and anything
 * unmapped) collected under `core-essentials`.
 *
 * @param {string} pkg The package the export came from (`'ui'` | `'web'` | `'files'`).
 * @param {string} file The export's repo-relative declaration path.
 * @returns {string} The category slug.
 */
export function categoryFor(pkg, file) {
  if (pkg === 'web') return 'web';
  if (pkg === 'files') return 'files';
  if (/packages\/core\//.test(file)) return 'core-essentials';
  const seg = (file.match(/packages\/ui\/src\/([^/]+)/) ?? [])[1];
  return (seg && UI_SEGMENT_CATEGORY[seg]) ?? 'core-essentials';
}

/** Strip `{@link X}` / `{@linkcode X}` to plain `X` and collapse whitespace, for clean prose. */
function cleanProse(text) {
  return text
    .replace(/\{@link(?:code|plain)?\s+([^}|]+?)(?:\s*\|[^}]*)?\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Render one export digest to a markdown section (heading + lead + a single fenced signature block). */
export function renderExport(e) {
  const out = [`## ${e.name}`, ''];
  const lead = cleanProse(e.lead);
  if (lead !== '') out.push(lead, '');

  const code = [];
  if (e.kind === 'class') {
    code.push(`${e.construct}${e.extends ? `   // extends ${e.extends}` : ''}`);
    if (e.members && e.members.length > 0) {
      code.push('// methods & signals:');
      for (const m of e.members) code.push(m);
    }
  } else if (e.kind === 'interface') {
    code.push(`interface ${e.title} {`);
    for (const f of e.fields) code.push(`  ${f.sig};${f.doc ? `   // ${cleanProse(f.doc)}` : ''}`);
    code.push('}');
  } else if (e.kind === 'type') {
    code.push(`type ${e.def}`);
  } else if (e.kind === 'function') {
    code.push(e.sig);
  } else if (e.kind === 'const') {
    code.push(`const ${e.sig}`);
  } else if (e.kind === 'enum') {
    code.push(`enum ${e.name} { ${e.members.join(', ')} }`);
  }

  if (code.length > 0) {
    out.push('```ts', ...code, '```', '');
  }
  return out.join('\n').trimEnd();
}

const BANNER =
  '<!-- GENERATED FILE — do not edit by hand. Regenerate with `yarn plugin:sync --fix`. Source: @jsvision/* JSDoc. -->';

/** Render a full category page from its (name-sorted) export digests. */
export function renderCategory(category, exportsInCat) {
  const sorted = [...exportsInCat].sort((a, b) => a.name.localeCompare(b.name));
  const head = [
    BANNER,
    `# API — ${category.title}`,
    category.blurb,
    'Signatures are copied from the source types; every field/member carries the one-line intent from its JSDoc. Import everything from the package barrel (`@jsvision/ui` unless noted). For usage patterns see the recipes and `component-catalog.md`; this page is the exact-signature lookup.',
  ].join('\n\n');
  // A blank line between each export section keeps the page readable and diff-friendly.
  return [head, ...sorted.map(renderExport)].join('\n\n').trimEnd() + '\n';
}

/** Render the API index page: the routing entry point over the category pages. */
export function renderIndex(counts) {
  const rows = CATEGORIES.filter((c) => (counts[c.slug] ?? 0) > 0).map(
    (c) => `- [${c.title}](./${c.slug}.md) — ${c.blurb} (${counts[c.slug]} exports)`,
  );
  return (
    [
      BANNER,
      '',
      '# API reference',
      '',
      "The exact public API of `@jsvision/ui`, `@jsvision/web`, and `@jsvision/files` — every export's constructor/options/methods/types with the one-line intent from its source JSDoc. **Consult this before reading the SDK source:** if you need a prop name, a method signature, or a type, it is here. The pages are generated from the source, so they never drift.",
      '',
      'When you already know which widget you want, open its category page and copy the signature. When you are choosing a widget, start from `../component-catalog.md`; for how to compose them, see `../recipes/index.md` and `../layout.md`.',
      '',
      '## Categories',
      '',
      ...rows,
      '',
    ].join('\n') + '\n'
  );
}

/**
 * Generate the whole API reference as an in-memory map of `{ relPath: content }` (relative to the api
 * dir), plus the flat list of every covered export `name`. Pure and deterministic — the gate diffs
 * this against the committed files, and a test asserts the coverage list equals the barrels.
 *
 * @param {string} [rootDir] Repo root (default: the script's repo).
 * @returns {{ files: Record<string, string>, names: string[] }}
 * @example
 * const { files } = generateApiDocs();
 * files['controls.md']; // the rendered Controls page
 */
export function generateApiDocs(rootDir = ROOT) {
  const all = [];
  for (const { pkg, entry } of PACKAGES) {
    for (const e of extractPackageApi(join(rootDir, entry), rootDir)) {
      all.push({ ...e, category: categoryFor(pkg, e.file) });
    }
  }

  const counts = {};
  for (const e of all) counts[e.category] = (counts[e.category] ?? 0) + 1;

  const files = { 'index.md': renderIndex(counts) };
  for (const category of CATEGORIES) {
    const inCat = all.filter((e) => e.category === category.slug);
    if (inCat.length > 0) files[`${category.slug}.md`] = renderCategory(category, inCat);
  }
  return { files, names: all.map((e) => e.name).sort((a, b) => a.localeCompare(b)) };
}

/**
 * Write the generated API reference to disk under the plugin's `references/api/` directory.
 *
 * @param {string} [rootDir] Repo root (default: the script's repo).
 * @returns {string[]} The relative file paths written.
 */
export function writeApiDocs(rootDir = ROOT) {
  const { files } = generateApiDocs(rootDir);
  const dir = join(rootDir, API_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const written = [];
  for (const [rel, content] of Object.entries(files)) {
    writeFileSync(join(dir, rel), content);
    written.push(rel);
  }
  return written;
}

/**
 * Compare the committed API reference on disk against a fresh generation. Reports any file whose
 * content differs, is missing, or is present on disk but no longer generated (stale).
 *
 * @param {string} [rootDir] Repo root (default: the script's repo).
 * @returns {string[]} Human-readable drift messages (empty when the reference is in sync).
 */
export function checkApiDrift(rootDir = ROOT) {
  const { files } = generateApiDocs(rootDir);
  const dir = join(rootDir, API_DIR);
  const errors = [];
  for (const [rel, content] of Object.entries(files)) {
    const path = join(dir, rel);
    if (!existsSync(path)) {
      errors.push(`api/${rel}: missing (run \`yarn plugin:sync --fix\`)`);
    } else if (readFileSync(path, 'utf8') !== content) {
      errors.push(`api/${rel}: out of date (run \`yarn plugin:sync --fix\`)`);
    }
  }
  return errors;
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--check')) {
    const errors = checkApiDrift();
    if (errors.length === 0) {
      process.stdout.write('api-reference: in sync\n');
    } else {
      for (const e of errors) process.stdout.write(`  - ${e}\n`);
      process.exitCode = 1;
    }
    return;
  }
  const written = writeApiDocs();
  process.stdout.write(`generated ${written.length} API page(s) under ${API_DIR}\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
