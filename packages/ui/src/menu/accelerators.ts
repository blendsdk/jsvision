/**
 * The pure duplicate-accelerator validator and its dev-warning reporter.
 *
 * Many widgets claim an `Alt`+letter accelerator via the `~X~` tilde convention (a menu title, a
 * button, a tab, a checkbox). Within one focus scope only the *first* claimant of a given letter is
 * reachable, so a second claim is a silent bug. {@link findDuplicateAccelerators} detects those
 * within-scope collisions from a plain char list — it is view-free and fully deterministic — and
 * {@link reportDuplicateAccelerators} runs it and emits a development-only warning per collision.
 */
import { devWarn } from '../shared/warnings.js';

/** One within-scope accelerator collision: the shared (lowercase) char and the claiming indices, in order. */
export interface DuplicateAccelerator {
  /** The colliding accelerator character, lowercased. */
  readonly char: string;
  /** The 0-based positions in the input list that claim this char, in first-appearance order. */
  readonly indices: number[];
}

/**
 * Find every accelerator character claimed by more than one entry, case-insensitively. Pure — no
 * view or reactive dependency, so it is directly unit-testable.
 *
 * Pass one accelerator char (or `''`) per scope entry, in scope order: `''`/absent entries (menu
 * separators, items with no `~X~`) are ignored and never grouped. Each returned group lists the
 * claiming indices in order; only chars claimed twice or more appear, in first-appearance order.
 *
 * @param chars One accelerator char (lowercase or any case) or `''` per scope entry, in scope order.
 * @returns The collisions, one group per over-claimed char; `[]` when every char is unique.
 * @example
 * import { findDuplicateAccelerators } from '@jsvision/ui';
 *
 * findDuplicateAccelerators(['f', 'e', 'o']);      // [] — all distinct
 * findDuplicateAccelerators(['x', '', 'X']);       // [{ char: 'x', indices: [0, 2] }]
 */
export function findDuplicateAccelerators(chars: readonly string[]): DuplicateAccelerator[] {
  // Map preserves insertion order, so grouping by lowercased char keeps first-appearance order.
  const groups = new Map<string, number[]>();
  chars.forEach((raw, index) => {
    if (raw === '') return; // separators / no-hotkey entries never collide
    const char = raw.toLowerCase();
    const bucket = groups.get(char);
    if (bucket === undefined) groups.set(char, [index]);
    else bucket.push(index);
  });

  const out: DuplicateAccelerator[] = [];
  for (const [char, indices] of groups) {
    if (indices.length >= 2) out.push({ char, indices });
  }
  return out;
}

/**
 * Run {@link findDuplicateAccelerators} over a scope's accelerator chars and emit one dev-only warning
 * per collision (silent under `NODE_ENV=production`). When `labels` is supplied (parallel to `chars`),
 * the message names the colliding entries; otherwise it names the char and the claim count.
 *
 * @param scope  The subsystem tag for the warning prefix (`'menu'`, `'dialog'`, `'tabs'`).
 * @param chars  One accelerator char (or `''`) per scope entry, in scope order.
 * @param labels Optional display labels parallel to `chars`, used to name the colliding entries.
 * @example
 * import { reportDuplicateAccelerators } from '@jsvision/ui';
 *
 * // Warns once (in development): duplicate accelerator 'x' — "Exit", "Export" share it …
 * reportDuplicateAccelerators('menu', ['x', '', 'x'], ['Exit', '', 'Export']);
 */
export function reportDuplicateAccelerators(scope: string, chars: readonly string[], labels?: readonly string[]): void {
  for (const dup of findDuplicateAccelerators(chars)) {
    const named =
      labels !== undefined
        ? dup.indices.map((i) => `"${labels[i] ?? ''}"`).join(', ')
        : `${dup.indices.length} entries`;
    devWarn(scope, `duplicate accelerator '${dup.char}' — ${named} share it; only the first is reachable`);
  }
}
