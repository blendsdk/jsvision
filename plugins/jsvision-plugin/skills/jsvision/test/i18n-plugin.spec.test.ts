/**
 * The canonical skill is an SDK surface: source impact must route internationalization changes to
 * every relevant reference, the assembled plugin must be identical, and its localized-app recipe
 * must compile as a dependency-installation-free consumer.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { afterEach, describe, expect, test } from 'vitest';
import { checkTreesEqual } from '../../../scripts/check-plugin.mjs';
import { checkPluginImpact, readImpactRegistry } from '../../../scripts/plugin-impact.mjs';

const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(SKILL_ROOT, '..', '..');
const DISTRIBUTED_ROOT = join(REPO_ROOT, 'plugins', 'jsvision-plugin', 'skills', 'jsvision');
const RECIPE_PATH = join(SKILL_ROOT, 'references', 'recipes', 'i18n-app.md');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function localizedRecipe(): string {
  const markdown = readFileSync(RECIPE_PATH, 'utf8');
  const blocks = [...markdown.matchAll(/```(?:ts|typescript)\s*\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
  const recipe = blocks.find((block) => /\bcreateI18n\s*\(/u.test(block));
  expect(recipe, 'localized app recipe needs an executable TypeScript block').toBeDefined();
  return recipe ?? '';
}

describe('internationalization plugin impact', () => {
  test('maps implementation and application seams to every canonical reference with no unreviewed drift', () => {
    const registry = readImpactRegistry() as {
      readonly areas: readonly {
        readonly name: string;
        readonly paths: readonly string[];
        readonly references: readonly string[];
      }[];
    };
    const area = registry.areas.find((candidate) => candidate.paths.includes('packages/i18n/src'));
    expect(area).toBeDefined();
    expect(area?.paths).toEqual(
      expect.arrayContaining([
        'packages/i18n/src',
        'packages/ui/src/app',
        'packages/ui/src/i18n',
        'packages/forms/src',
        'packages/files/src',
        'packages/datagrid/src',
      ]),
    );
    expect(area?.references).toEqual(
      expect.arrayContaining([
        'references/i18n.md',
        'references/recipes/i18n-app.md',
        'references/api/i18n.md',
        'references/app-lifecycle.md',
      ]),
    );
    expect(checkPluginImpact().filter((finding) => finding.name === area?.name)).toEqual([]);
  });

  test('keeps the generated plugin copy byte-identical to the canonical skill', () => {
    expect(checkTreesEqual(SKILL_ROOT, DISTRIBUTED_ROOT)).toEqual([]);
  });
});

test('localized app recipe imports one requested locale explicitly and typechecks without installing', () => {
  const recipe = localizedRecipe();
  const source = ts.createSourceFile('main.ts', recipe, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const localeImports = source.statements
    .filter(ts.isImportDeclaration)
    .map((statement) => (ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : ''))
    .filter((specifier) => specifier.includes('/locales/'));
  expect(localeImports).toHaveLength(4);
  expect(
    localeImports
      .map((specifier) => /^@jsvision\/(ui|forms|files|datagrid)\/locales\/(.+)$/u.exec(specifier)?.[1])
      .sort(),
  ).toEqual(['datagrid', 'files', 'forms', 'ui']);
  const localeTags = new Set(
    localeImports.map((specifier) => /^@jsvision\/(?:ui|forms|files|datagrid)\/locales\/(.+)$/u.exec(specifier)?.[1]),
  );
  expect(localeTags.size).toBe(1);
  expect([...localeTags][0]).toMatch(/^(?:en|nl|de|fr|es|it|pt-PT|pl|ro|sv)$/u);

  const serviceDeclarations: ts.VariableDeclaration[] = [];
  const createApplicationCalls: ts.CallExpression[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer !== undefined &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === 'createI18n'
    ) {
      serviceDeclarations.push(node);
    }
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'createApplication') {
      createApplicationCalls.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(serviceDeclarations).toHaveLength(1);
  expect(createApplicationCalls).toHaveLength(1);
  const service = serviceDeclarations[0];
  expect(service !== undefined && ts.isIdentifier(service.name)).toBe(true);
  const serviceName = service !== undefined && ts.isIdentifier(service.name) ? service.name.text : '';
  const options =
    service?.initializer && ts.isCallExpression(service.initializer) ? service.initializer.arguments[0] : undefined;
  expect(options !== undefined && ts.isObjectLiteralExpression(options)).toBe(true);
  const catalogs =
    options !== undefined && ts.isObjectLiteralExpression(options)
      ? options.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) && property.name.getText(source) === 'catalogs',
        )
      : undefined;
  expect(catalogs !== undefined && ts.isArrayLiteralExpression(catalogs.initializer)).toBe(true);
  const catalogElements =
    catalogs !== undefined && ts.isArrayLiteralExpression(catalogs.initializer) ? catalogs.initializer.elements : [];
  expect(catalogElements.at(-1)?.getText(source)).toMatch(/app.*catalog/iu);

  const applicationOptions = createApplicationCalls[0]?.arguments[0];
  expect(applicationOptions !== undefined && ts.isObjectLiteralExpression(applicationOptions)).toBe(true);
  const injection =
    applicationOptions !== undefined && ts.isObjectLiteralExpression(applicationOptions)
      ? applicationOptions.properties.find((property) => property.name?.getText(source) === 'i18n')
      : undefined;
  expect(injection?.getText(source)).toMatch(new RegExp(`^(?:i18n|i18n:\\s*${serviceName})$`, 'u'));

  const consumer = mkdtempSync(join(REPO_ROOT, '.i18n-skill-consumer-'));
  temporaryDirectories.push(consumer);
  const entry = join(consumer, 'main.ts');
  writeFileSync(entry, recipe);
  const program = ts.createProgram([entry], {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
  });
  expect(ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code)).toEqual([]);
});
