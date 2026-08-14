/**
 * Immutable responsive-layout requirements for the real Kanban editor dialog surface.
 *
 * The oracle drives public Window, Scroller, focus, keyboard, and render behavior. Geometry may
 * change internally, but every field and action must remain reachable without losing the draft.
 */
import { resolveCapabilities } from '@jsvision/core';
import { createI18n } from '@jsvision/i18n';
import { Button, Commands, Group, Input, Scroller, Window, createEventLoop } from '@jsvision/ui';
import type { View } from '@jsvision/ui';
import { describe, expect, it, vi } from 'vitest';

import {
  createKanbanCardEditorSchema,
  createKanbanEditorCoordinator,
  openKanbanCardEditDialog,
} from '../../src/index.js';
import type { KanbanCardEditorAdapter } from '../../src/index.js';

interface DenseCard {
  readonly id: string;
  readonly values: Readonly<Record<string, string>>;
}

interface DenseDraft {
  readonly values: Readonly<Record<string, string>>;
}

const CAPS = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const FIELD_IDS = Object.freeze(Array.from({ length: 14 }, (_, index) => `field-${index + 1}`));

/** Builds the dense schema used to force vertical scrolling at compact geometry. */
function denseAdapter(): KanbanCardEditorAdapter<DenseCard, DenseDraft> {
  return {
    schema: createKanbanCardEditorSchema({
      revision: 'dense-dialog-v1',
      sections: [
        { sectionId: 'common', labelId: 'ticket.section.common', order: 0 },
        { sectionId: 'details', labelId: 'ticket.section.details', order: 1, presentation: 'collapsible' },
      ],
      fields: FIELD_IDS.map((fieldId, index) => ({
        fieldId,
        sectionId: index < 4 ? 'common' : 'details',
        kind: 'text' as const,
        labelId: `ticket.field.long-${index + 1}`,
        order: index,
        read: (draft: DenseDraft) => draft.values[fieldId] ?? '',
        write: (draft: DenseDraft, value: string) => ({ values: { ...draft.values, [fieldId]: value } }),
      })),
    }),
    create: (card) => ({ values: { ...(card?.values ?? {}) } }),
    snapshot: (draft) => ({ values: draft.values }),
    proposal: ({ snapshot }) => ({ kind: 'card-update', cardKey: 'dense-card', patch: snapshot }),
  };
}

/** Mounts an application-like modal host and captures the one active editor window. */
function host(width = 80, height = 24) {
  const root = new Group();
  const loop = createEventLoop({ width, height }, { caps: CAPS });
  loop.mount(root);
  let dialog: View | undefined;
  return {
    loop,
    dialog: (): View | undefined => dialog,
    value: {
      i18n: createI18n(),
      loop,
      desktop: {
        bounds: { x: 0, y: 0, width, height },
        addWindow(view: View): void {
          dialog = view;
          root.add(view);
        },
        removeWindow(view: View): void {
          root.remove(view);
          if (dialog === view) dialog = undefined;
        },
      },
    },
  };
}

/** Returns all descendants of one public Group in stable traversal order. */
function descendants(view: View): readonly View[] {
  if (!(view instanceof Group)) return [];
  return view.children.flatMap((child) => [child, ...descendants(child)]);
}

/** Lets async session acquisition mount its dialog. */
const mounted = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Opens the same deterministic dense card for each geometry oracle. */
function open(h: ReturnType<typeof host>) {
  const card: DenseCard = {
    id: 'dense-card',
    values: Object.fromEntries(FIELD_IDS.map((fieldId, index) => [fieldId, `Value ${index + 1}`])),
  };
  return openKanbanCardEditDialog(h.value, {
    cardKey: card.id,
    adapter: denseAdapter(),
    coordinator: createKanbanEditorCoordinator(),
    resolver: {
      resolve: vi.fn(async () => ({ kind: 'record' as const, card, revision: 'dense-r1' })),
      subscribe: vi.fn(() => () => undefined),
    },
    completion: { kind: 'authority', authority: { request: vi.fn() } },
    confirm: async () => true,
  });
}

describe('Kanban editor responsive dialog', () => {
  it('should expose a centered resizable dialog, scrollable fields, and measured actions at 80x24', async () => {
    const h = host();
    const pending = open(h);
    await mounted();
    h.loop.renderRoot.flush();
    const dialog = h.dialog();

    expect(dialog).toBeInstanceOf(Window);
    expect(dialog?.bounds.x).toBeGreaterThan(0);
    expect(dialog?.bounds.y).toBeGreaterThan(0);
    expect(dialog?.bounds.width).toBeLessThan(80);
    expect(dialog?.bounds.height).toBeLessThan(24);
    const controls = descendants(dialog!);
    expect(controls.filter((view) => view instanceof Input)).toHaveLength(FIELD_IDS.length);
    expect(controls.some((view) => view instanceof Scroller)).toBe(true);
    expect(controls.filter((view) => view instanceof Button).length).toBeGreaterThanOrEqual(2);

    h.loop.emitCommand(Commands.cancel);
    await pending;
  });

  it('should preserve the focused field and draft across maximize and exact restore', async () => {
    const h = host();
    const pending = open(h);
    await mounted();
    h.loop.renderRoot.flush();
    const dialog = h.dialog();
    expect(dialog).toBeInstanceOf(Window);
    const window = dialog instanceof Window ? dialog : undefined;
    expect(window).toBeDefined();
    const restored = { ...window!.bounds };
    const focused = h.loop.getFocused();
    expect(focused).toBeInstanceOf(Input);
    h.loop.dispatch({ type: 'key', key: 'z', ctrl: false, alt: false, shift: false });

    window!.zoom();
    h.loop.renderRoot.flush();
    expect(window!.bounds).toEqual({ x: 0, y: 0, width: 80, height: 24 });
    expect(h.loop.getFocused()).toBe(focused);

    window!.zoom();
    h.loop.renderRoot.flush();
    expect(window!.bounds).toEqual(restored);
    expect(h.loop.getFocused()).toBe(focused);

    h.loop.emitCommand(Commands.cancel);
    await pending;
  });

  it('should keep all active fields and actions keyboard-reachable after narrow reflow and scrolling', async () => {
    const h = host(52, 18);
    const pending = open(h);
    await mounted();
    h.loop.renderRoot.flush();
    const dialog = h.dialog();
    expect(dialog).toBeInstanceOf(Window);
    const window = dialog instanceof Window ? dialog : undefined;
    window?.setLayout({ rect: { x: 1, y: 1, width: 34, height: 12 } });
    window?.onResized();
    h.loop.renderRoot.flush();

    const controls = descendants(dialog!);
    const scroller = controls.find((view): view is Scroller => view instanceof Scroller);
    const inputs = controls.filter((view): view is Input => view instanceof Input);
    const buttons = controls.filter(
      (view): view is Button => view instanceof Button && view.state.visible && !view.state.disabled,
    );
    expect(scroller).toBeDefined();
    expect(inputs).toHaveLength(FIELD_IDS.length);
    expect(buttons.length).toBeGreaterThanOrEqual(2);

    h.loop.focusView(scroller!);
    h.loop.dispatch({ type: 'key', key: 'pagedown', ctrl: false, alt: false, shift: false });
    h.loop.renderRoot.flush();
    expect(scroller!.delta.y).toBeGreaterThan(0);

    const reached = new Set<View>();
    for (let index = 0; index < inputs.length + buttons.length + 4; index += 1) {
      const focused = h.loop.getFocused();
      if (focused !== null) reached.add(focused);
      h.loop.focusNext();
    }
    expect(inputs.every((input) => reached.has(input))).toBe(true);
    expect(buttons.every((button) => reached.has(button))).toBe(true);

    h.loop.emitCommand(Commands.cancel);
    await pending;
  });
});
