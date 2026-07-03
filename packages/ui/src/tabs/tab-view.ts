/**
 * `TabView` — a self-contained folder-tab container (RD-17, 03-01). A `Group` (the shipped container
 * idiom, AR-169: `ListView`/`Tree`/`DataGrid` all `extends Group`) owning a focusable {@link TabStrip}
 * (the focus target) + a bordered content region, one page visible at a time. It holds the data model
 * (`tabs`/`active` signals + callbacks), the navigation/cycle/clamp logic, and the one-page-visible
 * flip. Dropping a `TabView` into any `Group`/`Window`/`Dialog` is complete — it draws both the strip
 * and the surrounding frame (AR-174).
 *
 * **RD-17 has NO Turbo Vision counterpart** (GATE-1, AR-172); the fidelity work is the glyph/colour
 * decode captured in `tab-strip.ts` + core `theme.ts`. This file is the plain container behaviour.
 *
 * **Content model (AR-175, PF-001).** Every `Tab.content` is an eager child of the content region
 * (mounted up-front via a keyed `For` over `tabs`, keyed by the content `Group`'s identity so a
 * reorder/close reuses the live page). Exactly one page is visible via a reactive `effect` that sets
 * each page's `state.visible = (i === active)`; `reflow` omits the hidden pages. Switching is a
 * **visibility flip — no per-switch mount/dispose** (a widget's text/scroll/focus on an inactive page
 * survives). **Not** `Show`, which disposes the inactive branch (`reactive/show.ts`) and loses state.
 * `For` mounts/disposes only on a genuine `tabs` add/remove.
 *
 * **Clamp (AR-177, PF-003).** `active` is caller-owned, so clamping is **read/render-time**: a
 * self-correcting `effect` re-clamps `active` into `[0, len-1]` and snaps forward off a disabled tab
 * whenever `active` **or** `tabs` changes, from any writer (incl. a raw `active.set` bypassing
 * `select`). An all-disabled/empty set resolves to no visible page (a no-op, no infinite loop).
 *
 * **Nav scoping (AR-179/183, PF-002).** Ctrl+PageUp/Down + the Alt-hotkey are handled in
 * `preProcess` (which fires on *every* tab view in scope, `event/dispatch.ts`), so the handler
 * consumes the chord **only when `ev.getFocused()` is `this` or a descendant** ({@link isWithin}) —
 * targeting the correct panel when two/nested `TabView`s coexist. `←`/`→` are handled by the strip
 * when it holds focus; plain Tab/Shift-Tab fall through to RD-04 content-focus traversal. Ctrl+Tab is
 * byte-identical to plain Tab on today's terminals, so `event/dispatch.ts` consumes it as focus
 * traversal before `preProcess` — it never switches tabs (the DEF-2 keyboard-protocol gate, AR-183).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, View } from '../view/index.js';
import type { DrawContext, DispatchEvent } from '../view/index.js';
import { For } from '../reactive/index.js';
import type { Signal } from '../reactive/index.js';
import type { LayoutProps } from '../layout/index.js';
import { parseTilde } from '../menu/builders.js';
import { TabStrip, TAB_GLYPHS } from './tab-strip.js';

/**
 * A single tab descriptor. `title` carries optional `~X~` hotkey markup (parsed with `parseTilde`).
 * (AR-178)
 */
export interface Tab {
  /** Tab label; `~X~` marks the Alt-hotkey letter. Sanitized to the screen on draw. */
  readonly title: string;
  /** The page shown when this tab is active — an eager-built `Group` (all pages stay mounted, AR-175). */
  readonly content: Group;
  /** When true, drawn greyed, unactivatable, and skipped by all cycling/hotkeys (AR-176). */
  readonly disabled?: boolean;
  /** When true, the label draws a `×`; clicking it removes the tab + fires `onClose` (AR-176/178). */
  readonly closeable?: boolean;
}

/** Constructor options for {@link TabView}. */
export interface TabViewOptions {
  /** Caller-owned reactive tab list (AR-178). */
  readonly tabs: Signal<Tab[]>;
  /** Two-way active-index binding; clamped to the tab count at read/render-time (AR-177). */
  readonly active: Signal<number>;
  /** Fired after a tab is removed via its `×` (built-in handler) (AR-178). */
  readonly onClose?: (tab: Tab, index: number) => void;
  /** Fired when the active index changes (Should-Have, PA-1). */
  readonly onChange?: (index: number) => void;
}

// ---------------------------------------------------------------------------------------------------
// View-free helpers (unit-testable; AR-176/177). Exported for the impl tests.
// ---------------------------------------------------------------------------------------------------

/** Clamp `i` into `[0, len-1]`; returns 0 for an empty list (callers bounds-check before indexing). */
export function clampActive(i: number, len: number): number {
  if (len <= 0) return 0;
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(Math.floor(i), len - 1));
}

/** Index of the first enabled tab, or -1 if none / empty (snap-to-first-enabled, PA-1). */
export function firstEnabled(tabs: readonly Tab[]): number {
  for (let i = 0; i < tabs.length; i += 1) {
    if (tabs[i].disabled !== true) return i;
  }
  return -1;
}

/**
 * Next enabled index after `from` with wrap; returns `from` if it is the only enabled tab, and -1 if
 * no tab is enabled (the all-disabled no-op, AR-176 / AC-15). A disabled `from` returns the next
 * enabled tab found scanning forward (never `from`).
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

/** Neighbour index after removing `removedIndex` (the new length is `newLen`): prev if it was last,
 *  else the same position (the next tab shifts into the slot) (AR-177). */
export function neighbourAfterRemove(removedIndex: number, newLen: number): number {
  if (newLen <= 0) return 0;
  if (removedIndex >= newLen) return newLen - 1; // removed the last tab → its previous neighbour
  return removedIndex; // else the tab that shifted into the freed slot
}

/** True if `leaf` is `root` or a descendant of `root` (walks `.parent`) — the PF-002 focus-scoping
 *  predicate that gates the global chord + Alt-hotkey to the focus-owning `TabView`. */
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
  /** Column of pages; `padding` insets them inside the `│` sides + above the `└─┘` bottom (top joins the strip). */
  override layout: LayoutProps = {
    direction: 'col',
    size: { kind: 'fr', weight: 1 },
    padding: { top: 0, left: 1, right: 1, bottom: 1 },
  };

  /** Draw the side `│` borders + the `└─┘` bottom in the neutral gray frame colour, over an opaque fill. */
  override draw(ctx: DrawContext): void {
    const { width: w, height: h } = ctx.size;
    if (w < 2 || h < 1) return;
    const chrome = ctx.color('staticText'); // neutral gray line (tab* roles are now green button faces)
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

/** A tabbed layout container: a folder-tab strip over a bordered, one-page-visible content region. */
export class TabView extends Group {
  /** Consume the global switch chords in the pre-process sweep (scoped to the focused subtree). */
  override preProcess = true;

  /** The caller-owned reactive tab list. */
  readonly tabs: Signal<Tab[]>;
  /** The caller-owned active-index signal (clamped at read/render-time). */
  readonly active: Signal<number>;
  /** The focusable strip renderer — the focus target (a `Group` is not itself a focus leaf, AR-169). */
  readonly strip: TabStrip;

  private readonly body: TabBody;
  private readonly onCloseCb?: (tab: Tab, index: number) => void;
  private readonly onChangeCb?: (index: number) => void;
  /** The last effective active index reported via `onChange` (dedupe; init to the resolved initial). */
  private lastActive: number;

  /**
   * @param opts `tabs` + `active` signals, plus optional `onClose`/`onChange` callbacks.
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
    // Eager pages, keyed by the content Group identity (a reorder/close reuses the live page, PF-001).
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

    // Inner column container: keeps `[strip 1 | body fr]` stacked regardless of how the parent places
    // the TabView (an absolute rect or an `fr` flow slot both leave the TabView's own `layout` free —
    // the DataGrid PF-101 idiom, so a caller's `at(view, …)` never clobbers the internal direction).
    const inner = new Group();
    inner.layout = { direction: 'col', size: { kind: 'fr', weight: 1 } };
    inner.add(this.strip);
    inner.add(this.body);
    this.add(inner);

    // Self-correcting clamp + one-page-visible flip + onChange (read/render-time, PF-003). Bound on
    // mount when the scope exists; re-runs on any `active` / `tabs` change from any writer.
    this.onMount(() => {
      this.bind(
        () => [this.tabs(), this.active()] as const,
        () => this.syncActive(),
        { relayout: true },
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
   * enabled tab (or left unchanged if none) (Should-Have, PA-1; AR-177).
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
   * Remove tab `i` from the `tabs` signal (the built-in `×` handler), fire `onClose(tab, i)`, and
   * re-clamp `active` toward the neighbour (AR-176/178). Out-of-range `i` is a safe no-op.
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
   * Route the global switch chords + Alt-hotkey in `preProcess`, scoped to the focus-owning `TabView`
   * (PF-002). Ctrl+PageUp/Down cycle enabled tabs; Alt+letter jumps to a `~X~`-matching enabled tab.
   *
   * @param ev The dispatch envelope.
   */
  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'key') return;
    // PF-002: the pre-process sweep hits every TabView in scope; act only when focus is within THIS one.
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
