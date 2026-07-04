/**
 * Color-family walkthrough (RD-21) — a narrated, headless console demo of `@jsvision/ui`'s
 * `ColorSwatch` + `ColorPicker`: a DOS-16 `ColorSwatch` rendered, arrow-navigated (`→`), then a swatch
 * committed (Enter); then a `ColorPicker` whose Down opens the anchored swatch popup, Tab reaches the
 * hex field, a `#rrggbb` is typed, and Enter commits it — all rendered through a real `RenderRoot` (no
 * TTY), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:color
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities, ANSI16_ORDER, toRgb } from '@jsvision/core';
import type { Color, KeyEvent } from '@jsvision/core';
import { Group, ColorSwatch, ColorPicker, createEventLoop, signal } from '@jsvision/ui';
import type { PopupHost } from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: k, ctrl: false, alt: false, shift: false, ...mods };
}

/** `#rrggbb` for the echo (falls back to the raw value). */
function hexOf(c: Color): string {
  try {
    const rgb = toRgb(c);
    if (rgb === null) return '(default)';
    const h = (n: number): string => n.toString(16).padStart(2, '0');
    return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
  } catch {
    return String(c);
  }
}

/** Steps 1-3: a standalone ColorSwatch — render → arrow-nav → commit. */
function swatchWalkthrough(): void {
  const value = signal<Color>('blue'); // cell 4
  const swatch = new ColorSwatch({ value, colors: ANSI16_ORDER as readonly Color[], columns: 4 });
  const size = swatch.measure(); // 12 × 4
  swatch.layout = { position: 'absolute', rect: { x: 0, y: 0, width: size.width, height: size.height } };
  const root = new Group();
  root.add(swatch);
  const loop = createEventLoop({ width: size.width, height: size.height }, { caps });
  loop.mount(root);
  loop.focusView(swatch);
  loop.renderRoot.flush();
  const frame = (t: string): void => printFrame(t, loop.renderRoot.buffer().rows());

  frame('Step 1 — ColorSwatch (DOS-16, 4×4), ◘ marks the value (blue)');
  loop.dispatch(key('right')); // navRight(4) → 5 (magenta)
  loop.renderRoot.flush();
  frame('Step 2 — → arrow-nav moves the cursor to the next cell (magenta)');
  loop.dispatch(key('enter'));
  loop.renderRoot.flush();
  frame('Step 3 — Enter commits the cursor color; the ◘ marker follows the value');
  console.log(`  ColorSwatch value = ${value()}  ${hexOf(value())}`);
}

/** Steps 4-6: a ColorPicker — Down opens the popup, Tab reaches the hex field, a #rrggbb is committed. */
function pickerWalkthrough(): void {
  const value = signal<Color>('red');
  const picker = new ColorPicker({ value, allowCustom: true });
  picker.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 18, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 20 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(picker);
  root.add(overlay);
  const loop = createEventLoop({ width: 40, height: 20 }, { caps });
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(picker);
  loop.renderRoot.flush();
  const frame = (t: string): void => printFrame(t, loop.renderRoot.buffer().rows());

  frame('Step 4 — ColorPicker chip (red) + the ▐↓▌ dropdown button');
  loop.dispatch(key('down')); // open the anchored swatch popup
  loop.renderRoot.flush();
  frame('Step 4b — Down opens the anchored swatch + hex-field popup');
  loop.dispatch(key('tab')); // grid-first → Tab reaches the hex field
  loop.renderRoot.flush();
  for (const ch of '#12ab34') loop.dispatch(key(ch)); // type a truecolor hex
  loop.renderRoot.flush();
  frame('Step 5 — Tab to the hex field and type #12ab34');
  loop.dispatch(key('enter')); // commit + close
  loop.renderRoot.flush();
  frame('Step 6 — Enter commits the hex color; the popup closes');
  console.log(`  ColorPicker value = ${value()}  ${hexOf(value())}`);
}

function main(): void {
  swatchWalkthrough();
  pickerWalkthrough();
  console.log('\nDone — a ColorSwatch navigated + committed a color, and a ColorPicker typed + committed a hex color.');
}

main();
