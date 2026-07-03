/**
 * Feedback walkthrough (RD-18) — a narrated, headless console demo of `@jsvision/ui`'s `ProgressBar`
 * + `Spinner`: a determinate bar driven 0 → 33 → 66 → 100 % (smooth sub-cell eighth-block fill over a
 * `░` track), then a `Spinner` stepped through several frames, then the pure-ASCII fallback form (`#`
 * fill / `-` track for the bar, `line` preset for the spinner) under a Unicode-off capability profile
 * — all rendered through a real `RenderRoot` (no TTY), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:feedback
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { CapabilityProfile } from '@jsvision/core';
import { Group, ProgressBar, Spinner, createEventLoop, signal } from '@jsvision/ui';

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** Full-Unicode caps → smooth sub-cell fill + braille spinner. */
const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: true }, glyphs: { boxDrawing: true, halfBlocks: true } },
}).profile;
/** Unicode-off caps → whole-cell `#`/`-` bar + `line` spinner. */
const asciiCaps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor', unicode: { utf8: false } },
}).profile;

const WIDTH = 34;
const BAR_H = 1;
const SPIN_H = 1;

/** Mount a single view filling `w×h` under `profile`; return the loop + a frame() printer. */
function mount(view: Group, w: number, h: number, profile: CapabilityProfile) {
  const loop = createEventLoop({ width: w, height: h }, { caps: profile });
  loop.mount(view);
  return { loop, frame: (title: string) => printFrame(title, loop.renderRoot.buffer().rows()) };
}

/** Wrap a leaf view in an absolutely-placed root group. */
function rootOf(child: { layout: unknown }, w: number, h: number): Group {
  child.layout = { position: 'absolute', rect: { x: 0, y: 0, width: w, height: h } };
  const g = new Group();
  g.add(child as never);
  return g;
}

function main(): void {
  // --- Determinate bar: 0 → 33 → 66 → 100 % (smooth sub-cell fill) ---
  const value = signal(0);
  const bar = new ProgressBar({ value, caption: true });
  const barDemo = mount(rootOf(bar, WIDTH, BAR_H), WIDTH, BAR_H, caps);
  for (const pct of [0, 33, 66, 100]) {
    value.set(pct / 100);
    barDemo.loop.renderRoot.flush();
    barDemo.frame(`Frame — ProgressBar ${pct}% (smooth █ + eighth-block partial over ░)`);
  }

  // --- Indeterminate spinner: stepped through several frames (dots) ---
  const frame = signal(0);
  const spin = new Spinner({ frame, preset: 'dots', label: 'Loading…' });
  const spinDemo = mount(rootOf(spin, WIDTH, SPIN_H), WIDTH, SPIN_H, caps);
  for (let i = 0; i < 4; i += 1) {
    frame.set(i);
    spinDemo.loop.renderRoot.flush();
    spinDemo.frame(`Frame — Spinner (dots) frame ${i}`);
  }

  // --- ASCII fallback (Unicode-off caps): bar → #/- , spinner → line ---
  const av = signal(0.5);
  const abar = new ProgressBar({ value: av, caption: true });
  const abarDemo = mount(rootOf(abar, WIDTH, BAR_H), WIDTH, BAR_H, asciiCaps);
  abarDemo.frame('Frame — ASCII fallback: ProgressBar 50% renders whole-cell # fill / - track');

  const af = signal(1);
  const aspin = new Spinner({ frame: af, preset: 'dots', label: 'Loading…' });
  const aspinDemo = mount(rootOf(aspin, WIDTH, SPIN_H), WIDTH, SPIN_H, asciiCaps);
  aspinDemo.frame('Frame — ASCII fallback: Spinner dots → line preset (still animates)');

  console.log('\nDone — a ProgressBar filled 0→100% (smooth), a Spinner animated, and both fell back to ASCII.');
}

main();
