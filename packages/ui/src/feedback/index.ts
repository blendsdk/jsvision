/**
 * RD-18 feedback subsystem barrel — the determinate {@link ProgressBar} (smooth sub-cell fill) + the
 * indeterminate {@link Spinner} (caller-driven) + the {@link runSpinner} timer helper. Documented new
 * components (TV has no gauge/spinner class, AR-186); additive surface = 2 core `progress*` theme
 * roles + the `DrawContext.caps` seam. The `.js` extension in import specifiers is required by
 * NodeNext ESM resolution.
 */
export { ProgressBar, PARTIAL, asciiOnly } from './progress-bar.js';
export type { ProgressBarOptions, LabelPosition } from './progress-bar.js';
export { Spinner, SPINNERS } from './spinner.js';
export type { SpinnerOptions, SpinnerName } from './spinner.js';
export { runSpinner } from './run-spinner.js';
export type { RunSpinnerOptions, TimerSeam } from './run-spinner.js';
