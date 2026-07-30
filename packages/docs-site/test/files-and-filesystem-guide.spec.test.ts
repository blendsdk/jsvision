/**
 * Immutable oracle for the Files & the FileSystem seam course and its host-neutral laboratory.
 *
 * Public-control assertions prove the synchronous seam, browser-virtual storage, scan rules,
 * sanitized listing, and modal selection results before the course and laboratory are implemented.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolveCapabilities } from '@jsvision/core';
import {
  FileList,
  buildDirTree,
  isWild,
  nodeFileSystem,
  openFile,
  scanDirectory,
  wildcardMatch,
} from '@jsvision/files';
import type { FileSystem } from '@jsvision/files';
import { Button, Commands, Group, View, createEventLoop, createRoot, signal } from '@jsvision/ui';
import { createBrowserFileSystem } from '@jsvision/web';
import { describe, expect, test, vi } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/files-and-filesystem.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = existsSync(guidePath) ? readFileSync(guidePath, 'utf8') : '';
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'files-and-filesystem');
const labId = 'guides/filesystem-seams';

interface FileSystemSeamPanel extends View {
  readonly lessonName: 'Host-neutral file workflows';
  readonly scanRuns: number;
  readonly readRuns: number;
  readonly writeRuns: number;
  readonly deniedRuns: number;
  readonly failedRuns: number;
  readonly cleanupCount: number;
  readonly browserFileSystem: FileSystem;
  readonly customFileSystem: FileSystem;
}

function isFileSystem(value: unknown): value is FileSystem {
  if (typeof value !== 'object' || value === null) return false;
  for (const method of [
    'readDir',
    'stat',
    'lstat',
    'resolve',
    'isAbsolute',
    'join',
    'dirname',
    'basename',
    'homedir',
    'roots',
    'readFile',
    'writeFile',
    'rename',
    'unlink',
  ]) {
    if (!(method in value) || typeof value[method as keyof typeof value] !== 'function') return false;
  }
  return 'sep' in value && typeof value.sep === 'string';
}

function isFileSystemSeamPanel(view: View): view is FileSystemSeamPanel {
  return (
    view.constructor.name === 'FileSystemSeamPanel' &&
    'lessonName' in view &&
    view.lessonName === 'Host-neutral file workflows' &&
    'scanRuns' in view &&
    typeof view.scanRuns === 'number' &&
    'readRuns' in view &&
    typeof view.readRuns === 'number' &&
    'writeRuns' in view &&
    typeof view.writeRuns === 'number' &&
    'deniedRuns' in view &&
    typeof view.deniedRuns === 'number' &&
    'failedRuns' in view &&
    typeof view.failedRuns === 'number' &&
    'cleanupCount' in view &&
    typeof view.cleanupCount === 'number' &&
    'browserFileSystem' in view &&
    isFileSystem(view.browserFileSystem) &&
    'customFileSystem' in view &&
    isFileSystem(view.customFileSystem)
  );
}

function panelIn(dialog: View): FileSystemSeamPanel {
  const panels = viewsIn(dialog).filter(isFileSystemSeamPanel);
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  if (panel === undefined) throw new Error('Filesystem-seam laboratory is missing its teaching panel');
  return panel;
}

function snippets(): string[] {
  return [...source.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}

function registryEntry(id: string) {
  return EXAMPLES.find((candidate) => candidate.id === id);
}

async function loadDefinition(): Promise<ExampleDefinition> {
  const entry = registryEntry(labId);
  if (entry === undefined) throw new Error(`Missing example registry entry: ${labId}`);
  return (await entry.load()).default;
}

function resizeDialog(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
): void {
  const origin = absoluteOrigin(dialog);
  const from = {
    x: origin.x + dialog.bounds.width - 1,
    y: origin.y + dialog.bounds.height - 1,
  };
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'drag',
    at: from,
    to: { x: from.x + 10, y: from.y + 4 },
  });
}

function clickButton(app: ReturnType<typeof buildLabExample>['app'], dialog: View, label: string): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`Laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}

function makeHost(width: number, height: number) {
  const caps = resolveCapabilities({
    env: {},
    platform: 'linux',
    override: { colorDepth: 'truecolor' },
  }).profile;
  const root = new Group();
  const loop = createEventLoop({ width, height }, { caps });
  loop.mount(root);
  return {
    loop,
    host: {
      loop,
      desktop: {
        addWindow: (view: View) => root.add(view),
        removeWindow: (view: View) => root.remove(view),
      },
    },
  };
}

function typeText(loop: ReturnType<typeof createEventLoop>, text: string): void {
  for (const character of text) loop.dispatch(key(character));
}

describe('Files & the FileSystem seam course contract', () => {
  test('should publish the completed catalog course with exact prerequisites, outcomes, and lab', () => {
    expect(source).not.toBe('');
    expect(guide).toMatchObject({
      title: 'Files & the FileSystem seam',
      page: '/guide/files-and-filesystem',
      profile: 'course',
      stage: 'complete',
      prerequisites: ['dialogs-and-modality', 'async-work'],
      learningOutcomes: [
        'Use file and directory workflows through the host-neutral FileSystem seam.',
        'Run the same file UI against Node, browser-virtual, and application-defined file systems.',
      ],
      requiredLiveExamples: 1,
      liveExampleException: null,
      examples: [labId],
    });
  });

  test('should state the learner contract and follow a complete question-led course backbone', () => {
    const sections = [
      '## Who is this course for?',
      '## What is the FileSystem mental model?',
      '## How do I build the first host-neutral file workflow?',
      '## Laboratory: one workflow across filesystem seams',
      '## How do I choose a Node, browser, or application adapter?',
      '## How do path, scan, and wildcard rules work?',
      '## How do dialogs own selection and cancellation?',
      '## How do I read and write text safely?',
      '## Where do authorization and trust boundaries live?',
      '## How do lifecycle, failure, and retry work?',
      '## How do I diagnose filesystem failures?',
      '## What are the best practices?',
      '## What should I practice next?',
    ];
    let previous = -1;
    for (const section of sections) {
      const index = source.indexOf(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }
    expect(source).toMatch(/^description:\s*.+FileSystem.+(?:Node|browser).+(?:virtual|host-neutral|custom).+$/imu);
    expect(source).toMatch(
      /\bbuild\b[\s\S]{0,500}\bexplain\b[\s\S]{0,500}\bdiagnos(?:e|is)\b[\s\S]{0,500}\bverify\b/iu,
    );
    expect(source).toMatch(
      /(?:assume|already know|comfortable with)[\s\S]{0,450}(?:dialog|modality)[\s\S]{0,350}async work/iu,
    );
    expect(source).toMatch(/beginner[\s\S]{0,450}intermediate[\s\S]{0,450}advanced/iu);
    expect(source).toContain(`<PlayExample id="${labId}"`);
  });

  test('should teach the synchronous seam, injected ownership, and adapter equivalence', () => {
    expect(source).toMatch(/FileSystem[\s\S]{0,450}(?:14 methods|readDir)[\s\S]{0,350}\bsep\b/iu);
    expect(source).toMatch(
      /(?:synchronous|sync)[\s\S]{0,450}(?:every method|readDir|render)[\s\S]{0,300}(?:block|yield)/iu,
    );
    expect(source).toMatch(
      /(?:inject|dependency)[\s\S]{0,450}FileSystem[\s\S]{0,300}(?:same|unchanged).+(?:UI|workflow)/iu,
    );
    expect(source).toMatch(
      /nodeFileSystem[\s\S]{0,450}(?:default|Node)[\s\S]{0,300}(?:real|host).+(?:disk|filesystem)/iu,
    );
    expect(source).toMatch(
      /createBrowserFileSystem[\s\S]{0,450}(?:in-memory|virtual)[\s\S]{0,300}(?:no|never).+(?:node:fs|real disk|network)/iu,
    );
    expect(source).toMatch(
      /(?:application-defined|custom)[\s\S]{0,450}FileSystem[\s\S]{0,300}(?:policy|deny|authorize)/iu,
    );
    expect(source).toMatch(
      /(?:Node|nodeFileSystem)[\s\S]{0,600}(?:browser|createBrowserFileSystem)[\s\S]{0,600}(?:application-defined|custom)/iu,
    );
  });

  test('should teach path, directory, wildcard, hidden, ordering, and symlink semantics', () => {
    expect(source).toMatch(
      /resolve\([\s\S]{0,350}isAbsolute\([\s\S]{0,350}join\([\s\S]{0,350}dirname\([\s\S]{0,350}basename\(/iu,
    );
    expect(source).toMatch(
      /(?:normalize|lexical)[\s\S]{0,400}\.\.[\s\S]{0,350}(?:not authorization|does not authorize|policy)/iu,
    );
    expect(source).toMatch(/scanDirectory\([\s\S]{0,450}(?:wildcard|showHidden|filter)/iu);
    expect(source).toMatch(
      /(?:files first|file.+directory)[\s\S]{0,350}(?:directories|dirs)[\s\S]{0,250}\.\.[\s\S]{0,200}last/iu,
    );
    expect(source).toMatch(
      /wildcard[\s\S]{0,350}(?:files only|not directories)[\s\S]{0,300}directories.+(?:remain|always)/iu,
    );
    expect(source).toMatch(/showHidden[\s\S]{0,300}(?:false|default)[\s\S]{0,300}(?:dotfile|hidden)/iu);
    expect(source).toMatch(
      /wildcardMatch[\s\S]{0,350}(?:case-sensitive|case sensitive)[\s\S]{0,300}\*\.\*[\s\S]{0,200}\*/iu,
    );
    expect(source).toMatch(/symlink[\s\S]{0,450}(?:lstat|stat)[\s\S]{0,300}(?:broken|target|follow)/iu);
  });

  test('should teach modal open/change-directory results without confusing selection and access', () => {
    expect(source).toMatch(/openFile\([\s\S]{0,400}(?:string.+null|path.+null)[\s\S]{0,250}(?:cancel|OK)/iu);
    expect(source).toMatch(/changeDir\([\s\S]{0,400}(?:string.+null|directory.+null)[\s\S]{0,250}(?:cancel|OK)/iu);
    expect(source).toMatch(
      /openFile[\s\S]{0,500}(?:does not|doesn't)[\s\S]{0,250}(?:exist|readable)[\s\S]{0,250}(?:readFile|validate)/iu,
    );
    expect(source).toMatch(/(?:addWindow|modal)[\s\S]{0,450}(?:finally|removeWindow)[\s\S]{0,250}(?:cleanup|owner)/iu);
    expect(source).toMatch(/(?:Cancel|Escape)[\s\S]{0,350}null[\s\S]{0,250}(?:unchanged|no read|no write)/iu);
    expect(source).toMatch(
      /(?:dialog|confirmation)[\s\S]{0,450}(?:does not|cannot)[\s\S]{0,250}(?:authorize|grant).+filesystem/iu,
    );
    expect(source).toContain('](/components/files/file-dialog)');
    expect(source).toContain('](/components/files/chdir-dialog)');
  });

  test('should teach content operations, failures, authorization, and safe display boundaries', () => {
    expect(source).toMatch(/readFile\([\s\S]{0,350}(?:UTF-8|text)[\s\S]{0,300}(?:throw|missing|unreadable)/iu);
    expect(source).toMatch(/writeFile\([\s\S]{0,350}(?:create|replace)[\s\S]{0,300}(?:synchronous|throw|failure)/iu);
    expect(source).toMatch(/rename\([\s\S]{0,300}unlink\([\s\S]{0,300}(?:application|policy|confirm)/iu);
    expect(source).toMatch(
      /(?:denied|permission)[\s\S]{0,400}(?:normal|expected)[\s\S]{0,250}(?:state|result|feedback)/iu,
    );
    expect(source).toMatch(
      /(?:retry|try again)[\s\S]{0,400}(?:fresh|re-read|re-scan)[\s\S]{0,250}(?:preserve|keep).+(?:selection|content|state)/iu,
    );
    expect(source).toMatch(/sanitize\([\s\S]{0,400}(?:filename|host|untrusted)[\s\S]{0,250}(?:display|terminal)/iu);
    expect(source).toMatch(/(?:bound|truncate|limit)[\s\S]{0,350}(?:path|diagnostic|message)/iu);
    expect(source).toMatch(/(?:secret|home path|token|content)[\s\S]{0,450}(?:redact|never|do not leak)/iu);
    expect(source).toMatch(
      /(?:visitor|real)[ -](?:file|filesystem|disk)[\s\S]{0,450}(?:explicit|authorized|never|no implicit)/iu,
    );
  });

  test('should teach truthful lifecycle, accessibility, roles, reduced geometry, and boundaries', () => {
    expect(source).toMatch(
      /(?:FileSystem|adapter)[\s\S]{0,450}(?:dispose|cleanup|release)[\s\S]{0,300}(?:application-defined|owner)/iu,
    );
    expect(source).toMatch(
      /(?:stale|supersed)[\s\S]{0,450}(?:scan|selection|result)[\s\S]{0,300}(?:generation|drop|ignore)/iu,
    );
    expect(source).toMatch(/(?:focus|first file|list)[\s\S]{0,400}(?:keyboard|arrow|Enter|Tab)/iu);
    expect(source).toMatch(/(?:non-colou?r|text label)[\s\S]{0,400}(?:adapter|denied|cancelled|error)/iu);
    expect(source).toMatch(/(?:monochrome|ASCII)[\s\S]{0,350}(?:fallback|separator|tree|cue)/iu);
    expect(source).toMatch(/(?:reduced|small)[ -](?:geometry|viewport)[\s\S]{0,400}(?:wrap|clip|resize)/iu);
    for (const role of ['dialog', 'fileInfo', 'listNormal', 'listFocused', 'listSelected', 'inputNormal', 'button']) {
      expect(source).toContain(`\`${role}\``);
    }
    expect(source).toMatch(
      /(?:File Dialog|FileList|FileEditor)[\s\S]{0,500}(?:component|owns|specialist)[\s\S]{0,300}(?:link|details)/iu,
    );
  });

  test('should keep at least ten snippets public, focused, synchronous, and host-neutral', () => {
    const code = snippets();
    expect(code.length).toBeGreaterThanOrEqual(10);
    for (const snippet of code) {
      expect(snippet.split('\n').filter((line) => line.trim() !== '').length).toBeLessThanOrEqual(28);
      expect(snippet).not.toMatch(
        /(?:demoApp|Template1Dialog|defineExample|packages\/(?:files|web|ui|core)\/src|@jsvision\/files\/src)/u,
      );
      for (const imported of snippet.matchAll(/\bfrom\s+['"]([^'"]+)['"]/gu)) {
        expect(['@jsvision/core', '@jsvision/files', '@jsvision/ui', '@jsvision/web']).toContain(imported[1]);
      }
    }
    const joined = code.join('\n');
    for (const publicName of [
      'FileSystem',
      'nodeFileSystem',
      'createBrowserFileSystem',
      'scanDirectory',
      'wildcardMatch',
      'openFile',
      'changeDir',
      'readFile',
      'writeFile',
    ]) {
      expect(joined).toMatch(new RegExp(`\\b${publicName}\\b`, 'u'));
    }
    expect(code.some((snippet) => /(?:implements|satisfies)\s+FileSystem/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /if\s*\(.+===\s*null\)|if\s*\(.+!==\s*null\)/u.test(snippet))).toBe(true);
    expect(code.some((snippet) => /try[\s\S]*(?:readFile|writeFile)[\s\S]*catch/u.test(snippet))).toBe(true);
  });

  test('should diagnose distinct failures and close with practice plus owning links', () => {
    expect(source).toMatch(/symptom[\s\S]{0,300}cause[\s\S]{0,300}(?:correction|fix)[\s\S]{0,300}evidence/iu);
    for (const failure of [
      /(?:empty list|no entries)[\s\S]{0,400}(?:wildcard|hidden|permission|readDir)/iu,
      /(?:file not found|ENOENT|missing)[\s\S]{0,400}(?:selected path|readFile|parent)/iu,
      /(?:wrong|unexpected).+path[\s\S]{0,400}(?:resolve|absolute|separator)/iu,
      /(?:frozen|unresponsive)[\s\S]{0,400}(?:synchronous|large|slow).+(?:readDir|adapter)/iu,
      /(?:host|visitor).+(?:file|disk)[\s\S]{0,400}(?:nodeFileSystem|authorization|wrong adapter)/iu,
      /(?:unsafe|escape|control)[\s\S]{0,400}(?:filename|diagnostic|content)[\s\S]{0,250}sanitize/iu,
    ]) {
      expect(source).toMatch(failure);
    }
    expect(source).toMatch(/(?:exercise|experiment)[\s\S]{0,800}(?:virtual|custom|denied|wildcard|cancel)/iu);
    expect(source).toContain('](/guide/dialogs-and-modality)');
    expect(source).toContain('](/guide/async-work)');
    expect(source).toContain('](/guide/running-in-the-browser)');
    expect(source).toContain('](/api/files/interfaces/FileSystem)');
    expect(source).toContain('](/api/files/functions/openFile)');
  });
});

describe('public filesystem building blocks taught by the course', () => {
  test('should implement the complete browser-virtual seam without touching network or host disk', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const fs = createBrowserFileSystem({
        tree: { '/workspace': { 'readme.txt': 'alpha', src: { 'main.ts': 'beta' } } },
        home: '/workspace',
        mtime: new Date('2026-01-01T00:00:00.000Z'),
      });
      expect(isFileSystem(fs)).toBe(true);
      expect(fs.sep).toBe('/');
      expect(fs.homedir()).toBe('/workspace');
      expect(fs.roots()).toEqual(['/']);
      expect(fs.resolve('/workspace', '../shared')).toBe('/shared');
      expect(fs.resolve('/workspace', '../../../../etc/passwd')).toBe('/etc/passwd');
      expect(fs.join('/workspace', 'src', '..', 'readme.txt')).toBe('/workspace/readme.txt');
      expect(fs.dirname('/workspace/readme.txt')).toBe('/workspace');
      expect(fs.basename('/workspace/readme.txt')).toBe('readme.txt');
      expect(fs.isAbsolute('/workspace')).toBe(true);
      expect(fs.stat('/workspace/readme.txt').kind).toBe('file');
      expect(fs.lstat('/workspace/readme.txt')).toEqual(fs.stat('/workspace/readme.txt'));
      expect(fs.readFile('/workspace/readme.txt')).toBe('alpha');
      fs.writeFile('/workspace/new.txt', 'gamma');
      expect(fs.readFile('/workspace/new.txt')).toBe('gamma');
      fs.rename('/workspace/new.txt', '/workspace/renamed.txt');
      expect(fs.readDir('/workspace').map((entry) => entry.name)).toContain('renamed.txt');
      fs.unlink('/workspace/renamed.txt');
      expect(() => fs.readFile('/workspace/renamed.txt')).toThrow();
      expect(() => fs.readFile('/etc/passwd')).toThrow();
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('should apply source-defined wildcard, hidden, ordering, parent, and tree rules', () => {
    const fs = createBrowserFileSystem({
      tree: {
        '/workspace': {
          'b.txt': 'b',
          'A.txt': 'a',
          README: 'readme',
          '.secret.txt': 'secret',
          src: { 'main.ts': 'main' },
        },
      },
      home: '/workspace',
    });
    expect(isWild('*.txt')).toBe(true);
    expect(isWild('literal')).toBe(false);
    expect(wildcardMatch('*.txt', 'b.txt')).toBe(true);
    expect(wildcardMatch('*.TXT', 'b.txt')).toBe(false);
    expect(wildcardMatch('*.*', 'README')).toBe(true);
    expect(wildcardMatch('a?c', 'abc')).toBe(true);
    expect(wildcardMatch('a?c', 'ac')).toBe(false);

    const visible = scanDirectory(fs, '/workspace', { wildcard: '*.txt' });
    expect(visible.map((entry) => entry.name)).toEqual(['A.txt', 'b.txt', 'src', '..']);
    const hidden = scanDirectory(fs, '/workspace', {
      wildcard: '*.txt',
      showHidden: true,
      filter: (entry) => entry.name !== 'b.txt',
    });
    expect(hidden.map((entry) => entry.name)).toEqual(['.secret.txt', 'A.txt', 'src', '..']);
    const tree = buildDirTree(fs, '/workspace/src');
    expect(tree.some((node) => node.path === '/workspace/src' && node.isCurrent)).toBe(true);
    expect(tree.some((node) => node.label === 'main.ts')).toBe(false);
  });

  test('should rescan a real FileList and sanitize an untrusted filename at draw time', () => {
    const fs = createBrowserFileSystem({
      tree: {
        '/workspace': {
          '\x1b[2Jhostile.txt': 'unsafe name',
          src: { 'main.ts': 'main' },
        },
      },
      home: '/workspace',
    });
    const directory = signal('/workspace');
    const list = new FileList({ fs, directory });
    list.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 8 } });
    const caps = resolveCapabilities({
      env: {},
      platform: 'linux',
      override: { colorDepth: 'truecolor' },
    }).profile;
    const root = new Group();
    root.add(list);
    const loop = createEventLoop({ width: 40, height: 8 }, { caps });
    loop.mount(root);
    expect(list.entries().map((entry) => entry.name)).toContain('\x1b[2Jhostile.txt');
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 40; x += 1) {
        expect(loop.renderRoot.buffer().get(x, y)?.char).not.toBe('\x1b');
      }
    }
    directory.set('/workspace/src');
    expect(list.entries().map((entry) => entry.name)).toContain('main.ts');
    loop.dispose();
  });

  test('should return an injected absolute selection or null through openFile', async () => {
    const fs = createBrowserFileSystem({
      tree: { '/workspace': { 'readme.txt': 'alpha', src: {} } },
      home: '/workspace',
    });
    const { loop, host } = makeHost(60, 22);
    const open = openFile(host, { fs, directory: '/workspace', wildcard: '*.txt' });
    typeText(loop, 'readme.txt');
    loop.emitCommand(Commands.ok);
    await expect(open).resolves.toBe('/workspace/readme.txt');

    const cancelOpen = openFile(host, { fs, directory: '/workspace' });
    loop.emitCommand(Commands.cancel);
    await expect(cancelOpen).resolves.toBeNull();

    loop.dispose();
  });

  test('should confine every path-bearing operation while preserving distinct in-root failures', () => {
    const base = createBrowserFileSystem({
      tree: {
        '/workspace': { 'readme.txt': 'safe', 'move.txt': 'move', 'delete.txt': 'delete' },
        '/outside': { 'secret.txt': 'secret' },
      },
      home: '/workspace',
    });
    const authorize = (path: string): string => {
      const resolved = base.resolve(path);
      if (resolved !== '/workspace' && !resolved.startsWith('/workspace/')) {
        throw Object.assign(new Error('Access denied'), { code: 'EACCES' });
      }
      return resolved;
    };
    const custom: FileSystem = {
      ...base,
      readDir: (path) => base.readDir(authorize(path)),
      stat: (path) => base.stat(authorize(path)),
      lstat: (path) => base.lstat(authorize(path)),
      readFile: (path) => base.readFile(authorize(path)),
      writeFile: (path, text) => base.writeFile(authorize(path), text),
      rename: (from, to) => base.rename(authorize(from), authorize(to)),
      unlink: (path) => base.unlink(authorize(path)),
    };
    expect(() => custom.readDir('/workspace/../outside')).toThrow('Access denied');
    expect(() => custom.stat('/outside/secret.txt')).toThrow('Access denied');
    expect(() => custom.lstat('/outside/secret.txt')).toThrow('Access denied');
    expect(() => custom.readFile('/outside/secret.txt')).toThrow('Access denied');
    expect(() => custom.writeFile('/outside/new.txt', 'unsafe')).toThrow('Access denied');
    expect(() => custom.rename('/workspace/move.txt', '/outside/move.txt')).toThrow('Access denied');
    expect(() => custom.rename('/outside/secret.txt', '/workspace/secret.txt')).toThrow('Access denied');
    expect(() => custom.unlink('/outside/secret.txt')).toThrow('Access denied');
    expect(() => custom.readFile('/workspace/missing.txt')).toThrow(/ENOENT/iu);
    expect(base.readFile('/workspace/readme.txt')).toBe('safe');
    custom.writeFile('/workspace/readme.txt', 'changed');
    expect(custom.readFile('/workspace/readme.txt')).toBe('changed');
    expect(nodeFileSystem.sep.length).toBeGreaterThan(0);
    expect(nodeFileSystem.resolve('.')).toBeTruthy();
  });
});

describe('Host-neutral filesystem laboratory contract', () => {
  test('should register one application with an objective-specific title and blurb', async () => {
    expect(registryEntry(labId)).toMatchObject({
      kind: 'app',
      sourcePath: 'examples/guides/filesystem-seams.ts',
    });
    const definition = await loadDefinition();
    expect(definition.title).toMatch(/FileSystem Seams (?:Laboratory|Workshop)/iu);
    expect(definition.blurb).toMatch(
      /(?:same|one) workflow[\s\S]*(?:browser|virtual)[\s\S]*(?:application-defined|custom)[\s\S]*(?:denial|authorization)/iu,
    );
  });

  test('should open in a compact centered Classic shell at 80x24', async () => {
    const definition = await loadDefinition();
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition);
      const evidence = collectTemplate1Evidence(app, dialog);
      expect(evidence.viewport).toEqual({ width: 80, height: 24 });
      expect(evidence.dialogRect.width).toBeLessThan(evidence.viewport.width);
      expect(evidence.dialogRect.height).toBeLessThan(evidence.viewport.height - 2);
      expect(dialog.closable).toBe(false);
      expect(dialog.background).toBeUndefined();
      expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Enter|mouse|click)/iu);
      app.loop.dispose();
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });

  test('should stay padded and unclipped through resize, maximize, and restore', async () => {
    const definition = await loadDefinition();
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition, {
        viewport: { width: 120, height: 40 },
      });
      const authored = { ...dialog.bounds };
      resizeDialog(app, dialog);
      expect(dialog.bounds.width).toBeGreaterThan(authored.width);
      expect(dialog.bounds.height).toBeGreaterThan(authored.height);
      const resized = { ...dialog.bounds };
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      collectTemplate1Evidence(app, dialog, { startup: 'maximized' });
      dialog.zoom();
      app.loop.renderRoot.flush();
      app.loop.renderRoot.flush();
      expect(dialog.bounds).toEqual(resized);
      collectTemplate1Evidence(app, dialog, { startup: 'resized' });
      app.loop.dispose();
      dispose();
    });
  });

  test('should run scan, read, write, denial, missing, and custom-adapter paths', async () => {
    const definition = await loadDefinition();
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition);
      const panel = panelIn(dialog);
      expect(panel.browserFileSystem).not.toBe(panel.customFileSystem);
      expect(frameText(app)).toMatch(
        /Adapter:\s*browser virtual[\s\S]*(?:No visitor files|in-memory)[\s\S]*Status:\s*idle/iu,
      );

      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.scanRuns).toBe(1);
      expect(frameText(app)).toMatch(/Scan:\s*\*\.txt[\s\S]*(?:readme\.txt|notes\.txt)[\s\S]*(?:src\/|directory)/iu);
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.readRuns).toBe(1);
      expect(frameText(app)).toMatch(/Read:\s*(?:readme\.txt|notes\.txt)[\s\S]*Content:\s*(?:hello|alpha|safe)/iu);
      app.loop.dispatch(key('w', { alt: true }));
      expect(panel.writeRuns).toBe(1);
      expect(frameText(app)).toMatch(/Write:\s*success[\s\S]*(?:updated|saved)/iu);

      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toMatch(/Adapter:\s*application-defined/iu);
      app.loop.dispatch(key('s', { alt: true }));
      expect(panel.scanRuns).toBe(2);
      app.loop.dispatch(key('d', { alt: true }));
      app.loop.dispatch(key('r', { alt: true }));
      expect(panel.deniedRuns).toBe(1);
      expect(frameText(app)).toMatch(/Status:\s*denied[\s\S]*(?:bounded|redacted|safe).+diagnostic/iu);
      app.loop.dispatch(key('m', { alt: true }));
      expect(panel.failedRuns).toBe(1);
      expect(frameText(app)).toMatch(/Status:\s*missing[\s\S]*(?:bounded|redacted|safe).+diagnostic/iu);

      clickButton(app, dialog, 'Scan');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/iu);
      app.loop.dispose();
      dispose();
    });
  });

  test('should use bounded virtual/custom seams, keyboard and mouse routes, and exact cleanup', async () => {
    const definition = await loadDefinition();
    let panel: FileSystemSeamPanel | undefined;
    let mounted: View[] = [];
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition);
      panel = panelIn(dialog);
      mounted = viewsIn(dialog);
      const text = frameText(app);
      expect(text).toMatch(/Alt\+[A-Z]/u);
      expect(text).toMatch(/(?:Adapter|Scan|Read|Write|Selection|Status|Action):/iu);
      expect(text).toMatch(/(?:browser virtual|application-defined|in-memory|No network|No visitor files)/iu);
      expect(text).toMatch(/(?:Node|nodeFileSystem)[\s\S]*(?:not run|native|authorized)/iu);
      expect(text).toMatch(/(?:ASCII|monochrome|text status|non-colou?r)/iu);
      const buttons = mounted.filter((view): view is Button => view instanceof Button);
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => button.focusable)).toBe(true);
      app.loop.dispose();
      dispose();
    });
    expect(panel?.cleanupCount).toBe(1);
    expect(mounted.every((view) => !view.mounted && view.scope === null)).toBe(true);
  });
});
