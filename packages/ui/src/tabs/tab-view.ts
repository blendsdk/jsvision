/**
 * `TabView` — a self-contained, folder-tab container widget. See the {@link TabView} class for the
 * full description and a worked example. Dropping one into any `Group`/`Window`/`Dialog` is complete:
 * it draws both the tab strip and the surrounding content frame.
 *
 * Key behaviours a caller should know:
 *
 * **Content stays mounted.** Every `Tab.content` page is built up-front and kept mounted; switching
 * tabs only flips which page is visible. A widget's text, scroll position, and focus on an inactive
 * page therefore survive being switched away from and back to. Pages are keyed by content identity,
 * so reordering or closing a tab reuses the live page rather than rebuilding it.
 *
 * **`active` is clamped for you.** The `active` signal is caller-owned, so the view self-corrects it
 * at render time: it clamps `active` into range and snaps forward off a disabled tab whenever
 * `active` or `tabs` changes, from any writer (including a raw `active.set`). An empty or all-disabled
 * set shows no page.
 *
 * **Keyboard scoping.** Ctrl+PageUp/Down and the Alt+letter hotkeys act only on the `TabView` that
 * currently owns focus, so two or nested tab views can coexist without stealing each other's chords.
 * `←`/`→` cycle tabs while the strip holds focus; plain Tab/Shift-Tab move focus into and through the
 * active page's content as usual.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { For } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { LayoutProps } from '../layout/index.js';
import { parseTilde } from '../menu/builders.js';
import { reportDuplicateAccelerators } from '../menu/accelerators.js';
import { TabStrip, TAB_GLYPHS } from './tab-strip.js';

/**
 * A single tab descriptor. `title` carries optional `~X~` hotkey markup (e.g. `'~G~eneral'` marks
 * `Alt+G`).
 */
export interface Tab {
  /** Tab label; wrap the hotkey letter in tildes (`~X~`) to mark the Alt-hotkey. Sanitized on draw. */
  readonly title: string;
  /** The page shown when this tab is active. Built up-front and kept mounted while other tabs show. */
  readonly content: Group;
  /** When true, the tab is drawn greyed, cannot be activated, and is skipped by cycling/hotkeys. */
  readonly disabled?: boolean;
  /** When true, the label draws a `×`; clicking it removes the tab and fires `onClose`. */
  readonly closeable?: boolean;
}

/** Constructor options for {@link TabView}. */
export interface TabViewOptions {
  /** Caller-owned reactive tab list. */
  readonly tabs: Signal<Tab[]>;
  /** Caller-owned active-index signal; clamped to the tab count at render time. */
  readonly active: Signal<number>;
  /** Fired after a tab is removed via its `×` close mark. */
  readonly onClose?: (tab: Tab, index: number) => void;
  /** Fired when the effective active index changes. */
  readonly onChange?: (index: number) => void;
}

// ---------------------------------------------------------------------------------------------------
// View-free navigation helpers — pure and deterministic.
// ---------------------------------------------------------------------------------------------------

/** Clamp `i` into `[0, len-1]`; returns 0 for an empty list (callers bounds-check before indexing). */
export function clampActive(i: number, len: number): number {
  if (len <= 0) return 0;
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(Math.floor(i), len - 1));
}

/** Index of the first enabled tab, or -1 if none / empty. */
export function firstEnabled(tabs: readonly Tab[]): number {
  for (let i = 0; i < tabs.length; i += 1) {
    if (tabs[i].disabled !== true) return i;
  }
  return -1;
}

/**
 * Next enabled index after `from` with wrap-around; returns `from` if it is the only enabled tab, and
 * -1 if no tab is enabled. A disabled `from` returns the next enabled tab found scanning forward.
 */
export function nextEnabled(tabs: readonly Tab[], from: number): number {
  const n = tabs.length;
  if (n === 0) return -1;
  for (let step = 1; step <= n; step += 1) {
    const i = (((from + step) % n) + n) % n;
    if (tabs[i].disabled !== true) return i;
  }
  return -1;
}

/** Previous enabled index before `from` with wrap; symmetric to {@link nextEnabled}. */
export function prevEnabled(tabs: readonly Tab[], from: number): number {
  const n = tabs.length;
  if (n === 0) return -1;
  for (let step = 1; step <= n; step += 1) {
    const i = (((from - step) % n) + n) % n;
    if (tabs[i].disabled !== true) return i;
  }
  return -1;
}

/** Neighbour index after removing `removedIndex` (the new length is `newLen`): the previous index if
 *  the last tab was removed, else the same position (the next tab shifts into the freed slot). */
export function neighbourAfterRemove(removedIndex: number, newLen: number): number {
  if (newLen <= 0) return 0;
  if (removedIndex >= newLen) return newLen - 1; // removed the last tab → its previous neighbour
  return removedIndex; // else the tab that shifted into the freed slot
}

/** True if `leaf` is `root` or a descendant of `root` (walks `.parent`) — used to gate the global
 *  switch chords + Alt-hotkeys to whichever `TabView` currently owns focus. */
export function isWithin(leaf: View | null, root: View): boolean {
  let node: View | null = leaf;
  while (node !== null) {
    if (node === root) return true;
    node = node.parent;
  }
  return false;
}

/** Resolve a raw `active` to a valid VISIBLE tab: clamp into range, then snap forward off a disabled
 *  tab; -1 for empty / all-disabled (no page shown). */
function resolveActive(raw: number, tabs: readonly Tab[]): number {
  if (tabs.length === 0) return -1;
  const c = clampActive(raw, tabs.length);
  return tabs[c].disabled === true ? nextEnabled(tabs, c) : c;
}

// ---------------------------------------------------------------------------------------------------
// TabBody — the internal bordered content region (side `│` + bottom `└─┘`), hosting the pages.
// ---------------------------------------------------------------------------------------------------

/** The bordered content region below the strip: draws the side + bottom frame; pages inset by padding. */
class TabBody extends Group {
  /** Column of pages; padding insets them inside the `│` sides and above the `└─┘` bottom (the top joins the strip). */
  override layout: LayoutProps = {
    direction: 'col',
    size: { kind: 'fr', weight: 1 },
    padding: { top: 0, left: 1, right: 1, bottom: 1 },
  };

  /** Draw the side `│` borders + the `└─┘` bottom in the neutral gray frame colour, over an opaque fill. */
  override draw(ctx: DrawContext): void {
    const { width: w, height: h } = ctx.size;
    if (w < 2 || h < 1) return;
    const chrome = ctx.color('staticText'); // neutral gray line colour
    ctx.fill(' ', chrome); // opaque interior so a page insets over a solid field
    for (let row = 0; row < h - 1; row += 1) {
      ctx.text(0, row, TAB_GLYPHS.v, chrome);
      ctx.text(w - 1, row, TAB_GLYPHS.v, chrome);
    }
    // Bottom edge: `└` + `─`… + `┘` (the strip already drew the top corners `┌`/`┐` on row 0 above).
    ctx.text(0, h - 1, TAB_GLYPHS.bl, chrome);
    for (let col = 1; col < w - 1; col += 1) ctx.text(col, h - 1, TAB_GLYPHS.h, chrome);
    ctx.text(w - 1, h - 1, TAB_GLYPHS.br, chrome);
  }
}

// ---------------------------------------------------------------------------------------------------
// TabView — the public container.
// ---------------------------------------------------------------------------------------------------

/**
 * A tabbed layout container: a folder-tab strip over a bordered, one-page-at-a-time content region.
 * Each {@link Tab} pairs a title with a content `Group`; all pages stay mounted, so switching tabs
 * preserves each page's state (see the file overview for the full behaviour notes).
 *
 * Keyboard: Ctrl+PageUp/Down cycle enabled tabs, Alt+letter jumps to a `~X~`-marked tab, and `←`/`→`
 * cycle while the strip holds focus. Mouse: click a tab to activate it, click a closeable tab's `×`
 * to remove it, or click the `◄`/`►` arrows to scroll an overflowing strip. Both `tabs` and `active`
 * are caller-owned signals you can read and drive from outside.
 *
 * The strip is the focus target — focus the exposed {@link TabView.strip}, not the view.
 *
 * @example
 * import { Group, Text, TabView, createEventLoop, signal } from '@jsvision/ui';
 * import type { Tab } from '@jsvision/ui';
 *
 * const page = (line: string): Group => {
 *   const g = new Group();
 *   g.add(new Text(line));
 *   return g;
 * };
 *
 * const tabs = signal<Tab[]>([
 *   { title: '~G~eneral', content: page('General settings') },
 *   { title: '~D~isplay', content: page('Display options'), closeable: true },
 *   { title: '~A~dvanced', content: page('Advanced'), disabled: true },
 * ]);
 * const active = signal(0);
 *
 * const view = new TabView({
 *   tabs,
 *   active,
 *   onChange: (i) => console.log('switched to tab', i),
 *   onClose: (tab) => console.log('closed', tab.title),
 * });
 * view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 10 } };
 *
 * const root = new Group();
 * root.add(view);
 * const loop = createEventLoop({ width: 40, height: 10 });
 * loop.mount(root);
 * loop.focusView(view.strip); // focus the strip, not the view
 */
export class TabView extends Group {
  /** Handle the global switch chords in the pre-process sweep (scoped to the focus-owning tab view). */
  override preProcess = true;
  /** Roots its own accelerator scope — an enclosing Dialog's duplicate check stops at the strip. */
  override acceleratorScope = true;

  /** The caller-owned reactive tab list. */
  readonly tabs: Signal<Tab[]>;
  /** The caller-owned active-index signal (clamped at render time). */
  readonly active: Signal<number>;
  /** The focusable strip renderer — focus this (a plain `Group` is not itself a focus target). */
  readonly strip: TabStrip;

  private readonly body: TabBody;
  private readonly onCloseCb?: (tab: Tab, index: number) => void;
  private readonly onChangeCb?: (index: number) => void;
  /** The last effective active index reported via `onChange` (dedupe; init to the resolved initial). */
  private lastActive: number;

  /**
   * @param opts The tab view configuration — see {@link TabViewOptions}.
   */
  constructor(opts: TabViewOptions) {
    super();
    this.tabs = opts.tabs;
    this.active = opts.active;
    this.onCloseCb = opts.onClose;
    this.onChangeCb = opts.onChange;
    this.lastActive = resolveActive(this.active(), this.tabs());

    this.strip = new TabStrip({
      tabs: () => this.tabs(),
      active: () => resolveActive(this.active(), this.tabs()),
      onSelect: (i) => this.select(i),
      onClose: (i) => this.closeTab(i),
      onCycle: (dir) => (dir < 0 ? this.prev() : this.next()),
    });
    this.strip.layout = { size: { kind: 'fixed', cells: 1 } };

    this.body = new TabBody();
    // Build every page up-front, keyed by the content Group's identity so a reorder/close reuses the
    // live page rather than tearing it down and losing its state.
    this.body.addDynamic(() =>
      For(
        () => this.tabs(),
        (t) => t.content,
        (t) => {
          t.content.layout = { size: { kind: 'fr', weight: 1 } };
          return t.content;
        },
      ),
    );

    // Inner column container: keeps the strip stacked above the body regardless of how the parent
    // places the TabView (an absolute rect or an `fr` flow slot both leave the TabView's own `layout`
    // free, so placing the view never clobbers the internal stacking direction).
    const inner = new Group();
    inner.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
    inner.add(this.strip);
    inner.add(this.body);
    this.add(inner);

    // Self-correcting clamp + one-page-visible flip + onChange. Bound on mount (when the reactive
    // scope exists); re-runs on any `active` or `tabs` change, from any writer.
    this.onMount(() => {
      this.bind(
        () => [this.tabs(), this.active()] as const,
        () => this.syncActive(),
        { relayout: true },
      );
      // Dev-only: flag two tabs whose `~X~` hotkeys collide (strip tabs only — page contents are a
      // separate focus interaction and are not walked). Checked once against the initial tab set.
      const list = this.tabs();
      reportDuplicateAccelerators(
        'tabs',
        list.map((t) => parseTilde(t.title).hotkey ?? ''),
        list.map((t) => parseTilde(t.title).text),
      );
    });
  }

  /** Recompute the effective active tab, correct a drifted `active`, flip page visibility, notify. */
  private syncActive(): void {
    const list = this.tabs();
    const raw = this.active();
    const effective = resolveActive(raw, list);
    // Correct the caller's signal if it drifted outside the valid (enabled) set — a no-op write when
    // already valid (so the effect converges); left untouched when all-disabled/empty (show nothing).
    if (effective >= 0 && effective !== raw) this.active.set(effective);
    for (let i = 0; i < list.length; i += 1) list[i].content.state.visible = i === effective;
    if (effective !== this.lastActive && effective >= 0) {
      this.lastActive = effective;
      this.onChangeCb?.(effective);
    }
  }

  /**
   * Set the active tab to `i`, clamped into range; a disabled target is skipped forward to the next
   * enabled tab (or left unchanged if none is enabled).
   *
   * @param i The requested tab index (clamp-checked).
   */
  select(i: number): void {
    const list = this.tabs();
    if (list.length === 0) return;
    let c = clampActive(i, list.length);
    if (list[c].disabled === true) c = nextEnabled(list, c);
    if (c >= 0) this.active.set(c);
  }

  /** Advance the active tab to the next enabled tab (wrap). Reused by Ctrl+PageDown / `→`. */
  next(): void {
    const target = nextEnabled(this.tabs(), this.active());
    if (target >= 0) this.active.set(target);
  }

  /** Retreat the active tab to the previous enabled tab (wrap). Reused by Ctrl+PageUp / `←`. */
  prev(): void {
    const target = prevEnabled(this.tabs(), this.active());
    if (target >= 0) this.active.set(target);
  }

  /**
   * Remove tab `i` from the `tabs` signal, fire `onClose(tab, i)`, and re-clamp `active` toward the
   * neighbouring tab. Out-of-range `i` is a safe no-op.
   *
   * @param i The tab index to close.
   */
  closeTab(i: number): void {
    const list = this.tabs();
    if (i < 0 || i >= list.length) return;
    const tab = list[i];
    const next = list.slice(0, i).concat(list.slice(i + 1));
    const cur = this.active();
    this.tabs.set(next);
    // Steer `active` toward the neighbour; the sync effect then re-clamps + snaps off a disabled tab.
    let na = cur;
    if (i < cur)
      na = cur - 1; // a tab before the active one was removed → shift left
    else if (i === cur) na = neighbourAfterRemove(i, next.length); // the active tab was removed
    this.active.set(clampActive(na, next.length));
    this.onCloseCb?.(tab, i);
  }

  /**
   * Handle the global switch chords + Alt-hotkey, but only when this tab view owns focus.
   * Ctrl+PageUp/Down cycle enabled tabs; Alt+letter jumps to a `~X~`-matching enabled tab.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'key') return;
    // The pre-process sweep hits every TabView in scope; act only when focus is within THIS one.
    if (!isWithin(ev.getFocused?.() ?? null, this)) return;

    if (inner.ctrl && !inner.alt) {
      if (inner.key === 'pagedown') {
        this.next();
        ev.handled = true;
      } else if (inner.key === 'pageup') {
        this.prev();
        ev.handled = true;
      }
      return;
    }
    if (inner.alt && !inner.ctrl && inner.key.length === 1) {
      const target = this.hotkeyTarget(inner.key);
      if (target >= 0) {
        this.select(target);
        ev.handled = true;
      }
    }
  }

  /** The index of the first ENABLED tab whose `~X~` hotkey matches `letter` (case-insensitive), or -1. */
  private hotkeyTarget(letter: string): number {
    const key = letter.toLowerCase();
    const list = this.tabs();
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].disabled === true) continue;
      if (parseTilde(list[i].title).hotkey === key) return i;
    }
    return -1;
  }
}
