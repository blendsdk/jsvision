/** Controlled local timing evidence for the representative mixed-height Kanban board. */
import { cpus } from 'node:os';

import { serialize } from '@jsvision/core';
import { createApplication, resolveCapabilities } from '@jsvision/ui';
import { expect, test } from 'vitest';

import { KanbanBoard, createEagerKanbanDataSource, createStandardKanbanCardAdapter } from '../src/index.js';
import {
  createKanbanStabilizationFixture,
  invalidateKanbanViewportProjectionForTesting,
  inspectKanbanViewportScale,
  observeKanbanViewportOperations,
} from '../src/testing.js';

const ITERATIONS = 200;
const WARMUPS = 20;
const MEDIAN_BUDGET_MS = 16;
const P95_DIAGNOSTIC_MS = 33;
const CAPS = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', mouse: { sgr: true, drag: true, wheel: true } },
}).profile;
const timingTest = process.env.CI || process.env.TUI_SKIP_PERF ? test.skip : test;

/** Returns one sorted percentile without mutating the caller's samples. */
function percentile(samples: readonly number[], fraction: number): number {
  const ordered = [...samples].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * fraction))] ?? Number.POSITIVE_INFINITY;
}

/** Measures one callback after fixed discarded warmups. */
function samples(measure: (iteration: number) => void): readonly number[] {
  for (let iteration = 0; iteration < WARMUPS; iteration += 1) measure(iteration);
  return Object.freeze(
    Array.from({ length: ITERATIONS }, (_, iteration) => {
      const start = performance.now();
      measure(iteration);
      return performance.now() - start;
    }),
  );
}

timingTest('keeps mixed-height projection and captured pointer feedback within the local frame budget', () => {
  const fixture = createKanbanStabilizationFixture();
  const source = createEagerKanbanDataSource(() => fixture.cards, {
    columns: () => fixture.columns,
    keyOf: (card) => card.key,
    columnOf: (card) => card.columnId,
  });
  const board = new KanbanBoard({
    source,
    query: () => ({ filters: [], sort: [], viewRevision: 'perf-kanban-r1' }),
    card: createStandardKanbanCardAdapter(),
    presentation: () => ({
      revision: 'perf-mixed-height-r1',
      cardRows: 6,
      cardGap: 1,
      metadataFields: 2,
      labelRows: 1,
      summarySections: 1,
      checklistMode: 'preview',
      checklistPreviewItems: 2,
    }),
    dispatcher: (request) => ({ kind: 'accepted', operationId: request.operationId }),
    operationEligibility: () => ({ kind: 'allowed' }),
    overscan: { horizontal: 0, vertical: 0 },
  });
  board.setLayout({ position: 'fill' });
  const application = createApplication({ content: board, viewport: { width: 80, height: 24 }, caps: CAPS });
  application.loop.renderRoot.flush();
  const scale = inspectKanbanViewportScale(board.viewport);
  const descriptorMix = [
    ...new Set(board.inspection().visibleCards.map(({ descriptor }) => descriptor.measuredHeight)),
  ];

  const projectionSamples = samples(() => {
    invalidateKanbanViewportProjectionForTesting(board.viewport);
    board.viewport.invalidate();
    application.loop.renderRoot.flush();
  });
  const projectionEvidence = observeKanbanViewportOperations(board.viewport, 'benchmark-projection-proof');
  invalidateKanbanViewportProjectionForTesting(board.viewport);
  board.viewport.invalidate();
  application.loop.renderRoot.flush();
  expect(projectionEvidence.snapshot().work.residentDescriptors).toBeGreaterThan(0);
  projectionEvidence.dispose();

  const sourceTarget = board
    .inspection()
    .actionTargets.find(({ kind, cardKey }) => kind === 'card' && cardKey === fixture.named.short);
  const origin = application.loop.renderRoot.originOf(board.viewport);
  if (sourceTarget === undefined || origin === null) throw new Error('Expected visible performance drag source.');
  const down = { x: origin.x + sourceTarget.x + 2, y: origin.y + sourceTarget.y + 1 };
  application.loop.dispatch({ type: 'mouse', kind: 'down', button: 0, ...down });
  application.loop.dispatch({ type: 'mouse', kind: 'move', button: 0, x: down.x + 2, y: down.y });

  let prior = application.loop.renderRoot.buffer().clone();
  let sink = 0;
  const encoder = new TextEncoder();
  application.loop.onFrame = (buffer) => {
    sink += encoder.encode(serialize(buffer, prior, { caps: CAPS })).byteLength;
    prior = buffer.clone();
  };
  const pointerSamples = samples((iteration) => {
    application.loop.dispatch({
      type: 'mouse',
      kind: 'drag',
      button: 0,
      x: down.x + 4 + (iteration % 2),
      y: down.y + 1 + (iteration % 2),
    });
  });

  const projectionMedian = percentile(projectionSamples, 0.5);
  const projectionP95 = percentile(projectionSamples, 0.95);
  const pointerMedian = percentile(pointerSamples, 0.5);
  const pointerP95 = percentile(pointerSamples, 0.95);
  const metadata = {
    cpu: cpus()[0]?.model ?? 'unknown',
    runtime: process.version,
    date: new Date().toISOString(),
    sourceMode: 'eager',
    fixtureCards: fixture.cards.length,
    visibleCards: scale.projectedCards,
    retainedDescriptors: scale.retainedDescriptors,
    descriptorMix,
    capabilities: { colorDepth: CAPS.colorDepth, widthMode: CAPS.unicode.widthMode },
    terminalHarness: 'in-memory-core-serializer',
    warmups: WARMUPS,
    iterations: ITERATIONS,
    projection: { medianMs: projectionMedian, p95Ms: projectionP95, p95TargetMs: P95_DIAGNOSTIC_MS },
    pointer: { medianMs: pointerMedian, p95Ms: pointerP95, p95TargetMs: P95_DIAGNOSTIC_MS },
  };
  console.log(`kanban performance ${JSON.stringify(metadata)}`);

  expect(sink).toBeGreaterThan(0);
  expect(descriptorMix.length).toBeGreaterThan(1);
  expect(projectionMedian, `projection median ${projectionMedian.toFixed(3)}ms`).toBeLessThanOrEqual(MEDIAN_BUDGET_MS);
  expect(pointerMedian, `pointer median ${pointerMedian.toFixed(3)}ms`).toBeLessThanOrEqual(MEDIAN_BUDGET_MS);
  application.loop.dispose();
});
