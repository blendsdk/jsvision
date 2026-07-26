import type { CodeEditorTheme } from '../theme/theme.js';

/** Normalizes snippet placeholder payloads without invoking accessors on hostile input objects. */
export function normalizeSnippetPlaceholders(
  placeholders: readonly { readonly from: number; readonly to: number }[],
  decorationLimit: number,
  documentLength: number,
): readonly { readonly from: number; readonly to: number }[] | undefined {
  const normalized: { readonly from: number; readonly to: number }[] = [];
  try {
    if (!Array.isArray(placeholders) || placeholders.length > 100_000) return undefined;
    for (let index = 0; index < Math.min(placeholders.length, decorationLimit); index += 1) {
      const item = ownData(placeholders, String(index));
      const from = ownInteger(item, 'from');
      const to = ownInteger(item, 'to');
      if (from !== undefined && to !== undefined && from >= 0 && to >= from && to <= documentLength) {
        normalized.push(Object.freeze({ from, to }));
      }
    }
  } catch {
    return undefined;
  }
  return Object.freeze(normalized);
}

/** Produces a stable presentation fingerprint for an already validated editor theme. */
export function fingerprintTheme(theme: CodeEditorTheme): string {
  let hash = 2_166_136_261;
  const sections = [theme.surfaces, theme.syntax, theme.structure, theme.diagnostics, theme.assistance];
  const values = [
    theme.name,
    ...sections.flatMap((section) =>
      Object.values(section).flatMap((style) => [style.foreground, style.background, String(style.attrs ?? 0)]),
    ),
  ];
  for (const value of values) {
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
    }
  }
  return (hash >>> 0).toString(16);
}

/** Reads an own safe-integer data property. */
function ownInteger(value: unknown, key: string): number | undefined {
  const candidate = ownData(value, key);
  return Number.isSafeInteger(candidate) ? (candidate as number) : undefined;
}

/**
 * Reads an own data property from a plain record or array.
 *
 * Accessor descriptors and custom prototypes are rejected so validation never invokes user code.
 */
export function ownData(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== 'object') return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}
