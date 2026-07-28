/**
 * Specification oracle for consumer and agent documentation of native clipboard integration.
 *
 * These checks intentionally look for durable concepts rather than exact paragraphs. Documentation
 * authors may reorganize or reword the material, but consumers must still be able to discover the
 * complete configuration, safety, degradation, and host-ownership contract.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');

/** Read a UTF-8 repository file relative to the monorepo root. */
function repositoryFile(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

/** One semantic requirement and the wording variants that can demonstrate it. */
interface DocumentationConcept {
  readonly label: string;
  readonly pattern: RegExp;
}

/** Report every absent concept so one RED run exposes the complete documentation gap. */
function missingConcepts(text: string, concepts: readonly DocumentationConcept[]): string[] {
  return concepts.filter(({ pattern }) => !pattern.test(text)).map(({ label }) => label);
}

/** Assert a document covers each required concept without pinning its layout or exact prose. */
function expectConcepts(documentName: string, text: string, concepts: readonly DocumentationConcept[]): void {
  expect(missingConcepts(text, concepts), `${documentName} is missing required clipboard concepts`).toEqual([]);
}

const consumerGuide = repositoryFile('packages/docs-site/guide/keyboard-and-clipboard.md');
const canonicalArchitecture = repositoryFile('tools/jsvision-skill/references/architecture.md');
const canonicalGotchas = repositoryFile('tools/jsvision-skill/references/gotchas.md');
const canonicalApi = repositoryFile('tools/jsvision-skill/references/api/app-shell.md');
const generatedArchitecture = repositoryFile('plugins/jsvision-plugin/skills/jsvision/references/architecture.md');
const generatedGotchas = repositoryFile('plugins/jsvision-plugin/skills/jsvision/references/gotchas.md');
const generatedApi = repositoryFile('plugins/jsvision-plugin/skills/jsvision/references/api/app-shell.md');

const configurationConcepts: readonly DocumentationConcept[] = [
  { label: 'automatic system clipboard default', pattern: /Application\.run\(\)[\s\S]{0,180}(?:default|automatic)/i },
  { label: 'system clipboard opt-out', pattern: /\bsystemClipboard\s*:\s*false\b/ },
  { label: 'readClipboardText callback', pattern: /\breadClipboardText\b/ },
  { label: 'writeClipboardText callback', pattern: /\bwriteClipboardText\b/ },
  { label: 'application configuration example', pattern: /createApplication\s*\(\s*\{[\s\S]*readClipboardText/ },
  { label: 'direct event-loop configuration', pattern: /createEventLoop[\s\S]*readClipboardText/ },
  {
    label: 'canonical clipboard commits before host synchronization',
    pattern:
      /canonical[\s\S]{0,180}(?:before|first|then)[\s\S]{0,120}host|first[\s\S]{0,100}canonical[\s\S]{0,180}host/i,
  },
  {
    label: 'exact raw Unicode and line-ending semantics',
    pattern: /(?:exact|raw)[\s\S]{0,120}(?:Unicode|line endings?)/i,
  },
];

const shortcutConcepts: readonly DocumentationConcept[] = [
  { label: 'ordinary Ctrl+C and Ctrl+V application shortcuts', pattern: /Ctrl\+C[\s\S]{0,100}Ctrl\+V/i },
  { label: 'terminal-owned shifted copy and paste shortcuts', pattern: /Ctrl\+Shift\+C[\s\S]{0,140}Ctrl\+Shift\+V/i },
  {
    label: 'bracketed paste remains a separate input path',
    pattern: /bracketed paste[\s\S]{0,180}(?:separate|direct|does not|never)/i,
  },
  { label: 'OSC 52 is outbound and capability gated', pattern: /OSC 52[\s\S]{0,160}(?:outbound|write|cop)/i },
  {
    label: 'browser clipboard remains outbound-only',
    pattern: /browser[\s\S]{0,180}(?:outbound.only|write.only|does not read)/i,
  },
];

const safetyConcepts: readonly DocumentationConcept[] = [
  {
    label: 'asynchronous reads are serialized in gesture order',
    pattern: /(?:serial|one at a time)[\s\S]{0,160}(?:order|gesture)/i,
  },
  {
    label: 'pending reads do not block input or rendering',
    pattern: /(?:does not|without)[\s\S]{0,100}block[\s\S]{0,100}(?:input|render)/i,
  },
  { label: 'focus continuity discards stale results', pattern: /focus[\s\S]{0,180}(?:continu|stale|discard)/i },
  { label: 'modal changes discard stale results', pattern: /modal[\s\S]{0,180}(?:stale|discard|change)/i },
  {
    label: 'unmount and stop lifecycle changes discard results',
    pattern: /(?:unmount|stop|dispose)[\s\S]{0,180}(?:stale|discard|ignore)/i,
  },
  { label: 'one MiB UTF-8 byte boundary', pattern: /1\s*MiB[\s\S]{0,100}UTF-8|UTF-8[\s\S]{0,100}1\s*MiB/i },
  { label: 'over-cap text reports truncation', pattern: /truncat/i },
  {
    label: 'successful empty reads clear canonical state without editing',
    pattern: /empty[\s\S]{0,180}(?:clear|canonical)[\s\S]{0,180}(?:no.op|without edit|does not edit)/i,
  },
  {
    label: 'read failure uses the current local fallback',
    pattern: /(?:read|reader)[\s\S]{0,120}fail[\s\S]{0,180}(?:fallback|app.local|canonical)/i,
  },
  {
    label: 'diagnostics never include payload or host error details',
    pattern: /(?:payload.free|without payload|never log|not log)[\s\S]{0,180}(?:error|exception|detail|clipboard)/i,
  },
];

const platformConcepts: readonly DocumentationConcept[] = [
  {
    label: 'clipboardy is loaded lazily by the UI runtime',
    pattern:
      /(?:UI runtime|Application\.run)[\s\S]{0,180}clipboardy|clipboardy[\s\S]{0,180}(?:UI runtime|Application\.run)/i,
  },
  {
    label: 'macOS support is host-helper dependent',
    pattern: /macOS[\s\S]{0,180}(?:helper|pbcopy|pbpaste)|(?:helper|pbcopy|pbpaste)[\s\S]{0,180}macOS/i,
  },
  {
    label: 'Windows support is host-helper dependent',
    pattern: /Windows[\s\S]{0,180}(?:helper|PowerShell)|(?:helper|PowerShell)[\s\S]{0,180}Windows/i,
  },
  { label: 'Linux X11 and Wayland limitations', pattern: /X11[\s\S]{0,120}Wayland|Wayland[\s\S]{0,120}X11/i },
  { label: 'headless and SSH degradation', pattern: /headless[\s\S]{0,120}SSH|SSH[\s\S]{0,120}headless/i },
  {
    label: 'missing helpers fall back without terminating the app',
    pattern: /missing[\s\S]{0,100}helper[\s\S]{0,180}(?:fallback|remain|contin|usable)/i,
  },
  {
    label: 'runtime never installs helpers',
    pattern: /(?:does not|never|no)\s+(?:automatically\s+|auto-?)?install\s+(?:platform\s+)?helpers?/i,
  },
  {
    label: 'native clipboard access has no retry or polling loop',
    pattern: /(?:no|does not|never)[\s\S]{0,80}(?:retry|poll)/i,
  },
];

test('consumer guide documents configuration and raw canonical semantics', () => {
  expectConcepts('keyboard and clipboard guide', consumerGuide, configurationConcepts);
});

test('consumer guide distinguishes application shortcuts from host-owned paste paths', () => {
  expectConcepts('keyboard and clipboard guide', consumerGuide, shortcutConcepts);
});

test('consumer guide documents ordering, destination safety, bounds, empty reads, and fallback', () => {
  expectConcepts('keyboard and clipboard guide', consumerGuide, safetyConcepts);
});

test('consumer guide documents automatic platform, headless, helper, and no-install limitations', () => {
  expectConcepts('keyboard and clipboard guide', consumerGuide, platformConcepts);
});

test('canonical skill teaches the complete native clipboard operating model', () => {
  const canonicalGuidance = `${canonicalArchitecture}\n${canonicalGotchas}`;
  expectConcepts('canonical skill clipboard guidance', canonicalGuidance, [
    ...configurationConcepts,
    ...shortcutConcepts,
    ...safetyConcepts,
    ...platformConcepts,
  ]);
  expectConcepts('canonical generated API reference', canonicalApi, [
    { label: 'reader callback type and option', pattern: /ClipboardTextReader[\s\S]*readClipboardText/ },
    { label: 'writer callback type and option', pattern: /ClipboardTextWriter[\s\S]*writeClipboardText/ },
  ]);
});

test('generated plugin teaches the same complete native clipboard operating model', () => {
  const generatedGuidance = `${generatedArchitecture}\n${generatedGotchas}`;
  expectConcepts('generated plugin clipboard guidance', generatedGuidance, [
    ...configurationConcepts,
    ...shortcutConcepts,
    ...safetyConcepts,
    ...platformConcepts,
  ]);
  expectConcepts('generated plugin API reference', generatedApi, [
    { label: 'reader callback type and option', pattern: /ClipboardTextReader[\s\S]*readClipboardText/ },
    { label: 'writer callback type and option', pattern: /ClipboardTextWriter[\s\S]*writeClipboardText/ },
  ]);
});

test('source-impact routing keeps automatic application clipboard changes connected to clipboard guidance', () => {
  const impact: unknown = JSON.parse(repositoryFile('tools/jsvision-plugin-impact.json'));
  if (!isRecord(impact) || !Array.isArray(impact.areas)) {
    throw new Error('tools/jsvision-plugin-impact.json must contain an areas array');
  }
  const routed = impact.areas.some((area) => {
    if (!isRecord(area) || !Array.isArray(area.paths) || !Array.isArray(area.references)) return false;
    return (
      area.paths.includes('packages/ui/src/app') &&
      area.references.includes('references/architecture.md') &&
      area.references.includes('references/gotchas.md')
    );
  });

  expect(routed, 'application clipboard changes must report both canonical clipboard references').toBe(true);
});

/** Narrow parsed JSON before reading its named fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
