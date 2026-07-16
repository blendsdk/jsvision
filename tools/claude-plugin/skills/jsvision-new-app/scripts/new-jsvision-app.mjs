// Deterministic scaffolder for a new jsvision TUI app package.
//
// Given an app name, it produces a complete, runnable `packages/<slug>/` package (manifest,
// tsconfig, vitest config, a starter `main.ts`, and a headless smoke test) that plugs straight into
// the monorepo's `yarn verify`. The core is a pure, no-fs `buildAppFiles(name, archetype)` returning
// a `Map<relativePath, contents>`, so it is trivially unit-testable; a thin `writeApp` wrapper
// materializes that map on disk and refuses to overwrite an existing package.
//
// An `archetype` picks the starter: `basic` (default) uses only the shared skeleton in
// `../../../templates/app-skeleton/`; any subdirectory of `../../../templates/archetypes/` overlays
// its own `main.ts` (and any other file it provides) on that skeleton. Archetypes are auto-discovered,
// so adding one is a pure content change — no edit here.
//
// Run directly:  node new-jsvision-app.mjs <app-name> [--template <name>]  |  --list

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * The app skeleton: each template file and the repo-relative path its rendered output is written to.
 * The smoke test's filename carries the slug so an app's tests read naturally.
 */
const SKELETON = [
  { file: 'package.json.tmpl', out: (slug) => `packages/${slug}/package.json` },
  { file: 'tsconfig.json.tmpl', out: (slug) => `packages/${slug}/tsconfig.json` },
  { file: 'vitest.config.ts.tmpl', out: (slug) => `packages/${slug}/vitest.config.ts` },
  { file: 'main.ts.tmpl', out: (slug) => `packages/${slug}/src/main.ts` },
  { file: 'smoke.test.ts.tmpl', out: (slug) => `packages/${slug}/test/${slug}.smoke.test.ts` },
];

/** The default archetype: the plain starter, using only the base skeleton (no overrides). */
export const DEFAULT_ARCHETYPE = 'basic';

// Load every template once at module init (not inside buildAppFiles) so buildAppFiles stays a pure,
// fs-free interpolation over pre-loaded strings — the property its unit tests rely on.
const TEMPLATE_ROOT = new URL('../../../templates/', import.meta.url);
const BASE_DIR = new URL('app-skeleton/', TEMPLATE_ROOT);
const ARCHETYPES_DIR = new URL('archetypes/', TEMPLATE_ROOT);

/** The shared base skeleton: file name → template text. Every archetype starts from these. */
const BASE = new Map(SKELETON.map(({ file }) => [file, readFileSync(new URL(file, BASE_DIR), 'utf8')]));

/**
 * Discover the archetypes on disk: each subdirectory of `templates/archetypes/` that provides a
 * `main.ts.tmpl`. An archetype overlays its own copies of one or more skeleton files on top of
 * {@link BASE}; `about.txt` (if present) is its one-line description. Adding an archetype is therefore
 * a pure content change — drop in a directory and it appears here.
 */
function loadArchetypes() {
  const archetypes = new Map();
  let entries;
  try {
    entries = readdirSync(fileURLToPath(ARCHETYPES_DIR), { withFileTypes: true });
  } catch {
    return archetypes; // no archetypes directory yet — only `basic` is available
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = new URL(`${entry.name}/`, ARCHETYPES_DIR);
    const overrides = new Map();
    for (const { file } of SKELETON) {
      const url = new URL(file, dir);
      if (existsSync(fileURLToPath(url))) overrides.set(file, readFileSync(url, 'utf8'));
    }
    if (!overrides.has('main.ts.tmpl')) continue; // an archetype must at least override main.ts
    const aboutUrl = new URL('about.txt', dir);
    const description = existsSync(fileURLToPath(aboutUrl)) ? readFileSync(aboutUrl, 'utf8').trim() : '';
    archetypes.set(entry.name, { description, overrides });
  }
  return archetypes;
}

const ARCHETYPES = loadArchetypes();

/**
 * List the available archetypes — `basic` first, then the discovered ones, alphabetically.
 *
 * @returns {{ name: string, description: string }[]} Each archetype's slug and one-line description.
 * @example
 * listArchetypes(); // → [{ name: 'basic', description: '…' }, { name: 'dashboard', … }, …]
 */
export function listArchetypes() {
  const discovered = [...ARCHETYPES.entries()]
    .map(([name, { description }]) => ({ name, description }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [{ name: DEFAULT_ARCHETYPE, description: 'A plain starter: one window with a greeting.' }, ...discovered];
}

/**
 * Normalize a human app name into a package-safe slug: lowercase, spaces/underscores to dashes,
 * anything outside `[a-z0-9-]` stripped, repeated dashes collapsed, and leading/trailing dashes
 * trimmed. Names that could escape `packages/<slug>/` — containing a path separator, `..`, or an
 * absolute path, or empty — are rejected outright.
 *
 * @param {string} name The raw app name.
 * @returns {string} The package slug (e.g. `my-app`).
 * @throws {Error} If the name is unsafe or normalizes to nothing usable.
 * @example
 * slugify('My App'); // 'my-app'
 */
export function slugify(name) {
  if (typeof name !== 'string') {
    throw new TypeError('app name must be a string');
  }
  const raw = name.trim();
  // Reject traversal / separators / absolute paths before slugging — the generator only ever writes
  // under packages/<slug>/, and these inputs could break out of it.
  if (raw === '' || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    throw new Error(`unsafe app name: ${JSON.stringify(name)}`);
  }
  const slug = raw
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') {
    throw new Error(`app name has no usable characters: ${JSON.stringify(name)}`);
  }
  return slug;
}

/**
 * The `@jsvision/ui` dependency specifier the generated `package.json` uses. This is the single
 * publish-sensitive line: today apps live in this monorepo, so the workspace form (`"*"`) resolves
 * `@jsvision/ui` via yarn workspaces. A future publish flips this one helper to a version range.
 *
 * @returns {string} The dependency specifier (currently the workspace form).
 * @example
 * uiDependency(); // '*'
 */
export function uiDependency() {
  return '*';
}

/**
 * Render a template string: substitute the app slug and the `@jsvision/ui` dependency seam.
 *
 * @param {string} template The raw template text.
 * @param {string} slug The package slug.
 * @returns {string} The rendered file contents.
 */
function render(template, slug) {
  return template.replaceAll('__SLUG__', slug).replaceAll('__UIDEP__', uiDependency());
}

/**
 * Resolve the effective template map for an archetype: the shared {@link BASE} skeleton with the
 * archetype's overrides layered on top. `basic` is the base unchanged.
 *
 * @param {string} archetype The archetype slug.
 * @returns {Map<string, string>} File name → template text, one entry per skeleton file.
 * @throws {Error} If the archetype is unknown.
 */
function templatesFor(archetype) {
  if (archetype === DEFAULT_ARCHETYPE) return BASE;
  const found = ARCHETYPES.get(archetype);
  if (found === undefined) {
    const available = listArchetypes()
      .map((a) => a.name)
      .join(', ');
    throw new Error(`unknown archetype: ${JSON.stringify(archetype)} — available: ${available}`);
  }
  const merged = new Map(BASE);
  for (const [file, text] of found.overrides) merged.set(file, text);
  return merged;
}

/**
 * Build the full set of files for a new app, keyed by their repo-relative path. Pure and fs-free:
 * it interpolates the templates loaded at module init, so it is deterministic and trivially
 * unit-testable. Does not touch disk — see {@link writeApp} to materialize the result.
 *
 * The optional `archetype` picks a starting point (see {@link listArchetypes}); it overlays its own
 * `main.ts` (and any other files it provides) on the shared skeleton, so the file *set* is identical
 * across archetypes — only the starter UI differs. The default `basic` is the plain starter.
 *
 * @param {string} name The raw app name (slugified internally; unsafe names throw).
 * @param {string} [archetype] The archetype slug (default `basic`).
 * @returns {Map<string, string>} A map of `packages/<slug>/…` paths to file contents.
 * @throws {Error} If the name is unsafe (see {@link slugify}) or the archetype is unknown.
 * @example
 * const files = buildAppFiles('todo');            // the plain starter
 * const grid = buildAppFiles('stock', 'grid');    // a sortable DataGrid starter
 * files.get('packages/todo/src/main.ts');         // the starter app source
 */
export function buildAppFiles(name, archetype = DEFAULT_ARCHETYPE) {
  const slug = slugify(name);
  const templates = templatesFor(archetype);
  const files = new Map();
  for (const { file, out } of SKELETON) {
    files.set(out(slug), render(templates.get(file), slug));
  }
  return files;
}

/**
 * Materialize a new app on disk under `<root>/packages/<slug>/`, refusing to overwrite an existing
 * package. Every write is confined to that directory (defense in depth over {@link slugify}).
 *
 * @param {string} name The raw app name.
 * @param {{ root?: string, archetype?: string }} [options] `root` defaults to the current working
 *   directory; `archetype` defaults to `basic` (see {@link listArchetypes}).
 * @returns {{ slug: string, dir: string, files: string[] }} The chosen slug, the package directory,
 *   and the repo-relative paths written.
 * @throws {Error} If the name is unsafe, the archetype is unknown, or `packages/<slug>/` already exists.
 * @example
 * const { dir } = writeApp('todo'); // writes packages/todo/… ; dir === 'packages/todo'
 * writeApp('stock', { archetype: 'grid' }); // scaffold from the grid archetype
 */
export function writeApp(name, { root = process.cwd(), archetype = DEFAULT_ARCHETYPE } = {}) {
  const slug = slugify(name);
  const pkgDir = join(root, 'packages', slug);
  if (existsSync(pkgDir)) {
    throw new Error(`packages/${slug}/ already exists — choose another name`);
  }
  const pkgDirResolved = resolve(pkgDir);
  const files = buildAppFiles(name, archetype);
  const written = [];
  for (const [rel, contents] of files) {
    const abs = resolve(join(root, rel));
    if (abs !== pkgDirResolved && !abs.startsWith(pkgDirResolved + sep)) {
      throw new Error(`refusing to write outside packages/${slug}/: ${rel}`);
    }
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, contents);
    written.push(rel);
  }
  return { slug, dir: `packages/${slug}`, files: written };
}

/**
 * Parse the CLI args into an app name and options. Recognizes `--list` (show archetypes and exit) and
 * `--template <name>` / `--template=<name>` (pick an archetype); the first non-flag positional is the
 * app name.
 *
 * @param {string[]} argv The arguments after the script name (i.e. `process.argv.slice(2)`).
 * @returns {{ list: boolean, name: string | undefined, archetype: string }} The parsed request.
 * @throws {Error} If `--template` is given without a value.
 */
function parseArgs(argv) {
  let list = false;
  let name;
  let archetype = DEFAULT_ARCHETYPE;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--list') {
      list = true;
    } else if (arg === '--template' || arg === '-t') {
      archetype = argv[++i];
      if (archetype === undefined) throw new Error('--template requires an archetype name');
    } else if (arg.startsWith('--template=')) {
      archetype = arg.slice('--template='.length);
    } else if (name === undefined && !arg.startsWith('-')) {
      name = arg;
    }
  }
  return { list, name, archetype };
}

/** The command-line entry point: `node new-jsvision-app.mjs <app-name> [--template <name>] | --list`. */
function cli() {
  let request;
  try {
    request = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
    return;
  }

  if (request.list) {
    process.stdout.write('Available archetypes (--template <name>):\n');
    for (const { name, description } of listArchetypes()) {
      process.stdout.write(`  ${name.padEnd(12)} ${description}\n`);
    }
    return;
  }

  if (request.name === undefined || request.name.trim() === '') {
    process.stderr.write('usage: node new-jsvision-app.mjs <app-name> [--template <name>] | --list\n');
    process.exit(2);
    return;
  }

  try {
    const { slug, dir, files } = writeApp(request.name, { archetype: request.archetype });
    const suffix = request.archetype === DEFAULT_ARCHETYPE ? '' : ` [${request.archetype}]`;
    process.stdout.write(`Created ${dir}/ (@jsvision/${slug})${suffix}:\n`);
    for (const rel of files) {
      process.stdout.write(`  ${rel}\n`);
    }
    process.stdout.write(
      `\nNext steps:\n` +
        `  yarn install\n` +
        `  yarn workspace @jsvision/${slug} start   # on an interactive terminal\n` +
        `  yarn verify                              # typecheck + tests, including the app's smoke test\n`,
    );
  } catch (err) {
    process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

// Run the CLI only when executed directly, never when imported by a test.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli();
}
