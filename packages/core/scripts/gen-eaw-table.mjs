#!/usr/bin/env node
/**
 * Dev-only generator for the render `WIDE` table (RD-13 HR-19 / PA-18).
 *
 * Derives the East-Asian Wide (`W`) + Fullwidth (`F`) code-point ranges from the Unicode
 * `EastAsianWidth.txt` data file and prints a ready-to-paste `const WIDE` TypeScript table
 * (merging adjacent/overlapping ranges). It is **not shipped, not a build step, and not run in CI**
 * — it exists so the checked-in table in `src/engine/render/width.ts` is a documented derivation of
 * the Unicode standard rather than a hand-guessed list. Zero runtime deps: the published package
 * never imports this.
 *
 * Usage:
 *   node packages/core/scripts/gen-eaw-table.mjs path/to/EastAsianWidth.txt
 *
 * Get the data file (version pinned in the table JSDoc — currently 15.1.0):
 *   https://www.unicode.org/Public/15.1.0/ucd/EastAsianWidth.txt
 *
 * The emitted ranges are the strict `W`/`F` set; the checked-in table additionally coarsens a few
 * whole CJK/Kana/emoji blocks (documented in width.ts) — a safe over-approximation for a TUI.
 */
import { readFileSync } from 'node:fs';

/** Parse `EastAsianWidth.txt`, returning sorted, merged `[lo, hi]` ranges for width classes W and F. */
function parseWideRanges(text) {
  /** @type {Array<[number, number]>} */
  const ranges = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.split('#')[0].trim(); // strip comments
    if (line === '') continue;
    const [codes, prop] = line.split(';').map((s) => s.trim());
    if (prop !== 'W' && prop !== 'F') continue;
    const [loHex, hiHex] = codes.includes('..') ? codes.split('..') : [codes, codes];
    ranges.push([parseInt(loHex, 16), parseInt(hiHex, 16)]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  // Merge adjacent/overlapping ranges so the binary search stays on a non-overlapping table.
  /** @type {Array<[number, number]>} */
  const merged = [];
  for (const [lo, hi] of ranges) {
    const last = merged[merged.length - 1];
    if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi);
    else merged.push([lo, hi]);
  }
  return merged;
}

/** Format one merged range as a `width.ts` table row. */
function formatRow([lo, hi]) {
  const hex = (n) => `0x${n.toString(16)}`;
  return `  [${hex(lo)}, ${hex(hi)}],`;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node gen-eaw-table.mjs path/to/EastAsianWidth.txt');
    process.exit(1);
  }
  const ranges = parseWideRanges(readFileSync(file, 'utf8'));
  console.log('const WIDE: readonly Range[] = [');
  for (const range of ranges) console.log(formatRow(range));
  console.log('];');
  console.error(`// ${ranges.length} merged W/F ranges emitted`);
}

main();
