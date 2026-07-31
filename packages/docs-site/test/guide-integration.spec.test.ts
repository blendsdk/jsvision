/**
 * Immutable ST-41–ST-47 integration oracle for the complete Guide curriculum.
 *
 * Route-specific specifications own lesson depth. This suite verifies that the committed catalog,
 * pages, snippets, registry modules, template1 applications, trust evidence, and VitePress inputs
 * compose into one deterministic learning path.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import vitepressConfig from '../.vitepress/config.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { LatestResultPanel } from '../src/example-fixtures/async-work/latest-result-panel.js';
import { BrowserCapabilityPanel } from '../src/example-fixtures/running-in-the-browser/browser-capability-panel.js';
import { CapstoneWorkflowPanel } from '../src/example-fixtures/complete-application/workflow-model.js';
import { FileSystemSeamPanel } from '../src/example-fixtures/files-and-filesystem/file-system-seam-panel.js';
import { UntrustedTextPanel } from '../src/example-fixtures/untrusted-text/untrusted-text-panel.js';
import { parseGuideCatalog, projectGuideNavigation } from '../src/guides/guide-catalog.mjs';
import { buildLabExample, collectTemplate1Evidence, frameText, viewsIn } from './example-lab-harness.js';

const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPOSITORY_ROOT = resolve(PACKAGE_ROOT, '..', '..');
const GUIDE_ROOT = join(PACKAGE_ROOT, 'guide');
const CATALOG = parseGuideCatalog(readFileSync(join(PACKAGE_ROOT, 'guides.json'), 'utf8'));
const CURRICULUM = readFileSync(join(GUIDE_ROOT, 'index.md'), 'utf8');
const ROOT_MANIFEST = JSON.parse(readFileSync(join(REPOSITORY_ROOT, 'package.json'), 'utf8')) as {
  readonly scripts?: Readonly<Record<string, string>>;
};
const AGENTS = readFileSync(join(REPOSITORY_ROOT, 'AGENTS.md'), 'utf8');

interface SidebarItem {
  readonly text: string;
  readonly link: string;
}

interface SidebarGroup {
  readonly text: string;
  readonly items: readonly SidebarItem[];
}

interface MarkdownDocument {
  readonly path: string;
  readonly route: string;
  readonly source: string;
}

interface SnippetImport {
  readonly document: string;
  readonly specifier: string;
  readonly runtimeNames: readonly string[];
  readonly defaultImport: boolean;
}

function routeSource(route: string): string {
  if (route === '/guide/') return join(GUIDE_ROOT, 'index.md');
  if (route.endsWith('/')) return join(PACKAGE_ROOT, route.slice(1), 'index.md');
  return join(PACKAGE_ROOT, `${route.slice(1)}.md`);
}

function guideSidebar(): readonly SidebarGroup[] {
  const config = vitepressConfig as {
    readonly themeConfig?: { readonly sidebar?: Readonly<Record<string, unknown>> };
  };
  const sidebar = config.themeConfig?.sidebar?.['/guide/'];
  if (!Array.isArray(sidebar)) throw new TypeError('VitePress must expose the projected /guide/ sidebar');
  return sidebar as readonly SidebarGroup[];
}

function guideDocuments(): MarkdownDocument[] {
  return CATALOG.entries
    .filter((entry) => entry.profile !== 'specialist')
    .map((entry) => ({
      path: routeSource(entry.page),
      route: entry.page,
      source: readFileSync(routeSource(entry.page), 'utf8'),
    }));
}

function integrationDocuments(): MarkdownDocument[] {
  const guides = [
    {
      path: join(GUIDE_ROOT, 'index.md'),
      route: '/guide/',
      source: CURRICULUM,
    },
    ...guideDocuments(),
  ];
  const specialists = CATALOG.entries
    .filter((entry) => entry.profile === 'specialist')
    .map((entry) => ({
      path: routeSource(entry.page),
      route: entry.page,
      source: readFileSync(routeSource(entry.page), 'utf8'),
    }));
  return [...guides, ...specialists];
}

function markdownLinks(source: string): string[] {
  const pattern = new RegExp(String.raw`\[[^\x5d]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)`, 'gu');
  return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

function stripFragment(link: string): string {
  return link.split('#', 1)[0] ?? '';
}

function resolveInternalLink(document: MarkdownDocument, link: string): string | null {
  const target = stripFragment(link);
  if (
    target === '' ||
    target.startsWith('#') ||
    /^(?:https?:|mailto:|tel:)/u.test(target) ||
    target.startsWith('/api/')
  ) {
    return null;
  }
  if (target.startsWith('/')) return routeSource(target);
  const absolute = normalize(resolve(dirname(document.path), target));
  if (target.endsWith('/')) return join(absolute, 'index.md');
  return extname(absolute) === '' ? `${absolute}.md` : absolute;
}

function linkedDocumentPaths(document: MarkdownDocument): Set<string> {
  const paths = new Set<string>();
  for (const link of markdownLinks(document.source)) {
    const target = resolveInternalLink(document, link);
    if (target !== null) paths.add(target);
  }
  return paths;
}

function assertAcyclicPrerequisites(): void {
  const entries = new Map(CATALOG.entries.map((entry) => [entry.id, entry] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, path: readonly string[]): void => {
    if (visiting.has(id)) throw new Error(`Guide prerequisite cycle: ${[...path, id].join(' -> ')}`);
    if (visited.has(id)) return;
    visiting.add(id);
    const entry = entries.get(id);
    if (entry === undefined) throw new Error(`unknown Guide prerequisite: ${id}`);
    for (const prerequisite of entry.prerequisites) visit(prerequisite, [...path, id]);
    visiting.delete(id);
    visited.add(id);
  };
  for (const entry of CATALOG.entries) visit(entry.id, []);
}

function typescriptSnippets(document: MarkdownDocument): string[] {
  return [...document.source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/gu)].map((match) => match[1] ?? '');
}

function snippetImports(document: MarkdownDocument): SnippetImport[] {
  const imports: SnippetImport[] = [];
  for (const snippet of typescriptSnippets(document)) {
    for (const match of snippet.matchAll(/import\s+(?!type\b)([\s\S]*?)\s+from\s+['"]([^'"]+)['"];?/gu)) {
      const clause = (match[1] ?? '').trim();
      const specifier = match[2] ?? '';
      const named = /\{([\s\S]*?)\}/u.exec(clause)?.[1] ?? '';
      const runtimeNames = named
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry !== '' && !entry.startsWith('type '))
        .map((entry) => entry.split(/\s+as\s+/u, 1)[0]?.trim() ?? '')
        .filter(Boolean);
      const beforeNamed = clause.split('{', 1)[0]?.replace(/,$/u, '').trim() ?? '';
      const defaultImport = beforeNamed !== '' && !beforeNamed.startsWith('* as ');
      imports.push({ document: document.route, specifier, runtimeNames, defaultImport });
    }
  }
  return imports;
}

function publicPackagePath(specifier: string): { packageRoot: string; exportKey: string } | null {
  if (!specifier.startsWith('@jsvision/')) return null;
  const segments = specifier.split('/');
  const packageName = segments[1];
  if (packageName === undefined) return null;
  const packageRoot = join(REPOSITORY_ROOT, 'packages', packageName);
  const subpath = segments.slice(2).join('/');
  return { packageRoot, exportKey: subpath === '' ? '.' : `./${subpath}` };
}

function localModuleEvidence(entrySourcePath: string): string {
  const initial = join(PACKAGE_ROOT, entrySourcePath);
  const visited = new Set<string>();
  const chunks: string[] = [];
  const visit = (path: string): void => {
    const normalized = normalize(path);
    if (visited.has(normalized) || !normalized.startsWith(PACKAGE_ROOT) || !existsSync(normalized)) return;
    visited.add(normalized);
    const source = readFileSync(normalized, 'utf8');
    chunks.push(source);
    for (const match of source.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/gu)) {
      const target = resolve(dirname(normalized), match[1] ?? '');
      const candidate = extname(target) === '.js' ? `${target.slice(0, -3)}.ts` : target;
      visit(candidate);
    }
  };
  visit(initial);
  return chunks.join('\n');
}

async function loadGuideDefinition(id: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`missing registered Guide example: ${id}`);
  return (await entry.load()).default;
}

describe('ST-41 Guide learning path and links', () => {
  test('should resolve every prerequisite and keep the catalog learning graph acyclic', () => {
    expect(() => assertAcyclicPrerequisites()).not.toThrow();
    const documents = new Map(guideDocuments().map((document) => [document.route, document] as const));
    const missingLinks: string[] = [];
    for (const entry of CATALOG.entries.filter((candidate) => candidate.profile !== 'specialist')) {
      const document = documents.get(entry.page);
      expect(document, entry.id).toBeDefined();
      const linkedPaths = linkedDocumentPaths(document as MarkdownDocument);
      for (const prerequisiteId of entry.prerequisites) {
        const prerequisite = CATALOG.entries.find((candidate) => candidate.id === prerequisiteId);
        expect(prerequisite, `${entry.id}: unknown prerequisite ${prerequisiteId}`).toBeDefined();
        if (!linkedPaths.has(routeSource(prerequisite?.page ?? ''))) {
          missingLinks.push(`${entry.id} -> ${prerequisiteId}`);
        }
      }
    }
    expect(missingLinks, 'catalog prerequisite links missing from learner pages').toEqual([]);
  });

  test('should resolve every committed internal documentation link and preserve a next step', () => {
    const documents = integrationDocuments();
    for (const document of documents) {
      const links = markdownLinks(document.source);
      for (const link of links) {
        const target = resolveInternalLink(document, link);
        if (target !== null) expect(existsSync(target), `${document.route} -> ${link}`).toBe(true);
        if (link.startsWith('/api/')) {
          expect(link).toMatch(
            /^(?:\/api\/|\/api\/[a-z0-9-]+\/(?:classes|functions|interfaces|type-aliases|variables|enums)\/)/u,
          );
        }
      }
      if (document.route.startsWith('/guide/') && document.route !== '/guide/') {
        const ownEntry = CATALOG.entries.find((entry) => entry.page === document.route);
        const prerequisitePaths = new Set(
          (ownEntry?.prerequisites ?? []).map((id) =>
            routeSource(CATALOG.entries.find((entry) => entry.id === id)?.page ?? ''),
          ),
        );
        const onward = links.some((link) => {
          const target = resolveInternalLink(document, link);
          return (
            target !== null &&
            target.startsWith(PACKAGE_ROOT) &&
            target !== document.path &&
            !prerequisitePaths.has(target)
          );
        });
        expect(onward, `${document.route}: missing a non-prerequisite next step`).toBe(true);
      }
    }
  });
});

describe('ST-42 catalog, navigation, registry, and file coherence', () => {
  test('should publish exactly 29 Guide routes and two specialists at Complete', () => {
    expect(CATALOG.entries).toHaveLength(31);
    expect(CATALOG.entries.every((entry) => entry.stage === 'complete')).toBe(true);
    expect(CATALOG.entries.filter((entry) => entry.profile === 'specialist')).toHaveLength(2);
    expect(CATALOG.entries.filter((entry) => entry.profile !== 'specialist')).toHaveLength(29);
    expect(CATALOG.entries.filter((entry) => entry.page.startsWith('/guide/'))).toHaveLength(29);
    expect(CATALOG.entries.filter((entry) => entry.page.startsWith('/components/'))).toHaveLength(2);
  });

  test('should keep routes, curriculum, sidebar, files, and registered evidence synchronized', () => {
    const projected = projectGuideNavigation(CATALOG.entries).map((group) => ({
      text: group.text,
      items: group.items.map(({ text, link }) => ({ text, link })),
    }));
    expect(guideSidebar()).toEqual(projected);
    const registered = new Set(EXAMPLES.map((entry) => entry.id));
    for (const entry of CATALOG.entries) {
      expect(existsSync(routeSource(entry.page)), `${entry.id}: route source`).toBe(true);
      expect(CURRICULUM, `${entry.id}: curriculum title`).toContain(entry.title);
      expect(CURRICULUM, `${entry.id}: curriculum route`).toContain(`](${entry.page})`);
      expect(entry.examples.length, `${entry.id}: example target`).toBeGreaterThanOrEqual(entry.requiredLiveExamples);
      for (const id of entry.examples) expect(registered.has(id), `${entry.id}: ${id}`).toBe(true);
    }
    const declared = new Set(CATALOG.entries.flatMap((entry) => entry.examples));
    const guideRegistry = EXAMPLES.filter((entry) => entry.id.startsWith('guides/'));
    expect(guideRegistry.every((entry) => declared.has(entry.id))).toBe(true);
  });
});

describe('ST-43 completed Guide snippet/public API parity', () => {
  test('should use only public supported module paths from committed package exports', () => {
    const imports = guideDocuments().flatMap(snippetImports);
    expect(imports.length).toBeGreaterThan(40);
    for (const item of imports) {
      expect(item.specifier, item.document).not.toMatch(/(?:\/src\/|\/dist\/|\/engine\/|\/test\/|\.\.\/)/u);
      const publicPath = publicPackagePath(item.specifier);
      if (publicPath !== null) {
        const manifest = JSON.parse(readFileSync(join(publicPath.packageRoot, 'package.json'), 'utf8')) as {
          readonly exports?: Readonly<Record<string, unknown>>;
        };
        expect(manifest.exports, `${item.document}: ${item.specifier}`).toHaveProperty(publicPath.exportKey);
      } else {
        expect(item.specifier, item.document).toMatch(/^(?:\.\/|node:|zod$|@xterm\/xterm$)/u);
      }
    }
  });

  test('should resolve every runtime value named by a teaching snippet', async () => {
    const imports = guideDocuments().flatMap(snippetImports);
    const modules = new Map<string, Record<string, unknown>>();
    for (const item of imports) {
      if (item.specifier.startsWith('./')) continue;
      let module = modules.get(item.specifier);
      if (module === undefined) {
        module = (await import(item.specifier)) as Record<string, unknown>;
        modules.set(item.specifier, module);
      }
      if (item.defaultImport)
        expect(module, `${item.document}: default from ${item.specifier}`).toHaveProperty('default');
      for (const name of item.runtimeNames) {
        expect(
          Object.prototype.hasOwnProperty.call(module, name),
          `${item.document}: runtime export ${name} from ${item.specifier}`,
        ).toBe(true);
      }
    }
  });
});

describe('ST-44 registered Guide template1 applications', () => {
  test('should smoke-render every declared Guide lab at 80x24 and survive maximize and restore', async () => {
    const labIds = CATALOG.entries.flatMap((entry) => entry.examples).filter((id) => id.startsWith('guides/'));
    expect(labIds).toHaveLength(43);
    expect(new Set(labIds).size).toBe(labIds.length);
    for (const id of labIds) {
      const entry = EXAMPLES.find((candidate) => candidate.id === id);
      expect(entry, id).toMatchObject({ id, category: 'guides', kind: 'app' });
      const definition = await loadGuideDefinition(id);
      const { app, dialog } = buildLabExample(id, definition);
      try {
        const compact = collectTemplate1Evidence(app, dialog);
        expect(compact.viewport).toEqual({ width: 80, height: 24 });
        expect(compact.dialogInterior.join('\n'), `${id}: keyboard instructions`).toMatch(
          /(?:Alt|Tab|Enter|Space|arrow|click|mouse)/iu,
        );
        dialog.zoom();
        app.loop.renderRoot.flush();
        collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
        dialog.zoom();
        app.loop.renderRoot.flush();
        const restored = collectTemplate1Evidence(app, dialog);
        expect(restored.dialogRect).toEqual(compact.dialogRect);
        expect(frameText(app), `${id}: visible lesson`).toMatch(/\S/u);
      } finally {
        app.loop.dispose();
      }
    }
  }, 120_000);
});

describe('ST-45 lifecycle, unsafe text, and host-boundary evidence', () => {
  test('should behaviorally prove cancellation, denial, sanitization, stale suppression, and cleanup', async () => {
    const asyncLab = buildLabExample(
      'guides/latest-result-wins',
      await loadGuideDefinition('guides/latest-result-wins'),
    );
    const asyncPanel = viewsIn(asyncLab.dialog).find(
      (view): view is LatestResultPanel => view instanceof LatestResultPanel,
    );
    expect(asyncPanel).toBeDefined();
    asyncPanel?.requestPair('keyboard');
    asyncPanel?.completeNewest('keyboard');
    asyncPanel?.completeOlder('keyboard');
    expect(asyncPanel).toMatchObject({ publishedRuns: 1, staleDrops: 1, cleanupCount: 2 });
    asyncLab.app.loop.dispose();
    expect(asyncPanel?.mounted).toBe(false);

    const filesLab = buildLabExample('guides/filesystem-seams', await loadGuideDefinition('guides/filesystem-seams'));
    const filesPanel = viewsIn(filesLab.dialog).find(
      (view): view is FileSystemSeamPanel => view instanceof FileSystemSeamPanel,
    );
    expect(filesPanel).toBeDefined();
    filesPanel?.armDenial('keyboard');
    filesPanel?.read('keyboard');
    filesPanel?.read('keyboard');
    expect(filesPanel).toMatchObject({ deniedRuns: 1, readRuns: 1 });
    filesLab.app.loop.dispose();
    expect(filesPanel).toMatchObject({ cleanupCount: 1, mounted: false });

    const browserLab = buildLabExample(
      'guides/browser-capability-boundaries',
      await loadGuideDefinition('guides/browser-capability-boundaries'),
    );
    const browserPanel = viewsIn(browserLab.dialog).find(
      (view): view is BrowserCapabilityPanel => view instanceof BrowserCapabilityPanel,
    );
    expect(browserPanel).toBeDefined();
    await browserPanel?.copyAuthorized('keyboard');
    await browserPanel?.copyDenied('keyboard');
    browserPanel?.useVirtualFile('keyboard');
    expect(browserPanel).toMatchObject({
      clipboardWrites: 1,
      deniedClipboardWrites: 1,
      virtualFileOperations: 1,
    });
    browserLab.app.loop.dispose();
    expect(browserPanel).toMatchObject({ cleanupCount: 1, mounted: false });

    const unsafeLab = buildLabExample(
      'guides/untrusted-text-boundary',
      await loadGuideDefinition('guides/untrusted-text-boundary'),
    );
    const unsafePanel = viewsIn(unsafeLab.dialog).find(
      (view): view is UntrustedTextPanel => view instanceof UntrustedTextPanel,
    );
    expect(unsafePanel).toBeDefined();
    unsafePanel?.sanitizeSelected();
    unsafePanel?.redactSelected();
    expect(unsafePanel).toMatchObject({
      sanitizations: 1,
      redactions: 1,
      renderedControlCount: 0,
      leakedPayloads: 0,
    });
    unsafeLab.app.loop.dispose();
    unsafePanel?.sanitizeSelected();
    expect(unsafePanel).toMatchObject({ sanitizations: 1, cleanupCount: 1, mounted: false });

    const capstoneLab = buildLabExample(
      'guides/capstone-workflow',
      await loadGuideDefinition('guides/capstone-workflow'),
    );
    const capstonePanel = viewsIn(capstoneLab.dialog).find(
      (view): view is CapstoneWorkflowPanel => view instanceof CapstoneWorkflowPanel,
    );
    expect(capstonePanel).toBeDefined();
    capstonePanel?.startRefresh();
    capstonePanel?.cancelWork();
    await Promise.resolve();
    await Promise.resolve();
    expect(capstonePanel).toMatchObject({
      cancellations: 1,
      staleResultsSuppressed: 1,
      pendingWork: 0,
    });
    capstoneLab.app.loop.dispose();
    capstonePanel?.openEditor();
    expect(capstonePanel).toMatchObject({ routeName: 'records', cleanupCount: 1, mounted: false });
  });

  test('should keep ambient visitor capabilities out of every risk-bearing lab module', () => {
    for (const course of [
      'async-work',
      'files-and-filesystem',
      'running-in-the-browser',
      'untrusted-text',
      'complete-application',
    ]) {
      const catalogEntry = CATALOG.entries.find((entry) => entry.id === course);
      expect(catalogEntry, course).toBeDefined();
      const evidence = (catalogEntry?.examples ?? [])
        .map((id) => {
          const registry = EXAMPLES.find((entry) => entry.id === id);
          expect(registry, `${course}: ${id}`).toBeDefined();
          return registry === undefined ? '' : localModuleEvidence(registry.sourcePath);
        })
        .join('\n');
      expect(evidence, `${course}: ambient visitor authority`).not.toMatch(
        /(?:readFileSync|writeFileSync|fetch|XMLHttpRequest|localStorage|sessionStorage|navigator\s*\.\s*clipboard|fs\s*\.\s*promises)\s*(?:\.|\()/u,
      );
    }
  });
});

describe('ST-46 production trust and VitePress build inputs', () => {
  test('should ground security, compatibility, performance, and production claims in authentic evidence', () => {
    const production = readFileSync(join(GUIDE_ROOT, 'in-production.md'), 'utf8');
    for (const link of [
      '/reference/architecture/security',
      '/reference/decisions/ADR-001-esm-zero-dependency',
      '/reference/decisions/ADR-006-informational-perf-bench',
      '/reference/decisions/ADR-009-bun-runtime-support',
    ]) {
      expect(production).toContain(`](${link})`);
    }
    expect(production).not.toContain('<PlayExample');
    expect(production).toMatch(
      /(?:browser|embedded browser)[\s\S]{0,350}(?:cannot|cannot honestly)[\s\S]{0,350}(?:TTY|supervision|deployment|signal)/iu,
    );

    const crashSafety = readFileSync(join(GUIDE_ROOT, 'crash-safety.md'), 'utf8');
    expect(crashSafety).not.toContain('<PlayExample');
    expect(crashSafety).toMatch(/(?:browser terminal)[\s\S]{0,350}cannot[\s\S]{0,300}(?:signal|restor)/iu);

    const capabilities = readFileSync(join(GUIDE_ROOT, 'terminal-capabilities.md'), 'utf8');
    expect(capabilities).toMatch(/(?:browser)[\s\S]{0,350}(?:does not|not)[\s\S]{0,250}(?:prove|evidence)/iu);

    const capstone = readFileSync(join(GUIDE_ROOT, 'complete-application.md'), 'utf8');
    expect(capstone).toMatch(
      /(?:browser|embedded browser)[\s\S]{0,350}(?:cannot|does not)[\s\S]{0,300}(?:prove|verify)[\s\S]{0,250}(?:supervision|real TTY|deployment|signal)/iu,
    );
  });

  test('should expose complete deterministic VitePress inputs and authoritative verification commands', async () => {
    expect(ROOT_MANIFEST.scripts).toMatchObject({
      'docs:build': expect.stringContaining('vp:build'),
      verify: expect.stringContaining('check:docs'),
    });
    expect(AGENTS).toContain('guide-course-template1');
    expect(AGENTS).toContain('yarn docs:build');
    expect(AGENTS).toContain('yarn verify');
    for (const entry of EXAMPLES.filter((candidate) => candidate.id.startsWith('guides/'))) {
      expect(existsSync(join(PACKAGE_ROOT, entry.sourcePath)), entry.id).toBe(true);
      await expect(entry.load(), entry.id).resolves.toHaveProperty('default.build');
    }
    for (const document of integrationDocuments()) {
      expect(document.source).not.toMatch(/This guide is being written|placeholder while the guide is authored/iu);
    }
  }, 60_000);
});

describe('ST-47 final gate declaration', () => {
  test('should reserve completion for the production docs build and authoritative repository gate', () => {
    expect(ROOT_MANIFEST.scripts?.['docs:build']).toBeDefined();
    expect(ROOT_MANIFEST.scripts?.verify).toBeDefined();
    expect(AGENTS).toMatch(/focused docs typecheck\/tests[\s\S]{0,300}yarn docs:build[\s\S]{0,300}yarn verify/iu);
  });
});
