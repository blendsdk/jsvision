/**
 * Display width of a Unicode code point — the single source of width truth for the
 * renderer.
 *
 * The buffer advances the cursor by these widths so wide CJK/emoji occupy two
 * columns and combining marks occupy none. Widths follow the Unicode East-Asian
 * Width property: Wide/Fullwidth → 2, Ambiguous → 2 only under
 * `widthMode: 'ambiguous-wide'`, combining/zero-width → 0, everything else → 1.
 *
 * Pure and capability-free: pass the terminal's `unicode.widthMode`.
 */

/**
 * Width-resolution mode. `'ambiguous-wide'` renders the East-Asian Ambiguous range
 * as width 2, which matches how CJK-context terminals lay it out; `'wcwidth'`
 * treats it as width 1.
 */
export type WidthMode = 'wcwidth' | 'ambiguous-wide';

/** An inclusive `[lo, hi]` code-point range. Tables below are sorted by `lo`. */
type Range = readonly [number, number];

/**
 * Zero-width code points: combining marks and explicit zero-width characters.
 * A documented core subset — enough for the common scripts a TUI encounters; not
 * the full Unicode `Mn`/`Me` set. Sorted ascending by `lo`.
 */
const ZERO_WIDTH: readonly Range[] = [
  [0x0300, 0x036f], // Combining Diacritical Marks
  [0x0483, 0x0489], // Cyrillic combining
  [0x0591, 0x05bd], // Hebrew points
  [0x05bf, 0x05bf],
  [0x0610, 0x061a], // Arabic
  [0x064b, 0x065f], // Arabic
  [0x0670, 0x0670],
  [0x06d6, 0x06dc], // Arabic
  [0x0e31, 0x0e31], // Thai
  [0x0e34, 0x0e3a],
  [0x200b, 0x200f], // Zero-width space / ZWNJ / ZWJ / directional marks
  [0xfeff, 0xfeff], // Zero-width no-break space (BOM)
];

/**
 * East-Asian Wide (`W`) and Fullwidth (`F`) code-point ranges.
 *
 * Derived from the Unicode 15.1.0 East-Asian Width data (`W` ∪ `F`), then merged with the adjacent
 * CJK/Kana super-blocks this renderer already treats as wide. A few entries are deliberate **coarse
 * over-approximations** (whole Misc-Symbols / emoji / supplementary-CJK blocks) — safe for a TUI
 * because rendering an unassigned code point two columns wide never desyncs the grid, whereas
 * under-counting a real wide glyph does. Sorted ascending by `lo`, non-overlapping (binary-searched).
 */
const WIDE: readonly Range[] = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x231a, 0x231b], // ⌚⌛ watch / hourglass
  [0x2329, 0x232a], // 〈 〉 angle brackets
  [0x23e9, 0x23ec], // ⏩⏪⏫⏬ media fast-forward group
  [0x23f0, 0x23f0], // ⏰ alarm clock
  [0x23f3, 0x23f3], // ⏳ hourglass flowing
  [0x25fd, 0x25fe], // ◽◾ medium-small squares
  [0x2600, 0x26ff], // Miscellaneous Symbols (coarse; emoji presentation, PL-10)
  [0x2705, 0x2705], // ✅ check mark
  [0x270a, 0x270b], // ✊✋ raised fist / hand
  [0x2728, 0x2728], // ✨ sparkles
  [0x274c, 0x274c], // ❌ cross mark
  [0x274e, 0x274e], // ❎ negative squared cross
  [0x2753, 0x2755], // ❓❔❕ question / exclamation ornaments
  [0x2757, 0x2757], // ❗ exclamation mark
  [0x2795, 0x2797], // ➕➖➗ heavy math signs
  [0x27b0, 0x27b0], // ➰ curly loop
  [0x27bf, 0x27bf], // ➿ double curly loop
  [0x2b1b, 0x2b1c], // ⬛⬜ large squares
  [0x2b50, 0x2b50], // ⭐ star
  [0x2b55, 0x2b55], // ⭕ heavy large circle
  [0x2e80, 0x303e], // CJK Radicals .. Kangxi .. CJK Symbols & Punctuation
  [0x3041, 0x33ff], // Hiragana .. Katakana .. CJK Compatibility
  [0x3400, 0x4dbf], // CJK Unified Ideographs Extension A
  [0x4e00, 0x9fff], // CJK Unified Ideographs
  [0xa000, 0xa4cf], // Yi Syllables / Radicals
  [0xa960, 0xa97c], // Hangul Jamo Extended-A
  [0xac00, 0xd7a3], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe10, 0xfe19], // Vertical Forms
  [0xfe30, 0xfe6f], // CJK Compatibility Forms / Small Form Variants
  [0xff00, 0xff60], // Fullwidth Forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x16fe0, 0x16fe4], // Tangut/Khitan iteration & filler marks
  [0x16ff0, 0x16ff1], // Vietnamese reading marks
  [0x17000, 0x187f7], // Tangut Ideographs
  [0x18800, 0x18cd5], // Tangut Components
  [0x18d00, 0x18d08], // Tangut Ideographs Supplement
  [0x1aff0, 0x1affe], // Kana Extended-B (coarse)
  [0x1b000, 0x1b2fb], // Kana Supplement / Extended-A / Small Kana Extension (coarse)
  [0x1f004, 0x1f004], // 🀄 mahjong red dragon
  [0x1f0cf, 0x1f0cf], // 🃏 joker
  [0x1f18e, 0x1f18e], // 🆎 AB blood type
  [0x1f191, 0x1f19a], // 🆑..🆚 squared latin abbreviations
  [0x1f200, 0x1f251], // Enclosed Ideographic Supplement (coarse)
  [0x1f260, 0x1f265], // 🉠..🉥 rounded symbols
  [0x1f300, 0x1faff], // Emoji: Misc Symbols & Pictographs .. Symbols Extended-A (coarse)
  [0x20000, 0x3fffd], // CJK Unified Ideographs Extension B+ (supplementary)
];

/**
 * East-Asian Ambiguous (`A`) ranges — width 2 only under `'ambiguous-wide'`.
 * A documented common subset (covers Latin-1 symbols, general punctuation,
 * arrows, Roman numerals); not the exhaustive `A` table. Sorted by `lo`.
 */
const AMBIGUOUS: readonly Range[] = [
  [0x00a1, 0x00a1], // ¡
  [0x00a4, 0x00a4],
  [0x00a7, 0x00a8],
  [0x00aa, 0x00aa],
  [0x00ad, 0x00ae],
  [0x00b0, 0x00b4],
  [0x00b6, 0x00ba],
  [0x00bc, 0x00bf],
  [0x2018, 0x2019], // ‘ ’
  [0x201c, 0x201d], // “ ”
  [0x2020, 0x2022],
  [0x2025, 0x2027],
  [0x2030, 0x2030],
  [0x2032, 0x2033],
  [0x203b, 0x203b],
  [0x2103, 0x2103], // ℃
  [0x2160, 0x216b], // Roman numerals Ⅰ..Ⅻ
  [0x2170, 0x2179],
  [0x2190, 0x2199], // Arrows
  [0x21d2, 0x21d2],
  [0x21d4, 0x21d4],
];

/** True when `cp` falls inside one of the sorted, non-overlapping `ranges`. */
function inRanges(cp: number, ranges: readonly Range[]): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [start, end] = ranges[mid];
    if (cp < start) hi = mid - 1;
    else if (cp > end) lo = mid + 1;
    else return true;
  }
  return false;
}

/**
 * Display width of a Unicode code point.
 *
 * @param codepoint The code point (e.g. from `String.prototype.codePointAt`).
 * @param widthMode From the terminal's `unicode.widthMode`; `'ambiguous-wide'`
 *   widens East-Asian Ambiguous characters to 2.
 * @returns 0 (C0/C1 control, combining, or zero-width), 2 (East-Asian Wide /
 *   Fullwidth / wide emoji, or Ambiguous under `'ambiguous-wide'`), else 1.
 * @example
 * import { charWidth } from '@jsvision/core';
 *
 * charWidth('A'.codePointAt(0)!, 'wcwidth'); // 1 — normal Latin letter
 * charWidth('漢'.codePointAt(0)!, 'wcwidth'); // 2 — wide CJK ideograph
 * charWidth(0x0301, 'wcwidth');               // 0 — combining acute accent
 */
export function charWidth(codepoint: number, widthMode: WidthMode): 0 | 1 | 2 {
  // C0 (incl. NUL) and C1 controls have no advance.
  if (codepoint < 0x20 || (codepoint >= 0x7f && codepoint < 0xa0)) return 0;
  if (inRanges(codepoint, ZERO_WIDTH)) return 0;
  if (inRanges(codepoint, WIDE)) return 2;
  if (widthMode === 'ambiguous-wide' && inRanges(codepoint, AMBIGUOUS)) return 2;
  return 1;
}
