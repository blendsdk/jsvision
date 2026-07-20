/**
 * Specification oracle for the repo's typecheck coverage gate.
 *
 * A `tsconfig` decides what the compiler is allowed to see, and a file it never
 * names is never checked — silently, forever. Two blind spots existed here: the
 * examples package named six directories out of its whole tree, and no package
 * except datagrid pointed its `typecheck` script at a config that included its
 * own `test/`. Because the compiler is the primary oracle for large mechanical
 * refactors, an invisible file is an unverified one.
 *
 * These checks pin the contract that closes both:
 *
 *   - the examples package typechecks every `.ts` file it contains;
 *   - a type error introduced into a demo entry is actually caught (the gate is
 *     watched failing, not merely assumed to work);
 *   - every package that ships both a `typecheck` script and a `test/` directory
 *     typechecks that directory.
 *
 * Coverage is read from the compiler's own config resolution — the same file set
 * `tsc --listFiles -p <config>` reports for the project — rather than by shelling
 * out to nine compilers, which would cost minutes per run to prove a fact that is
 * decided entirely by `include`/`exclude`.
 *
 * Immutable oracle: if a package config disagrees, the config is wrong — never
 * this test.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
// test/ lives at packages/examples/test → the repo root is three levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const PACKAGES = join(REPO_ROOT, 'packages');

/** Packages exempt from the coverage rule, with the reason they are exempt. */
const EXEMPT: Record<string, string> = {
  // A throwaway feasibility spike: no build, no test, no typecheck script by design.
  'spike-data-studio': 'inert spike — carries no typecheck script',
};

/**
 * Individual test files a package's typecheck config may leave out, and why.
 *
 * Kept here rather than trusted from each config, so that dropping a file out of the compiler is a
 * change to this oracle — visible in review — instead of a one-line edit nobody reads. Paths are
 * package-relative.
 */
const ALLOWED_UNCHECKED: Record<string, readonly string[]> = {
  // Both import a `.ts` helper from the sibling core package by workspace-relative path. That
  // resolves at run time under vitest, but a cross-package source file falls outside this package's
  // rootDir, which tsc rejects outright. They stay covered by vitest.
  datagrid: ['test/golden-screen.spec.test.ts', 'test/a11y-golden.spec.test.ts'],
};

/** Compare paths the way the compiler reports them: absolute, forward slashes. */
function norm(p: string): string {
  return resolve(p).split(sep).join('/');
}

/**
 * The tsconfig a package's own `typecheck` script compiles.
 *
 * Read from the script text rather than assumed, because that is the only config
 * whose coverage actually gates CI — a `tsconfig.typecheck.json` nobody runs
 * proves nothing.
 */
function typecheckConfigOf(pkgDir: string): string | undefined {
  const pkgJson = join(pkgDir, 'package.json');
  if (!existsSync(pkgJson)) return undefined;
  const script = (JSON.parse(readFileSync(pkgJson, 'utf8')) as { scripts?: Record<string, string> }).scripts?.typecheck;
  if (script === undefined) return undefined;
  // Both spellings tsc accepts — matching only `-p` would silently fall back to `tsconfig.json` and
  // report coverage for a config that is never compiled.
  const explicit = /(?:-p|--project)[\s=]+(\S+)/.exec(script);
  return join(pkgDir, explicit ? explicit[1]! : 'tsconfig.json');
}

/** Every file the given tsconfig puts into the program, absolute and normalized. */
function programFiles(configPath: string): string[] {
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(read.error, `${relative(REPO_ROOT, configPath)} failed to parse`).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath), undefined, configPath);
  expect(parsed.errors.filter((e) => e.category === ts.DiagnosticCategory.Error)).toEqual([]);
  return parsed.fileNames.map(norm);
}

/** Every `.ts` file physically present under a directory, ignoring node_modules. */
function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(norm(full));
  }
  return out;
}

// ST-1 — the examples package typechecks every .ts file it contains, not a named subset.
test('ST-1: the examples typecheck config covers every .ts file in the package', () => {
  const config = typecheckConfigOf(join(PACKAGES, 'examples'));
  expect(config, 'packages/examples must have a typecheck script').toBeDefined();
  const covered = new Set(programFiles(config!));
  const uncovered = tsFilesUnder(join(PACKAGES, 'examples'))
    .filter((f) => !covered.has(f))
    .map((f) => relative(REPO_ROOT, f));
  expect(uncovered).toEqual([]);
});

// ST-2 — the gate is watched failing: an error in a demo entry that the old include
// never named is caught, and reverting the injection restores green. Compiled from an
// in-memory overlay so the working tree is never mutated and nothing needs reverting.
test('ST-2: a type error in a previously-unchecked demo entry fails the typecheck', () => {
  const pkg = join(PACKAGES, 'examples');
  const entry = norm(join(pkg, 'view-demo', 'main.ts'));
  const config = typecheckConfigOf(pkg)!;

  // The gate only exists if the file is in the program at all — that is the half the
  // old six-directory include failed, and no amount of compiler strictness substitutes.
  expect(programFiles(config)).toContain(entry);

  const read = ts.readConfigFile(config, ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(config), undefined, config).options;

  /** Diagnostics for the entry alone, optionally with `extra` appended to its source. */
  const diagnose = (extra: string): readonly ts.Diagnostic[] => {
    const host = ts.createCompilerHost(options, true);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (name, ...rest) => {
      if (norm(name) !== entry || extra === '') return original(name, ...rest);
      const text = `${readFileSync(entry, 'utf8')}\n${extra}\n`;
      return ts.createSourceFile(name, text, ts.ScriptTarget.ES2022, true);
    };
    const program = ts.createProgram([entry], options, host);
    const file = program.getSourceFile(entry)!;
    return [...program.getSyntacticDiagnostics(file), ...program.getSemanticDiagnostics(file)];
  };

  // Reverted (i.e. the file as committed) is green …
  expect(diagnose('').map((d) => `${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)).toEqual([]);
  // … and the injected error is reported, on this file, as the assignment mismatch it is.
  expect(diagnose(`export const __gateProbe: number = 'not a number';`).map((d) => d.code)).toContain(2322);
});

// ST-3 — tests are typechecked repo-wide. `readonly` and every other type-only contract
// is erased at runtime, so a test directory the compiler never sees enforces nothing.
//
// Every test file must be in the program, not merely one of them: a config that dropped all but a
// single file would satisfy "the directory is covered" while leaving the rest unchecked.
test('ST-3: every package with a typecheck script typechecks every file in its test/ directory', () => {
  const uncovered: string[] = [];
  for (const name of readdirSync(PACKAGES)) {
    const pkgDir = join(PACKAGES, name);
    const testDir = join(pkgDir, 'test');
    const config = typecheckConfigOf(pkgDir);
    if (!existsSync(testDir)) continue; // nothing to cover
    if (config === undefined) {
      // A package can only opt out of the gate by being named here — otherwise deleting a typecheck
      // script would silently un-gate the whole package, the exact hole this test exists to close.
      expect(EXEMPT[name], `${name} has tests but no typecheck script, and is not a named exemption`).toBeDefined();
      continue;
    }
    const inProgram = new Set(programFiles(config));
    const allowed = new Set((ALLOWED_UNCHECKED[name] ?? []).map((rel) => norm(join(pkgDir, rel))));
    for (const file of tsFilesUnder(testDir)) {
      if (!inProgram.has(file) && !allowed.has(file)) uncovered.push(relative(REPO_ROOT, file));
    }
  }
  expect(uncovered).toEqual([]);
});
