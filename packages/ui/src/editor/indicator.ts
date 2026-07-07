/**
 * `Indicator` — the `line:col` strip in an `EditWindow`'s bottom border: a faithful `TIndicator`
 * port (RD-08 03-04).
 *
 * Decode (`tindictr.cpp:27-63`, glyphs `tvtext1.cpp:83-84`, re-verified 2026-07-07 @ 57b6f56):
 *   • NOT dragging → `getColor(1)` → `cpIndicator "\x02"` → `cpBlueWindow[2]=0x09` →
 *     **`indicatorNormal` `0x1F`** white-on-blue, filled with `dragFrame` `\xCD` **═** U+2550.
 *   • Dragging (`sfDragging`) → `getColor(2)` → **`indicatorDragging` `0x1A`**
 *     brightGreen-on-blue, filled with `normalFrame` `\xC4` **─** U+2500 — bound to the PA-3
 *     reactive `Window.dragging` signal via the nearest window ancestor (structurally duck-typed
 *     so `editor/` gains no `window/` import; no ancestor ⇒ resting state, the PA-3 edge).
 *   • `modified` ⇒ `putChar(0, 15)` — CP437 `\x0F` (☼) at column 0 (`:56-57`); rendered as `*`
     (see draw()) per the fidelity directive's unambiguous-narrow rule.
 *   • The location `" line:col "` (both 1-based) is right-aligned so the `:` sits at column 8
 *     (`moveStr(8 − colonIndex)`, `:60-63`).
 * `growMode = gfGrowLoY|gfGrowHiY` (`:34`) — the EditWindow's `onResized` re-pins the rect.
 * Values are plain signals, so `setValue` pushes coalesce into one repaint.
 * GATE-2 AFTER-diff (2026-07-07): rendered headlessly and diffed against the decode — the ═/─
 * state swap, both palette bytes, the colon-at-8 layout all match; the one recorded deviation is
 * the ☼ EAW two-cell width noted in draw(). No other mismatch.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { IndicatorTarget } from './editor.js';

/** Find the nearest ancestor carrying the PA-3 reactive drag signal (a `Window`), if any. */
function findDragSignal(v: View): Signal<boolean> | null {
  let cur = v.parent;
  while (cur !== null) {
    const candidate = (cur as unknown as { dragging?: unknown }).dragging;
    if (typeof candidate === 'function') return candidate as Signal<boolean>;
    cur = cur.parent;
  }
  return null;
}

/** The `line:col` indicator strip (satisfies the editor's PF-003 `IndicatorTarget` seam). */
export class Indicator extends View implements IndicatorTarget {
  override focusable = false;

  /** @internal The pushed 1-based position. */
  protected readonly pos = signal({ line: 1, col: 1 });
  /** @internal The pushed modified flag. */
  protected readonly modified = signal(false);
  /** @internal The bound window drag signal; `null` without a window ancestor (PA-3 edge). */
  protected drag: Signal<boolean> | null = null;

  constructor() {
    super();
    this.onMount(() => {
      this.drag = findDragSignal(this);
      // Repaint on every value/drag flip (draw() is not auto-tracked).
      this.bind(() => [this.pos(), this.modified(), this.drag?.() ?? false] as const);
    });
  }

  /** The `doUpdate` push (`teditor1.cpp:446-447`): 1-based `line:col` + the modified flag. */
  setValue(pos: { line: number; col: number }, modified: boolean): void {
    this.pos.set({ line: pos.line, col: pos.col });
    this.modified.set(modified);
  }

  /** Paint the strip per the decode: fill + optional ☼ + the colon-at-8 location. */
  override draw(ctx: DrawContext): void {
    const dragging = this.drag?.() ?? false;
    const style = ctx.color(dragging ? 'indicatorDragging' : 'indicatorNormal');
    const fill = dragging ? '─' : '═'; // normalFrame \xC4 while dragging, dragFrame \xCD resting
    ctx.fill(fill, style);
    // CP437 0x0F is ☼ U+263C (:56-57), but U+263C is East-Asian AMBIGUOUS — core's wcwidth mode
    // stores it as 2 cells while most terminal fonts render it 1, leaving a visible hole in the
    // bottom border. Per the fidelity directive's unambiguous-narrow rule we substitute `*`
    // (1 DOS cell in TV, 1 cell everywhere here — the DEF-23 family).
    if (this.modified()) ctx.text(0, 0, '*', style);
    const { line, col } = this.pos();
    const text = ` ${line}:${col} `;
    const colonIndex = text.indexOf(':');
    ctx.text(8 - colonIndex, 0, text, style); // the colon lands at column 8 (:63)
  }
}
