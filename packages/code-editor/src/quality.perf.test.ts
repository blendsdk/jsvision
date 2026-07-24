import { describe, expect, it } from 'vitest';

import { runReferenceBenchmark, runSchedulingStressProbe } from '../bench/reference.js';
import { classifyDocumentSize } from './limits.js';

describe('cross-cutting quality performance', () => {
  it('reports bounded slices and leaves no flood work pending after cancellation', async () => {
    const result = await runSchedulingStressProbe({
      backgroundKinds: ['parser', 'diagnostic', 'completion'],
      interactiveUpdates: 100,
    });

    expect(result.maximumBackgroundSliceMs).toBeLessThanOrEqual(result.backgroundSliceBudgetMs);
    expect(result.pendingWorkAfterCancellation).toBe(0);
    expect(result.cancelledStaleWorkPresented).toBe(false);
    expect(Object.values(result.interactivePrecededBackground).every(Boolean)).toBe(true);
  });

  it('covers full, large, and reduced tier boundaries without allocating tier-sized text', () => {
    const tiers = [
      classifyDocumentSize({ bytes: 1_048_576, lines: 50_000 }),
      classifyDocumentSize({ bytes: 1_048_577, lines: 50_001 }),
      classifyDocumentSize({ bytes: 10 * 1_048_576 + 1, lines: 100_000 }),
    ];

    expect(tiers.map(({ mode }) => mode)).toEqual(['full', 'large', 'reduced']);
    expect(tiers.every(({ preservedFeatures }) => preservedFeatures.includes('edit'))).toBe(true);
    expect(tiers.every(({ preservedFeatures }) => preservedFeatures.includes('save'))).toBe(true);
    expect(tiers.every(({ preservedFeatures }) => preservedFeatures.includes('close'))).toBe(true);
  });

  it('reports reference latency percentiles and isolated retained memory', async () => {
    const evidence = await runReferenceBenchmark({
      fixtures: [
        { label: '1 MiB quality', sizeBytes: 1_048_576 },
        { label: '50,000 lines quality', lineCount: 50_000 },
      ],
      sampleCount: 3,
      warmupCount: 1,
    });

    expect(evidence.sampleCount).toBe(3);
    expect(evidence.peakRetainedBytes).toBeGreaterThanOrEqual(0);
    expect(evidence.memoryAfterDisposalBytes).toBeGreaterThan(0);
    // The committed serial benchmark enforces 16 ms; this parallel unit suite guards
    // gross regressions while avoiding false failures from repository-wide CPU contention.
    expect(evidence.fixtures.every(({ editAndViewport }) => editAndViewport.p95Ms <= 100)).toBe(true);
  });
});
