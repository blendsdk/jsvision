import { defineConfig } from 'vitest/config';
import { BaseSequencer } from 'vitest/node';
import type { TestSpecification } from 'vitest/node';

/** Controlled wall-clock files in the exact order required before functional CPU warmup. */
const PERFORMANCE_FILE_ORDER = Object.freeze(['perf-kanban-bench.spec.test.ts', 'phase-d-performance.spec.test.ts']);

/** Returns the fixed leading order for one performance file, or the shared functional rank. */
function performanceRank(moduleId: string): number {
  const index = PERFORMANCE_FILE_ORDER.findIndex((file) => moduleId.endsWith(file));
  return index < 0 ? PERFORMANCE_FILE_ORDER.length : index;
}

/** Preserves Vitest's normal ordering while placing controlled wall-clock evidence first. */
class KanbanPerformanceFirstSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const sorted = await super.sort(files);
    return sorted.sort((left, right) => performanceRank(left.moduleId) - performanceRank(right.moduleId));
  }
}

/** Separates fast contract tests from process and rendered-host integration tests. */
export default defineConfig({
  test: {
    sequence: { sequencer: KanbanPerformanceFirstSequencer },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.{spec,impl,property,perf}.test.ts', 'src/**/*.{spec,impl,property,perf}.test.ts'],
          exclude: ['test/**/*.e2e.test.ts', 'node_modules/**'],
          // Performance files run first in a deterministic order; serial files prevent sibling-worker contention.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e.test.ts'],
          pool: 'forks',
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
