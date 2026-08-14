/**
 * Specification oracle for immutable card-drag and operation overlay projection.
 *
 * These cases describe terminal-visible behavior without depending on controller internals. The
 * authoritative projection is reused after every composition to prove overlays never mutate source
 * descriptors or geometry.
 */
import { classicTheme, resolveCapabilities } from '@jsvision/core';
import { Group, View, createRenderRoot } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createKanbanTheme } from '../src/index.js';
import type { KanbanCardDescriptor } from '../src/index.js';
import { createEnglishKanbanI18n } from '../src/i18n/catalog.js';
import type { KanbanDragOverlayEvidence } from '../src/interaction/drag-types.js';
import type { KanbanOperationSnapshot } from '../src/operation/types.js';
import { composeKanbanViewportOverlay, type KanbanOverlayProjection } from '../src/board/overlay-projector.js';
import { calculateKanbanViewportDamage } from '../src/board/viewport-damage.js';
import type { KanbanViewportProjection } from '../src/board/viewport-projector.js';
import { drawKanbanViewport } from '../src/board/viewport-render.js';

const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', glyphs: { boxDrawing: true } },
}).profile;
const THEME = createKanbanTheme(classicTheme);
const I18N = createEnglishKanbanI18n();

/** Real viewport-renderer leaf used to assert terminal-visible overlay precedence. */
class ProjectionLeaf extends View {
  constructor(protected readonly projection: KanbanViewportProjection) {
    super();
  }

  override draw(ctx: DrawContext): void {
    drawKanbanViewport(ctx, this.projection, THEME, (key, params) =>
      I18N.t(key, params === undefined ? undefined : { params }),
    );
  }
}

/** Render one immutable 40×12 projection through the public terminal-cell composition path. */
function renderProjection(projection: KanbanViewportProjection) {
  const leaf = new ProjectionLeaf(projection);
  leaf.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 12 } });
  const root = new Group();
  root.add(leaf);
  const render = createRenderRoot({ width: 40, height: 12 }, { caps: CAPS });
  render.mount(root);
  render.flush();
  return render;
}

/** Creates a minimal immutable card descriptor with deliberately hostile and wide title text. */
function descriptor(cardKey: number, title: string): KanbanCardDescriptor {
  return Object.freeze({
    cardKey,
    width: 16,
    measuredHeight: 2,
    surfaceRole: 'card.normal',
    borderRole: 'card.normal',
    marker: Object.freeze({ row: 1, column: 0, glyph: 'R', role: 'content.status', cues: Object.freeze([]) }),
    rows: Object.freeze([
      Object.freeze({
        section: 'title' as const,
        spans: Object.freeze([Object.freeze({ column: 0, text: title, role: 'content.title' as const })]),
      }),
      Object.freeze({
        section: 'status' as const,
        spans: Object.freeze([Object.freeze({ column: 0, text: 'Ready', role: 'content.status' as const })]),
      }),
    ]),
    sections: Object.freeze([
      Object.freeze({ id: 'title', kind: 'title' as const, startRow: 0, rowCount: 1, priority: 0 }),
      Object.freeze({ id: 'status', kind: 'status' as const, startRow: 1, rowCount: 1, priority: 1 }),
    ]),
    actions: Object.freeze([]),
    regions: Object.freeze([]),
    degradation: Object.freeze({ level: 'none', omittedSections: Object.freeze([]) }),
  });
}

/** Creates a two-column authoritative projection used by every overlay scenario. */
function authoritative(): KanbanViewportProjection {
  return Object.freeze({
    columns: Object.freeze([
      Object.freeze({
        columnId: 'ready',
        label: 'Ready',
        contentOffset: 0,
        contentWidth: 20,
        headerAlignment: 'start' as const,
        rect: Object.freeze({ x: 0, y: 0, width: 20, height: 12 }),
      }),
      Object.freeze({
        columnId: 'doing',
        label: 'Doing',
        contentOffset: 0,
        contentWidth: 20,
        headerAlignment: 'start' as const,
        rect: Object.freeze({ x: 20, y: 0, width: 20, height: 12 }),
      }),
    ]),
    cards: Object.freeze([
      Object.freeze({
        columnId: 'ready',
        index: 0,
        descriptor: descriptor(1, 'Unsafe\u001b[31m界 title'),
        descriptorColumnOffset: 0,
        descriptorRowOffset: 0,
        rect: Object.freeze({ x: 1, y: 3, width: 18, height: 4 }),
      }),
      Object.freeze({
        columnId: 'doing',
        index: 0,
        descriptor: descriptor(2, 'Destination'),
        descriptorColumnOffset: 0,
        descriptorRowOffset: 0,
        rect: Object.freeze({ x: 21, y: 3, width: 18, height: 4 }),
      }),
    ]),
    regions: Object.freeze([]),
    actionTargets: Object.freeze([]),
    states: Object.freeze([]),
  });
}

/** Creates one allowed drag overlay from card 1 to the visible Doing stack. */
function drag(eligibility: KanbanDragOverlayEvidence['gap'] extends infer _T ? 'allowed' : never = 'allowed') {
  const targetEligibility =
    eligibility === 'allowed'
      ? Object.freeze({ kind: 'allowed' as const })
      : Object.freeze({ kind: 'unavailable' as const, code: 'eligibility-unavailable' });
  return Object.freeze({
    generation: 7,
    geometryGeneration: 3,
    ghost: Object.freeze({
      cardKey: 1,
      point: Object.freeze({ x: 37, y: 10 }),
      grabOffset: Object.freeze({ x: 3, y: 1 }),
      width: 18,
      count: 1,
    }),
    placeholders: Object.freeze([
      Object.freeze({ address: Object.freeze({ columnId: 'ready' }), cardKeys: Object.freeze([1]) }),
    ]),
    gap: Object.freeze({
      slotId: 'doing:end',
      address: Object.freeze({ columnId: 'doing' }),
      rect: Object.freeze({ x: 21, y: 8, width: 18, height: 1 }),
      eligibility: targetEligibility,
    }),
  }) satisfies KanbanDragOverlayEvidence;
}

/** Creates one pending semantic move with no application-owned card record. */
function pending(state: 'pending' | 'accepted' = 'pending'): KanbanOperationSnapshot {
  return Object.freeze({
    operationId: 'operation-7' as KanbanOperationSnapshot['operationId'],
    kind: 'card-move',
    state,
    affected: Object.freeze([Object.freeze({ kind: 'card' as const, cardKey: 1 })]),
    projection: Object.freeze({
      kind: 'card-move' as const,
      state,
      cardKeys: Object.freeze([1]),
      sources: Object.freeze([Object.freeze({ columnId: 'ready' })]),
      target: Object.freeze({ columnId: 'doing' }),
      position: Object.freeze({ kind: 'end' as const, cursorRevision: 'doing-r1' }),
    }),
  });
}

/** Composes one overlay with the standard finite viewport bounds. */
function compose(options: {
  readonly drag?: KanbanDragOverlayEvidence;
  readonly operations?: readonly KanbanOperationSnapshot[];
}): KanbanViewportProjection & { readonly overlay: KanbanOverlayProjection } {
  return composeKanbanViewportOverlay({
    authoritative: authoritative(),
    bounds: Object.freeze({ x: 0, y: 0, width: 40, height: 12 }),
    density: 'compact',
    ...options,
  });
}

describe('drag overlay composition', () => {
  it('should replace moved cards with stable placeholders, one active gap, and a bounded recognizable ghost', () => {
    const source = authoritative();
    const result = composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 40, height: 12 },
      density: 'compact',
      drag: drag(),
    });

    expect(result.cards.map(({ descriptor: value }) => value.cardKey)).toEqual([2]);
    expect(result.overlay.placeholders).toHaveLength(1);
    expect(result.overlay.gap).toMatchObject({ eligibility: { kind: 'allowed' }, rect: { height: 1 } });
    expect(result.overlay.ghost).toMatchObject({ cardKey: 1, count: 1 });
    expect(result.overlay.ghost?.rect.height).toBe(3);
    expect(result.overlay.ghost).not.toHaveProperty('status');
    expect(result.overlay.ghost?.rect.x).toBeLessThan(40);
    expect(result.overlay.ghost?.rect.y).toBeLessThan(12);
    expect(source.cards).toHaveLength(2);
    expect(source.cards[0]?.rect).toEqual({ x: 1, y: 3, width: 18, height: 4 });
  });

  // The dragged card is the foremost object: its complete frame must cover an intersecting target strip.
  it('should paint the complete card ghost above an overlapping insertion strip', () => {
    const evidence = drag();
    const result = compose({
      drag: {
        ...evidence,
        ghost: { ...evidence.ghost, point: { x: 30, y: 9 } },
      },
    });
    expect(result.overlay.gap?.rect).toEqual({ x: 21, y: 8, width: 18, height: 1 });
    expect(result.overlay.ghost?.rect).toEqual({ x: 27, y: 8, width: 13, height: 3 });

    const render = renderProjection(result);
    const top = render
      .buffer()
      .rows()[8]!
      .map(({ char }) => char)
      .join('');

    expect(top.slice(21, 27)).toBe('▶ Move');
    expect(top.slice(27, 40)).toBe('◆━━━━━━━━━━━◆');
    render.unmount();
  });

  // A lifted card keeps the exact source-relative grab point; resident overlap must not teleport it elsewhere.
  it('should keep the ghost at the captured pointer-relative grab offset inside viewport bounds', () => {
    const evidence = drag();
    const result = compose({
      drag: { ...evidence, ghost: { ...evidence.ghost, point: { x: 10, y: 5 } } },
    });

    expect(result.overlay.ghost?.rect).toEqual({ x: 7, y: 4, width: 18, height: 3 });
  });

  it('should replace the drag in the same tick with one source-ordered pending block', () => {
    const dragging = compose({ drag: drag() });
    const handedOff = compose({ operations: [pending()] });

    expect(dragging.overlay.ghost).toBeDefined();
    expect(handedOff.overlay.ghost).toBeUndefined();
    expect(handedOff.overlay.pending).toHaveLength(1);
    expect(handedOff.overlay.pending[0]).toMatchObject({ state: 'pending', cardKeys: [1] });
    expect(handedOff.cards.map(({ descriptor: value }) => value.cardKey)).toEqual([2]);
  });

  it.each([
    ['allowed', 'valid', '>'],
    ['warning', 'warning', '!'],
    ['blocked', 'invalid', 'x'],
    ['unavailable', 'unavailable', '?'],
  ] as const)('should preserve a non-color %s target cue as %s', (kind, visualState, asciiMarker) => {
    const evidence = drag();
    const eligibility =
      kind === 'allowed'
        ? { kind }
        : kind === 'warning'
          ? { kind, code: 'wip-maximum-exceeded' }
          : kind === 'blocked'
            ? { kind, code: 'transition-blocked' }
            : { kind, code: 'eligibility-unavailable' };
    const result = compose({ drag: { ...evidence, gap: { ...evidence.gap!, eligibility } } });

    expect(result.overlay.gap).toMatchObject({ visualState, asciiMarker });
    expect(result.overlay.gap?.label).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/u);
  });
});

describe('overlay damage and settled equality', () => {
  const bounds = Object.freeze({ x: 0, y: 0, width: 40, height: 12 });
  const offsets = Object.freeze({ x: 0, y: 0 });

  it('should damage old and new ghost rectangles without repainting unrelated columns', () => {
    const before = compose({ drag: drag() });
    const currentDrag = drag();
    const after = compose({
      drag: { ...currentDrag, ghost: { ...currentDrag.ghost, point: { x: 25, y: 5 } } },
    });
    const damage = calculateKanbanViewportDamage({
      previous: before,
      current: after,
      bounds,
      previousOffsets: offsets,
      currentOffsets: offsets,
    });

    expect(damage.some(({ kind }) => kind === 'overlay')).toBe(true);
    expect(damage.every(({ width, height }) => width <= bounds.width && height <= bounds.height)).toBe(true);
  });

  it('should restore the authoritative projection exactly after cancellation or rejection feedback settles', () => {
    const baseline = authoritative();
    const cancelled = composeKanbanViewportOverlay({
      authoritative: baseline,
      bounds,
      density: 'comfortable',
    });
    expect(cancelled.cards).toEqual(baseline.cards);
    expect(cancelled.overlay).toEqual({
      placeholders: [],
      pending: [],
      feedback: [],
      affectedStacks: [],
    });
  });
});

describe('responsive and hostile overlay projection', () => {
  it.each([
    [40, 12],
    [24, 8],
    [18, 5],
    [80, 24],
  ])('should clip every overlay rectangle after a %ix%i surface or window resize', (width, height) => {
    const result = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width, height },
      density: 'compact',
      drag: drag(),
    });
    const rectangles = [
      ...result.overlay.placeholders.map(({ rect }) => rect),
      ...(result.overlay.gap === undefined ? [] : [result.overlay.gap.rect]),
      ...(result.overlay.ghost === undefined ? [] : [result.overlay.ghost.rect]),
    ];

    expect(rectangles.every((rect) => rect.x >= 0 && rect.y >= 0)).toBe(true);
    expect(rectangles.every((rect) => rect.x + rect.width <= width && rect.y + rect.height <= height)).toBe(true);
  });

  it('should never expose terminal controls from a hostile ghost descriptor or reason code', () => {
    const evidence = drag();
    const result = compose({
      drag: {
        ...evidence,
        gap: {
          ...evidence.gap!,
          eligibility: { kind: 'warning', code: 'unsafe\u001b[2J\nreason' },
        },
      },
    });
    const projectedText = JSON.stringify(result.overlay);

    expect(projectedText).not.toContain('\u001b');
    expect(projectedText).not.toContain('2J');
    expect(projectedText).not.toContain('Unsafe');
  });
});
