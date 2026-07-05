/**
 * The TV-faithful `*`/`?` wildcard matcher (AC-2). Pure, zero-dep, bounds-checked for any pattern/name
 * length.
 *
 * TV decode (GATE-1) — `FindFirstRec::wildcardMatch` (`source/platform/findfrst.cpp:173-186`),
 * `FindFirstRec::isWild` semantics (`strpbrk(f, "?*")`):
 *   • `?` matches exactly one character; `*` matches zero or more (greedy — a trailing `*` matches the
 *     rest); any other character is an **exact case-sensitive** byte compare; both pattern and name
 *     must be fully consumed.
 *   • The `"*.*"` special case collapses to `"*"` so it matches extensionless names too (03-01).
 *   • Case-sensitivity is retained cross-platform (PA/AR-243) — a deliberate fidelity choice.
 *
 * `.js` specifiers per NodeNext.
 */

/** True iff `pattern` contains a `*` or `?` (TV `strpbrk(f, "?*") != NULL`). */
export function isWild(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?');
}

/**
 * Match `name` against a `*`/`?` `pattern`, case-sensitive; `"*.*"` collapses to `"*"`.
 *
 * @param pattern The wildcard pattern.
 * @param name    The candidate name.
 * @returns Whether the whole name matches the whole pattern.
 */
export function wildcardMatch(pattern: string, name: string): boolean {
  const pat = pattern === '*.*' ? '*' : pattern; // "*.*" → "*" (matches extensionless), 03-01
  return match(pat, 0, name, 0);
}

/** Recursive matcher over code-unit indices (TV's pointer walk, `findfrst.cpp:173-186`). */
function match(pattern: string, pi: number, name: string, ni: number): boolean {
  for (; pi < pattern.length; pi += 1) {
    const pc = pattern[pi];
    if (pc === '?') {
      if (ni >= name.length) return false; // '?' needs a character
      ni += 1;
    } else if (pc === '*') {
      if (pi + 1 >= pattern.length) return true; // trailing '*' matches the rest
      for (let i = ni; i < name.length; i += 1) if (match(pattern, pi + 1, name, i)) return true;
      return false;
    } else {
      if (name[ni] !== pc) return false; // exact, case-sensitive
      ni += 1;
    }
  }
  return ni === name.length; // both fully consumed
}
