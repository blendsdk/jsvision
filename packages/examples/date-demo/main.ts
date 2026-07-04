/**
 * Date-family walkthrough (RD-20) — a narrated, headless console demo of `@jsvision/ui`'s `Calendar`
 * + `DatePicker`: a `Calendar` (September 2026, today = the 3rd) rendered, then day-navigated (`→`),
 * then month-navigated (PgDn → October), then a day committed (Enter); then a `DatePicker` field whose
 * `Alt+↓` opens the anchored `Calendar` popup, and an Enter commits today into the field — all rendered
 * through a real `RenderRoot` (no TTY), printing a composed ASCII frame after each step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:date
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, Calendar, DatePicker, createEventLoop, signal, toISO } from '@jsvision/ui';
import type { CalendarDate, PopupHost } from '@jsvision/ui';

/** A fixed "today" so the walkthrough is deterministic (no real clock). */
const TODAY: CalendarDate = { year: 2026, month: 9, day: 3 };

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

/** Steps 1-4: a standalone Calendar — render → day-nav → month-nav → commit. */
function calendarWalkthrough(): void {
  const value = signal<CalendarDate | null>(null);
  const cal = new Calendar({ value, today: TODAY, firstDayOfWeek: 0 });
  cal.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 20, height: 8 } };
  const root = new Group();
  root.add(cal);
  const loop = createEventLoop({ width: 20, height: 8 }, { caps });
  loop.mount(root);
  loop.focusView(cal);
  loop.renderRoot.flush();
  const frame = (t: string): void => printFrame(t, loop.renderRoot.buffer().rows());

  frame('Step 1 — Calendar September 2026, cursor on today (3)');
  loop.dispatch(key('right'));
  loop.renderRoot.flush();
  frame('Step 2 — → day-nav: the cursor moves to the 4th');
  loop.dispatch(key('pagedown'));
  loop.renderRoot.flush();
  frame('Step 3 — PgDn: month nav to October 2026');
  loop.dispatch(key('enter'));
  loop.renderRoot.flush();
  frame('Step 4 — Enter commits the cursor day');
  console.log(`  Calendar value = ${value() === null ? '(none)' : toISO(value() as CalendarDate)}`);
}

/** Steps 5-6: a DatePicker — Alt+↓ opens the anchored Calendar popup, Enter commits today. */
function pickerWalkthrough(): void {
  const value = signal<CalendarDate | null>(null);
  const dp = new DatePicker({ value, today: TODAY });
  dp.layout = { position: 'absolute', rect: { x: 2, y: 1, width: 16, height: 1 } };
  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 40, height: 16 } };
  overlay.state.visible = false;
  const root = new Group();
  root.add(dp);
  root.add(overlay);
  const loop = createEventLoop({ width: 40, height: 16 }, { caps });
  loop.mount(root);
  const host: PopupHost = { overlay, focusView: (v) => loop.focusView(v), getFocused: () => loop.getFocused() };
  loop.popupHost = host;
  loop.focusView(dp.input);
  loop.renderRoot.flush();
  const frame = (t: string): void => printFrame(t, loop.renderRoot.buffer().rows());

  frame('Step 5 — DatePicker field (empty), ▐↓▌ dropdown button on the right');
  loop.dispatch(key('down', { alt: true }));
  loop.renderRoot.flush();
  frame('Step 5b — Alt+↓ opens the anchored Calendar popup');
  loop.dispatch(key('enter'));
  loop.renderRoot.flush();
  frame('Step 6 — Enter commits today; the popup closes and the field fills');
  console.log(`  DatePicker value = ${value() === null ? '(none)' : toISO(value() as CalendarDate)}`);
}

function main(): void {
  calendarWalkthrough();
  pickerWalkthrough();
  console.log('\nDone — a Calendar navigated + committed a day, and a DatePicker opened its popup + committed today.');
}

main();
