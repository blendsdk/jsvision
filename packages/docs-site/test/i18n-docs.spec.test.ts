/**
 * Consumer documentation is executable product surface: the guide must cover every runtime
 * boundary, its localized application must compile and build headlessly, and generated API
 * navigation must expose the complete internationalization package.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, test } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import type { Application, View } from '@jsvision/ui';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = join(PACKAGE_ROOT, '..', '..');
const GUIDE_PATH = join(PACKAGE_ROOT, 'guide', 'i18n.md');
const EXAMPLE_PATH = join(PACKAGE_ROOT, 'examples', 'i18n-theme-designer.ts');
const REFERENCE_PATH = join(PACKAGE_ROOT, 'reference', 'i18n.md');
const CONFIG_PATH = join(PACKAGE_ROOT, '.vitepress', 'config.ts');
const API_PACKAGES_PATH = join(PACKAGE_ROOT, 'src', 'api', 'packages.mjs');

function readRequired(path: string): string {
  expect(existsSync(path), path).toBe(true);
  return readFileSync(path, 'utf8');
}

describe('consumer internationalization guide', () => {
  test('covers the complete browser, Node, catalog, loading, recovery, and migration workflow', () => {
    const guide = readRequired(GUIDE_PATH);
    const requiredSubstance = [
      /browser/iu,
      /@jsvision\/i18n\/node/u,
      /createI18n/u,
      /loadI18n/u,
      /defineCatalog/u,
      /plural/iu,
      /select/iu,
      /interpolat/iu,
      /format/iu,
      /diagnostic/iu,
      /atomic/iu,
      /createApplication\s*\(\s*\{\s*[\s\S]*?i18n/gu,
      /application catalog[\s\S]*last/iu,
      /partial[\s\S]*strict/iu,
      /AbortSignal|AbortController/u,
      /timeout/iu,
      /Theme Designer/iu,
      /no-config/iu,
      /BlendSDK/u,
    ];
    for (const pattern of requiredSubstance) {
      expect(guide, `missing guide substance ${pattern}`).toMatch(pattern);
    }
    expect(guide).toMatch(/\]\(\.\.\/components\/theming\/i18n-theme-designer\)/u);
  });

  test('typechecks the localized Theme Designer and runs its public headless build contract', async () => {
    readRequired(EXAMPLE_PATH);
    const configPath = join(PACKAGE_ROOT, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    expect(config.error).toBeUndefined();
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, PACKAGE_ROOT, undefined, configPath);
    const program = ts.createProgram(parsed.fileNames, parsed.options);
    expect(ts.getPreEmitDiagnostics(program).map((diagnostic) => diagnostic.code)).toEqual([]);

    const module = (await import(pathToFileURL(EXAMPLE_PATH).href)) as {
      readonly default?: {
        readonly build?: (context: {
          readonly width: number;
          readonly height: number;
          readonly caps: ReturnType<typeof resolveCapabilities>['profile'];
        }) => Application | View;
      };
    };
    expect(module.default?.build).toBeTypeOf('function');
    const built = module.default?.build?.({
      width: 80,
      height: 24,
      caps: resolveCapabilities({
        env: {},
        platform: 'linux',
        override: { colorDepth: 'truecolor' },
      }).profile,
    });
    expect(built).toBeDefined();
  });
});

describe('generated internationalization API navigation', () => {
  test('links the package and locale entry points and keeps every public export documented', () => {
    const apiPackages = readRequired(API_PACKAGES_PATH);
    expect(apiPackages).toMatch(
      /\{\s*name:\s*['"]i18n['"],\s*entry:\s*['"]\.\.\/i18n\/src\/index\.ts['"],\s*tsconfig:\s*['"]\.\.\/i18n\/tsconfig\.json['"]\s*\}/u,
    );

    const entryPath = join(REPO_ROOT, 'packages', 'i18n', 'src', 'index.ts');
    const program = ts.createProgram([entryPath], {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entryPath);
    expect(source).toBeDefined();
    const moduleSymbol = source === undefined ? undefined : checker.getSymbolAtLocation(source);
    expect(moduleSymbol).toBeDefined();
    const undocumented =
      moduleSymbol === undefined
        ? ['<missing-module>']
        : checker
            .getExportsOfModule(moduleSymbol)
            .map((exported) => (exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported))
            .filter((exported) => !exported.getJsDocTags(checker).some((tag) => tag.name === 'internal'))
            .filter((exported) => ts.displayPartsToString(exported.getDocumentationComment(checker)).trim() === '')
            .map((exported) => exported.getName())
            .sort();
    expect(undocumented).toEqual([]);

    const reference = readRequired(REFERENCE_PATH);
    const config = readRequired(CONFIG_PATH);
    expect(reference).toMatch(/\/api\/i18n\//u);
    expect(config).toMatch(/\/guide\/i18n/u);
    expect(config).toMatch(/\/reference\/i18n/u);
    for (const packageName of ['ui', 'forms', 'files', 'datagrid']) {
      expect(reference).toContain(`@jsvision/${packageName}/locales/`);
    }
  });
});
