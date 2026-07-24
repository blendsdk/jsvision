import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { inspectShippedDependencyClosure, runHeadlessCompatibilityProbe } from '../src/architecture/feasibility.js';
import { runFeasibilityProbeCli } from '../src/architecture/feasibility-runner.js';
import { inspectDependencyClosureFrom } from '../src/architecture/installed-dependencies.js';
import { runReferenceBenchmark, runSchedulingStressProbe } from '../bench/reference.js';

describe('architecture probe implementation', () => {
  it('keeps supported entry points isolated and repeatable', async () => {
    const first = await runHeadlessCompatibilityProbe();
    const second = await runHeadlessCompatibilityProbe();

    expect(second).toEqual(first);
    expect(first.initializedUnrelatedParsers).toEqual([]);
    expect(first.spawnedProcesses).toBe(0);
  });

  it('rejects unbounded benchmark and scheduler inputs', async () => {
    await expect(
      runReferenceBenchmark({
        fixtures: [{ label: 'too large', sizeBytes: 2 * 1024 * 1024 + 1 }],
        sampleCount: 1,
        warmupCount: 0,
      }),
    ).rejects.toThrow(RangeError);

    await expect(
      runSchedulingStressProbe({
        backgroundKinds: ['parser', 'parser', 'completion'],
        interactiveUpdates: 1,
      }),
    ).rejects.toThrow(RangeError);

    await expect(
      runSchedulingStressProbe({
        backgroundKinds: ['parser', 'diagnostic', 'completion', 'completion'],
        interactiveUpdates: 1,
      }),
    ).rejects.toThrow(RangeError);
  });

  it('reports runner failures as bounded JSON without throwing', async () => {
    const output: string[] = [];
    const errors: string[] = [];
    const exitCode = await runFeasibilityProbeCli({
      runProbe: () => Promise.reject(new Error('probe failed safely')),
      writeOutput: (value) => output.push(value),
      writeError: (value) => errors.push(value),
    });

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual(['{"error":"probe failed safely"}\n']);
  });

  it('returns a deterministic server-safe package closure', async () => {
    const first = await inspectShippedDependencyClosure();
    const second = await inspectShippedDependencyClosure();

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      unapprovedRuntimePackages: [],
      domRuntimePackages: [],
      browserRuntimePackages: [],
      ideRuntimePackages: [],
      incompatibleLicenses: [],
      allLicensesMitCompatible: true,
    });
    expect(first.packages.length).toBeGreaterThan(0);
    expect(first.packages.every((entry) => entry.version.length > 0)).toBe(true);
  });

  it('keeps nested versions and installed optional dependencies in the closure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'code-editor-deps-'));
    const manifest = (
      name: string,
      version: string,
      dependencies: Readonly<Record<string, string>> = {},
      optionalDependencies: Readonly<Record<string, string>> = {},
    ) =>
      JSON.stringify({
        name,
        version,
        license: 'MIT',
        dependencies,
        optionalDependencies,
      });

    try {
      const paths = [
        join(root, 'node_modules', 'left', 'node_modules', 'shared'),
        join(root, 'node_modules', 'right', 'node_modules', 'shared'),
        join(root, 'node_modules', 'optional-runtime'),
        join(root, 'node_modules', 'left'),
        join(root, 'node_modules', 'right'),
      ];
      await Promise.all(paths.map((path) => mkdir(path, { recursive: true })));
      await writeFile(
        join(root, 'package.json'),
        manifest('fixture-root', '1.0.0', { left: '1.0.0', right: '1.0.0' }, { 'optional-runtime': '1.0.0' }),
      );
      await writeFile(
        join(root, 'node_modules', 'left', 'package.json'),
        manifest('left', '1.0.0', { shared: '1.0.0' }),
      );
      await writeFile(
        join(root, 'node_modules', 'right', 'package.json'),
        manifest('right', '1.0.0', { shared: '2.0.0' }),
      );
      await writeFile(
        join(root, 'node_modules', 'left', 'node_modules', 'shared', 'package.json'),
        manifest('shared', '1.0.0'),
      );
      await writeFile(
        join(root, 'node_modules', 'right', 'node_modules', 'shared', 'package.json'),
        manifest('shared', '2.0.0'),
      );
      await writeFile(
        join(root, 'node_modules', 'optional-runtime', 'package.json'),
        manifest('optional-runtime', '1.0.0'),
      );

      const closure = await inspectDependencyClosureFrom(join(root, 'package.json'));

      expect(closure.packages.filter((entry) => entry.name === 'shared').map((entry) => entry.version)).toEqual([
        '1.0.0',
        '2.0.0',
      ]);
      expect(closure.packages.some((entry) => entry.name === 'optional-runtime')).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
