/**
 * A DatePicker laboratory showing masking, nullable binding, bounds, and the anchored calendar.
 */
import { DatePicker, Group, Label, Text, at, createKeymap, signal, toISO } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import type { CalendarDate } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CMD_LOAD = 'date-picker-lab.load';
const CMD_CLEAR = 'date-picker-lab.clear';
const TODAY: CalendarDate = { year: 2026, month: 8, day: 12 };
const SAMPLE: CalendarDate = { year: 2026, month: 8, day: 21 };
const CONTENT_WIDTH = 56;
const CONTENT_HEIGHT = 9;

export default defineExample({
  title: 'Date Picker Lab',
  blurb: 'Edit a masked civil date or choose it from a bounded, deterministic popup calendar.',
  build: (ctx) => {
    const app = demoApp(ctx, {
      themeMenu: true,
      keymap: createKeymap({ 'alt+n': CMD_LOAD, 'alt+c': CMD_CLEAR }),
    });
    const value = signal<CalendarDate | null>(null);
    const picker = new DatePicker({
      value,
      format: 'DD/MM/YYYY',
      today: TODAY,
      min: { year: 2026, month: 8, day: 1 },
      max: { year: 2026, month: 9, day: 30 },
      firstDayOfWeek: 1,
      showWeekNumbers: true,
      density: 'compact',
      placeholder: 'DD/MM/YYYY',
    });
    const dialog = new Template1Dialog({
      title: ' Date Picker Lab ',
      width: 60,
      height: 13,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('Masked DD/MM/YYYY field and shared date value.'), 0, 0, 56, 1));
    content.add(at(new Label('~D~ate', picker.input), 0, 2, 8, 1));
    content.add(at(picker, 9, 2, 18, 1));
    content.add(at(new Text(() => `ISO value: ${value() === null ? 'none' : toISO(value()!)}`), 0, 4, 40, 1));
    content.add(at(new Text('Invalid or incomplete edits leave the value unchanged.'), 0, 6, 56, 1));
    content.add(at(new Text('Alt+Down opens · Alt+N loads · Alt+C clears'), 0, 8, 56, 1));

    app.onCommand(CMD_LOAD, () => value.set(SAMPLE));
    app.onCommand(CMD_CLEAR, () => value.set(null));
    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(picker.input);
    return app;
  },
});
