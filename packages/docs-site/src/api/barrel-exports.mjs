// Public-barrel export extractor — the independent ground truth the generated API
// tree is diffed against (coverage: nothing missing; leakage: nothing extra).
//
// Authored as plain ESM (.mjs) so the plain-`node` generation + gate scripts can
// import it directly (no TypeScript loader), while the vitest specs import the
// very same implementation — one shared source of truth for the export set.

import ts from 'typescript';

/**
 * Compiler options that resolve the repo's NodeNext `.js` import specifiers back
 * to their `.ts` sources (exactly as the packages compile), so `export *` chains
 * are followed the way the type checker — and TypeDoc — see them.
 */
const COMPILER_OPTIONS = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ESNext,
  allowJs: true,
  noEmit: true,
  skipLibCheck: true,
};

/**
 * Return the sorted list of PUBLIC symbol names a package barrel exports.
 *
 * Follows `export *` re-exports transitively (via the TypeScript checker, so it
 * matches the compiler exactly rather than a regex approximation), and excludes
 * anything tagged `@internal` — the same surface the generator emits with
 * `excludeInternal`. Never-exported locals never appear (they are not exports).
 * The result is de-duplicated and sorted so downstream diffs are stable.
 *
 * @param {string} entryFilePath  Absolute path to a package's public entry `.ts`.
 * @returns {string[]} The public export names, sorted ascending.
 *
 * @example
 * import { barrelExports } from './barrel-exports.mjs';
 * const names = barrelExports('/repo/packages/ui/src/index.ts');
 * // → ['Button', 'ButtonOptions', 'CheckGroup', …]
 */
export function barrelExports(entryFilePath) {
  const program = ts.createProgram([entryFilePath], COMPILER_OPTIONS);
  const checker = program.getTypeChecker();

  const sourceFile = program.getSourceFile(entryFilePath);
  if (!sourceFile) throw new Error(`barrelExports: cannot load entry point ${entryFilePath}`);

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) return []; // a file with no module-level exports

  const names = [];
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    if (isInternal(symbol, checker)) continue;
    names.push(symbol.getName());
  }
  return [...new Set(names)].sort();
}

/**
 * True when an exported symbol carries an `@internal` JSDoc tag. Aliases (from
 * `export { X } from './y.js'`) are resolved to their target first so the tag on
 * the original declaration is honoured, matching TypeDoc's `excludeInternal`.
 *
 * @param {import('typescript').Symbol} symbol
 * @param {import('typescript').TypeChecker} checker
 * @returns {boolean}
 */
function isInternal(symbol, checker) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return target.getJsDocTags(checker).some((tag) => tag.name === 'internal');
}
