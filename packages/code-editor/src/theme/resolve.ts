import type { CapabilityProfile, Color, Theme } from '@jsvision/core';
import { Attr } from '@jsvision/core';
import { darkCodeEditorTheme } from './presets.js';
import type { CodeEditorCellStyle, CodeEditorTheme, CodeEditorThemeSource, ResolvedCodeEditorTheme } from './theme.js';

interface ResolveCodeEditorThemeContext {
  readonly applicationTheme: Theme;
  readonly caps: CapabilityProfile;
}

const allowedSections = new Set(['surfaces', 'syntax', 'structure', 'diagnostics', 'assistance']);

/**
 * Resolves the hybrid editor theme without invoking accessors or retaining caller-owned data.
 *
 * @example
 * ```ts
 * const resolved = resolveCodeEditorTheme({ kind: 'application' }, { applicationTheme, caps });
 * ```
 */
export function resolveCodeEditorTheme(
  source: CodeEditorThemeSource,
  context: ResolveCodeEditorThemeContext,
): ResolvedCodeEditorTheme {
  const rejected: string[] = [];
  const adjustments: { path: string; reason: 'minimum-contrast' | 'capability-fallback' }[] = [];
  const selection = readSource(source);
  const independent = selection?.kind === 'independent' ? snapshotCodeEditorTheme(selection.base) : undefined;
  const base =
    selection?.kind === 'independent'
      ? cloneTheme(independent ?? darkCodeEditorTheme)
      : deriveApplicationTheme(context.applicationTheme);
  if (selection?.kind === 'independent' && independent === undefined) rejected.push('base');
  const override = safeOverrides(selection?.overrides, rejected);
  const merged = applyOverrides(base, override);
  repairContrast(merged, adjustments);
  if (context.caps.colorDepth === 'mono') {
    downsampleMonochrome(merged);
    adjustments.push({ path: '*', reason: 'capability-fallback' });
  }
  return Object.freeze({
    contractVersion: 1,
    theme: freezeTheme(merged),
    report: Object.freeze({
      rejected: Object.freeze(rejected.sort()),
      adjustments: Object.freeze(adjustments),
    }),
  });
}

function readSource(
  value: unknown,
): { kind: 'application' | 'independent'; base?: unknown; overrides?: unknown } | undefined {
  try {
    if (!isPlainObject(value)) return undefined;
    const kind = ownData(value, 'kind');
    if (kind !== 'application' && kind !== 'independent') return undefined;
    const overrides = ownData(value, 'overrides');
    return kind === 'independent' ? { kind, base: ownData(value, 'base'), overrides } : { kind, overrides };
  } catch {
    return undefined;
  }
}

function ownData(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
}

function deriveApplicationTheme(theme: Theme): CodeEditorTheme {
  const base = cloneTheme(darkCodeEditorTheme);
  const editor = coreStyle(theme, 'editorNormal') ?? base.surfaces.editor;
  const selection = coreStyle(theme, 'editorSelected') ?? base.surfaces.selection;
  const status = coreStyle(theme, 'statusBar') ?? base.surfaces.status;
  return {
    ...base,
    name: 'application',
    surfaces: {
      ...base.surfaces,
      editor,
      selection,
      status,
    },
  };
}

function coreStyle(theme: unknown, role: string): CodeEditorCellStyle | undefined {
  try {
    if (!isPlainObject(theme)) return undefined;
    const candidate = ownData(theme, role);
    if (!isPlainObject(candidate)) return undefined;
    const foreground = validColor(ownData(candidate, 'fg'));
    const background = validColor(ownData(candidate, 'bg'));
    const attrs = ownData(candidate, 'attrs');
    if (foreground === undefined || background === undefined) return undefined;
    if (attrs !== undefined && (!Number.isSafeInteger(attrs) || (attrs as number) < 0 || (attrs as number) > 127))
      return undefined;
    return cell(foreground, background, attrs as number | undefined);
  } catch {
    return undefined;
  }
}

function safeOverrides(value: unknown, rejected: string[]): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isPlainObject(value)) return {};
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || !allowedSections.has(key)) {
      rejected.push(key);
      continue;
    }
    if (!isSafeTree(descriptor.value, 0)) {
      rejected.push(key);
      continue;
    }
    result[key] = descriptor.value;
  }
  return result;
}

function isSafeTree(value: unknown, depth: number): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return true;
  if (!isPlainObject(value)) return false;
  return Object.keys(value).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor && isSafeTree(descriptor.value, depth + 1);
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function applyOverrides(base: CodeEditorTheme, value: Record<string, unknown>): CodeEditorTheme {
  for (const section of allowedSections) {
    const source = value[section];
    if (!isPlainObject(source)) continue;
    const target = base[
      section as keyof Pick<CodeEditorTheme, 'surfaces' | 'syntax' | 'structure' | 'diagnostics' | 'assistance'>
    ] as Record<string, CodeEditorCellStyle>;
    for (const [role, candidate] of Object.entries(source)) {
      if (!(role in target) || !isPlainObject(candidate)) continue;
      const foreground = validColor(candidate.foreground) ?? target[role]?.foreground;
      const background = validColor(candidate.background) ?? target[role]?.background;
      if (foreground !== undefined && background !== undefined) target[role] = cell(foreground, background);
    }
  }
  return base;
}

function validColor(value: unknown): Color | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^#[0-9a-f]{6}$/iu.test(value)) return value as Color;
  return ansiColors.has(value) ? (value as Color) : undefined;
}

function repairContrast(
  theme: CodeEditorTheme,
  adjustments: { path: string; reason: 'minimum-contrast' | 'capability-fallback' }[],
): void {
  for (const section of ['surfaces', 'syntax', 'structure', 'diagnostics', 'assistance'] as const) {
    const target = theme[section] as Record<string, CodeEditorCellStyle>;
    for (const [role, style] of Object.entries(target)) {
      if (contrastRatio(style.foreground, style.background) < 4.5) {
        target[role] = cell(contrastColor(style.background), style.background, style.attrs);
        adjustments.push({ path: `${section}.${role}`, reason: 'minimum-contrast' });
      }
    }
  }
}

function contrastRatio(foreground: Color, background: Color): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  if (first === undefined || second === undefined) return foreground === background ? 1 : Number.POSITIVE_INFINITY;
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: Color): number | undefined {
  if (!/^#[0-9a-f]{6}$/iu.test(color)) return undefined;
  const channels = [1, 3, 5].map((from) => Number.parseInt(color.slice(from, from + 2), 16) / 255);
  const linear = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

function contrastColor(background: Color): Color {
  if (typeof background === 'string' && /^#[0-9a-f]{6}$/iu.test(background)) {
    const value = Number.parseInt(background.slice(1), 16);
    const luminance = ((value >> 16) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;
    return luminance >= 128 ? '#000000' : '#ffffff';
  }
  return background === 'black' || background === 'blue' ? 'brightWhite' : 'black';
}

function downsampleMonochrome(theme: CodeEditorTheme): void {
  let index = 0;
  for (const section of ['surfaces', 'syntax', 'structure', 'diagnostics', 'assistance'] as const) {
    for (const key of Object.keys(theme[section])) {
      const previous = (theme[section] as Record<string, CodeEditorCellStyle>)[key];
      (theme[section] as Record<string, CodeEditorCellStyle>)[key] = cell(
        'default',
        'default',
        previous?.attrs ?? (index++ % 2 === 0 ? Attr.none : Attr.bold),
      );
    }
  }
}

function cell(foreground: Color, background: Color, attrs?: number): CodeEditorCellStyle {
  return { foreground, background, ...(attrs === undefined ? {} : { attrs }) };
}

function cloneTheme(theme: CodeEditorTheme): CodeEditorTheme {
  return {
    contractVersion: 1,
    name: theme.name,
    surfaces: cloneSection(theme.surfaces),
    syntax: cloneSection(theme.syntax),
    structure: cloneSection(theme.structure),
    diagnostics: cloneSection(theme.diagnostics),
    assistance: cloneSection(theme.assistance),
  };
}

/**
 * Copies one complete theme through descriptor and primitive validation.
 *
 * @example
 * ```ts
 * const safe = snapshotCodeEditorTheme(candidate);
 * ```
 */
export function snapshotCodeEditorTheme(value: unknown): CodeEditorTheme | undefined {
  try {
    if (!isPlainObject(value)) return undefined;
    if (ownData(value, 'contractVersion') !== 1 || typeof ownData(value, 'name') !== 'string') return undefined;
    const base = cloneTheme(darkCodeEditorTheme);
    const name = String(ownData(value, 'name')).slice(0, 128);
    for (const section of allowedSections) {
      const source = ownData(value, section);
      if (!isPlainObject(source)) return undefined;
      const target = base[
        section as keyof Pick<CodeEditorTheme, 'surfaces' | 'syntax' | 'structure' | 'diagnostics' | 'assistance'>
      ] as Record<string, CodeEditorCellStyle>;
      for (const role of Object.keys(target)) {
        const candidate = ownData(source, role);
        if (!isPlainObject(candidate)) return undefined;
        const foreground = validColor(ownData(candidate, 'foreground'));
        const background = validColor(ownData(candidate, 'background'));
        const attrs = ownData(candidate, 'attrs');
        if (foreground === undefined || background === undefined) return undefined;
        if (attrs !== undefined && (!Number.isSafeInteger(attrs) || (attrs as number) < 0 || (attrs as number) > 127))
          return undefined;
        target[role] = cell(foreground, background, attrs as number | undefined);
      }
    }
    return freezeTheme({ ...base, name });
  } catch {
    return undefined;
  }
}

function cloneSection<T extends Readonly<Record<string, CodeEditorCellStyle>>>(section: T): T {
  return Object.fromEntries(
    Object.entries(section).map(([key, value]) => [key, cell(value.foreground, value.background, value.attrs)]),
  ) as T;
}

function freezeTheme(theme: CodeEditorTheme): CodeEditorTheme {
  for (const section of ['surfaces', 'syntax', 'structure', 'diagnostics', 'assistance'] as const) {
    for (const style of Object.values(theme[section])) Object.freeze(style);
    Object.freeze(theme[section]);
  }
  return Object.freeze(theme);
}

const ansiColors = new Set([
  'default',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite',
]);
