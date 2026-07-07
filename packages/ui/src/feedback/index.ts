/**
 * Public surface of the feedback family: the determinate {@link ProgressBar} (smooth sub-cell fill),
 * the indeterminate {@link Spinner} (caller-driven frame), and the {@link runSpinner} timer helper
 * that drives a spinner over an injectable timer.
 */
export { ProgressBar, PARTIAL, asciiOnly } from './progress-bar.js';
export type { ProgressBarOptions, LabelPosition } from './progress-bar.js';
export { Spinner, SPINNERS } from './spinner.js';
export type { SpinnerOptions, SpinnerName } from './spinner.js';
export { runSpinner } from './run-spinner.js';
export type { RunSpinnerOptions, TimerSeam } from './run-spinner.js';
