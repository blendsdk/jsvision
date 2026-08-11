/** Implementation coverage for pure overlay composition, drawing, and bounded damage. */
import { classicTheme, resolveCapabilities } from '@jsvision/core';
import { Group, View, createRenderRoot } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { describe, expect, it } from 'vitest';

import { createKanbanOperationId, createKanbanTheme, evaluateKanbanMoveEligibility } from '../src/index.js';
import type { KanbanCardDescriptor, KanbanOperationSnapshot } from '../src/index.js';
import { createEnglishKanbanI18n } from '../src/i18n/catalog.js';
import type { KanbanDragOverlayEvidence } from '../src/interaction/drag-types.js';
import { composeKanbanViewportOverlay } from '../src/board/overlay-projector.js';
import type { KanbanOverlayProjectionWork } from '../src/board/overlay-projector.js';
import { calculateKanbanViewportDamage } from '../src/board/viewport-damage.js';
import type { KanbanViewportProjection } from '../src/board/viewport-projector.js';
import { drawKanbanViewport } from '../src/board/viewport-render.js';

const UNICODE_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', glyphs: { boxDrawing: true } },
}).profile;
const ASCII_CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'mono', unicode: { utf8: false }, glyphs: { boxDrawing: false } },
}).profile;
const THEME = createKanbanTheme(classicTheme);
const I18N = createEnglishKanbanI18n();

/** Creates one small deterministic descriptor without retaining an application record. */
function descriptor(cardKey: string | number, title = `Card ${String(cardKey)}`): KanbanCardDescriptor {
  return Object.freeze({
    cardKey,
    width: 14,
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

/** Creates an authoritative two-stack viewport with type-distinct identities. */
function authoritative(): KanbanViewportProjection {
  return Object.freeze({
    columns: Object.freeze([
      Object.freeze({
        columnId: 'ready',
        label: 'Ready',
        contentOffset: 0,
        contentWidth: 18,
        headerAlignment: 'start' as const,
        rect: Object.freeze({ x: 0, y: 0, width: 18, height: 12 }),
      }),
      Object.freeze({
        columnId: 'doing',
        label: 'Doing',
        contentOffset: 0,
        contentWidth: 18,
        headerAlignment: 'start' as const,
        rect: Object.freeze({ x: 18, y: 0, width: 18, height: 12 }),
      }),
    ]),
    cards: Object.freeze([
      Object.freeze({
        columnId: 'ready',
        index: 0,
        descriptor: descriptor(1, 'Numeric source'),
        descriptorColumnOffset: 0,
        descriptorRowOffset: 0,
        rect: Object.freeze({ x: 1, y: 3, width: 16, height: 4 }),
      }),
      Object.freeze({
        columnId: 'ready',
        index: 1,
        descriptor: descriptor('1', 'String sibling'),
        descriptorColumnOffset: 0,
        descriptorRowOffset: 0,
        rect: Object.freeze({ x: 1, y: 8, width: 16, height: 4 }),
      }),
      Object.freeze({
        columnId: 'doing',
        index: 0,
        descriptor: descriptor(2, 'Wide 界e\u0301 target'),
        descriptorColumnOffset: 0,
        descriptorRowOffset: 0,
        rect: Object.freeze({ x: 19, y: 3, width: 16, height: 4 }),
      }),
    ]),
    regions: Object.freeze([]),
    actionTargets: Object.freeze([
      Object.freeze({
        kind: 'card' as const,
        scope: Object.freeze({ kind: 'card' as const, cardKey: 1, address: Object.freeze({ columnId: 'ready' }) }),
        zIndex: 400,
        address: Object.freeze({ columnId: 'ready' }),
        cardKey: 1,
        logicalIndex: 0,
        x: 1,
        y: 3,
        width: 16,
        height: 4,
      }),
      Object.freeze({
        kind: 'card' as const,
        scope: Object.freeze({ kind: 'card' as const, cardKey: 2, address: Object.freeze({ columnId: 'doing' }) }),
        zIndex: 400,
        address: Object.freeze({ columnId: 'doing' }),
        cardKey: 2,
        logicalIndex: 0,
        x: 19,
        y: 3,
        width: 16,
        height: 4,
      }),
    ]),
    states: Object.freeze([]),
  });
}

/** Creates one compact move with an intentionally non-resident ghost identity when requested. */
function drag(cardKey: string | number = 1): KanbanDragOverlayEvidence {
  return Object.freeze({
    generation: 1,
    geometryGeneration: 1,
    ghost: Object.freeze({ cardKey, point: Object.freeze({ x: 31, y: 10 }), count: 1 }),
    placeholders: Object.freeze([
      Object.freeze({ address: Object.freeze({ columnId: 'ready' }), cardKeys: Object.freeze([cardKey]) }),
    ]),
    gap: Object.freeze({
      slotId: 'doing:end',
      address: Object.freeze({ columnId: 'doing' }),
      rect: Object.freeze({ x: 19, y: 5, width: 16, height: 2 }),
      eligibility: Object.freeze({ kind: 'allowed' as const }),
    }),
  });
}

/** Creates a complete allowed move whose individual policy stages can be varied by a focused test. */
function eligibleMoveInput() {
  return {
    proposal: {
      kind: 'card-move' as const,
      moved: [
        {
          cardKey: 1,
          source: { columnId: 'ready' },
          sourcePlacement: { kind: 'start' as const, cursorRevision: 'ready-r1' },
          sourceRevision: 'ready-r1',
          entityRevision: 'card-1-r1',
        },
      ],
      target: { columnId: 'doing' },
      position: { kind: 'end' as const, cursorRevision: 'doing-r1' },
    },
    current: {
      sourceRevision: 'source-r1',
      queryRevision: 'query-r1',
      columns: [
        { columnId: 'ready', revision: 'ready-r1' },
        { columnId: 'doing', revision: 'doing-r1' },
      ],
      swimlanes: [],
      cards: [{ cardKey: 1, revision: 'card-1-r1' }],
      sourceCells: [
        {
          address: { columnId: 'ready' },
          cursorRevision: 'ready-r1',
          edges: { start: 'complete' as const, end: 'complete' as const },
          cardKeys: [1],
          placementTokens: [],
        },
      ],
      targetCursorRevision: 'doing-r1',
      targetEdges: { start: 'complete' as const, end: 'complete' as const },
      targetCardKeys: [],
      placementTokens: [],
    },
    expected: { source: 'source-r1', query: 'query-r1' },
    capability: { state: 'allowed' as const },
    selection: { kind: 'loaded' as const, orderedCardKeys: [1], maximum: 10_000 },
    ordering: { sorted: false, filtered: false, filteredPlacement: 'not-required' },
    transition: { kind: 'allowed' },
    definitionOfDone: { kind: 'allowed' },
    wip: { kind: 'allowed' },
    unchanged: false,
  };
}

/** Minimal leaf that draws a supplied projection through the real viewport renderer. */
class ProjectionLeaf extends View {
  #projection: KanbanViewportProjection;

  /** Retains only immutable projection values for deterministic frame tests. */
  constructor(projection: KanbanViewportProjection) {
    super();
    this.#projection = projection;
  }

  /** Replaces the frame input and requests repaint through the normal render scheduler. */
  replace(projection: KanbanViewportProjection): void {
    this.#projection = projection;
    this.invalidate();
  }

  /** Draws with the same theme and translation boundary as the mounted viewport. */
  override draw(ctx: DrawContext): void {
    drawKanbanViewport(ctx, this.#projection, THEME, (key, params) =>
      I18N.t(key, params === undefined ? undefined : { params }),
    );
  }
}

/** Mounts one exact-cell projection leaf and returns its text frame. */
function mountedFrame(projection: KanbanViewportProjection, ascii = false) {
  const leaf = new ProjectionLeaf(projection);
  leaf.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: 36, height: 12 } });
  const host = new Group();
  host.add(leaf);
  const render = createRenderRoot({ width: 36, height: 12 }, { caps: ascii ? ASCII_CAPS : UNICODE_CAPS });
  render.mount(host);
  render.flush();
  const text = () =>
    render
      .buffer()
      .rows()
      .map((row) => row.map(({ char }) => char).join(''))
      .join('\n');
  return Object.freeze({ leaf, render, text });
}

describe('overlay composition internals', () => {
  it('projects structural source, insertion, and bounded header ghost cues', () => {
    const result = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      structuralDrag: {
        generation: 1,
        geometryGeneration: 1,
        structure: { kind: 'column', columnId: 'ready' },
        point: { x: 34, y: 1 },
        sourceRect: { x: 0, y: 1, width: 18, height: 1 },
        markerRect: { x: 18, y: 1, width: 1, height: 1 },
      },
    });

    expect(result.overlay.structure).toMatchObject({
      kind: 'column',
      id: 'ready',
      placeholder: { x: 0, y: 1, width: 18, height: 1 },
      marker: { x: 18, y: 1, width: 1, height: 1 },
    });
    expect(result.overlay.structure?.ghost.x).toBeLessThan(36);
  });

  it('keeps semantic identity joins type-safe and disables only the projected card target', () => {
    const result = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
      drag: drag(1),
    });

    expect(result.cards.map(({ descriptor: value }) => value.cardKey)).toEqual(['1', 2]);
    expect(result.actionTargets.map(({ cardKey }) => cardKey)).toEqual([2]);
    expect(result.cards.find(({ descriptor: value }) => value.cardKey === 2)?.rect.y).toBe(4);
    expect(result.overlay.affectedStacks.map(({ columnId }) => columnId).sort()).toEqual(['doing', 'ready']);
  });

  it('uses bounded identity fallback when the ghost and pending descriptor are not resident', () => {
    const missingDrag = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 20, height: 6 },
      density: 'comfortable',
      drag: drag(999),
    });
    const pending = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [
        Object.freeze({
          operationId: createKanbanOperationId('missing-card'),
          kind: 'card-move' as const,
          state: 'pending' as const,
          affected: Object.freeze([Object.freeze({ kind: 'card' as const, cardKey: 999 })]),
          projection: Object.freeze({
            kind: 'card-move' as const,
            state: 'pending' as const,
            cardKeys: Object.freeze([999]),
            sources: Object.freeze([Object.freeze({ columnId: 'ready' })]),
            target: Object.freeze({ columnId: 'doing' }),
            position: Object.freeze({ kind: 'end' as const, cursorRevision: 1 }),
          }),
        }),
      ],
    });

    expect(missingDrag.overlay.placeholders).toEqual([]);
    expect(missingDrag.overlay.ghost).toMatchObject({ cardKey: 999, label: '#999' });
    expect(pending.overlay.pending[0]).toMatchObject({ cardKeys: [], count: 1, rect: { width: 16 } });
  });

  it('restores authority with an empty overlay after malformed composition input', () => {
    const source = authoritative();
    const malformed = Object.freeze({
      operationId: createKanbanOperationId('malformed'),
      kind: 'card-move' as const,
      state: 'pending' as const,
      affected: Object.freeze([]),
      projection: Object.freeze({ kind: 'card-move' as const, state: 'pending' as const }),
    });
    const result = composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
      operations: [malformed as never],
    });

    expect(result.cards).toBe(source.cards);
    expect(result.overlay).toEqual({ placeholders: [], pending: [], feedback: [], affectedStacks: [] });
    expect(result.overlayFailure).toBe('composition-failed');
    expect(result.actionTargets).toEqual([]);
  });

  it.each([
    ['wip-maximum-exceeded', 'kanban.workflow.wip-maximum-exceeded'],
    ['transition-blocked', 'kanban.operation.transition-blocked'],
    ['definition-of-done-not-met', 'kanban.operation.definition-of-done'],
    ['unrecognized-safe-code', 'kanban.drop.warning'],
  ] as const)('maps safe eligibility reason %s to localized key %s', (code, messageKey) => {
    const evidence = drag();
    const result = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      drag: {
        ...evidence,
        gap: { ...evidence.gap!, eligibility: { kind: 'warning', code } },
      },
    });

    expect(result.overlay.gap?.messageKey).toBe(messageKey);
    expect(result.overlay.gap?.eligibility).toEqual({ kind: 'warning' });
  });

  it('maps canonical evaluator stale, sorted, and filtered outcomes to their localized messages', () => {
    const baseline = eligibleMoveInput();
    const withinSource = {
      ...baseline,
      proposal: {
        ...baseline.proposal,
        target: { columnId: 'ready' },
        position: { kind: 'end' as const, cursorRevision: 'ready-r1' },
      },
      current: {
        ...baseline.current,
        targetCursorRevision: 'ready-r1',
        targetCardKeys: [1],
      },
    };
    const outcomes = [
      [
        evaluateKanbanMoveEligibility({
          ...baseline,
          current: {
            ...baseline.current,
            sourceCells: [{ ...baseline.current.sourceCells[0]!, cursorRevision: 'ready-r2' }],
          },
        }),
        'kanban.operation.stale-placement',
      ],
      [
        evaluateKanbanMoveEligibility({
          ...withinSource,
          ordering: { sorted: true, filtered: false, filteredPlacement: 'not-required' },
        }),
        'kanban.operation.sorted-placement',
      ],
      [
        evaluateKanbanMoveEligibility({
          ...withinSource,
          ordering: { sorted: false, filtered: true, filteredPlacement: 'unavailable' },
        }),
        'kanban.operation.filtered-placement',
      ],
    ] as const;

    for (const [eligibility, messageKey] of outcomes) {
      const evidence = drag();
      const result = composeKanbanViewportOverlay({
        authoritative: authoritative(),
        bounds: { x: 0, y: 0, width: 36, height: 12 },
        density: 'comfortable',
        drag: { ...evidence, gap: { ...evidence.gap!, eligibility } },
      });
      expect(result.overlay.gap?.messageKey).toBe(messageKey);
    }
  });

  it('indexes every maximum-resident card once and performs at most one lookup per distinct drag key', () => {
    const cardCount = 8_192;
    const selectionCount = 10_000;
    const source = authoritative();
    const cards = Object.freeze(
      Array.from({ length: cardCount }, (_, cardKey) =>
        Object.freeze({
          columnId: 'ready',
          index: cardKey,
          descriptor: descriptor(cardKey),
          descriptorColumnOffset: 0,
          descriptorRowOffset: 0,
          rect: Object.freeze({ x: 1, y: 3, width: 16, height: 4 }),
        }),
      ),
    );
    let measured:
      | Readonly<{ indexedCards: number; cardLookups: number; indexedColumns: number; columnLookups: number }>
      | undefined;
    composeKanbanViewportOverlay({
      authoritative: Object.freeze({ ...source, cards }),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
      drag: Object.freeze({
        ...drag(0),
        placeholders: Object.freeze([
          Object.freeze({
            address: Object.freeze({ columnId: 'ready' }),
            cardKeys: Object.freeze(Array.from({ length: selectionCount }, (_, cardKey) => cardKey)),
          }),
        ]),
      }),
      inspectWork: (work) => {
        measured = work;
      },
    });

    expect(measured).toEqual({
      indexedCards: cardCount,
      cardLookups: selectionCount,
      indexedColumns: 2,
      columnLookups: 2,
      operationIndexedCards: cardCount,
      operationCellLookups: 0,
      operationShiftEvents: 0,
      operationShiftLookups: 0,
    });
  });

  it('indexes configured pending-operation work without card-by-operation scans', () => {
    const source = authoritative();
    const operation = (index: number): KanbanOperationSnapshot =>
      Object.freeze({
        operationId: createKanbanOperationId(`bounded-${index}`),
        kind: 'card-move',
        state: 'pending',
        affected: Object.freeze([Object.freeze({ kind: 'card' as const, cardKey: 1 })]),
        projection: Object.freeze({
          kind: 'card-move' as const,
          state: 'pending' as const,
          cardKeys: Object.freeze([1]),
          sources: Object.freeze([Object.freeze({ columnId: 'ready' })]),
          target: Object.freeze({ columnId: 'doing' }),
          position: Object.freeze({ kind: 'start' as const, cursorRevision: 1 }),
        }),
      });
    const operations = Object.freeze(Array.from({ length: 512 }, (_, index) => operation(index)));
    let measured: KanbanOverlayProjectionWork | undefined;

    composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations,
      inspectWork: (work) => {
        measured = work;
      },
    });

    expect(measured).toMatchObject({
      operationIndexedCards: source.cards.length,
      operationCellLookups: operations.length * 3,
      operationShiftEvents: operations.length,
      operationShiftLookups: source.cards.length - 1,
    });
  });

  it('composes source placeholders, target reflow, concurrent slots, and offscreen fallback for pending moves', () => {
    const operation = (operationId: string, targetColumnId = 'doing'): KanbanOperationSnapshot =>
      Object.freeze({
        operationId: createKanbanOperationId(operationId),
        kind: 'card-move',
        state: 'pending',
        affected: Object.freeze([
          Object.freeze({ kind: 'card' as const, cardKey: 1 }),
          Object.freeze({ kind: 'column' as const, columnId: targetColumnId }),
        ]),
        projection: Object.freeze({
          kind: 'card-move' as const,
          state: 'pending' as const,
          cardKeys: Object.freeze([1]),
          sources: Object.freeze([Object.freeze({ columnId: 'ready' })]),
          target: Object.freeze({ columnId: targetColumnId }),
          position: Object.freeze({ kind: 'start' as const, cursorRevision: 1 }),
        }),
      });
    const visible = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [operation('one'), operation('two')],
    });
    const offscreen = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [operation('offscreen', 'hidden')],
    });

    expect(visible.overlay.placeholders).toHaveLength(2);
    expect(visible.overlay.pending.map(({ rect }) => rect.y)).toEqual([3, 6]);
    expect(visible.cards.find(({ descriptor: value }) => value.cardKey === 2)?.rect.y).toBeGreaterThan(3);
    expect(visible.actionTargets).toEqual([]);
    expect(offscreen.overlay.pending[0]).toMatchObject({ offscreen: true, rect: { x: 2, y: 3 } });
    expect(offscreen.cards.map(({ descriptor: value }) => value.cardKey)).not.toContain(1);
    expect(offscreen.overlay.placeholders).toHaveLength(1);
  });
});

describe('overlay drawing and damage internals', () => {
  it('draws Unicode/color and ASCII/mono ghosts with explicit non-color target cues', () => {
    const projection = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
      drag: drag(),
    });
    const unicode = mountedFrame(projection);
    const ascii = mountedFrame(projection, true);

    expect(unicode.text()).toContain('Numeric source');
    expect(unicode.text()).toContain('▶ Move here');
    expect(unicode.text()).toMatch(/[◆━┃]/u);
    expect(ascii.text()).toContain('> Move here');
    expect(ascii.text()).toMatch(/[+=!]/u);
    unicode.render.unmount();
    ascii.render.unmount();
  });

  it('draws localized bulk count and recognizable resident cues in Unicode and ASCII frames', () => {
    const evidence = drag();
    const projection = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
      drag: {
        ...evidence,
        ghost: { ...evidence.ghost, count: 3 },
        placeholders: [
          { address: { columnId: 'ready' }, cardKeys: [1, '1'] },
          { address: { columnId: 'doing' }, cardKeys: [2] },
        ],
      },
    });
    const unicode = mountedFrame(projection);
    const ascii = mountedFrame(projection, true);

    expect(unicode.text()).toContain('Moving 3 cards');
    expect(unicode.text()).toContain('Numeric source');
    expect(ascii.text()).toContain('Moving 3 cards');
    expect(ascii.text()).toContain('Numeric source');
    unicode.render.unmount();
    ascii.render.unmount();
  });

  it.each([
    ['pending', 'Move pending'],
    ['accepted', 'Awaiting board'],
  ] as const)('draws a source-free %s operation block with localized non-color evidence', (state, label) => {
    const projection = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [
        Object.freeze({
          operationId: createKanbanOperationId(`operation-${state}`),
          kind: 'card-move' as const,
          state,
          affected: Object.freeze([Object.freeze({ kind: 'card' as const, cardKey: 1 })]),
          projection: Object.freeze({
            kind: 'card-move' as const,
            state,
            cardKeys: Object.freeze([1]),
            sources: Object.freeze([Object.freeze({ columnId: 'ready' })]),
            target: Object.freeze({ columnId: 'doing' }),
            position: Object.freeze({ kind: 'end' as const, cursorRevision: 1 }),
          }),
        }),
      ],
    });
    const mounted = mountedFrame(projection);

    expect(mounted.text()).toContain(label);
    expect(mounted.text()).not.toContain('Numeric source');
    mounted.render.unmount();
  });

  it('draws rejected and superseded feedback outside the restored authoritative card body', () => {
    const projection = composeKanbanViewportOverlay({
      authoritative: authoritative(),
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [
        Object.freeze({
          operationId: createKanbanOperationId('operation-superseded'),
          kind: 'card-move' as const,
          state: 'superseded' as const,
          affected: Object.freeze([Object.freeze({ kind: 'card' as const, cardKey: 1 })]),
          code: 'private-application-code',
        }),
      ],
    });
    const mounted = mountedFrame(projection);

    expect(mounted.text()).toContain('! Board changed');
    expect(mounted.text()).toContain('Numeric source');
    expect(mounted.text()).not.toContain('private-application-code');
    mounted.render.unmount();
  });

  it('clears every ghost cell after cancellation and leaves a settled authoritative frame', () => {
    const source = authoritative();
    const active = composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
      drag: drag(),
    });
    const settled = composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'compact',
    });
    const mounted = mountedFrame(active);
    expect(mounted.text()).toMatch(/[◆━┃]/u);
    mounted.leaf.replace(settled);
    mounted.render.flush();

    expect(mounted.text()).not.toMatch(/[◆━┃]/u);
    expect(mounted.text()).toContain('Numeric source');
    mounted.render.unmount();
  });

  it('falls back to one whole-viewport region when overlay damage exceeds the finite budget', () => {
    const source = authoritative();
    const crowdedOverlay = Object.freeze({
      placeholders: Object.freeze(
        Array.from({ length: 257 }, (_, index) =>
          Object.freeze({
            address: Object.freeze({ columnId: 'ready' }),
            cardKeys: Object.freeze([index]),
            rect: Object.freeze({ x: index % 36, y: index % 12, width: 1, height: 1 }),
          }),
        ),
      ),
      pending: Object.freeze([]),
      feedback: Object.freeze([]),
      affectedStacks: Object.freeze([]),
    });
    const current: KanbanViewportProjection = Object.freeze({ ...source, overlay: crowdedOverlay });
    const bounds = Object.freeze({ x: 0, y: 0, width: 36, height: 12 });
    const damage = calculateKanbanViewportDamage({
      previous: source,
      current,
      bounds,
      previousOffsets: { x: 0, y: 0 },
      currentOffsets: { x: 0, y: 0 },
    });

    expect(damage).toEqual([{ kind: 'whole-viewport', ...bounds }]);
  });

  it('unions source, destination, feedback, and authoritative damage when pending work rejects', () => {
    const source = authoritative();
    const operationId = createKanbanOperationId('rejecting-operation');
    const pending = composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [
        Object.freeze({
          operationId,
          kind: 'card-move' as const,
          state: 'pending' as const,
          affected: Object.freeze([
            Object.freeze({ kind: 'card' as const, cardKey: 1 }),
            Object.freeze({ kind: 'column' as const, columnId: 'doing' }),
          ]),
          projection: Object.freeze({
            kind: 'card-move' as const,
            state: 'pending' as const,
            cardKeys: Object.freeze([1]),
            sources: Object.freeze([Object.freeze({ columnId: 'ready' })]),
            target: Object.freeze({ columnId: 'doing' }),
            position: Object.freeze({ kind: 'start' as const, cursorRevision: 1 }),
          }),
        }),
      ],
    });
    const rejected = composeKanbanViewportOverlay({
      authoritative: source,
      bounds: { x: 0, y: 0, width: 36, height: 12 },
      density: 'comfortable',
      operations: [
        Object.freeze({
          operationId,
          kind: 'card-move' as const,
          state: 'rejected' as const,
          affected: Object.freeze([Object.freeze({ kind: 'card' as const, cardKey: 1 })]),
          code: 'private-reason',
        }),
      ],
    });
    const bounds = Object.freeze({ x: 0, y: 0, width: 36, height: 12 });
    const damage = calculateKanbanViewportDamage({
      previous: pending,
      current: rejected,
      bounds,
      previousOffsets: { x: 0, y: 0 },
      currentOffsets: { x: 0, y: 0 },
    });

    expect(damage.some(({ kind, x }) => kind === 'overlay' && x === 0)).toBe(true);
    expect(damage.some(({ kind, x }) => kind === 'overlay' && x === 18)).toBe(true);
    expect(damage.some(({ kind, y }) => kind === 'overlay' && y === 11)).toBe(true);
  });
});
