/**
 * `TabStrip` — the focusable `View` that draws the folder-tab strip + the top frame border and
 * hit-tests strip clicks (RD-17, 03-02). The renderer-split sibling of `tab-view.ts` (PA-4),
 * mirroring `ListRows`/`GridRows`/`GridHeader`: keeping the notched-label draw, the overflow
 * `◄`/`►` arrows + auto-scroll, the per-tab `×`, and the click→(tab/close/arrow) hit-test here keeps
 * `tab-view.ts` ≤ 500 (AC-12).
 *
 * **RD-17 has NO Turbo Vision counterpart** (GATE-1, AR-172) — TV had no tab/notebook class. This is
 * a *documented new component* under the extension latitude of the fidelity directive; every *piece*
 * is grounded in a shipped, already-decoded facility. The glyphs are pinned at plan GATE-1
 * (`plans/tabs/03-03-theme-packaging.md §GATE-1`, task 1.1.1): the line/corner code points are
 * identical to `window/frame.ts`'s `SINGLE_BORDER` (which ships no tee and keeps its consts private,
 * PA-2), plus the four tab-junction tees decoded fresh — all **unambiguous-narrow** (width 1):
 *
 *   `─` U+2500 (CP437 0xC4) · `│` U+2502 (0xB3) · `┌` U+250C (0xDA) · `┐` U+2510 (0xBF) ·
 *   `└` U+2514 (0xC0) · `┘` U+2518 (0xD9). The four tab-junction tees `┬` U+252C (0xC2) · `┴` U+2534
 *   (0xC1) · `├` U+251C (0xC3) · `┤` U+2524 (0xB4) are also decoded + retained in {@link TAB_GLYPHS}
 *   as the GATE-1 reference set, though the adopted button-face design joins tabs with a plain `─`
 *   dash gap rather than drawing a `┬` notch.
 *
 * **Adopted design (post-spike):** tabs render as raised **button faces** (green, no drop-shadow) —
 * active = `tabActive` `0x2F` white-on-green, inactive = `tabInactive` `0x20` black-on-green (both with
 * the `0x2E` yellow `~X~` shortcut on every enabled tab), disabled = `tabDisabled` `0x28` darkGray-
 * on-green (green-dimmed, so it stays part of the strip). The frame chrome (corners/edges/`─` gaps/
 * arrows) draws in {@link staticText} `0x70` black-on-lightGray (the neutral gray line), NOT a tab role.
 *
 * **GATE-2 (AFTER-diff) — ✅ matches.** The rendered strip is diffed cell-by-cell against this decode:
 * `tab-strip.impl.test.ts` asserts every glyph's code point equals its CP437↔Unicode decode, and
 * `tabs.spec.test.ts`/`tab-strip.spec.test.ts` (ST-18/19/20/21) assert the composed buffer's
 * corners/edges/`─` gap/`×` glyphs + the active(`tabActive`)/inactive(`tabInactive`)/disabled
 * (`tabDisabled`) foregrounds. No TV `.cpp` is re-opened (none exists); the diff is against the
 * GATE-1 decode itself (AR-172/173/180/184).
 *
 * Colour: labels draw in `tabActive`/`tabInactive`/`tabDisabled`; the `~X~` marked letter in the role's
 * `hotkey` accent (`tildeSegments`, as `Label`/menus do). All writes go through `DrawContext` →
 * `ScreenBuffer` + core `sanitize` (the injection boundary, AC-14).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { signal } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import { parseTilde, tildeSegments } from '../menu/builders.js';
import { stringWidth } from '../controls/measure.js';

/**
 * Folder-tab box glyphs (GATE-1 decode, task 1.1.1). Line/corner code points match
 * `window/frame.ts`'s `SINGLE_BORDER` verbatim (kept local per PA-2 — frame.ts's consts are
 * module-private and ship no tee). The four tab-junction tees are the only fresh decode.
 */
export const TAB_GLYPHS = {
  h: '─', // ─  CP437 0xC4
  v: '│', // │  CP437 0xB3
  tl: '┌', // ┌  CP437 0xDA
  tr: '┐', // ┐  CP437 0xBF
  bl: '└', // └  CP437 0xC0
  br: '┘', // ┘  CP437 0xD9
  tdown: '┬', // ┬  CP437 0xC2 — tab/frame-top notch (between-tabs separator)   [GATE-1 tee]
  tup: '┴', // ┴  CP437 0xC1                                                    [GATE-1 tee]
  tright: '├', // ├  CP437 0xC3                                                 [GATE-1 tee]
  tleft: '┤', // ┤  CP437 0xB4                                                  [GATE-1 tee]
} as const;

/** Overflow-scroll left arrow (shown only while the strip overflows). */
export const OVERFLOW_LEFT = '◄'; // ◄
/** Overflow-scroll right arrow. */
export const OVERFLOW_RIGHT = '►'; // ►
/** Closeable-tab mark (`×`; `×`, unambiguous-narrow — same choice as the window close box). */
export const CLOSE_MARK = '×'; // ×

/** A visible tab's on-strip placement (0-based strip-local columns). */
export interface TabSlot {
  /** Index into the `tabs()` array. */
  readonly index: number;
  /** The slot's leading (pad) column. */
  readonly x: number;
  /** The full slot width in columns (leading pad + label + trailing pad + optional `×`). */
  readonly width: number;
  /** The label's display width (the `~X~`-stripped title, wide-glyph-aware). */
  readonly labelW: number;
  /** The `×` column when the tab is closeable, else absent. */
  readonly closeX?: number;
}

/** The strip's laid-out geometry — shared by `draw` + `hitStrip` so they never disagree (03-02). */
export interface StripGeometry {
  /** The visible tab slots (off-strip tabs are clipped/omitted under overflow). */
  readonly slots: readonly TabSlot[];
  /** Whether the strip overflows to the left (there is a hidden tab before the first visible one). */
  readonly showLeftArrow: boolean;
  /** Whether the strip overflows to the right (there is a hidden tab after the last visible one). */
  readonly showRightArrow: boolean;
  /** The `◄` column (valid only when {@link showLeftArrow}). */
  readonly leftArrowX: number;
  /** The `►` column (valid only when {@link showRightArrow}). */
  readonly rightArrowX: number;
  /** The effective first-visible tab index (auto-scrolled so the active tab is fully on-strip). */
  readonly firstVisible: number;
}

/** A resolved strip click (mirrors `GridHeader.onEvent`'s `local.x`→target mapping). */
export type StripHit =
  | { readonly kind: 'tab'; readonly index: number }
  | { readonly kind: 'close'; readonly index: number }
  | { readonly kind: 'arrow'; readonly dir: -1 | 1 };

/** The label text (tildes stripped) of a tab title. */
function labelText(title: string): string {
  return parseTilde(title).text;
}

/** The full drawn width of tab `t`: leading pad + label + trailing pad + (`×` + one trailing pad) when closeable. */
function slotWidth(t: Tab): number {
  return stringWidth(labelText(t.title)) + 2 + (t.closeable === true ? 2 : 0);
}

/** Minimal `Tab` shape the strip reads (the real {@link import('./tab-view.js').Tab}). */
interface Tab {
  readonly title: string;
  readonly disabled?: boolean;
  readonly closeable?: boolean;
}

/**
 * Compute the visible slots + overflow arrows for the current tabs/active/width, auto-scrolling so
 * the active tab is fully on-strip (AR-176). Pure — shared by `draw` and `hitStrip`.
 *
 * Layout (no overflow): `┌` at col 0, then abutting ` label ` slots separated by `┬`, then `─` fill
 * and `┐` at col `width-1`. Under overflow the interior window is `[2, width-3]` with `◄` at col 1
 * and `►` at col `width-2`; the first-visible index advances until the active slot fits the window.
 *
 * @param tabs        The tab descriptors.
 * @param active      The active tab index (already clamped by the container).
 * @param width       The strip width in columns.
 * @param scrollHint  The caller's current scroll offset (a first-visible index; re-clamped here).
 * @returns The laid-out {@link StripGeometry}.
 */
export function stripGeometry(tabs: readonly Tab[], active: number, width: number, scrollHint: number): StripGeometry {
  const n = tabs.length;
  if (n === 0 || width < 3) {
    return { slots: [], showLeftArrow: false, showRightArrow: false, leftArrowX: 0, rightArrowX: 0, firstVisible: 0 };
  }

  // Total width needed to draw every slot + separators inside the corners (cols 1..width-2).
  let total = 0;
  for (let i = 0; i < n; i += 1) total += slotWidth(tabs[i]) + (i > 0 ? 1 : 0); // +1 for each `┬`
  const interior = width - 2; // cols between `┌` (0) and `┐` (width-1)

  if (total <= interior) {
    // No overflow: place every slot from col 1, separators between.
    const slots = placeSlots(tabs, 0, n, 1);
    return { slots, showLeftArrow: false, showRightArrow: false, leftArrowX: 0, rightArrowX: 0, firstVisible: 0 };
  }

  // Overflow: reserve col 1 for `◄` and col width-2 for `►`; the window is cols [2, width-3].
  const winStart = 2;
  const winEnd = width - 3; // inclusive last usable column
  const winWidth = Math.max(0, winEnd - winStart + 1);

  // Auto-scroll: choose the first-visible index so the (clamped) active slot fits fully in the window.
  let first = Math.max(0, Math.min(scrollHint, n - 1));
  if (active < first) first = active;
  // Advance `first` until the active slot's right edge fits within `winWidth` measured from `first`.
  for (;;) {
    let used = 0;
    let activeFits = false;
    for (let i = first; i < n; i += 1) {
      const w = slotWidth(tabs[i]) + (i > first ? 1 : 0);
      if (used + w > winWidth) break;
      used += w;
      if (i === active) {
        activeFits = true;
        break;
      }
    }
    if (activeFits || first >= active) break;
    first += 1;
  }

  // Place the slots that fit the window starting at `first`.
  const slots: TabSlot[] = [];
  let x = winStart;
  let used = 0;
  let last = first - 1;
  for (let i = first; i < n; i += 1) {
    const sep = i > first ? 1 : 0;
    const w = slotWidth(tabs[i]);
    if (used + sep + w > winWidth) break;
    x += sep;
    used += sep + w;
    slots.push(makeSlot(tabs[i], i, x));
    x += w;
    last = i;
  }

  return {
    slots,
    showLeftArrow: first > 0,
    showRightArrow: last < n - 1,
    leftArrowX: 1,
    rightArrowX: width - 2,
    firstVisible: first,
  };
}

/** Place slots `[from, to)` starting at column `startX`, `┬`-separated. */
function placeSlots(tabs: readonly Tab[], from: number, to: number, startX: number): TabSlot[] {
  const slots: TabSlot[] = [];
  let x = startX;
  for (let i = from; i < to; i += 1) {
    if (i > from) x += 1; // `┬` separator column
    slots.push(makeSlot(tabs[i], i, x));
    x += slotWidth(tabs[i]);
  }
  return slots;
}

/** Build one {@link TabSlot} for tab `t` at index `i`, leading pad at `x`. */
function makeSlot(t: Tab, i: number, x: number): TabSlot {
  const labelW = stringWidth(labelText(t.title));
  const width = labelW + 2 + (t.closeable === true ? 2 : 0);
  // `×` (when closeable) sits after the trailing pad, with one more pad after it: ` label × ` →
  // close col = x + 1 + labelW + 1.
  const closeX = t.closeable === true ? x + 1 + labelW + 1 : undefined;
  return { index: i, x, width, labelW, closeX };
}

/**
 * Map a strip-local click column to an action (mirrors `GridHeader.onEvent`). Arrow cells win over
 * a slot that shares the column; the `×` of a closeable tab wins over its own label.
 *
 * @param geo    The current strip geometry.
 * @param localX The strip-local (0-based) click column.
 * @returns The resolved {@link StripHit}, or `undefined` for a gap / corner / frame click.
 */
export function hitStrip(geo: StripGeometry, localX: number): StripHit | undefined {
  if (geo.showLeftArrow && localX === geo.leftArrowX) return { kind: 'arrow', dir: -1 };
  if (geo.showRightArrow && localX === geo.rightArrowX) return { kind: 'arrow', dir: 1 };
  for (const slot of geo.slots) {
    if (slot.closeX !== undefined && localX === slot.closeX) return { kind: 'close', index: slot.index };
    if (localX >= slot.x && localX < slot.x + slot.width) return { kind: 'tab', index: slot.index };
  }
  return undefined;
}

/** The callbacks + reactive state a {@link TabStrip} needs from its owning `TabView`. */
export interface TabStripConfig {
  /** The (caller-owned) tab descriptors. */
  readonly tabs: () => Tab[];
  /** The (clamped) active tab index. */
  readonly active: () => number;
  /** Activate tab `i` (a label click). */
  readonly onSelect: (index: number) => void;
  /** Close tab `i` (a `×` click). */
  readonly onClose: (index: number) => void;
  /** Cycle prev/next enabled tab (`←`/`→` while focused). */
  readonly onCycle: (dir: -1 | 1) => void;
}

/** The focusable strip renderer: draws row 0 + the top border and hit-tests strip clicks. */
export class TabStrip extends View {
  override focusable = true;
  /** The overflow scroll offset (a first-visible tab index); owned here, clamped by `stripGeometry`. */
  private readonly scroll: Signal<number> = signal(0);
  private readonly cfg: TabStripConfig;

  /**
   * @param cfg The tabs/active accessors + activate/close/cycle callbacks from the owning `TabView`.
   */
  constructor(cfg: TabStripConfig) {
    super();
    this.cfg = cfg;
    // Repaint when the tabs, the active index, or the scroll offset changes.
    this.onMount(() => {
      this.bind(() => this.cfg.tabs());
      this.bind(() => this.cfg.active());
      this.bind(() => this.scroll());
    });
  }

  /** The current geometry for the laid-out width (shared by draw + hit-test). */
  private geometry(width: number): StripGeometry {
    return stripGeometry(this.cfg.tabs(), this.cfg.active(), width, this.scroll());
  }

  /**
   * Draw row 0: the tab labels notched into the top frame border (`┌ label ┬ label ─┐`), with the
   * active/inactive/disabled colouring, the `~X~` hotkey accent, the `×` on closeable tabs, and the
   * `◄`/`►` arrows when overflowing.
   *
   * @param ctx The clipped, view-local paint context (the strip is one row tall).
   */
  override draw(ctx: DrawContext): void {
    const width = ctx.size.width;
    if (width < 2) return;
    const chrome = ctx.color('staticText'); // neutral gray frame/line colour (tab* are now green faces)
    const tabs = this.cfg.tabs();
    const active = this.cfg.active();
    const geo = this.geometry(width);

    // Base: `┌` … `─` fill … `┐`, all in the frame colour. Slots + notches overdraw the fill.
    ctx.fillRect(0, 0, width, 1, TAB_GLYPHS.h, chrome);
    ctx.text(0, 0, TAB_GLYPHS.tl, chrome);
    ctx.text(width - 1, 0, TAB_GLYPHS.tr, chrome);

    for (let s = 0; s < geo.slots.length; s += 1) {
      const slot = geo.slots[s];
      const tab = tabs[slot.index];
      // Tabs abut with a plain `─` gap — the base row fill already supplies it, so no per-slot
      // separator glyph is drawn (the button-face design uses a flat dash, not a `┬` notch).
      this.drawLabel(ctx, slot, tab, slot.index === active);
      if (slot.closeX !== undefined)
        ctx.text(slot.closeX, 0, CLOSE_MARK, ctx.color(this.roleOf(tab, slot.index === active)));
    }

    if (geo.showLeftArrow) ctx.text(geo.leftArrowX, 0, OVERFLOW_LEFT, chrome);
    if (geo.showRightArrow) ctx.text(geo.rightArrowX, 0, OVERFLOW_RIGHT, chrome);
  }

  /** The theme role for a tab given its active/disabled state (the button-face `tab*` roles). */
  private roleOf(tab: Tab, isActive: boolean): 'tabActive' | 'tabInactive' | 'tabDisabled' {
    if (tab.disabled === true) return 'tabDisabled';
    return isActive ? 'tabActive' : 'tabInactive';
  }

  /** Draw one tab's ` label ` cells: pad, then `~X~`-coloured segments, in the tab's role. */
  private drawLabel(ctx: DrawContext, slot: TabSlot, tab: Tab, isActive: boolean): void {
    const roleName = this.roleOf(tab, isActive);
    const style = ctx.color(roleName);
    const raw = ctx.role(roleName);
    const hotStyle = { fg: raw.hotkey ?? style.fg, bg: style.bg };
    // Blank the whole slot in the role colour (pads + label field), then draw the label segments.
    ctx.fillRect(slot.x, 0, slot.width, 1, ' ', style);
    const labelStart = slot.x + 1; // after the leading pad
    if (tab.disabled === true) {
      // Disabled: no hotkey accent — draw the plain label text in the greyed role.
      ctx.text(labelStart, 0, labelText(tab.title), style);
      return;
    }
    for (const seg of tildeSegments(tab.title)) {
      ctx.text(labelStart + seg.col, 0, seg.text, seg.hot ? hotStyle : style);
    }
  }

  /**
   * Hit-test strip clicks and handle `←`/`→` cycling while focused (AR-179). Ctrl+PageUp/Down and the
   * Alt-hotkey are handled at the `TabView` level (global via `preProcess`), not here.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type === 'mouse' && inner.kind === 'down') {
      const local = ev.local;
      if (local === undefined) return;
      const hit = hitStrip(this.geometry(this.bounds.width), local.x);
      if (hit === undefined) return;
      if (hit.kind === 'tab') this.cfg.onSelect(hit.index);
      else if (hit.kind === 'close') this.cfg.onClose(hit.index);
      else this.scroll.set(this.scroll() + hit.dir); // `stripGeometry` re-clamps next draw
      ev.handled = true;
      return;
    }
    if (inner.type === 'key' && !inner.ctrl && !inner.alt) {
      if (inner.key === 'left') {
        this.cfg.onCycle(-1);
        ev.handled = true;
      } else if (inner.key === 'right') {
        this.cfg.onCycle(1);
        ev.handled = true;
      }
    }
  }
}
