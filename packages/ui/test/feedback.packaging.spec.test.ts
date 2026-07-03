/**
 * Specification test (immutable oracle) — jsvision-ui RD-18 feedback packaging (ST-12).
 *
 * Source: RD-18 AC-12 → ST-12 (plans/feedback/03-03-theme-packaging.md §Packaging, PA-6). The
 * `feedback/` subsystem lives under `src/` with explicit named re-exports from `src/index.ts`
 * (imported here BY NAME from `@jsvision/ui`, the published surface), every `feedback/` source file is
 * ≤ 500 lines, and the package declares zero native runtime dependencies (mirrors `tabs.packaging.spec`).
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signal } from '@jsvision/ui';
import { ProgressBar, Spinner, runSpinner, SPINNERS } from '@jsvision/ui';
import type { ProgressBarOptions, SpinnerOptions, SpinnerName, RunSpinnerOptions, TimerSeam } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ST-12 / AC-12 — ProgressBar/Spinner/runSpinner/SPINNERS (+ the types) re-export from @jsvision/ui.
test('ST-12: ProgressBar/Spinner/runSpinner/SPINNERS re-export from @jsvision/ui', () => {
  expect(typeof ProgressBar).toBe('function');
  expect(typeof Spinner).toBe('function');
  expect(typeof runSpinner).toBe('function');
  // The value/frame signals + the option types resolve (the type-only imports compile ⇒ re-exported).
  const barOpts: ProgressBarOptions = { value: signal(0), caption: true };
  const bar = new ProgressBar(barOpts);
  expect(typeof bar.set).toBe('function');
  expect(bar.percent).toBe(0);
  const preset: SpinnerName = 'dots';
  const spinOpts: SpinnerOptions = { frame: signal(0), preset, label: 'x' };
  expect(new Spinner(spinOpts)).toBeTruthy();
  // SPINNERS carries the three named presets.
  expect(Object.keys(SPINNERS).sort()).toEqual(['blocks', 'dots', 'line']);
});

// ST-12 — the runSpinner option/seam types resolve from the published surface.
test('ST-12: RunSpinnerOptions + TimerSeam are re-exported and usable', () => {
  const armed: number[] = [];
  const timer: TimerSeam = {
    setTimer: (_fn, ms) => {
      armed.push(ms);
      return 1;
    },
    clearTimer: () => {},
  };
  const opts: RunSpinnerOptions = { intervalMs: 120, timer };
  const stop = runSpinner(signal(0), opts);
  expect(armed[0]).toBe(120);
  stop();
});

// ST-12 — every file in src/feedback/ is ≤ 500 lines (architecture boundary, PA-6).
test('ST-12: each src/feedback/ source file is ≤ 500 lines', () => {
  const dir = join(here, '..', 'src', 'feedback');
  for (const file of tsFiles(dir)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    expect(lines, file).toBeLessThanOrEqual(500);
  }
});

// ST-12 / AC-12 — the package declares no third-party/native runtime dependency (check:deps clean).
test('ST-12: @jsvision/ui declares only the workspace @jsvision/core runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});
