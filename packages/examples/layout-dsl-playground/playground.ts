/**
 * Pure composition for `demo:layout-dsl` — the reactive state, the live-preview tree builder, the
 * key→state mutation, and the legend formatter. Kept free of any terminal/host wiring so it can be
 * unit-tested headlessly (see `test/layout-dsl-playground.smoke.spec.test.ts`); `main.ts` wraps it in
 * a real-TTY application.
 *
 * The preview is built entirely with the declarative layout DSL under test (`col`/`row`/`grow`/
 * `fixed`/`spacer`/`stack` + `centered`/`topRight`/`bottomRight`), so toggling a parameter and
 * watching the frame re-flow is a live demonstration of the DSL itself.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import {
  Group,
  Text,
  signal,
  col,
  row,
  grow,
  fixed,
  spacer,
  stack,
  centered,
  topRight,
  bottomRight,
} from '@jsvision/ui';
import type { View, Flex, Justify, Align, ThemeRoleName, Signal, Size2D } from '@jsvision/ui';

/** Option labels for each cyclable parameter, indexed by the bound signal. */
export const MODES = ['flow', 'stack'] as const;
const DIRECTIONS = ['row', 'col'] as const;
const JUSTIFY: readonly Justify[] = ['start', 'center', 'end', 'space-between'];
const ALIGN: readonly Align[] = ['start', 'center', 'end', 'stretch'];
const SIZING = ['grow equal', 'fixed + grow', 'fr 1:2:1', 'auto (justify/align)', 'spacer'] as const;
/** Inclusive maxima for the two numeric parameters (each cycles `0..MAX`). */
const GAP_MAX = 4;
const PAD_MAX = 3;

/** The reactive parameter state — one signal per cyclable/toggle-able facet of the DSL. */
export interface PlaygroundState {
  readonly mode: Signal<number>;
  readonly direction: Signal<number>;
  readonly justify: Signal<number>;
  readonly align: Signal<number>;
  readonly sizing: Signal<number>;
  readonly gap: Signal<number>;
  readonly padding: Signal<number>;
  readonly centered: Signal<boolean>;
  readonly corners: Signal<boolean>;
}

/** A plain snapshot of {@link PlaygroundState} — what the preview builder and legend consume. */
export interface PreviewParams {
  mode: number;
  direction: number;
  justify: number;
  align: number;
  sizing: number;
  gap: number;
  padding: number;
  centered: boolean;
  corners: boolean;
}

/** Create the reactive state with sensible defaults (flow · row · center · stretch · fr 1:2:1). */
export function createState(): PlaygroundState {
  return {
    mode: signal(0),
    direction: signal(0),
    justify: signal(1),
    align: signal(3),
    sizing: signal(2),
    gap: signal(1),
    padding: signal(0),
    centered: signal(true),
    corners: signal(true),
  };
}

/** Read every signal (subscribing, when called inside an effect) into a plain {@link PreviewParams}. */
export function snapshot(s: PlaygroundState): PreviewParams {
  return {
    mode: s.mode(),
    direction: s.direction(),
    justify: s.justify(),
    align: s.align(),
    sizing: s.sizing(),
    gap: s.gap(),
    padding: s.padding(),
    centered: s.centered(),
    corners: s.corners(),
  };
}

/** Advance a numeric signal to the next value in `[0, n)`, wrapping. */
function cycle(sig: Signal<number>, n: number): void {
  sig.set((sig.peek() + 1) % n);
}

/**
 * Apply a single key press to the state (cycle a parameter or flip a toggle).
 *
 * @param s The reactive state to mutate.
 * @param key The pressed key (a single character).
 * @returns `true` if the key mapped to a parameter (so the caller consumes it), else `false`.
 */
export function applyKey(s: PlaygroundState, key: string): boolean {
  switch (key) {
    case 'm':
      cycle(s.mode, MODES.length);
      return true;
    case 'd':
      cycle(s.direction, DIRECTIONS.length);
      return true;
    case 'j':
      cycle(s.justify, JUSTIFY.length);
      return true;
    case 'a':
      cycle(s.align, ALIGN.length);
      return true;
    case 's':
      cycle(s.sizing, SIZING.length);
      return true;
    case 'g':
      cycle(s.gap, GAP_MAX + 1);
      return true;
    case 'p':
      cycle(s.padding, PAD_MAX + 1);
      return true;
    case 'c':
      s.centered.set(!s.centered.peek());
      return true;
    case 'x':
      s.corners.set(!s.corners.peek());
      return true;
    default:
      return false;
  }
}

/** A labelled, themed box with an intrinsic 14×3 natural size (so `align` has room to position it). */
function boxView(text: string, role: ThemeRoleName): Group {
  const g = new Group();
  g.background = role;
  g.measure = (): Size2D => ({ width: 14, height: 3 });
  const t = new Text(text);
  t.layout = { position: 'absolute', rect: { x: 1, y: 0, width: Math.max(4, text.length + 1), height: 1 } };
  g.add(t);
  return g;
}

/** Build the flow preview: a `row`/`col` of three boxes sized by the current preset. */
function buildFlow(p: PreviewParams): Group {
  const a = boxView('A', 'window');
  const b = boxView('B', 'buttonDefault');
  const c = boxView('C', 'clusterNormal');

  let children: View[];
  switch (p.sizing) {
    case 1: // fixed + grow
      fixed(a, 14);
      grow(b);
      grow(c);
      children = [a, b, c];
      break;
    case 2: // fr 1:2:1
      grow(a, 1);
      grow(b, 2);
      grow(c, 1);
      children = [a, b, c];
      break;
    case 3: // auto — boxes keep their natural size, so justify + align both take visible effect
      children = [a, b, c];
      break;
    case 4: // spacer — a flexible gap pushes C to the far edge
      children = [a, spacer(), c];
      break;
    default: // grow equal
      grow(a);
      grow(b);
      grow(c);
      children = [a, b, c];
      break;
  }

  const props: Flex = { justify: JUSTIFY[p.justify], align: ALIGN[p.align], gap: p.gap, padding: p.padding };
  return p.direction === 1 ? col(props, ...children) : row(props, ...children);
}

/** Build the stack preview: a filling base plus the enabled overlays (centered box + corner badges). */
function buildStack(p: PreviewParams): Group {
  const layers: View[] = [boxView("position:'fill' base", 'window')];
  if (p.centered) layers.push(centered(boxView('centered 22x5', 'buttonDefault'), 22, 5));
  if (p.corners) {
    layers.push(topRight(boxView('top-right', 'clusterNormal'), 11, 1));
    layers.push(bottomRight(boxView('bottom-right', 'clusterNormal'), 14, 1));
  }
  return stack({ padding: p.padding }, ...layers);
}

/** Build the live preview tree from a parameter snapshot (flow or stack mode). */
export function buildPreviewTree(p: PreviewParams): Group {
  return p.mode === 1 ? buildStack(p) : buildFlow(p);
}

/** Format the left-panel legend: every parameter, its current value, and the key that cycles it. */
export function formatLegend(p: PreviewParams): string {
  const flowActive = p.mode === 0;
  const na = (active: boolean, value: string): string => (active ? value : `${value}  (n/a)`);
  const lines = [
    ' LAYOUT DSL — LIVE PLAYGROUND',
    '',
    ` [m] Mode ......... ${MODES[p.mode]}`,
    '',
    ` ${flowActive ? '▸' : ' '} flow (col / row)`,
    ` [d] Direction .... ${na(flowActive, DIRECTIONS[p.direction])}`,
    ` [j] Justify ...... ${na(flowActive, JUSTIFY[p.justify])}`,
    ` [a] Align ........ ${na(flowActive, ALIGN[p.align])}`,
    ` [s] Sizing ....... ${na(flowActive, SIZING[p.sizing])}`,
    '',
    ` ${flowActive ? ' ' : '▸'} stack (z-overlay)`,
    ` [c] Centered ..... ${na(!flowActive, p.centered ? 'on' : 'off')}`,
    ` [x] Corners ...... ${na(!flowActive, p.corners ? 'on' : 'off')}`,
    '',
    ' shared',
    ` [g] Gap .......... ${p.gap}`,
    ` [p] Padding ...... ${p.padding}`,
    '',
    ' [q] Quit   (also Alt-X / Ctrl-C)',
    '',
    ' Resize the terminal to watch it re-flow.',
  ];
  return lines.join('\n');
}
