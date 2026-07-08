/**
 * Lossless, injection-safe serialization of a {@link Theme} to and from JSON.
 *
 * `serializeTheme` emits a versioned `{ version, roles }` envelope with a stable
 * key order; `parseTheme` reads one back, validating **by field kind** (colors via
 * {@link toRgb}, the desktop pattern as a single printable cell, attributes as an
 * in-range integer) and either returning a complete {@link Theme} or throwing
 * {@link InvalidThemeError} — never a partial theme. Parsing is pure `JSON.parse`
 * (no `eval`, no filesystem), so a hostile payload cannot inject escape bytes or
 * smuggle in unknown roles.
 */
import type { AttrMask, Color } from '../render/types.js';
import { charWidth } from '../render/width.js';
import { TuiError } from '../safety/errors.js';
import { sanitize } from '../safety/sanitize.js';

import { InvalidColorError, toRgb } from './color.js';
import { defaultTheme, type Theme, type ThemeRole } from './theme.js';

/** The current on-disk schema version. A payload with any other version is rejected (no migration in v1). */
const SCHEMA_VERSION = 1;

/** The all-bits attribute mask (bold…strike) — the inclusive upper bound for a serialized `attrs`. */
const ATTR_MASK_MAX = 127;

/** Keys every role may carry regardless of type; everything else is a role-specific structural extra. */
const BASE_KEYS: ReadonlySet<string> = new Set(['fg', 'bg', 'hotkey', 'attrs']);

/** Structural extras that hold a color (validated via `toRgb`); `pattern` is a glyph, handled separately. */
const COLOR_EXTRA_KEYS: ReadonlySet<string> = new Set(['border', 'title', 'icon']);

/** Canonical role order + set, derived from {@link defaultTheme} so the validator tracks the type automatically. */
const CANONICAL_ROLES = Object.keys(defaultTheme) as (keyof Theme)[];

/**
 * Thrown when a serialized theme is structurally invalid, carries a malformed
 * color/pattern/attribute, or names an unexpected role. Extends {@link TuiError},
 * so one `catch (e) { if (e instanceof TuiError) }` handles it with every other
 * SDK error. `parseTheme` never returns a partially-built theme — it throws this.
 *
 * @example
 * import { parseTheme, InvalidThemeError } from '@jsvision/core';
 *
 * try {
 *   parseTheme('{"version":1,"roles":{}}');
 * } catch (e) {
 *   if (e instanceof InvalidThemeError) {
 *     console.error('rejected theme:', e.message);
 *   }
 * }
 */
export class InvalidThemeError extends TuiError {}

/** The structural extras a role must carry, derived from its shape in {@link defaultTheme}. */
function structuralExtrasOf(name: keyof Theme): string[] {
  return Object.keys(defaultTheme[name]).filter((k) => !BASE_KEYS.has(k));
}

/** Serialize one role with a fixed key order: fg, bg, hotkey?, attrs?, then structural extras. */
function serializeRole(name: keyof Theme, role: ThemeRole): Record<string, unknown> {
  const r: Record<string, unknown> = { ...role }; // widen to read the role-specific extras
  const out: Record<string, unknown> = { fg: role.fg, bg: role.bg };
  if (role.hotkey !== undefined) out.hotkey = role.hotkey;
  if (role.attrs !== undefined) out.attrs = role.attrs;
  for (const ex of structuralExtrasOf(name)) out[ex] = r[ex];
  return out;
}

/**
 * Serialize a theme to a JSON string.
 *
 * The result is a `{ "version": 1, "roles": { … } }` envelope; roles appear in the
 * canonical order and each role's keys in a fixed order, so two equal themes
 * serialize to byte-identical strings. Round-trips losslessly through
 * {@link parseTheme}, including the desktop pattern glyph and any `attrs`.
 *
 * @param theme The theme to serialize.
 * @returns A pretty-printed JSON string (no filesystem access — a pure string).
 * @example
 * import { serializeTheme, defaultTheme } from '@jsvision/core';
 *
 * const json = serializeTheme(defaultTheme); // '{ "version": 1, "roles": { … } }'
 */
export function serializeTheme(theme: Theme): string {
  const roles: Record<string, unknown> = {};
  for (const name of CANONICAL_ROLES) roles[name] = serializeRole(name, theme[name]);
  return JSON.stringify({ version: SCHEMA_VERSION, roles }, null, 2);
}

/** Assert that `v` is a non-null, non-array object; narrow it to a record. */
function asObject(v: unknown, message: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new InvalidThemeError(message);
  return v as Record<string, unknown>;
}

/** Assert a value is a resolvable color string (`toRgb`-parseable; `'default'` is allowed). */
function assertColor(v: unknown, where: string): void {
  if (typeof v !== 'string') throw new InvalidThemeError(`${where}: color must be a string`);
  try {
    toRgb(v as Parameters<typeof toRgb>[0]);
  } catch (e) {
    if (e instanceof InvalidColorError) throw new InvalidThemeError(`${where}: invalid color "${v}"`);
    throw e;
  }
}

/** Total display width of a string in terminal cells. */
function displayWidth(s: string): number {
  let width = 0;
  for (const ch of s) width += charWidth(ch.codePointAt(0) ?? 0, 'wcwidth');
  return width;
}

/**
 * Assert a value is a single printable cell: a non-empty string that survives the
 * injection sanitizer unchanged (no ESC/control bytes), carries no tab/newline
 * (which `sanitize` keeps but a pattern must not), and occupies exactly one cell.
 */
function assertPattern(v: unknown, where: string): void {
  if (typeof v !== 'string' || v.length === 0)
    throw new InvalidThemeError(`${where}: pattern must be a non-empty string`);
  if (v.includes('\t') || v.includes('\n'))
    throw new InvalidThemeError(`${where}: pattern must not contain tab/newline`);
  if (sanitize(v) !== v) throw new InvalidThemeError(`${where}: pattern must not contain control bytes`);
  if (displayWidth(v) !== 1) throw new InvalidThemeError(`${where}: pattern must be exactly one display cell`);
}

/** Assert a value is a finite integer attribute mask within the known `Attr` bits. */
function assertAttrs(v: unknown, where: string): void {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > ATTR_MASK_MAX) {
    throw new InvalidThemeError(`${where}: attrs must be an integer in [0, ${ATTR_MASK_MAX}]`);
  }
}

/** Validate one role's shape and every field kind; throws on the first violation. */
function validateRole(raw: unknown, name: keyof Theme): Record<string, unknown> {
  const role = asObject(raw, `role ${name}: must be an object`);
  const extras = structuralExtrasOf(name);
  const allowed = new Set<string>(['fg', 'bg', 'hotkey', 'attrs', ...extras]);
  for (const key of Object.keys(role)) {
    if (!allowed.has(key)) throw new InvalidThemeError(`role ${name}: unexpected key "${key}"`);
  }
  assertColor(role.fg, `role ${name}.fg`);
  assertColor(role.bg, `role ${name}.bg`);
  for (const ex of extras) {
    if (!(ex in role)) throw new InvalidThemeError(`role ${name}: missing "${ex}"`);
    if (ex === 'pattern') assertPattern(role.pattern, `role ${name}.pattern`);
    else if (COLOR_EXTRA_KEYS.has(ex)) assertColor(role[ex], `role ${name}.${ex}`);
  }
  if ('hotkey' in role) assertColor(role.hotkey, `role ${name}.hotkey`);
  if ('attrs' in role) assertAttrs(role.attrs, `role ${name}.attrs`);
  return role;
}

/**
 * Rebuild a validated role object with fg, bg, optional hotkey/attrs, and its
 * structural extras. The `unknown` values were already checked by
 * {@link validateRole}, so presenting them as their field types is sound.
 */
function buildRole(raw: Record<string, unknown>, name: keyof Theme): ThemeRole {
  const extras: Record<string, unknown> = {};
  for (const ex of structuralExtrasOf(name)) extras[ex] = raw[ex];
  return {
    fg: raw.fg as Color,
    bg: raw.bg as Color,
    ...('hotkey' in raw ? { hotkey: raw.hotkey as Color } : {}),
    ...('attrs' in raw ? { attrs: raw.attrs as AttrMask } : {}),
    ...extras,
  };
}

/**
 * Parse a serialized theme, validating every field, and return a complete
 * {@link Theme}.
 *
 * Validation is strict and by field kind: the envelope must be `{ version: 1,
 * roles }`; the role set must match exactly (no missing, unknown, or wrong-shape
 * roles); every color parses via {@link toRgb}; the desktop pattern must be a
 * single printable cell; and each `attrs` must be an integer in `[0, 127]`. Any
 * failure throws {@link InvalidThemeError} — a partial theme is never returned.
 * Parsing is pure `JSON.parse` (no `eval`, no filesystem).
 *
 * @param json A theme JSON string, e.g. from {@link serializeTheme}.
 * @returns The validated, fully-populated theme.
 * @throws InvalidThemeError on malformed JSON, a bad version/shape, or any invalid field.
 * @example
 * import { serializeTheme, parseTheme, defaultTheme } from '@jsvision/core';
 *
 * const theme = parseTheme(serializeTheme(defaultTheme)); // deep-equals defaultTheme
 */
export function parseTheme(json: string): Theme {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new InvalidThemeError('theme is not valid JSON');
  }
  const envelope = asObject(data, 'theme must be a { version, roles } object');
  if (envelope.version !== SCHEMA_VERSION) {
    throw new InvalidThemeError(`unsupported theme version: ${String(envelope.version)}`);
  }
  const roles = asObject(envelope.roles, 'theme.roles must be an object');
  for (const key of Object.keys(roles)) {
    if (!(CANONICAL_ROLES as string[]).includes(key)) throw new InvalidThemeError(`unknown role: ${key}`);
  }
  // Start from a real Theme so the result has the exact declared shape, then overwrite every role.
  const out: Theme = { ...defaultTheme };
  const writable = out as Record<keyof Theme, ThemeRole>;
  for (const name of CANONICAL_ROLES) {
    if (!(name in roles)) throw new InvalidThemeError(`missing role: ${name}`);
    writable[name] = buildRole(validateRole(roles[name], name), name);
  }
  return out;
}
