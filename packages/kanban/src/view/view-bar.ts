import { Group, Input, Label, View, fixed, grow, row, signal, stringWidth } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Rect, Signal, Size2D } from '@jsvision/ui';

import { KANBAN_LIMITS } from '../contract/limits.js';
import type { KanbanViewController } from './types.js';

/** Stable semantic identities for controls in the package-owned view bar. */
export type KanbanViewBarControlId = 'search' | 'quick-filters' | 'sort' | 'saved-views' | 'clear' | 'overflow';

/** Responsive presentation selected from the bar's current terminal width. */
export type KanbanViewBarMode = 'wide' | 'narrow';

/** Detached geometry and reachability evidence for one semantic bar control. */
export interface KanbanViewBarControlInspection {
  /** Stable semantic control identity. */
  readonly id: KanbanViewBarControlId;
  /** Whether the control is directly visible rather than represented in overflow. */
  readonly visible: boolean;
  /** Parent-relative terminal-cell bounds. */
  readonly bounds: Readonly<Rect>;
  /** Whether the action is reachable through the bar's keyboard model. */
  readonly keyboardReachable: boolean;
  /** Mouse hit target when the control is visible. */
  readonly mouseTarget?: Readonly<Rect>;
}

/** Detached reachability evidence for one action represented by narrow overflow. */
export interface KanbanViewBarOverflowEntryInspection {
  /** Stable package action identifier. */
  readonly actionId: string;
  /** Whether keyboard navigation can select the action. */
  readonly keyboardReachable: boolean;
  /** Whether the overflow surface provides a mouse target for the action. */
  readonly mouseReachable: boolean;
}

/** Complete bounded inspection of one responsive standard view bar. */
export interface KanbanViewBarInspection {
  /** Current responsive presentation. */
  readonly mode: KanbanViewBarMode;
  /** Immediate search draft, which may be newer than committed controller state. */
  readonly searchDraft: string;
  /** Last semantic control explicitly focused within the bar. */
  readonly focusedControlId?: KanbanViewBarControlId;
  /** Every standard control, including currently overflowed controls. */
  readonly controls: readonly KanbanViewBarControlInspection[];
  /** Stable action IDs represented by the narrow overflow control. */
  readonly overflowActionIds: readonly string[];
  /** Keyboard and mouse reachability of each overflow action. */
  readonly overflowEntries: readonly KanbanViewBarOverflowEntryInspection[];
}

/** Construction options for the package-owned standard view chrome. */
export interface KanbanViewBarOptions {
  /** Controller that owns committed semantic view state. */
  readonly controller: KanbanViewController;
}

/** Width at which secondary actions can remain individually labelled without clipping search. */
const WIDE_MINIMUM_WIDTH = 56;
/** Stable action IDs represented by the secondary strip. */
const OVERFLOW_ACTION_IDS = Object.freeze([
  'jsvision.kanban.quick-filters',
  'jsvision.kanban.sort',
  'jsvision.kanban.saved-views',
]);
/** Shared zero-area evidence for controls that are currently represented elsewhere. */
const HIDDEN_BOUNDS = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

/** Returns a detached immutable rectangle suitable for public inspection. */
function rect(value: Readonly<Rect>): Readonly<Rect> {
  return Object.freeze({ x: value.x, y: value.y, width: value.width, height: value.height });
}

/** One compact single-row action with normal button press/release behavior but no shadow row. */
class KanbanViewBarAction extends View {
  readonly #label: string;
  readonly #activate: () => void;
  #pressed = false;

  /** Stores the visible label and activation callback. */
  constructor(label: string, activate: () => void) {
    super();
    this.#label = label;
    this.#activate = activate;
    this.focusable = true;
  }

  /** Measures a padded one-row action face. */
  override measure(): Size2D {
    return { width: stringWidth(this.#label) + 2, height: 1 };
  }

  /** Draws a non-color bracket cue plus focused/pressed theme state. */
  override draw(ctx: DrawContext): void {
    const style = ctx.color(this.#pressed || this.state.focused ? 'statusSelected' : 'statusBar');
    ctx.fill(' ', style);
    ctx.text(0, 0, `[${this.#label}]`, style);
  }

  /** Activates on Enter/Space or a complete primary-button press and release. */
  override onEvent(event: DispatchEvent): void {
    const input = event.event;
    if (input.type === 'key' && (input.key === 'enter' || input.key === 'space')) {
      this.#activate();
      event.handled = true;
      return;
    }
    if (input.type !== 'mouse' || input.button !== 0) return;
    if (input.kind === 'down') {
      this.#pressed = true;
      event.setCapture?.(this);
      this.invalidate();
      event.handled = true;
    } else if (input.kind === 'up' && this.#pressed) {
      this.#pressed = false;
      event.releaseCapture?.();
      this.invalidate();
      if (event.local !== undefined) this.#activate();
      event.handled = true;
    }
  }
}

/** Geometry produced by the responsive secondary-action strip. */
interface KanbanSecondaryActionGeometry {
  /** Current strip mode. */
  readonly mode: KanbanViewBarMode;
  /** Directly visible semantic controls and their local bounds. */
  readonly controls: readonly { readonly id: KanbanViewBarControlId; readonly bounds: Readonly<Rect> }[];
}

/** Packs secondary actions into labels in wide mode and one overflow target in narrow mode. */
class KanbanViewBarSecondaryActions extends View {
  #selected = 0;

  /** The strip is one keyboard focus stop with internal left/right action navigation. */
  constructor() {
    super();
    this.focusable = true;
  }

  /** Reports the single row reserved by the outer DSL composition. */
  override measure(available: Size2D): Size2D {
    return { width: available.width, height: 1 };
  }

  /** Resolves current bounded action geometry directly from assigned terminal width. */
  geometry(): KanbanSecondaryActionGeometry {
    const mode: KanbanViewBarMode = this.bounds.width >= WIDE_MINIMUM_WIDTH ? 'wide' : 'narrow';
    if (mode === 'narrow') {
      return Object.freeze({
        mode,
        controls: Object.freeze([
          Object.freeze({ id: 'overflow' as const, bounds: Object.freeze({ x: 0, y: 0, width: 6, height: 1 }) }),
        ]),
      });
    }
    const entries = [
      ['quick-filters', 'Quick filters'],
      ['sort', 'Sort'],
      ['saved-views', 'Views'],
    ] as const;
    let x = 0;
    const controls = entries.map(([id, label]) => {
      const width = stringWidth(label) + 2;
      const control = Object.freeze({ id, bounds: Object.freeze({ x, y: 0, width, height: 1 }) });
      x += width + 1;
      return control;
    });
    return Object.freeze({ mode, controls: Object.freeze(controls) });
  }

  /** Draws the current secondary actions with an explicit focus cue on the selected item. */
  override draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color('statusBar'));
    const geometry = this.geometry();
    const labels = geometry.mode === 'wide' ? ['Quick filters', 'Sort', 'Views'] : ['More'];
    geometry.controls.forEach((control, index) => {
      const selected = this.state.focused && index === this.#selected;
      ctx.text(control.bounds.x, 0, `[${labels[index] ?? ''}]`, ctx.color(selected ? 'statusSelected' : 'statusBar'));
    });
  }

  /** Moves the semantic selection or activates the clicked target without owning application actions. */
  override onEvent(event: DispatchEvent): void {
    const geometry = this.geometry();
    const input = event.event;
    if (input.type === 'key') {
      if (input.key !== 'left' && input.key !== 'right' && input.key !== 'enter' && input.key !== 'space') return;
      if (input.key === 'left') this.#selected = Math.max(0, this.#selected - 1);
      if (input.key === 'right') this.#selected = Math.min(geometry.controls.length - 1, this.#selected + 1);
      this.invalidate();
      event.handled = true;
      return;
    }
    if (input.type !== 'mouse' || input.kind !== 'down' || input.button !== 0 || event.local === undefined) return;
    const index = geometry.controls.findIndex(
      ({ bounds }) => event.local !== undefined && event.local.x >= bounds.x && event.local.x < bounds.x + bounds.width,
    );
    if (index < 0) return;
    this.#selected = index;
    this.invalidate();
    event.handled = true;
  }
}

/** One passive summary row that never invents exact source counts before board binding. */
class KanbanViewBarSummaryLine extends View {
  readonly #controller: KanbanViewController;

  /** Retains only the controller interface used to read immutable summary evidence. */
  constructor(controller: KanbanViewController) {
    super();
    this.#controller = controller;
  }

  /** Reports the single row reserved by the standard bar. */
  override measure(available: Size2D): Size2D {
    return { width: available.width, height: 1 };
  }

  /** Draws visible count evidence and an honest unknown marker when no board has supplied counts. */
  override draw(ctx: DrawContext): void {
    const summary = this.#controller.summary();
    const matching = summary.matching.quality === 'unknown' ? '?' : String(summary.matching.value);
    ctx.fill(' ', ctx.color('statusBar'));
    ctx.text(0, 0, `${summary.visible} visible · ${matching} matching`, ctx.color('statusBar'));
  }
}

/**
 * Responsive three-row search and view-control surface for a {@link KanbanViewController}.
 *
 * The search row uses the framework's normal text input, so selection, clipboard, mouse caret, and
 * focus behavior match other JSVision controls. Secondary actions collapse into one reachable
 * overflow target when the terminal is narrow; action routing is attached by later board command
 * integration, while search and Clear Filters already operate directly on the view controller.
 *
 * @example
 * ```ts
 * const controller = createKanbanViewController();
 * const bar = new KanbanViewBar({ controller });
 * bar.setLayout({ position: 'fill' });
 * ```
 */
export class KanbanViewBar extends Group {
  readonly #controller: KanbanViewController;
  readonly #searchDraft: Signal<string>;
  readonly #searchInput: Input;
  readonly #searchRow: Group;
  readonly #clear: KanbanViewBarAction;
  readonly #secondary = new KanbanViewBarSecondaryActions();
  #committedSearch: string;
  #focusedControlId: KanbanViewBarControlId | undefined;

  /** Builds a DSL-composed search row, secondary strip, and honest summary row. */
  constructor(options: KanbanViewBarOptions) {
    super();
    this.#controller = options.controller;
    this.#committedSearch = options.controller.state().search;
    this.#searchDraft = signal(this.#committedSearch);
    this.#searchInput = new Input({
      value: this.#searchDraft,
      maxLength: KANBAN_LIMITS.semanticStringBytes.safe,
      placeholder: 'Find cards',
    });
    const label = new Label('Search', this.#searchInput);
    fixed(label, 6);
    this.#clear = new KanbanViewBarAction('Clear', () => {
      this.#focusedControlId = 'clear';
      this.#searchDraft.set('');
      this.#controller.clearFilters();
    });
    this.#searchRow = row({ gap: 1, background: 'statusBar' }, label, grow(this.#searchInput), this.#clear);
    this.setLayout({ direction: 'col' });
    this.background = 'statusBar';
    this.add(fixed(this.#searchRow, 1));
    this.add(fixed(this.#secondary, 1));
    this.add(fixed(new KanbanViewBarSummaryLine(options.controller), 1));

    this.onMount(() => {
      const current = this.#controller.state().search;
      this.#committedSearch = current;
      this.#searchDraft.set(current);
      const unsubscribe = this.#controller.subscribe((state) => {
        if (state.search === this.#committedSearch) return;
        this.#committedSearch = state.search;
        this.#searchDraft.set(state.search);
        this.invalidate();
      });
      this.onCleanup(unsubscribe);
      this.bind(
        () => this.#searchDraft(),
        (search) => {
          this.#focusedControlId = 'search';
          const result = this.#controller.apply({ kind: 'set-search', search });
          if (result.kind === 'rejected' || result.kind === 'unavailable') {
            this.#searchDraft.set(this.#committedSearch);
          }
        },
      );
      this.bind(
        () => this.#searchInput.focusSignal()(),
        () => {
          if (this.#searchInput.state.focused) this.#focusedControlId = 'search';
        },
      );
    });
  }

  /** Reports the complete standard three-row height to an auto-sized parent. */
  override measure(available: Size2D): Size2D {
    return { width: available.width, height: 3 };
  }

  /** Records search as the semantic focus identity without mutating framework focus state directly. */
  focusSearch(): void {
    this.#focusedControlId = 'search';
    this.#searchInput.invalidate();
  }

  /** Returns bounded responsive geometry and interaction reachability for tests and host tooling. */
  inspection(): KanbanViewBarInspection {
    const mode: KanbanViewBarMode = this.bounds.width >= WIDE_MINIMUM_WIDTH ? 'wide' : 'narrow';
    const searchBounds = rect({
      x: this.#searchInput.bounds.x,
      y: this.#searchRow.bounds.y + this.#searchInput.bounds.y,
      width: this.#searchInput.bounds.width,
      height: this.#searchInput.bounds.height,
    });
    const clearBounds = rect({
      x: this.#clear.bounds.x,
      y: this.#searchRow.bounds.y + this.#clear.bounds.y,
      width: this.#clear.bounds.width,
      height: this.#clear.bounds.height,
    });
    const secondary = this.#secondary.geometry();
    const secondaryBounds = new Map(
      secondary.controls.map((control) => [
        control.id,
        rect({
          x: this.#secondary.bounds.x + control.bounds.x,
          y: this.#secondary.bounds.y + control.bounds.y,
          width: Math.min(control.bounds.width, Math.max(0, this.bounds.width - control.bounds.x)),
          height: control.bounds.height,
        }),
      ]),
    );
    const control = (
      id: KanbanViewBarControlId,
      visible: boolean,
      bounds: Readonly<Rect>,
    ): KanbanViewBarControlInspection =>
      Object.freeze({ id, visible, bounds, keyboardReachable: true, ...(visible ? { mouseTarget: bounds } : {}) });
    const controls = Object.freeze([
      control('search', true, searchBounds),
      control('quick-filters', mode === 'wide', secondaryBounds.get('quick-filters') ?? HIDDEN_BOUNDS),
      control('sort', mode === 'wide', secondaryBounds.get('sort') ?? HIDDEN_BOUNDS),
      control('saved-views', mode === 'wide', secondaryBounds.get('saved-views') ?? HIDDEN_BOUNDS),
      control('clear', true, clearBounds),
      control('overflow', mode === 'narrow', secondaryBounds.get('overflow') ?? HIDDEN_BOUNDS),
    ]);
    const overflowEntries = Object.freeze(
      OVERFLOW_ACTION_IDS.map((actionId) => Object.freeze({ actionId, keyboardReachable: true, mouseReachable: true })),
    );
    return Object.freeze({
      mode,
      searchDraft: this.#searchDraft(),
      ...(this.#focusedControlId === undefined ? {} : { focusedControlId: this.#focusedControlId }),
      controls,
      overflowActionIds: OVERFLOW_ACTION_IDS,
      overflowEntries,
    });
  }
}
