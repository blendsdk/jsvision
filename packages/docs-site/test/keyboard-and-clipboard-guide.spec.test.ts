/** Immutable oracle for the completed Keyboard & clipboard course and its laboratory. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { boundPasteText, createKeymap, createLogger, setClipboard as encodeOscClipboard } from '@jsvision/core';
import {
  Button,
  Group,
  View,
  buildKeymap,
  createEventLoop,
  createRoot,
  type DispatchEvent,
  type DrawContext,
} from '@jsvision/ui';
import { setClipboard as setBrowserClipboard } from '@jsvision/web';
import { describe, expect, test } from 'vitest';
import type { ExampleDefinition } from '../examples/_contract.js';
import { EXAMPLES } from '../examples/index.js';
import { parseGuideCatalog } from '../src/guides/guide-catalog.mjs';
import {
  EXAMPLE_CAPS,
  absoluteOrigin,
  buildLabExample,
  collectTemplate1Evidence,
  dispatchExampleAction,
  frameText,
  key,
  viewsIn,
} from './example-lab-harness.js';

const guidePath = fileURLToPath(new URL('../guide/keyboard-and-clipboard.md', import.meta.url));
const catalogPath = fileURLToPath(new URL('../guides.json', import.meta.url));
const source = readFileSync(guidePath, 'utf8');
const catalog = parseGuideCatalog(readFileSync(catalogPath, 'utf8'));
const guide = catalog.entries.find((candidate) => candidate.id === 'keyboard-and-clipboard');
const labId = 'guides/clipboard-boundary';
function snippets(markdown: string): string[] {
  return [...markdown.matchAll(/```(?:ts|typescript)\n([\s\S]*?)```/g)].map((match) => match[1] ?? '');
}
function registryEntry() {
  return EXAMPLES.find((candidate) => candidate.id === labId);
}
async function loadDefinition(): Promise<ExampleDefinition> {
  const entry = registryEntry();
  if (entry === undefined) throw new Error(`Missing example registry entry: ${labId}`);
  return (await entry.load()).default;
}
function expectCourseText(pattern: RegExp, purpose: string): void {
  expect(source, purpose).toMatch(pattern);
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
    to: { x: from.x + 8, y: from.y + 3 },
  });
}
function clickButton(
  app: ReturnType<typeof buildLabExample>['app'],
  dialog: ReturnType<typeof buildLabExample>['dialog'],
  label: string,
): void {
  const button = viewsIn(dialog).find(
    (view): view is Button => view instanceof Button && view.activation.label === label,
  );
  if (button === undefined) throw new Error(`Clipboard laboratory is missing "${label}"`);
  const origin = absoluteOrigin(button);
  dispatchExampleAction(app, {
    kind: 'mouse',
    gesture: 'click',
    at: { x: origin.x + 1, y: origin.y },
  });
}
async function drainAsyncClipboard(): Promise<void> {
  for (let turn = 0; turn < 6; turn += 1) await Promise.resolve();
}
/** A focusable public View that exposes canonical copy and paste behavior for control tests. */
class ClipboardProbe extends View {
  readonly pastes: Array<{ text: string; truncated: boolean }> = [];
  copyText = 'local canonical';
  constructor() {
    super();
    this.focusable = true;
  }
  draw(_ctx: DrawContext): void {}
  override onEvent(event: DispatchEvent): void {
    if (event.event.type === 'command' && event.event.command === 'copy') {
      event.setClipboard?.(this.copyText);
      event.handled = true;
      return;
    }
    if (event.event.type === 'command' && event.event.command === 'paste') {
      this.pastes.push({ text: event.readClipboard?.() ?? '', truncated: false });
      event.handled = true;
      return;
    }
    if (event.event.type === 'paste') {
      this.pastes.push({
        text: event.event.text,
        truncated: event.event.truncated,
      });
      event.handled = true;
    }
  }
}

describe('Keyboard & clipboard guide course contract', () => {
  test('keeps the confirmed course profile, prerequisite, outcomes, and one-lab target', () => {
    expect(guide).toBeDefined();
    expect(guide?.profile).toBe('course');
    expect(['upgrade', 'complete']).toContain(guide?.stage);
    expect(guide?.prerequisites).toEqual(['events-commands-and-keymaps']);
    expect(guide?.learningOutcomes).toEqual([
      'Use the default editing and selection chords consistently.',
      'Choose native, browser, or custom clipboard adapters and explain their authorization boundaries.',
    ]);
    expect(guide?.requiredLiveExamples).toBe(1);
    expect(guide?.liveExampleException).toBeNull();
    expect(guide?.examples).toEqual([labId]);
  });
  test('states audience, assumed knowledge, motivating problem, and observable capabilities', () => {
    expectCourseText(/^description:\s*.+(?:selection|clipboard).+$/m, 'search-friendly frontmatter');
    expectCourseText(/^# Keyboard (?:and|&) clipboard$/m, 'course title');
    expectCourseText(/^## (?:Who this course is for|Course introduction)$/m, 'course introduction');
    expectCourseText(/\/guide\/events-commands-and-keymaps/i, 'Events, commands and keymaps prerequisite');
    expectCourseText(
      /(?:assume|already know|comfortable with)[\s\S]{0,500}(?:command|keymap|event route)/i,
      'assumed knowledge',
    );
    expectCourseText(
      /(?:editor|form|application)[\s\S]{0,500}(?:browser|terminal|host)[\s\S]{0,350}clipboard/i,
      'motivating cross-host problem',
    );
    expectCourseText(
      /\buse\b[\s\S]{0,300}\bchoose\b[\s\S]{0,350}\bexplain\b[\s\S]{0,350}\bdiagnos/i,
      'use, choose, explain, and diagnose capabilities',
    );
    expectCourseText(/\bverif(?:y|ication)\b/i, 'verification capability');
  });
  test('uses the full beginner-to-production course backbone in dependency order', () => {
    const sections = [
      /^## Mental model$/m,
      /^## (?:Your )?first useful result$/m,
      /^## Default selection and clipboard chords$/m,
      /^## The canonical clipboard pipeline$/m,
      /^## Choose a host boundary$/m,
      /^## Composition and integration$/m,
      /^## Advanced behavior$/m,
      /^## Failure modes and diagnosis$/m,
      /^## Best practices$/m,
      /^## Practice and next steps$/m,
    ];

    let previous = -1;
    for (const section of sections) {
      const index = source.search(section);
      expect(index, `missing or misplaced ${section}`).toBeGreaterThan(previous);
      previous = index;
    }

    const primaryLab = source.indexOf(`<PlayExample id="${labId}"`);
    expect(primaryLab).toBeGreaterThan(source.search(sections[2]!));
    expect(primaryLab).toBeLessThan(source.search(sections[4]!));
  });
  test('teaches modern, classic, selection, host-owned, and conflicting chords accurately', () => {
    for (const chord of ['Ctrl+A', 'Ctrl+C', 'Ctrl+Shift+C', 'Ctrl+X', 'Ctrl+V']) {
      expect(source).toContain(chord);
    }
    expectCourseText(/Ctrl\+A[\s\S]{0,180}select all/i, 'modern select-all');
    expectCourseText(/Ctrl\+C[\s\S]{0,180}copy/i, 'modern copy');
    expectCourseText(/Ctrl\+X[\s\S]{0,180}cut/i, 'modern cut');
    expectCourseText(/Ctrl\+V[\s\S]{0,180}paste/i, 'modern paste');
    expectCourseText(/Ctrl\+(?:Ins|Insert)[\s\S]{0,180}copy/i, 'classic copy');
    expectCourseText(/Shift\+(?:Ins|Insert)[\s\S]{0,180}paste/i, 'classic paste');
    expectCourseText(/Shift\+(?:Del|Delete)[\s\S]{0,180}cut/i, 'classic cut');
    expectCourseText(/Shift\+(?:arrow|Left|Right|Home|End)[\s\S]{0,300}(?:extend|selection)/i, 'keyboard selection');
    expectCourseText(/mouse drag[\s\S]{0,250}(?:extend|selection)/i, 'mouse selection');
    expectCourseText(
      /(?:host|terminal)[\s\S]{0,300}Ctrl\+Shift\+(?:C|V)[\s\S]{0,400}(?:reserve|own|gesture)/i,
      'host-owned shifted chords',
    );
    expectCourseText(
      /(?:application|user|app) keymap[\s\S]{0,400}(?:win|override|precedence)[\s\S]{0,300}(?:clipboard|default)/i,
      'application conflict precedence',
    );
    expectCourseText(
      /clipboardKeys[\s\S]{0,350}(?:modern|classic|both|none)[\s\S]{0,250}(?:default|both)/i,
      'binding-set choice',
    );
  });
  test('establishes one canonical app-local value and canonical-first copy semantics', () => {
    expectCourseText(
      /canonical[\s\S]{0,300}app-local[\s\S]{0,450}(?:single|one|source of truth)/i,
      'canonical ownership',
    );
    expectCourseText(
      /(?:copy|cut)[\s\S]{0,450}(?:commit|update)[\s\S]{0,250}canonical[\s\S]{0,350}(?:before|then)[\s\S]{0,250}host/i,
      'canonical-first write',
    );
    expectCourseText(
      /host[\s\S]{0,250}(?:fail|denied|unavailable)[\s\S]{0,450}(?:never|does not)[\s\S]{0,250}(?:roll back|break)[\s\S]{0,200}(?:local|canonical)/i,
      'host failure isolation',
    );
    expectCourseText(
      /(?:paste event|external paste)[\s\S]{0,350}(?:adopt|update|becomes)[\s\S]{0,300}canonical/i,
      'external paste adoption',
    );
    expectCourseText(/exact[\s\S]{0,250}(?:Unicode|line endings|raw text)/i, 'exact canonical text');
  });
  test('draws correct native terminal, browser, OSC 52, and custom adapter boundaries', () => {
    expectCourseText(
      /Application\.run\(\)[\s\S]{0,400}(?:system|native|operating-system)[\s\S]{0,250}(?:default|lazy)/i,
      'automatic native adapter',
    );
    expectCourseText(/systemClipboard:\s*false[\s\S]{0,300}(?:opt out|disable|app-local)/i, 'native opt-out');
    expectCourseText(
      /browser[\s\S]{0,350}outbound-only[\s\S]{0,400}(?:never reads|no native reader|writeText)/i,
      'outbound-only browser',
    );
    expectCourseText(
      /browser[\s\S]{0,400}(?:user gesture|focus|secure context|permission)[\s\S]{0,350}(?:deny|reject|unavailable)/i,
      'browser authorization',
    );
    expectCourseText(
      /OSC 52[\s\S]{0,400}capability[\s-]?gated[\s\S]{0,350}(?:write|outbound)[\s\S]{0,250}(?:no|not)[\s\S]{0,150}read/i,
      'OSC 52 boundary',
    );
    expectCourseText(
      /readClipboardText[\s\S]{0,250}writeClipboardText[\s\S]{0,450}(?:custom|adapter|callback)/i,
      'custom adapter seams',
    );
    expectCourseText(
      /custom adapter[\s\S]{0,450}(?:host|application)[\s\S]{0,250}(?:authorize|policy|permission)/i,
      'custom authorization owner',
    );
  });
  test('separates direct bracketed paste from native reads and preserves truncation evidence', () => {
    expectCourseText(
      /bracketed paste[\s\S]{0,450}(?:direct|decoded)[\s\S]{0,300}(?:never|does not)[\s\S]{0,180}(?:reader|readClipboardText)/i,
      'bracketed-paste route',
    );
    expectCourseText(
      /bracketed paste[\s\S]{0,500}truncat(?:ed|ion)[\s\S]{0,300}(?:retain|preserve|metadata)/i,
      'decoder truncation metadata',
    );
    expectCourseText(
      /1 MiB[\s\S]{0,450}(?:UTF-8|byte)[\s\S]{0,350}(?:code point|split)[\s\S]{0,250}truncat/i,
      'bounded native text',
    );
    expectCourseText(/(?:untrusted|sanitize|control)[\s\S]{0,500}(?:paste|display text)/i, 'untrusted paste boundary');
  });
  test('teaches explicit authorization states without normalizing implicit visitor access', () => {
    expectCourseText(
      /(?:authorized|allowed)[\s\S]{0,250}(?:denied|rejected)[\s\S]{0,250}unavailable/i,
      'three host states',
    );
    expectCourseText(
      /(?:visitor|browser)[\s\S]{0,400}clipboard[\s\S]{0,350}(?:never|must not|no implicit)/i,
      'no implicit visitor clipboard',
    );
    expectCourseText(
      /(?:denied|unavailable)[\s\S]{0,400}(?:canonical|app-local)[\s\S]{0,300}(?:fallback|continues|usable)/i,
      'denial fallback',
    );
    expectCourseText(
      /(?:authorize|permission)[\s\S]{0,450}(?:before|prior to)[\s\S]{0,250}(?:read|write|adapter)/i,
      'authorization before effect',
    );
  });
  test('covers async ordering, stale results, focus, modal, lifecycle, and cleanup', () => {
    expectCourseText(
      /(?:one at a time|serial|FIFO)[\s\S]{0,350}(?:gesture|read)[\s\S]{0,250}order/i,
      'native read ordering',
    );
    expectCourseText(
      /(?:does not await|non-blocking|does not block)[\s\S]{0,350}(?:input|render)/i,
      'non-blocking dispatch',
    );
    expectCourseText(
      /(?:stale|discard)[\s\S]{0,450}(?:focus|modal)[\s\S]{0,350}(?:unmount|remount|dispose|stop)/i,
      'stale-result guards',
    );
    expectCourseText(
      /(?:acquire|configure|install)[\s\S]{0,500}(?:dispose|cleanup|stop|remove)/i,
      'acquisition and cleanup',
    );
    expectCourseText(
      /(?:hung|pending)[\s\S]{0,350}(?:operation|adapter)[\s\S]{0,350}(?:later|queue|order)/i,
      'hung adapter consequence',
    );
  });
  test('requires bounded, payload-free, redacted diagnostics and safe fallback behavior', () => {
    expectCourseText(/(?:payload-free|content-free)[\s\S]{0,300}(?:warn|diagnostic)/i, 'payload-free warning');
    expectCourseText(
      /(?:clipboard payload|clipboard text|host error detail)[\s\S]{0,350}(?:never|must not|redact)[\s\S]{0,200}(?:log|diagnostic)/i,
      'diagnostic redaction',
    );
    expectCourseText(/read fail[\s\S]{0,450}(?:canonical|app-local)[\s\S]{0,250}fallback/i, 'read failure fallback');
    expectCourseText(/empty read[\s\S]{0,350}(?:clear|empty)[\s\S]{0,300}(?:no-op|editing)/i, 'empty read behavior');
  });
  test('uses accurate concept-sized snippets from supported public entry points', () => {
    const code = snippets(source);
    const combined = code.join('\n');
    const imports = [...combined.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);

    expect(code.length).toBeGreaterThanOrEqual(7);
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.every((path) => ['@jsvision/core', '@jsvision/ui', '@jsvision/web'].includes(path))).toBe(true);
    expect(combined).not.toMatch(/packages\/(?:core|ui|web)\/src|@jsvision\/ui\/src|\.\.\/src\//);
    expect(code.some((snippet) => /clipboardKeys/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /systemClipboard:\s*false/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /writeClipboardText/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /readClipboardText/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /setClipboard/.test(snippet))).toBe(true);
    expect(code.some((snippet) => /onCleanup|\.dispose\(/.test(snippet))).toBe(true);
  });
  test('places the focused lab beside its objective and does not reuse the generic editor demo', () => {
    expect(source).toContain(`<PlayExample id="${labId}"`);
    expect(source).not.toContain('<PlayExample id="apps/editor"');
    expectCourseText(
      /clipboard-boundary[\s\S]{0,600}(?:authorized|success)[\s\S]{0,250}(?:denied|denial)[\s\S]{0,250}(?:unavailable|fallback)/i,
      'lab authorization objective',
    );
    expectCourseText(
      /clipboard-boundary[\s\S]{0,900}(?:virtual|deterministic)[\s\S]{0,300}(?:host|adapter)/i,
      'virtual host framing',
    );
  });
  test('includes diagnosis, best practices, practice, and ownership-aware related links', () => {
    expectCourseText(
      /symptom[\s\S]{0,250}cause[\s\S]{0,250}(?:correction|fix)[\s\S]{0,250}evidence/i,
      'diagnosis table',
    );
    expectCourseText(
      /(?:copy|paste)[\s\S]{0,500}(?:denied|unavailable)[\s\S]{0,300}(?:canonical|fallback)/i,
      'host denial diagnosis',
    );
    expectCourseText(
      /paste[\s\S]{0,450}(?:wrong field|old focus|stale)[\s\S]{0,350}(?:discard|focus)/i,
      'stale paste diagnosis',
    );
    expectCourseText(/(?:truncated|1 MiB)[\s\S]{0,400}(?:indicator|metadata|evidence)/i, 'truncation diagnosis');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:modern|classic|selection)/i, 'chord practice');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:denied|unavailable|adapter)/i, 'authorization practice');
    expectCourseText(/(?:exercise|experiment)[\s\S]{0,900}(?:stale|focus|pending)/i, 'async practice');

    for (const link of [
      '/guide/events-commands-and-keymaps',
      '/guide/running-in-the-browser',
      '/components/controls/input',
      '/components/code-editor/editing-navigation-clipboard',
      '/api/ui/interfaces/EventLoop',
    ]) {
      expect(source).toContain(link);
    }
  });
});

describe('public keyboard and clipboard behavior taught by the course', () => {
  test('builds exact modern, classic, combined, and application-precedence keymaps', () => {
    const modern = buildKeymap('modern');
    expect(modern?.lookup(key('a', { ctrl: true }))).toBe('selectAll');
    expect(modern?.lookup(key('c', { ctrl: true }))).toBe('copy');
    expect(modern?.lookup(key('c', { ctrl: true, shift: true }))).toBe('copy');
    expect(modern?.lookup(key('x', { ctrl: true }))).toBe('cut');
    expect(modern?.lookup(key('v', { ctrl: true }))).toBe('paste');
    expect(modern?.lookup(key('insert', { ctrl: true }))).toBeUndefined();

    const classic = buildKeymap('classic');
    expect(classic?.lookup(key('insert', { ctrl: true }))).toBe('copy');
    expect(classic?.lookup(key('insert', { shift: true }))).toBe('paste');
    expect(classic?.lookup(key('delete', { shift: true }))).toBe('cut');
    expect(classic?.lookup(key('c', { ctrl: true }))).toBeUndefined();

    const both = buildKeymap('both', createKeymap({ 'ctrl+c': 'inspect' }));
    expect(both?.lookup(key('c', { ctrl: true }))).toBe('inspect');
    expect(both?.lookup(key('x', { ctrl: true }))).toBe('cut');
    expect(buildKeymap('none')).toBeUndefined();
  });
  test('commits app-local copy before an unavailable writer and keeps diagnostics payload-free', async () => {
    const payload = 'private local value';
    const logger = createLogger({ sink: 'ring', size: 8 });
    const hostWrites: string[] = [];
    const probe = new ClipboardProbe();
    probe.copyText = payload;
    const root = new Group();
    root.add(probe);
    const loop = createEventLoop(
      { width: 40, height: 8 },
      {
        caps: EXAMPLE_CAPS,
        logger,
        writeClipboardText: async (text) => {
          hostWrites.push(text);
          throw new Error(`denied ${text}`);
        },
      },
    );
    loop.mount(root);
    loop.focusView(probe);

    loop.emitCommand('copy');
    await drainAsyncClipboard();
    loop.emitCommand('paste');

    expect(hostWrites).toEqual([payload]);
    expect(probe.pastes.at(-1)).toEqual({ text: payload, truncated: false });
    const diagnostics = JSON.stringify(logger.entries());
    expect(diagnostics).toContain('host clipboard write failed');
    expect(diagnostics).not.toContain(payload);
    expect(diagnostics).not.toContain('denied');
    loop.dispose();
    logger.close();
  });
  test('adopts direct bracketed paste without invoking a native reader and preserves truncation', async () => {
    let reads = 0;
    const probe = new ClipboardProbe();
    const root = new Group();
    root.add(probe);
    const loop = createEventLoop(
      { width: 40, height: 8 },
      {
        caps: EXAMPLE_CAPS,
        readClipboardText: () => {
          reads += 1;
          return 'native';
        },
      },
    );
    loop.mount(root);
    loop.focusView(probe);

    loop.dispatch({ type: 'paste', text: 'bracketed', truncated: true });
    expect(reads).toBe(0);
    expect(probe.pastes).toContainEqual({ text: 'bracketed', truncated: true });

    loop.emitCommand('paste');
    await drainAsyncClipboard();
    expect(reads).toBe(1);
    expect(probe.pastes).toContainEqual({ text: 'native', truncated: false });
    loop.dispose();
  });
  test('bounds untrusted host text to a complete UTF-8 code-point prefix', () => {
    expect(boundPasteText('A😀B', 5)).toEqual({ text: 'A😀', truncated: true });

    const result = boundPasteText(`${'x'.repeat(1_048_576)}😀`);
    expect(result.truncated).toBe(true);
    expect(new TextEncoder().encode(result.text).byteLength).toBeLessThanOrEqual(1_048_576);
    expect(result.text.endsWith('\ud83d')).toBe(false);
  });
  test('keeps browser clipboard access outbound-only and graceful when unavailable', async () => {
    const calls: string[] = [];
    let reads = 0;
    const bridge = {
      writeText: async (text: string) => {
        calls.push(text);
      },
      readText: async () => {
        reads += 1;
        return 'visitor-owned';
      },
    };

    await setBrowserClipboard('copied', EXAMPLE_CAPS, bridge);
    await expect(setBrowserClipboard('ignored', EXAMPLE_CAPS, undefined)).resolves.toBeUndefined();
    expect(calls).toEqual(['copied']);
    expect(reads).toBe(0);
  });
  test('gates OSC 52 output by capability and encodes payload bytes safely', () => {
    const unsupported = {
      ...EXAMPLE_CAPS,
      osc: { ...EXAMPLE_CAPS.osc, clipboard52: false },
    };
    const supported = {
      ...EXAMPLE_CAPS,
      osc: { ...EXAMPLE_CAPS.osc, clipboard52: true },
    };

    expect(encodeOscClipboard('copied', unsupported)).toBe('');
    const sequence = encodeOscClipboard('copied\n安全', supported);
    expect(sequence).toContain(']52;c;');
    expect(sequence).not.toContain('copied');
    expect(sequence).not.toContain('安全');
  });
  test('discards an asynchronous native result after focus changes', async () => {
    let resolveRead: ((text: string) => void) | undefined;
    const reader = new Promise<string>((resolve) => {
      resolveRead = resolve;
    });
    const first = new ClipboardProbe();
    const second = new ClipboardProbe();
    const group = new Group();
    group.add(first);
    group.add(second);
    const loop = createEventLoop({ width: 40, height: 8 }, { caps: EXAMPLE_CAPS, readClipboardText: () => reader });
    loop.mount(group);
    loop.focusView(first);

    loop.emitCommand('paste');
    await drainAsyncClipboard();
    loop.focusView(second);
    resolveRead?.('stale host text');
    await drainAsyncClipboard();

    expect(first.pastes).toEqual([]);
    expect(second.pastes).toEqual([]);
    loop.dispose();
  });
});

describe('Clipboard boundary laboratory contract', () => {
  test('registers the catalog-declared Guide laboratory as an application', () => {
    expect(registryEntry()).toMatchObject({
      id: labId,
      kind: 'app',
      sourcePath: 'examples/guides/clipboard-boundary.ts',
    });
  });
  test('opens in a compact centered padded Classic template1 shell at 80x24', async () => {
    const definition = await loadDefinition();
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition);
      const evidence = collectTemplate1Evidence(app, dialog);
      const desktop = app.desktop;
      if (desktop === undefined) throw new Error('template1 requires a desktop');

      expect(evidence.viewport).toEqual({ width: 80, height: 24 });
      expect(dialog.closable).toBe(false);
      expect(dialog.background).toBeUndefined();
      expect(dialog.centered).toBe(true);
      expect(dialog.bounds.x).toBeGreaterThan(0);
      expect(dialog.bounds.y).toBeGreaterThan(0);
      expect(dialog.bounds.x + dialog.bounds.width).toBeLessThan(desktop.bounds.width);
      expect(dialog.bounds.y + dialog.bounds.height).toBeLessThan(desktop.bounds.height);
      expect(evidence.dialogInterior.join('\n')).toMatch(/(?:Alt|Ctrl|Enter|mouse|click)/i);

      app.loop.dispose();
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });
  test('stays padded and unclipped through resize, maximize, and restore', async () => {
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
      expect(dialog.mounted).toBe(false);
      dispose();
    });
  });
  test('uses only a deterministic virtual host and shows unavailable, denied, and authorized copy', async () => {
    const definition = await loadDefinition();
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition);
      expect(frameText(app)).toMatch(/Host seam:\s*virtual/i);
      expect(frameText(app)).toMatch(/Visitor clipboard:\s*never requested/i);
      expect(frameText(app)).toMatch(/Authorization:\s*unavailable/i);

      app.loop.dispatch(key('c', { alt: true }));
      expect(frameText(app)).toMatch(/Copy:\s*local success[\s\S]{0,100}host unavailable/i);

      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toMatch(/Authorization:\s*denied/i);
      app.loop.dispatch(key('c', { alt: true }));
      expect(frameText(app)).toMatch(/Copy:\s*local success[\s\S]{0,100}host denied/i);

      app.loop.dispatch(key('a', { alt: true }));
      expect(frameText(app)).toMatch(/Authorization:\s*authorized/i);
      app.loop.dispatch(key('c', { alt: true }));
      expect(frameText(app)).toMatch(/Host write:\s*success/i);

      clickButton(app, dialog, 'Copy sample');
      expect(frameText(app)).toMatch(/Action source:\s*mouse/i);
      app.loop.dispose();
      dispose();
    });
  });
  test('shows canonical fallback and stale async results without leaking clipboard content', async () => {
    const definition = await loadDefinition();
    createRoot((dispose) => {
      const { app } = buildLabExample(labId, definition);
      app.loop.dispatch(key('f', { alt: true }));
      app.loop.dispatch(key('v', { alt: true }));
      expect(frameText(app)).toMatch(/Paste:\s*canonical fallback/i);
      expect(frameText(app)).toMatch(/Diagnostic:\s*host clipboard read failed/i);
      expect(frameText(app)).not.toMatch(/HOST-SECRET-42|visitor-owned text/i);

      app.loop.dispatch(key('p', { alt: true }));
      expect(frameText(app)).toMatch(/Native read:\s*pending/i);
      app.loop.dispatch(key('n', { alt: true }));
      app.loop.dispatch(key('r', { alt: true }));
      expect(frameText(app)).toMatch(/Paste:\s*stale result discarded/i);
      expect(frameText(app)).toMatch(/Reason:\s*focus changed/i);
      app.loop.dispose();
      dispose();
    });
  });
  test('keeps keyboard, mouse, non-colour, and ASCII-safe evidence visible and cleans up', async () => {
    const definition = await loadDefinition();
    let mountedViews: View[] = [];
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(labId, definition);
      mountedViews = viewsIn(dialog);
      const text = frameText(app);
      expect(text).toMatch(/Alt\+[ACFV]/);
      expect(text).toMatch(/(?:Authorization|Copy|Paste|Diagnostic):/i);
      expect(text).toMatch(/(?:yes|no|success|denied|unavailable|fallback)/i);
      expect(text).toContain('>');
      expect(viewsIn(dialog).some((view) => view.focusable)).toBe(true);
      app.loop.dispose();
      dispose();
    });
    expect(mountedViews.length).toBeGreaterThan(0);
    expect(mountedViews.every((view) => !view.mounted && view.scope === null)).toBe(true);
  });
});
