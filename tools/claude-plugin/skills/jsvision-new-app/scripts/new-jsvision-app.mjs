// Deterministic scaffolder for a new jsvision TUI app package.
//
// Given an app name, it produces a complete, runnable `packages/<slug>/` package (manifest,
// tsconfig, vitest config, a starter `main.ts`, and a headless smoke test) that plugs straight into
// the monorepo's `yarn verify`. The core is a pure, no-fs `buildAppFiles(name)` returning a
// `Map<relativePath, contents>`, so it is trivially unit-testable; a thin `writeApp` wrapper
// materializes that map on disk and refuses to overwrite an existing package.
//
// Run directly:  node new-jsvision-app.mjs <app-name>

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

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

// Load the templates once at module init (not inside buildAppFiles) so buildAppFiles stays a pure,
// fs-free interpolation over pre-loaded strings — the property its unit tests rely on.
const TEMPLATE_DIR = new URL('../../../templates/app-skeleton/', import.meta.url);
const TEMPLATES = new Map(SKELETON.map(({ file }) => [file, readFileSync(new URL(file, TEMPLATE_DIR), 'utf8')]));

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
 * Render a loaded template: substitute the app slug and the `@jsvision/ui` dependency seam.
 *
 * @param {string} file The template file name (a key of {@link TEMPLATES}).
 * @param {string} slug The package slug.
 * @returns {string} The rendered file contents.
 */
function render(file, slug) {
  return TEMPLATES.get(file).replaceAll('__SLUG__', slug).replaceAll('__UIDEP__', uiDependency());
}

/**
 * Build the full set of files for a new app, keyed by their repo-relative path. Pure and fs-free:
 * it interpolates the templates loaded at module init, so it is deterministic and trivially
 * unit-testable. Does not touch disk — see {@link writeApp} to materialize the result.
 *
 * @param {string} name The raw app name (slugified internally; unsafe names throw).
 * @returns {Map<string, string>} A map of `packages/<slug>/…` paths to file contents.
 * @throws {Error} If the name is unsafe (see {@link slugify}).
 * @example
 * const files = buildAppFiles('todo');
 * files.get('packages/todo/src/main.ts'); // the starter app source
 */
export function buildAppFiles(name) {
  const slug = slugify(name);
  const files = new Map();
  for (const { file, out } of SKELETON) {
    files.set(out(slug), render(file, slug));
  }
  return files;
}

/**
 * Materialize a new app on disk under `<root>/packages/<slug>/`, refusing to overwrite an existing
 * package. Every write is confined to that directory (defense in depth over {@link slugify}).
 *
 * @param {string} name The raw app name.
 * @param {{ root?: string }} [options] `root` defaults to the current working directory.
 * @returns {{ slug: string, dir: string, files: string[] }} The chosen slug, the package directory,
 *   and the repo-relative paths written.
 * @throws {Error} If the name is unsafe, or `packages/<slug>/` already exists.
 * @example
 * const { dir } = writeApp('todo'); // writes packages/todo/… ; dir === 'packages/todo'
 */
export function writeApp(name, { root = process.cwd() } = {}) {
  const slug = slugify(name);
  const pkgDir = join(root, 'packages', slug);
  if (existsSync(pkgDir)) {
    throw new Error(`packages/${slug}/ already exists — choose another name`);
  }
  const pkgDirResolved = resolve(pkgDir);
  const files = buildAppFiles(name);
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

/** The command-line entry point: `node new-jsvision-app.mjs <app-name>`. */
function cli() {
  const name = process.argv[2];
  if (name === undefined || name.trim() === '') {
    process.stderr.write('usage: node new-jsvision-app.mjs <app-name>\n');
    process.exit(2);
  }
  try {
    const { slug, dir, files } = writeApp(name);
    process.stdout.write(`Created ${dir}/ (@jsvision/${slug}):\n`);
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
