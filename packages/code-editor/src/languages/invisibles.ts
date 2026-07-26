export interface InvisibleCharacterWarning {
  readonly offset: number;
  readonly codePoint: string;
  readonly label: string;
}

const sensitive = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/gu;

/**
 * Locates terminal-sensitive invisible code points without changing source text.
 * @example `inspectInvisibleCharacters('name\\u202E')`
 */
export function inspectInvisibleCharacters(text: string): readonly InvisibleCharacterWarning[] {
  return [...text.matchAll(sensitive)].map((match) => {
    const value = match[0].codePointAt(0) ?? 0;
    const codePoint = `U+${value.toString(16).toUpperCase().padStart(4, '0')}`;
    return Object.freeze({ offset: match.index, codePoint, label: `warning ${codePoint}` });
  });
}
