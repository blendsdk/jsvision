/**
 * A Calendar laboratory showing bounded navigation, selection, disabled dates, and stable today.
 */
import { Calendar, Group, Text, at, createKeymap, dayOfWeek, signal, toISO } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import type { CalendarDate } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_MIN = 'calendar-lab.minimum';
const TODAY: CalendarDate = { year: 2026, month: 7, day: 15 };
const MIN: CalendarDate = { year: 2026, month: 7, day: 10 };
const MAX: CalendarDate = { year: 2026, month: 8, day: 31 };
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 13;

export default defineExample({
  title: 'Calendar Lab',
  blurb: 'Navigate a deterministic civil-date grid with week numbers, inclusive bounds, and disabled Sundays.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+b': CMD_MIN }),
    });
    const value = signal<CalendarDate | null>(null);
    const calendar = new Calendar({
      value,
      today: TODAY,
      min: MIN,
      max: MAX,
      firstDayOfWeek: 1,
      showWeekNumbers: true,
      density: 'compact',
      isDisabled: (date) => dayOfWeek(date) === 0,
    });
    const dialog = new Template1Dialog({
      title: ' Calendar Lab ',
      width: 60,
      height: 17,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('Monday-first · ISO weeks · Sundays disabled'), 0, 0, 56, 1));
    content.add(at(calendar, 0, 2, 23, 8));
    content.add(at(new Text(() => `Selection: ${value() === null ? 'none' : toISO(value()!)}`), 27, 2, 29, 2));
    content.add(at(new Text('Bounds:\n2026-07-10\nthrough\n2026-08-31'), 27, 5, 20, 4));
    content.add(at(new Text('Arrows move · Enter selects · PgUp/PgDn month'), 0, 11, 56, 1));
    content.add(at(new Text('Alt+B selects the minimum · T returns to today'), 0, 12, 56, 1));

    app.onCommand(CMD_MIN, () => calendar.select(MIN));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(calendar);
    return app;
  },
});
