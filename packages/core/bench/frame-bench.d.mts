// Hand-written declaration for frame-bench.mjs (plain Node ESM, run via tsx so
// the built engine's `.js` specifier resolves to source). Declares only the
// pure measurement helpers the perf-budget specs import — the printing CLI
// (`runBench`) has no exported surface and is intentionally left out.

/**
 * The median of a sample set: the middle value (odd length) or the mean of
 * the two middle values (even length). Does not mutate the input.
 *
 * @param xs Non-empty samples.
 * @returns The median.
 */
export declare function median(xs: readonly number[]): number;

/**
 * The 95th percentile by nearest-rank: the value at rank `ceil(0.95·n)`,
 * clamped to the last element. Does not mutate the input.
 *
 * @param xs Non-empty samples.
 * @returns The p95 value.
 */
export declare function p95(xs: readonly number[]): number;

/**
 * Median wall-clock time of composing and diff-serializing a `w`×`h` frame,
 * over `iters` warmed iterations (never a single sample).
 *
 * @param w Frame width in columns.
 * @param h Frame height in rows.
 * @param iters Timed iterations.
 * @returns The median compose+diff time in milliseconds.
 */
export declare function measureComposeDiff(w: number, h: number, iters: number): number;

/**
 * Whether the frame-budget ceiling test should hard-assert the budget or only
 * log the number. Suppressed under CI (runner jitter), inside ordinary Turbo
 * tasks (parallel contention), and via `TUI_SKIP_PERF` (an explicit local
 * opt-out). The dedicated serial runner marks its Turbo-nested checks as
 * authoritative without overriding CI or the explicit opt-out.
 *
 * @param env Environment (e.g. `process.env`).
 * @returns `'assert'` to enforce the budget, `'log'` to record only.
 */
export declare function perfBudgetMode(env: Record<string, string | undefined>): 'assert' | 'log';
