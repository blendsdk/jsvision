#!/usr/bin/env node
/**
 * Documentation guard — enforces the "Documentation for users & AI agents" directive.
 *
 * Shipped source (`packages/<pkg>/src/**`, excluding tests and `.d.ts`) must document the
 * framework for its USERS and for AI agents, never for its maintainers. This guard fails the
 * build on two classes of violation:
 *
 *   Check A — BANNED references in any comment (JSDoc or `//` / block):
 *     - CodeOps process IDs: RD- PA- AR- PF- HR- GATE- AC- ST- ADR- DEF-
 *     - Repo doc paths:      codeops/…  plans/…  requirements/…
 *     - Turbo Vision / C++ provenance: *.cpp / *.h refs, getColor(…), cpXxx palette names,
 *       and T…::method C++ scope citations.
 *
 *   Check B — MISSING @example on a public export:
 *     Every value re-exported from a package's `src/index.ts` that is a class or a function
 *     (incl. `export const x = (…) => …` factories) must carry an `@example` JSDoc tag.
 *     Pure types/interfaces and plain data constants are exempt.
 *
 * Comments are located with the TypeScript scanner (so string/template literals that merely
 * contain `//` or a `.cpp` substring are never mis-flagged), and the public export set is
 * resolved by parsing each `index.ts` barrel (following `export * from` re-exports).
 *
 * Usage:
 *   node scripts/check-jsdoc.mjs [packageDir ...]   # default: every packages/* with src/index.ts
 *   node scripts/check-jsdoc.mjs .                   # the package in the current directory (turbo)
 *   node scripts/check-jsdoc.mjs --summary           # counts only, no per-violation lines
 *
 * Exit codes: 0 = clean · 1 = violations found · 2 = tool error.
 *
 * Pure-Node ESM; the only dependency is `typescript` (already a dev dependency, hoisted to the
 * workspace root), so it behaves identically on every OS.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, isAbsolute, dirname, relative, basename } from 'node:path';
import ts from 'typescript';

/** Candidate barrel locations, in priority order (core's public entry lives under engine/). */
const BARREL_CANDIDATES = ['src/index.ts', 'src/engine/index.ts'];

/** Locate a package's public barrel, or null if it exposes none (e.g. the examples package). */
function findBarrel(pkgDir) {
  for (const candidate of BARREL_CANDIDATES) {
    const p = join(pkgDir, candidate);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Banned comment patterns, each with a human label for the report. */
const BAN_RULES = [
  { name: 'codeops-id', re: /\b(?:RD|PA|AR|PF|HR|GATE|AC|ST|ADR|DEF)-\d+/g },
  { name: 'repo-doc-path', re: /\b(?:codeops|plans|requirements)\/[\w./-]*/g },
  { name: 'cpp-source-ref', re: /\b[\w.-]+\.(?:cpp|h)\b/g },
  { name: 'tv-palette', re: /\bgetColor\s*\(|\bcp[A-Z][A-Za-z]{2,}\b/g },
  { name: 'tv-class-ref', re: /\bT[A-Z][A-Za-z]+::[A-Za-z]/g },
];

/**
 * Recursively collect every `*.ts` source file under a directory, skipping declaration files
 * and test files (which have their own conventions and are out of scope for the directive).
 * @param {string} dir Directory to walk.
 * @returns {string[]} Absolute file paths.
 */
function collectSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    if (!name.endsWith('.ts') || name.endsWith('.d.ts') || name.endsWith('.test.ts')) continue;
    // `entry.parentPath` (Node 20.12+) / `entry.path` (older) is the containing directory.
    out.push(join(entry.parentPath ?? entry.path ?? dir, name));
  }
  return out;
}

/** Parse a source file into a TS AST with parent pointers (needed for JSDoc tag lookup). */
function parse(file, text) {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, /* setParentNodes */ true);
}

/**
 * Resolve the set of public VALUE names for a package by parsing its `index.ts` barrel and
 * following `export * from` re-exports. Type-only exports are excluded — they never require an
 * `@example`.
 * @param {string} indexFile Absolute path to the package's `src/index.ts`.
 * @param {Set<string>} [seen] Guards against circular barrels.
 * @returns {Set<string>} Public value names (as declared, i.e. the original of any `as` alias).
 */
function collectPublicNames(indexFile, seen = new Set()) {
  const names = new Set();
  if (seen.has(indexFile) || !existsSync(indexFile)) return names;
  seen.add(indexFile);

  const sf = parse(indexFile, readFileSync(indexFile, 'utf8'));
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt) || stmt.isTypeOnly) continue;

    if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      // `export { a, b as c } from '…'` — the DECLARED name is what we later match on.
      for (const spec of stmt.exportClause.elements) {
        if (spec.isTypeOnly) continue;
        names.add((spec.propertyName ?? spec.name).text);
      }
    } else if (!stmt.exportClause && stmt.moduleSpecifier && ts.isStringLiteral(stmt.moduleSpecifier)) {
      // `export * from '…'` — recurse into the referenced barrel to enumerate its names.
      const target = resolveModule(dirname(indexFile), stmt.moduleSpecifier.text);
      if (target) for (const n of collectPublicNames(target, seen)) names.add(n);
    }
  }
  return names;
}

/**
 * Resolve a NodeNext-style import specifier (which uses a `.js` extension for a `.ts` source)
 * to the actual file on disk.
 * @param {string} fromDir Directory of the importing file.
 * @param {string} spec The module specifier, e.g. `./reactive/index.js`.
 * @returns {string|null} Absolute path to the `.ts` file, or null if unresolved.
 */
function resolveModule(fromDir, spec) {
  if (!spec.startsWith('.')) return null; // external package — not our source
  const base = resolve(fromDir, spec).replace(/\.js$/, '');
  for (const candidate of [`${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** True if a node's JSDoc carries an `@example` tag. */
function hasExampleTag(node) {
  return ts.getJSDocTags(node).some((tag) => tag.tagName.escapedText === 'example');
}

/**
 * Check A — scan every comment for banned references.
 * @returns {{line: number, rule: string, match: string}[]}
 */
function findBannedRefs(text, sf) {
  const findings = [];
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, /* skipTrivia */ false, ts.LanguageVariant.Standard, text);
  let kind;
  while ((kind = scanner.scan()) !== ts.SyntaxKind.EndOfFileToken) {
    if (kind !== ts.SyntaxKind.SingleLineCommentTrivia && kind !== ts.SyntaxKind.MultiLineCommentTrivia) continue;
    const start = scanner.getTokenPos();
    const commentText = scanner.getTokenText();
    for (const rule of BAN_RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(commentText)) !== null) {
        // Map the match back to an exact source line (a block comment can span many lines).
        const line = sf.getLineAndCharacterOfPosition(start + m.index).line + 1;
        findings.push({ line, rule: rule.name, match: m[0] });
      }
    }
  }
  return findings;
}

/**
 * Check B — every exported class/function whose name is public must have an `@example`.
 * @returns {{line: number, name: string, kind: string}[]}
 */
function findMissingExamples(sf, publicNames) {
  const findings = [];
  const hasExport = (node) => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;

  for (const stmt of sf.statements) {
    if (ts.isClassDeclaration(stmt) && stmt.name && hasExport(stmt)) {
      record(stmt, stmt.name.text, 'class', stmt);
    } else if (ts.isFunctionDeclaration(stmt) && stmt.name && hasExport(stmt)) {
      record(stmt, stmt.name.text, 'function', stmt);
    } else if (ts.isVariableStatement(stmt) && hasExport(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        const init = decl.initializer;
        const isFn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
        if (isFn && ts.isIdentifier(decl.name)) {
          // JSDoc on a `const` factory attaches to the VariableStatement, not the declaration.
          record(stmt, decl.name.text, 'function', stmt);
        }
      }
    }
  }

  /** Record a public class/function that lacks an `@example`. */
  function record(node, name, kind, jsdocNode) {
    if (!publicNames.has(name)) return; // internal export — not part of the public API
    if (hasExampleTag(jsdocNode)) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
    findings.push({ line, name, kind });
  }

  return findings;
}

/**
 * Run both checks for one package.
 * @param {string} pkgDir Absolute package directory (must contain `src/`).
 * @returns {{ banned: object[], missing: object[], files: number } | null}
 */
function checkPackage(pkgDir) {
  const srcDir = join(pkgDir, 'src');
  const barrel = findBarrel(pkgDir);
  if (!existsSync(srcDir) || !barrel) return null;
  const publicNames = collectPublicNames(barrel);
  const files = collectSourceFiles(srcDir);

  const banned = [];
  const missing = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const sf = parse(file, text);
    const rel = relative(pkgDir, file);
    for (const f of findBannedRefs(text, sf)) banned.push({ file: rel, ...f });
    for (const f of findMissingExamples(sf, publicNames)) missing.push({ file: rel, ...f });
  }
  return { banned, missing, files: files.length };
}

/** Discover the package directories to check from the CLI args (or default to packages/*). */
function resolveTargets(args) {
  const dirs = args.filter((a) => !a.startsWith('--'));
  if (dirs.length > 0) {
    return dirs.map((d) => (isAbsolute(d) ? d : resolve(process.cwd(), d)));
  }
  const packagesDir = resolve(process.cwd(), 'packages');
  if (!existsSync(packagesDir)) return [process.cwd()];
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && findBarrel(join(packagesDir, e.name)) !== null)
    .map((e) => join(packagesDir, e.name));
}

const args = process.argv.slice(2);
const summaryOnly = args.includes('--summary');

try {
  const targets = resolveTargets(args);
  let totalBanned = 0;
  let totalMissing = 0;

  for (const pkgDir of targets) {
    const result = checkPackage(pkgDir);
    if (!result) continue;
    const label = relative(process.cwd(), pkgDir) || basename(pkgDir);
    totalBanned += result.banned.length;
    totalMissing += result.missing.length;

    if (!summaryOnly) {
      for (const b of result.banned) {
        process.stderr.write(`  ${b.file}:${b.line}  banned[${b.rule}]  "${b.match}"\n`);
      }
      for (const m of result.missing) {
        process.stderr.write(`  ${m.file}:${m.line}  missing @example on public ${m.kind} "${m.name}"\n`);
      }
    }
    process.stdout.write(
      `check:docs [${label}] — ${result.files} files · ${result.banned.length} banned refs · ${result.missing.length} missing @example\n`,
    );
  }

  if (totalBanned > 0 || totalMissing > 0) {
    process.stderr.write(
      `check:docs: FAILED — ${totalBanned} banned reference(s) + ${totalMissing} public export(s) missing @example.\n`,
    );
    process.exit(1);
  }
  process.stdout.write('check:docs: OK — docs are user/agent-facing and every public export has an @example.\n');
  process.exit(0);
} catch (err) {
  process.stderr.write(`check:docs: ERROR — ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(2);
}
