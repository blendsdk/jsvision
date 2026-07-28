import type { CapabilityProfile, Color, Theme } from '@jsvision/core';
import { ANSI16_ORDER, Attr, nearest16, toRgb } from '@jsvision/core';
import { darkCodeEditorTheme } from './presets.js';
import type {
  CodeEditorCellStyle,
  CodeEditorTheme,
  CodeEditorThemeResolutionReport,
  CodeEditorThemeSource,
  ResolvedCodeEditorTheme,
} from './theme.js';

/** Application presentation and terminal capabilities used to resolve an editor palette. */
export interface ResolveCodeEditorThemeContext {
  readonly applicationTheme: Pick<Theme, 'editorNormal' | 'editorSelected' | 'statusBar'>;
  readonly caps: CapabilityProfile;
}

type ThemeSection = 'surfaces' | 'syntax' | 'structure' | 'diagnostics' | 'assistance';
type ThemeAdjustment = { readonly path: string; readonly reason: 'minimum-contrast' | 'capability-fallback' };

const THEME_SECTIONS: readonly ThemeSection[] = Object.freeze([
  'surfaces',
  'syntax',
  'structure',
  'diagnostics',
  'assistance',
]);
const ABSENT = Symbol('absent');
const INVALID = Symbol('invalid');
const trustedResolutions = new WeakSet<object>();

/**
 * Resolves the hybrid editor theme without invoking accessors or retaining caller-owned data.
 *
 * Resolution reads only the fixed theme schema. Unknown properties are ignored without
 * enumeration, so a wide hostile object cannot turn one repaint into document-sized work.
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
  try {
    return resolveTheme(source, context);
  } catch {
    return safeDefaultResolution('theme-input');
  }
}

/**
 * Copies a hybrid source through the same fixed-schema boundary used by resolution.
 *
 * @param value - Untrusted live source candidate.
 * @returns A deeply immutable source, or `undefined` when a known field is invalid.
 */
export function snapshotCodeEditorThemeSource(value: unknown): CodeEditorThemeSource | undefined {
  try {
    const selection = readSource(value);
    if (selection === undefined) return undefined;
    const overrides = snapshotOverride(selection.overrides);
    if (!overrides.valid) return undefined;
    if (selection.kind === 'application') {
      const applicationOverrides = snapshotOverride(selection.applicationOverrides);
      if (!applicationOverrides.valid) return undefined;
      return Object.freeze({
        kind: 'application',
        ...(applicationOverrides.value === undefined ? {} : { applicationOverrides: applicationOverrides.value }),
        ...(overrides.value === undefined ? {} : { overrides: overrides.value }),
      });
    }
    const base = snapshotCodeEditorTheme(selection.base);
    if (base === undefined) return undefined;
    return Object.freeze({
      kind: 'independent',
      base,
      ...(overrides.value === undefined ? {} : { overrides: overrides.value }),
    });
  } catch {
    return undefined;
  }
}

function resolveTheme(source: unknown, context: ResolveCodeEditorThemeContext): ResolvedCodeEditorTheme {
  const rejected: string[] = [];
  const adjustments: ThemeAdjustment[] = [];
  const selection = readSource(source);
  const independent = selection?.kind === 'independent' ? snapshotCodeEditorTheme(selection.base) : undefined;
  const base =
    selection?.kind === 'independent'
      ? cloneTheme(independent ?? darkCodeEditorTheme)
      : deriveApplicationTheme(readOwn(context, 'applicationTheme'));
  if (selection === undefined) rejected.push('source');
  if (selection?.kind === 'independent' && independent === undefined) {
    rejected.push('base', 'name');
  }

  const application = applyOverrideLayer(base, selection?.applicationOverrides, 'applicationOverrides', rejected);
  const editor = applyOverrideLayer(base, selection?.overrides, 'overrides', rejected);
  repairContrast(base, adjustments);

  const caps = readCapabilities(readOwn(context, 'caps'));
  if (caps.colorDepth !== 'truecolor') adjustments.push({ path: '*', reason: 'capability-fallback' });
  if (caps.colorDepth === 'mono') downsampleMonochrome(base);
  else if (caps.colorDepth === '16') downsampleAnsi16(base);
  if (!caps.utf8 || !caps.boxDrawing) adjustments.push({ path: 'glyphs', reason: 'capability-fallback' });

  const activeLayer = editor.contributed
    ? 'editor'
    : application.contributed
      ? 'application'
      : selection?.kind === 'independent'
        ? 'independent'
        : selection?.kind === 'application'
          ? 'application-derived'
          : 'safe-default';
  const fallbackSource =
    selection?.kind === 'independent' ? (independent?.name ?? darkCodeEditorTheme.name) : 'application-derived';
  const report = makeReport(activeLayer, fallbackSource, rejected, adjustments);
  return trustedResolution(freezeTheme(base), report);
}

function safeDefaultResolution(rejection: string): ResolvedCodeEditorTheme {
  const report = makeReport('safe-default', darkCodeEditorTheme.name, [rejection], []);
  return trustedResolution(freezeTheme(cloneTheme(darkCodeEditorTheme)), report);
}

function readSource(value: unknown):
  | {
      readonly kind: 'application' | 'independent';
      readonly base?: unknown;
      readonly applicationOverrides?: unknown;
      readonly overrides?: unknown;
    }
  | undefined {
  if (!isPlainObject(value)) return undefined;
  const kind = ownData(value, 'kind');
  if (kind !== 'application' && kind !== 'independent') return undefined;
  const overrides = ownData(value, 'overrides');
  if (overrides === INVALID) return undefined;
  if (kind === 'independent') {
    const base = ownData(value, 'base');
    if (base === ABSENT || base === INVALID) return undefined;
    return { kind, base, ...(overrides === ABSENT ? {} : { overrides }) };
  }
  const applicationOverrides = ownData(value, 'applicationOverrides');
  if (applicationOverrides === INVALID) return undefined;
  return {
    kind,
    ...(applicationOverrides === ABSENT ? {} : { applicationOverrides }),
    ...(overrides === ABSENT ? {} : { overrides }),
  };
}

function applyOverrideLayer(
  theme: CodeEditorTheme,
  value: unknown,
  layer: string,
  rejected: string[],
): { readonly contributed: boolean } {
  if (value === undefined) return { contributed: false };
  if (!isPlainObject(value)) {
    rejected.push(layer);
    return { contributed: false };
  }
  let contributed = false;
  for (const section of THEME_SECTIONS) {
    const sectionValue = ownData(value, section);
    if (sectionValue === ABSENT) continue;
    if (sectionValue === INVALID || !isPlainObject(sectionValue)) {
      rejected.push(`${layer}.${section}`);
      continue;
    }
    const target = mutableSection(theme, section);
    for (const role of Object.keys(target)) {
      const candidate = ownData(sectionValue, role);
      if (candidate === ABSENT) continue;
      const path = `${layer}.${section}.${role}`;
      if (candidate === INVALID || !isPlainObject(candidate)) {
        rejected.push(path);
        continue;
      }
      if (
        ownData(candidate, 'foreground') === ABSENT &&
        ownData(candidate, 'background') === ABSENT &&
        ownData(candidate, 'attrs') === ABSENT
      )
        continue;
      const previous = target[role];
      if (previous === undefined) continue;
      const next = mergeStyle(previous, candidate);
      if (next === undefined) {
        rejected.push(path);
        continue;
      }
      target[role] = next;
      contributed = true;
    }
  }
  return { contributed };
}

function mergeStyle(
  previous: CodeEditorCellStyle,
  candidate: Record<string, unknown>,
): CodeEditorCellStyle | undefined {
  const foregroundInput = ownData(candidate, 'foreground');
  const backgroundInput = ownData(candidate, 'background');
  const attrsInput = ownData(candidate, 'attrs');
  if (foregroundInput === INVALID || backgroundInput === INVALID || attrsInput === INVALID) return undefined;
  const foreground = foregroundInput === ABSENT ? previous.foreground : validColor(foregroundInput);
  const background = backgroundInput === ABSENT ? previous.background : validColor(backgroundInput);
  const attrs = attrsInput === ABSENT ? previous.attrs : validAttrs(attrsInput);
  if (foreground === undefined || background === undefined || (attrsInput !== ABSENT && attrs === undefined))
    return undefined;
  return cell(foreground, background, attrs);
}

function snapshotOverride(value: unknown): { readonly valid: boolean; readonly value?: unknown } {
  if (value === undefined) return { valid: true };
  if (!isPlainObject(value)) return { valid: false };
  const result: Record<string, unknown> = {};
  for (const section of THEME_SECTIONS) {
    const source = ownData(value, section);
    if (source === ABSENT) continue;
    if (source === INVALID || !isPlainObject(source)) return { valid: false };
    const schema = mutableSection(cloneTheme(darkCodeEditorTheme), section);
    const sectionResult: Record<string, unknown> = {};
    for (const role of Object.keys(schema)) {
      const candidate = ownData(source, role);
      if (candidate === ABSENT) continue;
      if (candidate === INVALID || !isPlainObject(candidate)) return { valid: false };
      const style: Record<string, unknown> = {};
      for (const field of ['foreground', 'background', 'attrs'] as const) {
        const fieldValue = ownData(candidate, field);
        if (fieldValue === ABSENT) continue;
        if (
          fieldValue === INVALID ||
          (field === 'attrs' ? validAttrs(fieldValue) === undefined : validColor(fieldValue) === undefined)
        )
          return { valid: false };
        style[field] = fieldValue;
      }
      if (Object.keys(style).length > 0) sectionResult[role] = Object.freeze(style);
    }
    if (Object.keys(sectionResult).length > 0) result[section] = Object.freeze(sectionResult);
  }
  return {
    valid: true,
    ...(Object.keys(result).length === 0 ? {} : { value: Object.freeze(result) }),
  };
}

function deriveApplicationTheme(value: unknown): CodeEditorTheme {
  const base = cloneTheme(darkCodeEditorTheme);
  const editor = coreStyle(value, 'editorNormal') ?? base.surfaces.editor;
  const selection = coreStyle(value, 'editorSelected') ?? base.surfaces.selection;
  const status = coreStyle(value, 'statusBar') ?? base.surfaces.status;
  return {
    ...base,
    name: 'application',
    surfaces: { ...base.surfaces, editor, selection, status },
  };
}

function coreStyle(theme: unknown, role: string): CodeEditorCellStyle | undefined {
  if (!isPlainObject(theme)) return undefined;
  const candidate = ownData(theme, role);
  if (candidate === ABSENT || candidate === INVALID || !isPlainObject(candidate)) return undefined;
  const foregroundInput = ownData(candidate, 'fg');
  const backgroundInput = ownData(candidate, 'bg');
  const attrsInput = ownData(candidate, 'attrs');
  if (
    foregroundInput === ABSENT ||
    foregroundInput === INVALID ||
    backgroundInput === ABSENT ||
    backgroundInput === INVALID ||
    attrsInput === INVALID
  )
    return undefined;
  const foreground = validColor(foregroundInput);
  const background = validColor(backgroundInput);
  const attrs = attrsInput === ABSENT ? undefined : validAttrs(attrsInput);
  return foreground === undefined || background === undefined || (attrsInput !== ABSENT && attrs === undefined)
    ? undefined
    : cell(foreground, background, attrs);
}

function readCapabilities(value: unknown): {
  readonly colorDepth: CapabilityProfile['colorDepth'];
  readonly utf8: boolean;
  readonly boxDrawing: boolean;
} {
  if (!isPlainObject(value)) return { colorDepth: 'mono', utf8: false, boxDrawing: false };
  const colorDepth = ownData(value, 'colorDepth');
  const unicode = ownData(value, 'unicode');
  const glyphs = ownData(value, 'glyphs');
  return {
    colorDepth:
      colorDepth === 'mono' || colorDepth === '16' || colorDepth === '256' || colorDepth === 'truecolor'
        ? colorDepth
        : 'mono',
    utf8: unicode !== ABSENT && unicode !== INVALID && isPlainObject(unicode) && ownData(unicode, 'utf8') === true,
    boxDrawing:
      glyphs !== ABSENT && glyphs !== INVALID && isPlainObject(glyphs) && ownData(glyphs, 'boxDrawing') === true,
  };
}

function repairContrast(theme: CodeEditorTheme, adjustments: ThemeAdjustment[]): void {
  for (const section of THEME_SECTIONS) {
    const target = mutableSection(theme, section);
    for (const [role, style] of Object.entries(target)) {
      if (contrastRatio(style.foreground, style.background) >= 4.5) continue;
      target[role] = cell(contrastColor(style.background), style.background, style.attrs);
      adjustments.push({ path: `${section}.${role}`, reason: 'minimum-contrast' });
    }
  }
}

function contrastRatio(foreground: Color, background: Color): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  if (first === undefined || second === undefined) return foreground === background ? 1 : Number.POSITIVE_INFINITY;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function relativeLuminance(color: Color): number | undefined {
  if (!/^#[0-9a-f]{6}$/iu.test(color)) return undefined;
  const channels = [1, 3, 5].map((from) => Number.parseInt(color.slice(from, from + 2), 16) / 255);
  const linear = channels.map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return (linear[0] ?? 0) * 0.2126 + (linear[1] ?? 0) * 0.7152 + (linear[2] ?? 0) * 0.0722;
}

function contrastColor(background: Color): Color {
  if (/^#[0-9a-f]{6}$/iu.test(background)) {
    const value = Number.parseInt(background.slice(1), 16);
    const luminance = ((value >> 16) * 299 + ((value >> 8) & 255) * 587 + (value & 255) * 114) / 1000;
    return luminance >= 128 ? '#000000' : '#ffffff';
  }
  return background === 'black' || background === 'blue' ? 'brightWhite' : 'black';
}

function downsampleMonochrome(theme: CodeEditorTheme): void {
  let index = 0;
  for (const section of THEME_SECTIONS) {
    const target = mutableSection(theme, section);
    for (const [role, previous] of Object.entries(target)) {
      target[role] = cell('default', 'default', previous.attrs ?? (index++ % 2 === 0 ? Attr.none : Attr.bold));
    }
  }
}

function downsampleAnsi16(theme: CodeEditorTheme): void {
  adaptThemeColors(theme, (color) => {
    const rgb = toRgb(color);
    return rgb === null ? 'default' : (ANSI16_ORDER[nearest16(rgb)] ?? 'default');
  });
}

function adaptThemeColors(theme: CodeEditorTheme, adapt: (color: Color) => Color): void {
  for (const section of THEME_SECTIONS) {
    const target = mutableSection(theme, section);
    for (const [role, previous] of Object.entries(target)) {
      target[role] = cell(adapt(previous.foreground), adapt(previous.background), previous.attrs);
    }
  }
}

function validAttrs(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 127 ? value : undefined;
}

function validColor(value: unknown): Color | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^#[0-9a-f]{6}$/iu.test(value)) return value as Color;
  return ansiColors.has(value) ? (value as Color) : undefined;
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
    if (!isPlainObject(value) || ownData(value, 'contractVersion') !== 1) return undefined;
    const nameValue = ownData(value, 'name');
    const name = safeThemeName(nameValue);
    if (name === undefined) return undefined;
    const base = cloneTheme(darkCodeEditorTheme);
    for (const section of THEME_SECTIONS) {
      const source = ownData(value, section);
      if (source === ABSENT || source === INVALID || !isPlainObject(source)) return undefined;
      const target = mutableSection(base, section);
      for (const role of Object.keys(target)) {
        const candidate = ownData(source, role);
        if (candidate === ABSENT || candidate === INVALID || !isPlainObject(candidate)) return undefined;
        const previous = target[role];
        if (previous === undefined) return undefined;
        const next = mergeStyle({ foreground: previous.foreground, background: previous.background }, candidate);
        const foreground = ownData(candidate, 'foreground');
        const background = ownData(candidate, 'background');
        if (foreground === ABSENT || background === ABSENT || next === undefined) return undefined;
        target[role] = next;
      }
    }
    return freezeTheme({ ...base, name });
  } catch {
    return undefined;
  }
}

/**
 * Accepts inspection evidence only from the exact resolver result that owns it.
 *
 * Branding the complete result prevents a genuine report from being paired with a different
 * palette. Arbitrary structurally similar objects are ignored even when every field is safe.
 */
export function snapshotThemeResolutionReport(value: unknown): CodeEditorThemeResolutionReport | undefined {
  return typeof value === 'object' && value !== null && trustedResolutions.has(value)
    ? (value as ResolvedCodeEditorTheme).report
    : undefined;
}

function trustedResolution(theme: CodeEditorTheme, report: CodeEditorThemeResolutionReport): ResolvedCodeEditorTheme {
  const resolution = Object.freeze({ contractVersion: 1 as const, theme, report });
  trustedResolutions.add(resolution);
  return resolution;
}

function makeReport(
  activeLayer: CodeEditorThemeResolutionReport['activeLayer'],
  fallbackSource: string,
  rejected: readonly string[],
  adjustments: readonly ThemeAdjustment[],
): CodeEditorThemeResolutionReport {
  const report = Object.freeze({
    activeLayer,
    fallbackSource,
    rejected: Object.freeze([...new Set(rejected)].sort()),
    adjustments: Object.freeze(deduplicateAdjustments(adjustments)),
  });
  return report;
}

function safeThemeName(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) return undefined;
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (
      codePoint < 0x20 ||
      codePoint === 0x7f ||
      (codePoint >= 0x80 && codePoint <= 0x9f) ||
      (/\s/u.test(String.fromCodePoint(codePoint)) && (index === 0 || index === value.length - 1))
    )
      return undefined;
    if (codePoint > 0xffff) index += 1;
  }
  return value;
}

function deduplicateAdjustments(adjustments: readonly ThemeAdjustment[]): ThemeAdjustment[] {
  const seen = new Set<string>();
  const result: ThemeAdjustment[] = [];
  for (const adjustment of adjustments) {
    const key = `${adjustment.path}:${adjustment.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(adjustment);
  }
  return result;
}

function cloneSection<T extends Readonly<Record<string, CodeEditorCellStyle>>>(section: T): T {
  return Object.fromEntries(
    Object.entries(section).map(([key, value]) => [key, cell(value.foreground, value.background, value.attrs)]),
  ) as T;
}

function mutableSection(theme: CodeEditorTheme, section: ThemeSection): Record<string, CodeEditorCellStyle> {
  return theme[section] as Record<string, CodeEditorCellStyle>;
}

function freezeTheme(theme: CodeEditorTheme): CodeEditorTheme {
  for (const section of THEME_SECTIONS) {
    for (const style of Object.values(theme[section])) Object.freeze(style);
    Object.freeze(theme[section]);
  }
  return Object.freeze(theme);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function ownData(value: Record<string, unknown>, key: string): unknown | typeof ABSENT | typeof INVALID {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return ABSENT;
    return 'value' in descriptor ? descriptor.value : INVALID;
  } catch {
    return INVALID;
  }
}

function readOwn(value: unknown, key: string): unknown {
  return isPlainObject(value) ? ownData(value, key) : undefined;
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
