/**
 * Specification oracle for the layout DSL's names: nothing may shadow a builder
 * it imports.
 *
 * The DSL exports short, ordinary words — `row`, `col`, `at`, `center`, `place`,
 * `stack`, `grow`, `fixed`. Bare, "no file declares a `row`" is not a rule
 * anybody could keep, and it never was: `core/src/engine/render/buffer.ts`,
 * `datagrid/src/row-mutations.ts`, `ui/src/tree/tree.ts` and half a dozen more
 * carry perfectly harmless local `row`/`col`/`at` bindings in files that have
 * never heard of the DSL. A guard written that way would be permanently red and
 * therefore permanently ignored.
 *
 * The rule that is worth keeping is narrower and mechanical: **inside a file
 * that imports a builder, no local declaration may reuse that builder's name.**
 * A shadow there is genuinely confusing — the same identifier means the
 * framework's builder on one line and something unrelated twelve lines down —
 * and, when it is a module-level declaration, TypeScript will not even allow the
 * import to be added later without a rename first. That is the real cost this
 * pins: a shadow silently blocks a file from adopting the DSL.
 *
 * **What it checks, exactly.** Declarations of any kind (`const`/`let`/`var`/
 * `function`/`class`) anywhere on a line, including a `for`-loop binding, in a
 * file importing the name either from `@jsvision/ui` or by a relative path into
 * the DSL — the form all adoption inside `@jsvision/ui` itself takes.
 *
 * **What it does not check: parameters and destructuring.** `sortBy(col: number)`
 * in a file importing `col` is the same kind of shadow and is not reported. A
 * regex cannot tell that apart from a type annotation or a string, and the
 * heuristic tried first matched two test *titles*. Catching it needs a real
 * parser; the honest choice is a guard that never cries wolf plus a docstring
 * that says what is outside it, rather than a green that reads broader than it
 * is.
 *
 * The guard is green by construction once the shadows are retired, so it earns
 * its keep as a regression gate rather than as a worklist. It is watched failing
 * by injecting a shadow into a file that imports a builder, not merely assumed
 * to work.
 *
 * Immutable oracle: if this fails, rename the local binding — never this test.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
// test/ lives at packages/examples/test → the repo root is three levels up.
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const PACKAGES = join(REPO_ROOT, 'packages');

/** The DSL barrel this list is kept honest against — see the second test below. */
const DSL_BARREL = join(PACKAGES, 'ui', 'src', 'view', 'dsl', 'index.ts');

/**
 * The value exports of `@jsvision/ui`'s layout DSL (`src/view/dsl/index.ts`).
 * Type-only exports are excluded: a type and a value never collide.
 *
 * Spelled out rather than imported so the list is reviewable in place; the
 * companion test below fails if the barrel gains or loses a builder, which is
 * the one way a regression gate must not be allowed to quietly narrow.
 */
const DSL_BUILDERS = [
  'col',
  'row',
  'grow',
  'fixed',
  'spacer',
  'stack',
  'place',
  'centered',
  'topRight',
  'bottomRight',
  'topLeft',
  'at',
  'cover',
  'center',
] as const;

/**
 * An `import { … } from '<barrel-or-dsl-path>'` block. The specifier is either the
 * package barrel or a relative path into the DSL (`…/view/dsl/…`) or the view
 * barrel that re-exports it.
 */
const IMPORT_BLOCK =
  /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"](?:@jsvision\/ui|\.[^'"]*(?:view\/dsl|view\/index)[^'"]*)['"]/g;

/** Directories that hold no reviewable source: build output, vendored deps, and the inert spike. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage', 'api', '_archive', 'spike-data-studio']);

/** Every `.ts`/`.mts` file under `packages/`, minus build output and the inert spike. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if ((entry.endsWith('.ts') || entry.endsWith('.mts')) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

/**
 * Blank out block and line comments, preserving line count and line offsets so
 * reported line numbers still point at the real source.
 *
 * Load-bearing, not hygiene: the DSL's own modules carry `@example` blocks that
 * open with `import { col, row } from '@jsvision/ui';`, so an uncommented scan
 * reads every builder as importing itself and reports the definitions as
 * shadows of themselves.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

/**
 * The names a file imports as *values* from either the package barrel or a
 * relative path into the DSL.
 *
 * Both spellings matter: consumers write `@jsvision/ui`, but every adoption site
 * inside the `ui` package itself imports the builders relatively, and a guard
 * blind to that leaves all of the shipped widget source unguarded.
 *
 * `import type { … }` blocks are skipped wholesale, and so is an aliased import
 * (`at as place`), because in both cases the local identifier is not the
 * builder's name and cannot shadow it.
 */
function valueImportsOfBuilders(source: string): Set<string> {
  const names = new Set<string>();
  for (const [, typeOnly, body] of source.matchAll(IMPORT_BLOCK)) {
    if (typeOnly !== undefined) continue;
    for (const raw of body.split(',')) {
      const spec = raw.trim();
      if (spec === '' || spec.startsWith('type ') || spec.includes(' as ')) continue;
      names.add(spec);
    }
  }
  return names;
}

/**
 * Line numbers on which `name` is declared locally — `const`/`let`/`var`/
 * `function`/`class`, anywhere on the line.
 *
 * Deliberately unanchored. An anchored pattern reads only module-level and
 * statement-leading declarations, which silently exempts the single most common
 * shadow shape there is: `for (const row of rows)`. Two of those were introduced
 * under an anchored version of this very guard, and it stayed green.
 *
 * The source arrives comment-free (see {@link stripComments}), so a commented-out
 * declaration never counts.
 */
function localBindings(source: string, name: string): number[] {
  const declaration = new RegExp(String.raw`\b(?:const|let|var|function|class)\s+${name}\b`);
  return source
    .split('\n')
    .map((line, i) => (declaration.test(line) ? i + 1 : 0))
    .filter((n) => n > 0);
}

// ST-11 — the shadow rule, stated the only way it can ever pass: scoped to files
// that import the name they would be shadowing.
test('ST-11: no file that imports a layout-DSL builder binds that name locally', () => {
  const shadows: string[] = [];

  for (const file of sourceFiles(PACKAGES)) {
    const raw = readFileSync(file, 'utf8');
    // Cheap prescreen before the two whole-file comment-blanking passes: roughly three files in four
    // never mention the DSL at all, and blanking them is the bulk of this test's cost.
    if (!raw.includes('@jsvision/ui') && !raw.includes('view/dsl')) continue;
    const source = stripComments(raw);
    const imported = valueImportsOfBuilders(source);
    if (imported.size === 0) continue;

    for (const builder of DSL_BUILDERS) {
      if (!imported.has(builder)) continue;
      for (const line of localBindings(source, builder)) {
        shadows.push(`${relative(REPO_ROOT, file).split(sep).join('/')}:${line} — local '${builder}'`);
      }
    }
  }

  expect(shadows).toEqual([]);
});

// A hand-written list is the wrong shape for a gate that must not silently stop
// covering things, so it is pinned to the barrel rather than trusted.
test("the builder list covers exactly the DSL barrel's value exports", () => {
  const barrel = stripComments(readFileSync(DSL_BARREL, 'utf8'));
  const exported = new Set<string>();
  for (const [, body] of barrel.matchAll(/export\s+\{([^}]*)\}\s*from/g)) {
    for (const raw of body.split(',')) {
      const spec = raw.trim();
      if (spec === '' || spec.startsWith('type ')) continue;
      exported.add(spec.includes(' as ') ? spec.split(' as ')[1].trim() : spec);
    }
  }
  expect([...exported].sort()).toEqual([...DSL_BUILDERS].sort());
});
