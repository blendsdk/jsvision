/**
 * Character-set helpers shared by the `filter` and `range` validators. `expandCharSet` parses a
 * compact range spec (`'0-9A-Za-z '`) like a regex character class without the brackets — `X-Y`
 * expands to the inclusive code-point range, and every other character is a literal member.
 */

/**
 * Expand a compact character-set spec into the set of allowed characters. `X-Y` (a char, `-`, a char)
 * expands to the inclusive range; a `-` that is not between two characters is literal.
 *
 * @param spec An allowed-character set, e.g. `'0-9'`, `'A-Za-z_'`, or a literal list `'@#$'`.
 * @returns The set of allowed single-character strings.
 */
export function expandCharSet(spec: string): Set<string> {
  const chars = [...spec];
  const out = new Set<string>();
  let i = 0;
  while (i < chars.length) {
    const cur = chars[i];
    const next = chars[i + 1];
    const after = chars[i + 2];
    // A `cur - after` range (only when both ends exist and the range is non-descending).
    if (next === '-' && after !== undefined && cur !== undefined && cur.codePointAt(0)! <= after.codePointAt(0)!) {
      for (let cp = cur.codePointAt(0)!; cp <= after.codePointAt(0)!; cp += 1) {
        out.add(String.fromCodePoint(cp));
      }
      i += 3;
      continue;
    }
    if (cur !== undefined) out.add(cur);
    i += 1;
  }
  return out;
}

/**
 * Whether every character of `s` is in `set`.
 *
 * @param s   The candidate string.
 * @param set The allowed-character set.
 * @returns `true` iff all characters of `s` are allowed (an empty string is vacuously allowed).
 */
export function allInSet(s: string, set: Set<string>): boolean {
  for (const ch of s) {
    if (!set.has(ch)) return false;
  }
  return true;
}
