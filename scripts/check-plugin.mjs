// Integrity gate for the jsvision Claude Code plugin.
//
// Runs directly (not through turbo) as the last step of `yarn verify`, so a repo-root change can't
// be masked by a cached package task. It guards five things and exits non-zero on any failure:
//   1. manifest schema      — plugin.json + marketplace.json are well-formed and cross-referenced
//   2. link-graph           — every markdown link in the skill tree resolves; the router paths exist
//   3. snippet-drift        — each recipe page's embedded code equals its source module region
//   4. scaffolder templates — the app-skeleton templates are present and well-formed
//   5. barrel-coverage      — every @jsvision/ui widget class is documented, and vice versa
//
// The pure check functions are exported so their behavior is spec-tested with good/broken inputs.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

import { checkApiDrift } from './gen-plugin-api.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PLUGIN_ROOT = join(ROOT, 'tools', 'claude-plugin');
const SKILL_ROOT = join(PLUGIN_ROOT, 'skills', 'jsvision');
const MANIFEST = join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');
const MARKETPLACE = join(ROOT, '.claude-plugin', 'marketplace.json');
export const CATALOG = join(SKILL_ROOT, 'references', 'component-catalog.md');
const GOTCHAS = join(SKILL_ROOT, 'references', 'gotchas.md');
const RECIPE_DIR = join(ROOT, 'packages', 'examples', 'recipes');
const TEMPLATES_DIR = join(PLUGIN_ROOT, 'templates', 'app-skeleton');
const UI_BARREL = join(ROOT, 'packages', 'ui', 'src', 'index.ts');

const PLUGIN_NAME = 'jsvision-plugin';
const REQUIRED_GOTCHAS = 12;
const TEMPLATE_FILES = [
  'package.json.tmpl',
  'tsconfig.json.tmpl',
  'vitest.config.ts.tmpl',
  'main.ts.tmpl',
  'smoke.test.ts.tmpl',
];

// Class exports that need not appear in the component catalog: the abstract base and the error type.
export const CATALOG_DENYLIST = ['View', 'ReactiveCycleError'];

// Recipe/authoring pages and the source module region each embeds (drift is checked between them).
export const DRIFT_PAIRS = [
  { md: join('references', 'recipes', 'data-driven.md'), module: 'data-grid' },
  { md: join('references', 'recipes', 'forms-dialogs.md'), module: 'form-dialog' },
  { md: join('references', 'recipes', 'file-text.md'), module: 'file-tools' },
  { md: join('references', 'recipes', 'live-dashboard.md'), module: 'live-dashboard' },
  { md: join('references', 'widget-authoring.md'), module: 'custom-widget' },
];

/**
 * Validate the parsed manifest + marketplace data.
 *
 * @param {unknown} manifest Parsed `plugin.json` (or `null` if it failed to parse).
 * @param {unknown} marketplace Parsed `marketplace.json` (or `null`).
 * @param {string} pluginName The expected plugin name.
 * @param {boolean} sourceExists Whether the marketplace entry's `source` resolves to a plugin dir.
 * @returns {string[]} Human-readable errors (empty when valid).
 */
export function checkManifestData(manifest, marketplace, pluginName, sourceExists) {
  const errors = [];
  if (manifest === null || typeof manifest !== 'object') {
    errors.push('plugin.json: not a valid JSON object');
  } else if (typeof manifest.name !== 'string' || manifest.name.length === 0) {
    errors.push('plugin.json: missing required field "name"');
  } else if (manifest.name !== pluginName) {
    errors.push(`plugin.json: name "${manifest.name}" != expected "${pluginName}"`);
  }

  if (marketplace === null || typeof marketplace !== 'object') {
    errors.push('marketplace.json: not a valid JSON object');
  } else {
    for (const field of ['name', 'owner', 'plugins']) {
      if (marketplace[field] === undefined) errors.push(`marketplace.json: missing required field "${field}"`);
    }
    const plugins = Array.isArray(marketplace.plugins) ? marketplace.plugins : [];
    const entry = plugins.find((p) => p !== null && typeof p === 'object' && p.name === pluginName);
    if (entry === undefined) {
      errors.push(`marketplace.json: no plugin entry named "${pluginName}"`);
    } else if (typeof entry.source !== 'string' || entry.source.length === 0) {
      errors.push(`marketplace.json: plugin "${pluginName}" has no string "source"`);
    } else if (!sourceExists) {
      errors.push(`marketplace.json: plugin source "${entry.source}" does not resolve to a plugin dir`);
    }
  }
  return errors;
}

function walkMarkdown(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) out.push(...walkMarkdown(full));
    else if (name.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/**
 * Check that every relative markdown link in the `.md` files under `dir` resolves on disk. External
 * (`http(s):`) links and bare anchors are ignored.
 *
 * @param {string} dir The directory to walk.
 * @returns {string[]} Errors naming the file and the dead target (empty when all links resolve).
 */
export function checkLinksInDir(dir) {
  const errors = [];
  for (const file of walkMarkdown(dir)) {
    const content = readFileSync(file, 'utf8');
    for (const m of content.matchAll(/\]\(([^)]+)\)/g)) {
      let target = m[1].trim();
      if (/^https?:/.test(target) || target.startsWith('#')) continue;
      target = target.split('#')[0];
      if (target === '') continue;
      if (!existsSync(resolve(dirname(file), target))) {
        errors.push(`${relative(dir, file)}: dead link -> ${target}`);
      }
    }
  }
  return errors;
}

function extractTsBlock(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.trim() === '```ts');
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === '```');
  if (end === -1) return null;
  return lines.slice(start + 1, end).join('\n');
}

/**
 * Extract the text between `// #region example` and `// #endregion example` in a source module.
 *
 * @param {string} src The source module text.
 * @returns {string | null} The region body, or `null` when either marker is absent.
 */
export function extractRegion(src) {
  const lines = src.split('\n');
  const a = lines.findIndex((l) => l.trim() === '// #region example');
  const b = lines.findIndex((l) => l.trim() === '// #endregion example');
  if (a === -1 || b === -1) return null;
  return lines.slice(a + 1, b).join('\n');
}

/**
 * Check that a markdown page's embedded ` ```ts ` block matches a source region verbatim (ignoring
 * only surrounding whitespace), so taught code never drifts from running code.
 *
 * @param {string} mdContent The markdown page content.
 * @param {string} regionText The source module's region text.
 * @returns {string[]} A single drift error, or empty when they match.
 */
export function checkDrift(mdContent, regionText) {
  const block = extractTsBlock(mdContent);
  if (block === null) return ['no ```ts code block found to compare'];
  return block.trim() === regionText.trim() ? [] : ['embedded code block differs from its source region'];
}

/**
 * Count the numbered footgun headings (`### N.`) in a gotchas page.
 *
 * @param {string} content The gotchas markdown.
 * @returns {number} The number of numbered footguns.
 */
export function countGotchas(content) {
  return (content.match(/^###\s+\d+\./gm) ?? []).length;
}

/**
 * Check that a gotchas page documents exactly the required number of footguns.
 *
 * @param {string} content The gotchas markdown.
 * @param {number} required The expected count.
 * @returns {string[]} A single completeness error, or empty when the count matches.
 */
export function checkGotchas(content, required) {
  const n = countGotchas(content);
  return n === required ? [] : [`gotchas.md documents ${n} footguns, expected ${required}`];
}

function checkTemplatesValid(templatesDir) {
  const errors = [];
  for (const f of TEMPLATE_FILES) {
    if (!existsSync(join(templatesDir, f))) errors.push(`templates/app-skeleton: missing ${f}`);
  }
  const pkg = join(templatesDir, 'package.json.tmpl');
  if (existsSync(pkg)) {
    const filled = readFileSync(pkg, 'utf8').replaceAll('__SLUG__', 'sample').replaceAll('__UIDEP__', '*');
    try {
      JSON.parse(filled);
    } catch {
      errors.push('templates/app-skeleton/package.json.tmpl: not valid JSON after token fill');
    }
  }
  return errors;
}

/**
 * Barrel-coverage: every `@jsvision/ui` widget class (minus a small base-class denylist) must be
 * documented in the component catalog, and every class the catalog names must still be an export.
 *
 * @param {string[]} classNames All `@jsvision/ui` class value exports.
 * @param {string} catalogText The component-catalog markdown.
 * @param {string[]} denylist Class names that need not be documented (abstract bases, errors).
 * @returns {string[]} Errors for undocumented exports and catalog-named non-exports.
 */
export function checkBarrelCoverage(classNames, catalogText, denylist) {
  const errors = [];
  const deny = new Set(denylist);
  const known = new Set(classNames);
  for (const cls of classNames) {
    if (deny.has(cls)) continue;
    if (!new RegExp(`\\b${cls}\\b`).test(catalogText)) {
      errors.push(`component-catalog.md: missing entry for exported class "${cls}"`);
    }
  }
  for (const m of catalogText.matchAll(/\*\*([A-Z][A-Za-z0-9]+)\*\*/g)) {
    if (!known.has(m[1])) {
      errors.push(`component-catalog.md: names "${m[1]}", which is not a @jsvision/ui class export`);
    }
  }
  return errors;
}

/**
 * Extract the class value exports of the `@jsvision/ui` barrel via the TypeScript checker — the same
 * mechanism the docs-site API reference uses to enumerate the public surface.
 *
 * @returns {string[]} Sorted class export names.
 */
/** Build a TypeScript program over the `@jsvision/ui` barrel and return its checker + module symbol. */
function buildUiProgram() {
  const program = ts.createProgram([UI_BARREL], {
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    module: ts.ModuleKind.NodeNext,
    target: ts.ScriptTarget.ESNext,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(UI_BARREL));
  return { checker, moduleSymbol };
}

export function extractUiClassExports() {
  const { checker, moduleSymbol } = buildUiProgram();
  const names = [];
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    let sym = exported;
    if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    if (sym.flags & ts.SymbolFlags.Class) names.push(exported.getName());
  }
  return names.sort();
}

/**
 * Extract one `@jsvision/ui` class export's JSDoc lead sentence + `@example`, via the TypeScript
 * checker (following the barrel's re-export alias to the class declaration). This is the grounding
 * data for an AI-drafted catalog entry; the `@example` is always present because `check:docs` fails
 * `yarn verify` on any public export missing one.
 *
 * @param {string} name The exported class name.
 * @returns {{ lead: string, example: string } | null} The doc, or `null` when no such class export.
 * @example
 * const { lead, example } = extractUiClassDoc('Button');
 */
export function extractUiClassDoc(name) {
  const { checker, moduleSymbol } = buildUiProgram();
  for (const exported of checker.getExportsOfModule(moduleSymbol)) {
    if (exported.getName() !== name) continue;
    let sym = exported;
    if (sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    const lead = ts.displayPartsToString(sym.getDocumentationComment(checker)).trim();
    let example = '';
    for (const tag of sym.getJsDocTags(checker)) {
      if (tag.name === 'example') {
        example = (tag.text ?? [])
          .map((part) => part.text)
          .join('')
          .trim();
        break;
      }
    }
    return { lead, example };
  }
  return null;
}

/**
 * @typedef {{ kind: 'undocumented-widget', name: string }
 *          | { kind: 'snippet-drift', module: string }} DriftFinding
 * @typedef {{ catalogPath: string, recipeDir: string, skillRoot: string,
 *             listClassExports: () => string[] }} DriftRoots
 */

/**
 * The real plugin tree — the default target for {@link detectDrift} and the fixers. Tests pass their
 * own `roots` (a temp-dir copy) so drift detection and fixing never touch the repo.
 */
export const DEFAULT_ROOTS = {
  catalogPath: CATALOG,
  recipeDir: RECIPE_DIR,
  skillRoot: SKILL_ROOT,
  listClassExports: extractUiClassExports,
};

/**
 * Read a recipe module's `// #region example` block from a `roots` tree.
 *
 * @param {string} module The recipe module base name (e.g. `'data-grid'`).
 * @param {DriftRoots} [roots] Defaults to the real tree.
 * @returns {string | null} The region text, or `null` when the module has no marked region.
 * @example
 * const region = readRegion('data-grid');
 */
export function readRegion(module, roots = DEFAULT_ROOTS) {
  return extractRegion(readFileSync(join(roots.recipeDir, `${module}.ts`), 'utf8'));
}

/**
 * Structured drift detection: the two integrity findings PL-02 can auto-fix, as machine-readable
 * objects. It reuses the gate's own checkers — `checkBarrelCoverage` for undocumented widgets and
 * `checkDrift` for snippet drift — so a finding it returns is always a real gate finding (one
 * predicate, no second regex to drift from the gate). The catalog-name-not-exported reverse gap and
 * the missing-region error stay `runAllChecks` errors, not syncable deltas — you cannot invent a
 * widget or a source region.
 *
 * @param {DriftRoots} [roots] Defaults to the real plugin tree; a test passes a temp-dir `roots` so
 *   it observes seeded drift without reading or mutating the repo.
 * @returns {DriftFinding[]} The drift set — no more, no fewer than the two syncable kinds.
 * @example
 * const findings = detectDrift();
 * // → [{ kind: 'undocumented-widget', name: 'ColorSwatch' }, { kind: 'snippet-drift', module: 'data-grid' }]
 */
export function detectDrift(roots = DEFAULT_ROOTS) {
  const findings = [];
  const catalog = readFileSync(roots.catalogPath, 'utf8');

  // Undocumented widgets: map the gate's own "missing entry" errors back to findings, so the set is
  // — by construction — identical to what barrel-coverage reports.
  for (const err of checkBarrelCoverage(roots.listClassExports(), catalog, CATALOG_DENYLIST)) {
    const m = err.match(/missing entry for exported class "(.+)"/);
    if (m) findings.push({ kind: 'undocumented-widget', name: m[1] });
  }

  // Drifted snippets: a recipe module whose #region differs from the embedded block in its page.
  for (const { md, module } of DRIFT_PAIRS) {
    const region = readRegion(module, roots);
    if (region === null) continue; // an absent region is a runAllChecks error, not a syncable delta
    if (checkDrift(readFileSync(join(roots.skillRoot, md), 'utf8'), region).length > 0) {
      findings.push({ kind: 'snippet-drift', module });
    }
  }
  return findings;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Run every integrity check against the real plugin tree.
 *
 * @returns {{ ok: boolean, errors: string[] }} `ok` is true only when no check produced an error.
 */
export function runAllChecks() {
  const errors = [];
  const add = (label, errs) => {
    for (const e of errs) errors.push(`[${label}] ${e}`);
  };

  // 1. manifest schema
  const manifest = readJson(MANIFEST);
  const marketplace = readJson(MARKETPLACE);
  const entry = Array.isArray(marketplace?.plugins)
    ? marketplace.plugins.find((p) => p !== null && typeof p === 'object' && p.name === PLUGIN_NAME)
    : undefined;
  const sourceExists =
    entry !== undefined && typeof entry.source === 'string'
      ? existsSync(join(resolve(ROOT, entry.source), '.claude-plugin', 'plugin.json'))
      : false;
  add('manifest', checkManifestData(manifest, marketplace, PLUGIN_NAME, sourceExists));

  // 2. link-graph: markdown links across the skill tree, plus the router's reference paths.
  add('links', checkLinksInDir(SKILL_ROOT));
  const skillMd = readFileSync(join(SKILL_ROOT, 'SKILL.md'), 'utf8');
  for (const m of skillMd.matchAll(/`(references\/[\w./-]+\.md)`/g)) {
    if (!existsSync(join(SKILL_ROOT, m[1]))) errors.push(`[links] SKILL.md: router path -> ${m[1]} (missing)`);
  }

  // 3. snippet-drift
  for (const { md, module } of DRIFT_PAIRS) {
    const region = extractRegion(readFileSync(join(RECIPE_DIR, `${module}.ts`), 'utf8'));
    if (region === null) {
      errors.push(`[drift:${module}] source module has no #region example`);
      continue;
    }
    add(`drift:${module}`, checkDrift(readFileSync(join(SKILL_ROOT, md), 'utf8'), region));
  }

  // 4. scaffolder templates
  add('templates', checkTemplatesValid(TEMPLATES_DIR));

  // 5. barrel-coverage + gotchas completeness
  add('barrel', checkBarrelCoverage(extractUiClassExports(), readFileSync(CATALOG, 'utf8'), CATALOG_DENYLIST));
  add('gotchas', checkGotchas(readFileSync(GOTCHAS, 'utf8'), REQUIRED_GOTCHAS));

  // 6. generated API reference — the committed pages must equal a fresh generation from the source.
  add('api', checkApiDrift(ROOT));

  return { ok: errors.length === 0, errors };
}

function main() {
  const { ok, errors } = runAllChecks();
  if (ok) {
    process.stdout.write('check-plugin: PASS — all integrity checks green\n');
  } else {
    process.stdout.write(`check-plugin: FAIL — ${errors.length} issue(s)\n`);
    for (const e of errors) process.stdout.write(`  - ${e}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
