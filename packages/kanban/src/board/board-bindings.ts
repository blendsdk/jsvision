import type { I18n } from '@jsvision/i18n';
import { View, signal } from '@jsvision/ui';
import type { DispatchEvent, DrawContext, Signal } from '@jsvision/ui';

import type { KanbanCardDensity } from '../card/descriptor.js';
import type { KanbanTheme } from '../card/theme.js';
import type { KanbanCapabilities } from '../contract/capability.js';
import type { KanbanFocusedColumnNavigator } from '../layout/width-solver.js';
import type { KanbanIdentityChangeBatch } from '../source/types.js';
import { readKanbanIdentityInput, reconcileKanbanBoardIdentity } from './board-state.js';
import type { KanbanIdentityInput, KanbanViewportOptions } from './kanban-viewport.js';
import type { KanbanViewport } from './kanban-viewport.js';

/** Reactive values whose identity or value may affect board geometry. */
interface KanbanBoardBindingSnapshot {
  readonly viewportVersion: number;
  readonly mode: string;
  readonly i18n?: I18n;
  readonly density?: KanbanCardDensity;
  readonly theme?: KanbanTheme;
  readonly capabilities?: KanbanCapabilities;
}

/** Immutable state painted by the conditional focused-column navigator. */
export interface KanbanNavigatorState {
  /** Current localized service. */
  readonly i18n: I18n;
  /** Current responsive navigator metadata. */
  readonly navigator: KanbanFocusedColumnNavigator;
}

/** Produces a collision-safe value fingerprint for detached identity hints. */
function identityFingerprint(identity: KanbanIdentityInput): string {
  return JSON.stringify([
    identity.focusedCardKey === undefined ? null : [typeof identity.focusedCardKey, identity.focusedCardKey],
    identity.focusedColumnId ?? null,
    (identity.selectedCardKeys ?? []).map((key) => [typeof key, key]),
  ]);
}

/**
 * Coordinates application getters with one board-owned identity signal and one layout-change count.
 */
export class KanbanBoardBindings<TCard> {
  readonly #options: KanbanViewportOptions<TCard>;
  readonly identity: Signal<KanbanIdentityInput>;
  #identityFingerprint: string;
  #last: KanbanBoardBindingSnapshot | undefined;

  /** Reads and validates initial identity once so the viewport starts from a detached value. */
  constructor(options: KanbanViewportOptions<TCard>) {
    this.#options = options;
    const identity = readKanbanIdentityInput(options.identity);
    this.identity = signal(identity);
    this.#identityFingerprint = identityFingerprint(identity);
  }

  /** Returns the detached construction-time identity without re-reading the deprecated getter. */
  seed(): KanbanIdentityInput {
    return this.identity.peek();
  }

  /** Reads every layout-affecting reactive getter and the viewport's structural version. */
  read(viewport: KanbanViewport<TCard>): KanbanBoardBindingSnapshot {
    viewport.metricsSignal()();
    return Object.freeze({
      viewportVersion: viewport.metricsSignal().peek(),
      mode: viewport.metrics().mode,
      ...(this.#options.i18n === undefined ? {} : { i18n: this.#options.i18n() }),
      ...(this.#options.density === undefined ? {} : { density: this.#options.density() }),
      ...(this.#options.theme === undefined ? {} : { theme: this.#options.theme() }),
      ...(this.#options.capabilities === undefined ? {} : { capabilities: this.#options.capabilities() }),
    });
  }

  /** Applies reactive non-identity inputs and reports whether one semantic layout reflow should count. */
  apply(snapshot: KanbanBoardBindingSnapshot): boolean {
    const previous = this.#last;
    this.#last = snapshot;
    if (previous === undefined) return false;
    return (
      previous.mode !== snapshot.mode ||
      previous.i18n !== snapshot.i18n ||
      previous.density !== snapshot.density ||
      previous.theme !== snapshot.theme ||
      previous.capabilities !== snapshot.capabilities
    );
  }

  /** Prunes identity only for authoritative deletion facts, never for cursor unload. */
  reconcileIdentityChanges(batch: KanbanIdentityChangeBatch | undefined): boolean {
    const next = reconcileKanbanBoardIdentity(this.identity.peek(), batch);
    const fingerprint = identityFingerprint(next);
    if (fingerprint === this.#identityFingerprint) return false;
    this.#identityFingerprint = fingerprint;
    this.identity.set(next);
    return true;
  }
}

/** One-row leaf used only while responsive geometry is in focused-column mode. */
export class KanbanFocusedNavigatorView extends View {
  readonly #state: () => KanbanNavigatorState | undefined;
  readonly #navigate: (direction: 'previous-column' | 'next-column') => boolean;
  #pending: 'previous-column' | 'next-column' | undefined;

  /** Stores a current-state accessor; the board owns reactive invalidation and lifecycle. */
  constructor(
    state: () => KanbanNavigatorState | undefined,
    navigate: (direction: 'previous-column' | 'next-column') => boolean,
  ) {
    super();
    this.#state = state;
    this.#navigate = navigate;
    this.focusable = true;
  }

  /** Reports one intentional row to the DSL layout engine. */
  override measure(): { readonly width: number; readonly height: number } {
    return { width: 1, height: 1 };
  }

  /** Draws redundant previous/position/next evidence with terminal-safe ASCII fallback. */
  override draw(ctx: DrawContext): void {
    const state = this.#state();
    if (state === undefined) return;
    const previous = state.navigator.previousEnabled ? (ctx.caps.glyphs.boxDrawing ? '‹' : '<') : ' ';
    const next = state.navigator.nextEnabled ? (ctx.caps.glyphs.boxDrawing ? '›' : '>') : ' ';
    const position = state.i18n.t('kanban.focused-column.position', {
      params: { current: state.navigator.position, total: state.navigator.total },
    });
    ctx.fill(' ', ctx.color('statusBar'));
    ctx.text(0, 0, `${previous} ${state.navigator.columnId} — ${position} ${next}`, ctx.color('statusBar'));
    if (this.bounds.width > 1) ctx.text(this.bounds.width - 1, 0, next, ctx.color('statusBar'));
  }

  /** Routes left/right keys and exact arrow-cell clicks through the board interaction facade. */
  override onEvent(event: DispatchEvent): void {
    const state = this.#state();
    if (state === undefined) {
      this.#pending = undefined;
      return;
    }
    if (event.event.type === 'key') {
      this.#pending = undefined;
      const direction =
        event.event.key === 'left' ? 'previous-column' : event.event.key === 'right' ? 'next-column' : undefined;
      if (direction === undefined) return;
      const enabled = direction === 'previous-column' ? state.navigator.previousEnabled : state.navigator.nextEnabled;
      if (enabled) event.handled = this.#navigate(direction);
      return;
    }
    if (event.event.type !== 'mouse' || event.event.button !== 0 || event.local === undefined) {
      this.#pending = undefined;
      return;
    }
    const direction =
      event.local.x === 0 ? 'previous-column' : event.local.x === this.bounds.width - 1 ? 'next-column' : undefined;
    const enabled =
      direction === 'previous-column'
        ? state.navigator.previousEnabled
        : direction === 'next-column'
          ? state.navigator.nextEnabled
          : false;
    if (event.event.kind === 'down') {
      this.#pending = enabled ? direction : undefined;
      event.handled = this.#pending !== undefined;
      return;
    }
    if (event.event.kind === 'up') {
      const pending = this.#pending;
      this.#pending = undefined;
      if (pending !== undefined && pending === direction && enabled) event.handled = this.#navigate(pending);
      return;
    }
    this.#pending = undefined;
  }
}
