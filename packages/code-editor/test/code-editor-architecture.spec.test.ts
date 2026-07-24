import { describe, expect, it } from 'vitest';

import { inspectShippedDependencyClosure, runHeadlessCompatibilityProbe } from '../src/architecture/feasibility.js';
import { runReferenceBenchmark, runSchedulingStressProbe } from '../bench/reference.js';

describe('code editor architecture feasibility', () => {
  it('loads every supported entry point in clean Node without starting unrelated runtime work', async () => {
    // A headless consumer can import the package and its supported language subpaths
    // without browser globals, eager parser startup, or child-process side effects.
    const result = await runHeadlessCompatibilityProbe();

    expect(result.compatible).toBe(true);
    expect(result.importedEntrypoints).toEqual(['root', 'javascript', 'typescript', 'postgresql', 'node']);
    expect(result.domGlobalsDetected).toEqual([]);
    expect(result.initializedUnrelatedParsers).toEqual([]);
    expect(result.spawnedProcesses).toBe(0);
  });

  it('keeps edit and viewport work within the interactive budget on reference fixtures', async () => {
    // The reference benchmark reports reproducible latency and memory evidence for
    // both the one-mebibyte and fifty-thousand-line fixture classes.
    const sampleCount = 3;
    const result = await runReferenceBenchmark({
      fixtures: [
        { label: '1 MiB', sizeBytes: 1_048_576 },
        { label: '50,000 lines', lineCount: 50_000 },
      ],
      sampleCount,
      warmupCount: 1,
    });

    expect(result.sampleCount).toBe(sampleCount);
    expect(result.runtime).toEqual(expect.any(String));
    expect(result.environment).toEqual(expect.any(String));
    expect(result.peakRetainedBytes).toEqual(expect.any(Number));
    expect(result.fixtures).toHaveLength(2);

    expect(result.fixtures.map((fixture) => fixture.label)).toEqual(['1 MiB', '50,000 lines']);

    for (const fixture of result.fixtures) {
      expect(fixture.editAndViewport.p50Ms).toEqual(expect.any(Number));
      expect(fixture.editAndViewport.p95Ms).toEqual(expect.any(Number));
      expect(fixture.editAndViewport.p95Ms).toBeLessThanOrEqual(16);
    }
  });

  it('prioritizes interactive work while stale background work yields and disappears', async () => {
    // Interactive updates run ahead of parser, diagnostic, and completion work;
    // background tasks yield, and cancellation prevents stale results from presenting.
    const result = await runSchedulingStressProbe({
      backgroundKinds: ['parser', 'diagnostic', 'completion'],
      interactiveUpdates: 3,
    });

    expect(result.interactivePrecededBackground).toEqual({
      parser: true,
      diagnostic: true,
      completion: true,
    });
    expect(result.backgroundWorkYielded).toBe(true);
    expect(result.cancelledStaleWorkPresented).toBe(false);
  });

  it('ships only server-safe dependencies with licenses suitable for MIT distribution', async () => {
    // The distributable dependency closure excludes browser, DOM, and IDE runtime
    // packages, and every shipped license is compatible with MIT distribution.
    const result = await inspectShippedDependencyClosure();

    expect(result.domRuntimePackages).toEqual([]);
    expect(result.browserRuntimePackages).toEqual([]);
    expect(result.ideRuntimePackages).toEqual([]);
    expect(result.incompatibleLicenses).toEqual([]);
    expect(result.allLicensesMitCompatible).toBe(true);
  });
});
