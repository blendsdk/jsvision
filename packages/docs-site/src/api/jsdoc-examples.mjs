// The public-`@example` compile guard — extracts every `@example` body from the
// shipped packages, compiles each as a standalone module IN MEMORY, and reports
// any failure that a committed allowlist has not grandfathered.
//
// Authored as plain ESM (.mjs) so a plain-`node` script can import it directly
// (no TypeScript loader) while the vitest specs drive the very same implementation
// — the same shared-source-of-truth shape as barrel-exports.mjs beside it.
//
// Nothing is ever written to disk. Blocks are served to the compiler as virtual
// SourceFiles at a path inside their own source's directory, which is what makes
// relative specifiers and top-level `await` (every package is `type: module`)
// resolve the way they do for a reader who copies the snippet.

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Absolute path of the monorepo root, derived from this module's own location. */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * The six shipped packages whose public JSDoc the guard governs, enumerated
 * rather than globbed: `packages/&#42;/src` would also sweep in the docs-site itself
 * and the inert feasibility spike, neither of which ships.
 *
 * @type {readonly string[]}
 */
export const SHIPPED_ROOTS = Object.freeze([
  'packages/core/src',
  'packages/ui/src',
  'packages/web/src',
  'packages/files/src',
  'packages/datagrid/src',
  'packages/forms/src',
]);

/** Key used when an `@example`'s JSDoc hangs on a node that has no name. */
const ANONYMOUS = '(anonymous)';

/**
 * @typedef {object} ExampleBlock
 * @property {string} file    Repo-relative path of the source the block was found in.
 * @property {string} symbol  Declaration name — `Class.member` for members, `#N`-suffixed on collision.
 * @property {number} line    1-based line of the `@example` tag, for human-readable output.
 * @property {number} pos     Byte offset of the tag — the de-duplication identity.
 * @property {string} body    The block body, fence-stripped and terminator-unescaped.
 * @property {string} virtualPath  Absolute path the block is compiled *as*. Never written.
 */

/**
 * @typedef {object} ExampleFailure
 * @property {string} key      `${file}::${symbol}`.
 * @property {number} line     1-based line of the `@example` tag.
 * @property {number[]} codes  Every distinct diagnostic code, ascending — the comparison set.
 * @property {string[]} missingNames  For each TS2304, the identifier it could not find.
 * @property {string} message  All diagnostic messages joined, for human readability only.
 */

/**
 * @typedef {object} GuardResult
 * @property {number} checked  How many blocks were compiled.
 * @property {ExampleFailure[]} unexpected  Failures with no entry, or whose diagnostics differ from it.
 * @property {string[]} stale  Allowlist entries that now compile, or name a vanished file/symbol.
 */

/**
 * Collect every `@example` block under the given roots.
 *
 * Roots are directories, absolute or repo-relative. `.d.ts` files are skipped —
 * they carry generated copies of the very JSDoc being checked.
 *
 * @param {readonly string[]} roots  Directories to walk.
 * @returns {ExampleBlock[]} Every block found, in file then source order.
 *
 * @example
 * import { collectExamples, SHIPPED_ROOTS } from './jsdoc-examples.mjs';
 * const blocks = collectExamples(SHIPPED_ROOTS);
 */
export function collectExamples(roots) {
  /** @type {ExampleBlock[]} */
  const blocks = [];
  for (const root of roots) {
    for (const absPath of walkTypeScript(resolve(REPO_ROOT, root))) {
      blocks.push(...collectFromFile(absPath));
    }
  }
  return blocks;
}

/**
 * Compile every block and rule each one against the allowlist.
 *
 * The allowlist is a parameter rather than a file read so the contract can be
 * driven from fixtures in any state, instead of waiting for the repo to happen
 * to be in the state a case needs.
 *
 * @param {readonly ExampleBlock[]} blocks  Blocks from {@link collectExamples}.
 * @param {Record<string, {codes: number[], missingNames?: string[], message?: string}>} allowlist
 *   Grandfathered failures, keyed `file::Symbol`.
 * @returns {GuardResult} What the guard concluded.
 *
 * @example
 * import { checkExamples, collectExamples, SHIPPED_ROOTS } from './jsdoc-examples.mjs';
 * const result = checkExamples(collectExamples(SHIPPED_ROOTS), {});
 * if (result.unexpected.length > 0) throw new Error('an @example does not compile');
 */
export function checkExamples(blocks, allowlist) {
  const failures = compile(blocks);

  /** @type {ExampleFailure[]} */
  const unexpected = [];
  const matched = new Set();

  for (const block of blocks) {
    const key = `${block.file}::${block.symbol}`;
    const failure = failures.get(key);
    const entry = allowlist[key];

    if (!failure) continue; // compiles — a present entry is caught by the stale sweep below
    if (!entry) {
      unexpected.push(failure);
      continue;
    }
    if (sameSet(entry.codes ?? [], failure.codes) && sameSet(entry.missingNames ?? [], failure.missingNames)) {
      matched.add(key);
    } else {
      unexpected.push(failure);
    }
  }

  // Everything the allowlist claims but the run did not reproduce is stale: the
  // block now compiles, or its file or symbol has been renamed away. Both are the
  // same defect — an entry that no longer describes anything — and the list may
  // only ever shrink, so neither is tolerated.
  const stale = Object.keys(allowlist)
    .filter((key) => !matched.has(key))
    .sort();

  return { checked: blocks.length, unexpected, stale };
}

/**
 * Compile every block in one in-memory program and index the failures by key.
 *
 * @param {readonly ExampleBlock[]} blocks  Blocks to compile.
 * @returns {Map<string, ExampleFailure>} One entry per failing block.
 */
function compile(blocks) {
  /** @type {Map<string, ExampleFailure>} */
  const failures = new Map();
  if (blocks.length === 0) return failures;

  const options = compilerOptions();
  const virtual = new Map(blocks.map((b) => [b.virtualPath, b.body]));
  const realHost = ts.createCompilerHost(options);

  /** @type {ts.CompilerHost} */
  const host = {
    ...realHost,
    getSourceFile: (fileName, languageVersion, onError, shouldCreate) =>
      virtual.has(fileName)
        ? ts.createSourceFile(fileName, /** @type {string} */ (virtual.get(fileName)), languageVersion, true)
        : realHost.getSourceFile(fileName, languageVersion, onError, shouldCreate),
    fileExists: (fileName) => virtual.has(fileName) || realHost.fileExists(fileName),
    readFile: (fileName) => virtual.get(fileName) ?? realHost.readFile(fileName),
    writeFile: () => {}, // never emits, under any circumstances
  };

  const program = ts.createProgram({ rootNames: [...virtual.keys()], options, host });

  for (const block of blocks) {
    const sourceFile = program.getSourceFile(block.virtualPath);
    if (!sourceFile) continue;
    const diagnostics = [...program.getSyntacticDiagnostics(sourceFile), ...program.getSemanticDiagnostics(sourceFile)];
    if (diagnostics.length === 0) continue;

    failures.set(`${block.file}::${block.symbol}`, {
      key: `${block.file}::${block.symbol}`,
      line: block.line,
      codes: [...new Set(diagnostics.map((d) => d.code))].sort((a, b) => a - b),
      missingNames: [...new Set(diagnostics.flatMap(missingName))].sort(),
      message: diagnostics.map((d) => `TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join(' · '),
    });
  }

  return failures;
}

/**
 * The identifier a `Cannot find name` diagnostic names, if it is one.
 *
 * Matching on the named identifier rather than on the bare code is what separates
 * a newly forgotten import from the pre-existing missing binding it would
 * otherwise hide behind — both report TS2304.
 *
 * @param {ts.Diagnostic} diagnostic  A single diagnostic.
 * @returns {string[]} The missing identifier, or nothing.
 */
function missingName(diagnostic) {
  if (diagnostic.code !== 2304) return [];
  const text = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
  const match = /Cannot find name '([^']+)'/.exec(text);
  return match ? [match[1]] : [];
}

/**
 * The repo's own compiler options, with the three overrides the guard needs.
 *
 * Everything else is the repo's, so a block that passes the guard compiles the
 * way the repo compiles. The unused-symbol checks are off because an unused local
 * in a documentation snippet is snippet hygiene, not an API defect; `noEmit`
 * because the base config enables declaration and map output.
 *
 * @returns {ts.CompilerOptions} Options for the guard's program.
 */
function compilerOptions() {
  const configPath = join(REPO_ROOT, 'tsconfig.base.json');
  const { config } = ts.readConfigFile(configPath, (p) => readFileSync(p, 'utf8'));
  const { options } = ts.convertCompilerOptionsFromJson(config.compilerOptions, REPO_ROOT, configPath);
  return { ...options, noUnusedLocals: false, noUnusedParameters: false, noEmit: true };
}

/**
 * Every `.ts` source under a directory, recursively, excluding declaration files.
 *
 * @param {string} dir  Absolute directory path.
 * @returns {string[]} Absolute file paths, in directory order.
 */
function walkTypeScript(dir) {
  /** @type {string[]} */
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkTypeScript(abs));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) found.push(abs);
  }
  return found;
}

/**
 * Extract every `@example` block from one source file.
 *
 * @param {string} absPath  Absolute path of the source.
 * @returns {ExampleBlock[]} Blocks in source order, keys already disambiguated.
 */
function collectFromFile(absPath) {
  const text = readFileSync(absPath, 'utf8');
  const sourceFile = ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true);
  const file = relative(REPO_ROOT, absPath).split('\\').join('/');

  // A JSDoc comment binds to every node it can be reached from — for an
  // `export const` that is the statement, the declaration AND its identifier —
  // so a plain tag walk mints one block per binding, each with a different name.
  // The tag's byte offset is the block's true identity; the JSDoc's own parent is
  // the outermost node owning it, and therefore the one whose name is the symbol.
  /** @type {Map<number, {tag: ts.JSDocTag, owner: ts.Node}>} */
  const byPos = new Map();
  const visit = (/** @type {ts.Node} */ node) => {
    for (const tag of ts.getJSDocTags(node)) {
      if (tag.tagName.escapedText !== 'example') continue;
      if (byPos.has(tag.pos)) continue;
      byPos.set(tag.pos, { tag, owner: tag.parent.parent ?? node });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  /** @type {Array<Omit<ExampleBlock, 'symbol'> & {symbol: string}>} */
  const blocks = [];
  for (const { tag, owner } of [...byPos.values()].sort((a, b) => a.tag.pos - b.tag.pos)) {
    const body = normalizeBody(ts.getTextOfJSDocComment(tag.comment) ?? '');
    if (body.trim() === '') continue; // an empty example documents nothing; it is not a failure
    blocks.push({
      file,
      symbol: symbolName(owner),
      line: sourceFile.getLineAndCharacterOfPosition(tag.pos).line + 1,
      pos: tag.pos,
      body,
      virtualPath: join(dirname(absPath), `.jsdoc-example.${tag.pos}.ts`),
    });
  }

  return disambiguate(blocks);
}

/**
 * Suffix `#N` where a symbol name repeats within one file.
 *
 * The ordinal is scoped to the symbol, not to the file, so inserting an example
 * above an unrelated one never silently re-targets its allowlist entry.
 *
 * @param {ExampleBlock[]} blocks  Blocks of one file, in source order.
 * @returns {ExampleBlock[]} The same blocks with unique symbol keys.
 */
function disambiguate(blocks) {
  /** @type {Map<string, number>} */
  const totals = new Map();
  for (const b of blocks) totals.set(b.symbol, (totals.get(b.symbol) ?? 0) + 1);

  /** @type {Map<string, number>} */
  const seen = new Map();
  return blocks.map((b) => {
    if ((totals.get(b.symbol) ?? 0) < 2) return b;
    const ordinal = (seen.get(b.symbol) ?? 0) + 1;
    seen.set(b.symbol, ordinal);
    return { ...b, symbol: `${b.symbol}#${ordinal}` };
  });
}

/**
 * The allowlist-key name for the declaration an `@example` documents.
 *
 * @param {ts.Node} node  The outermost node the JSDoc binds to.
 * @returns {string} The declaration name, `Class.member`-qualified for members.
 */
function symbolName(node) {
  if (ts.isVariableStatement(node)) {
    const [declaration] = node.declarationList.declarations;
    return declaration && ts.isIdentifier(declaration.name) ? declaration.name.text : ANONYMOUS;
  }

  const name = /** @type {{name?: ts.Node}} */ (node).name;
  if (!name || !(ts.isIdentifier(name) || ts.isStringLiteral(name))) return ANONYMOUS;

  // A bare member name is not file-unique by construction — two classes in one
  // file may each declare `draw` — so members carry their owner.
  const owner = node.parent;
  if (owner && (ts.isClassLike(owner) || ts.isInterfaceDeclaration(owner)) && owner.name) {
    return `${owner.name.text}.${name.text}`;
  }
  return name.text;
}

/**
 * Turn a raw JSDoc comment body into compilable TypeScript.
 *
 * @param {string} raw  The text `getTextOfJSDocComment` returned.
 * @returns {string} Fence-stripped, terminator-unescaped source.
 */
function normalizeBody(raw) {
  // A body that legitimately contains a block comment has to escape its
  // terminator in the source, and the raw JSDoc text hands the escape straight back.
  const unescaped = raw.split('*\\/').join('*/');

  // Fencing is a per-block habit, not a per-package one, so the strip is
  // unconditional; left in place the backticks parse as a template literal.
  const lines = unescaped.split('\n');
  let first = 0;
  let last = lines.length - 1;
  while (first <= last && lines[first].trim() === '') first++;
  while (last >= first && lines[last].trim() === '') last--;
  if (first <= last && /^```/.test(lines[first].trim()) && lines[last].trim() === '```') {
    return lines.slice(first + 1, last).join('\n');
  }
  return unescaped;
}

/**
 * Order-insensitive comparison of two small primitive lists.
 *
 * @param {readonly (string | number)[]} a  One list.
 * @param {readonly (string | number)[]} b  The other.
 * @returns {boolean} True when they hold the same values.
 */
function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}
