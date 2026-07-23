#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const JSVISION_VERSION = '1.0.0';
const DEFAULT_ARCHETYPE = 'basic';
const PACKAGE_MANAGERS = new Set(['npm', 'yarn', 'pnpm', 'bun']);
const SKELETON = [
  { file: 'package.json.tmpl', out: () => 'package.json' },
  { file: 'tsconfig.json.tmpl', out: () => 'tsconfig.json' },
  { file: 'vitest.config.ts.tmpl', out: () => 'vitest.config.ts' },
  { file: 'main.ts.tmpl', out: () => 'src/main.ts' },
  { file: 'smoke.test.ts.tmpl', out: (slug) => `test/${slug}.smoke.test.ts` },
];

const TEMPLATE_ROOT = new URL('../../templates/', import.meta.url);
const BASE_DIR = new URL('app-skeleton/', TEMPLATE_ROOT);
const ARCHETYPES_DIR = new URL('archetypes/', TEMPLATE_ROOT);
const BASE = new Map(SKELETON.map(({ file }) => [file, readFileSync(new URL(file, BASE_DIR), 'utf8')]));

/**
 * Normalize an application name to a safe npm package slug.
 *
 * @param {string} name Human-readable application name.
 * @returns {string} Lowercase hyphenated package name.
 * @throws {Error} When the input is empty or could escape the destination.
 * @example
 * slugify('Inventory Desk'); // 'inventory-desk'
 */
export function slugify(name) {
  if (typeof name !== 'string') throw new TypeError('app name must be a string');
  const raw = name.trim();
  if (raw === '' || raw.includes('/') || raw.includes('\\') || raw.includes('..')) {
    throw new Error(`unsafe app name: ${JSON.stringify(name)}`);
  }
  const slug = raw
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug === '') throw new Error(`app name has no usable characters: ${JSON.stringify(name)}`);
  return slug;
}

function loadArchetypes() {
  const archetypes = new Map();
  for (const entry of readdirSync(fileURLToPath(ARCHETYPES_DIR), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = new URL(`${entry.name}/`, ARCHETYPES_DIR);
    const overrides = new Map();
    for (const { file } of SKELETON) {
      const url = new URL(file, dir);
      if (existsSync(fileURLToPath(url))) overrides.set(file, readFileSync(url, 'utf8'));
    }
    if (!overrides.has('main.ts.tmpl')) continue;
    const about = new URL('about.txt', dir);
    const description = existsSync(fileURLToPath(about)) ? readFileSync(about, 'utf8').trim() : '';
    archetypes.set(entry.name, { description, overrides });
  }
  return archetypes;
}

const ARCHETYPES = loadArchetypes();

/**
 * Return the available starter archetypes.
 *
 * @returns {{ name: string, description: string }[]} Stable alphabetized choices.
 * @example
 * listArchetypes().map(({ name }) => name); // ['basic', 'dashboard', 'form', 'grid']
 */
export function listArchetypes() {
  const rest = [...ARCHETYPES.entries()]
    .map(([name, value]) => ({ name, description: value.description }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [{ name: DEFAULT_ARCHETYPE, description: 'A plain starter with one window.' }, ...rest];
}

function templatesFor(archetype) {
  if (archetype === DEFAULT_ARCHETYPE) return BASE;
  const selected = ARCHETYPES.get(archetype);
  if (selected === undefined) {
    throw new Error(`unknown template ${JSON.stringify(archetype)}; use --list to see available templates`);
  }
  return new Map([...BASE, ...selected.overrides]);
}

/**
 * Build a standalone application's files without touching disk.
 *
 * @param {string} name Application name.
 * @param {string} [archetype] Starter archetype.
 * @returns {Map<string, string>} Destination-relative file content.
 * @example
 * buildAppFiles('todo').get('package.json');
 */
export function buildAppFiles(name, archetype = DEFAULT_ARCHETYPE) {
  const slug = slugify(name);
  const templates = templatesFor(archetype);
  return new Map(
    SKELETON.map(({ file, out }) => [
      out(slug),
      templates.get(file).replaceAll('__SLUG__', slug).replaceAll('__UIDEP__', JSVISION_VERSION),
    ]),
  );
}

function isDirectoryEmpty(path) {
  return !existsSync(path) || (statSync(path).isDirectory() && readdirSync(path).length === 0);
}

/**
 * Write a standalone application into a new directory or an explicitly approved current directory.
 *
 * @param {string} name Application name.
 * @param {{ root?: string, archetype?: string, currentDir?: boolean }} [options] Destination options.
 * @returns {{ slug: string, dir: string, files: string[] }} Written application details.
 * @example
 * writeApp('todo', { root: '/tmp' });
 */
export function writeApp(name, { root = process.cwd(), archetype = DEFAULT_ARCHETYPE, currentDir = false } = {}) {
  const slug = slugify(name);
  const destination = resolve(currentDir ? root : join(root, slug));
  if (!isDirectoryEmpty(destination)) {
    throw new Error(`${destination} is not empty; refusing to overwrite existing project files`);
  }
  const files = buildAppFiles(name, archetype);
  const written = [];
  for (const [relativePath, content] of files) {
    const output = resolve(destination, relativePath);
    if (output !== destination && !output.startsWith(`${destination}${sep}`)) {
      throw new Error(`refusing to write outside ${destination}: ${relativePath}`);
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, content);
    written.push(relativePath);
  }
  return { slug, dir: destination, files: written };
}

/**
 * Detect a package manager from package metadata and lockfiles.
 *
 * @param {string} directory Directory to inspect.
 * @returns {'npm'|'yarn'|'pnpm'|'bun'|null} Detected manager or null when ambiguous/unknown.
 * @example
 * detectPackageManager(process.cwd());
 */
export function detectPackageManager(directory) {
  const packageJson = join(directory, 'package.json');
  if (existsSync(packageJson)) {
    try {
      const manager = JSON.parse(readFileSync(packageJson, 'utf8')).packageManager?.split('@')[0];
      if (PACKAGE_MANAGERS.has(manager)) return manager;
    } catch {
      // A malformed manifest is handled by the consumer project's normal tooling.
    }
  }
  const matches = [
    ['npm', 'package-lock.json'],
    ['yarn', 'yarn.lock'],
    ['pnpm', 'pnpm-lock.yaml'],
    ['bun', 'bun.lock'],
    ['bun', 'bun.lockb'],
  ].filter(([, file]) => existsSync(join(directory, file)));
  return matches.length === 1 ? matches[0][0] : null;
}

function installDependencies(directory, manager) {
  const result = spawnSync(manager, ['install'], { cwd: directory, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${manager} install failed with exit code ${result.status}`);
}

function parseArgs(argv) {
  const request = {
    name: undefined,
    archetype: DEFAULT_ARCHETYPE,
    currentDir: false,
    install: true,
    list: false,
    packageManager: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--list') request.list = true;
    else if (argument === '--current-dir') request.currentDir = true;
    else if (argument === '--no-install') request.install = false;
    else if (argument === '--template') request.archetype = argv[++index];
    else if (argument === '--package-manager') request.packageManager = argv[++index];
    else if (!argument.startsWith('-') && request.name === undefined) request.name = argument;
    else throw new Error(`unknown argument: ${argument}`);
  }
  if (request.packageManager !== undefined && !PACKAGE_MANAGERS.has(request.packageManager)) {
    throw new Error(`unsupported package manager: ${request.packageManager}`);
  }
  return request;
}

async function main(argv = process.argv.slice(2)) {
  const request = parseArgs(argv);
  if (request.list) {
    for (const choice of listArchetypes()) {
      process.stdout.write(`${choice.name.padEnd(12)} ${choice.description}\n`);
    }
    return;
  }
  if (request.name === undefined) {
    throw new Error('usage: new-jsvision-app.mjs <name> [--template name] [--package-manager name]');
  }
  const result = writeApp(request.name, {
    archetype: request.archetype,
    currentDir: request.currentDir,
  });
  const manager = request.packageManager ?? detectPackageManager(process.cwd()) ?? 'npm';
  if (request.install) installDependencies(result.dir, manager);
  process.stdout.write(`Created ${result.slug} in ${result.dir} with ${manager}.\n`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`new-jsvision-app failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
