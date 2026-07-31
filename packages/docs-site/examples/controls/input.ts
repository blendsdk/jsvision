/**
 * An interactive Input laboratory showing placeholders, length caps, live filtering, completion
 * validation, picture-mask formatting, two-way binding, selection, clipboard editing, word
 * navigation, mouse selection, and horizontal scrolling.
 */
import { Button, Group, Input, Label, Text, signal, filter, range, picture, at } from '@jsvision/ui';
import { Template1Dialog } from '../../src/template1-dialog.js';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

const CONTENT_PADDING = 1;
const CONTENT_WIDTH = 66;
const CONTENT_HEIGHT = 15;
const DIALOG_WIDTH = CONTENT_WIDTH + (CONTENT_PADDING + 1) * 2;
const DIALOG_HEIGHT = CONTENT_HEIGHT + (CONTENT_PADDING + 1) * 2;
const SAMPLE_LONG_VALUE = 'This value is deliberately longer than the visible field';

export default defineExample({
  title: 'Input Lab',
  blurb: 'Explore Input validation, masks, binding, selection, clipboard editing, and overflow scrolling.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const name = signal('');
    const age = signal('');
    const phone = signal('');
    const longValue = signal(SAMPLE_LONG_VALUE);
    const status = signal('ready');

    const nameInput = new Input({
      value: name,
      maxLength: 24,
      validator: filter('A-Za-z '),
      placeholder: 'Letters and spaces',
    });
    const ageInput = new Input({
      value: age,
      maxLength: 3,
      validator: range(0, 150),
      placeholder: '0–150',
    });
    const phoneInput = new Input({
      value: phone,
      maxLength: 12,
      validator: picture('###-###-####'),
      placeholder: '555-123-4567',
    });
    const longInput = new Input({
      value: longValue,
      maxLength: 64,
      placeholder: 'Type a long value',
    });
    const inputs = [nameInput, ageInput, phoneInput, longInput];

    const dialog = new Template1Dialog({
      title: ' Input Lab ',
      width: DIALOG_WIDTH,
      height: DIALOG_HEIGHT,
      preserveChildHeights: true,
    });
    const content = new Group();

    content.add(at(new Text('Four fields — type, validate, select, paste, and scroll'), 0, 0, CONTENT_WIDTH, 1));

    content.add(at(new Label('~N~ame', nameInput), 0, 2, 10, 1));
    content.add(at(nameInput, 11, 2, 27, 1));
    content.add(at(new Text(() => `letters only · ${name().length}/24`), 40, 2, 26, 1));

    content.add(at(new Label('~A~ge', ageInput), 0, 4, 5, 1));
    content.add(at(ageInput, 6, 4, 8, 1));
    content.add(at(new Label('~P~hone', phoneInput), 17, 4, 7, 1));
    content.add(at(phoneInput, 25, 4, 20, 1));
    content.add(at(new Text('Age: 0–150, validates on blur · Phone mask fills punctuation'), 0, 5, CONTENT_WIDTH, 1));

    content.add(at(new Label('~L~ong value', longInput), 0, 7, 11, 1));
    content.add(at(longInput, 12, 7, 30, 1));
    content.add(at(new Text(() => `selection: ${longInput.hasSelection() ? 'active' : 'none'}`), 44, 7, 22, 1));
    content.add(
      at(new Text(() => `Live: name="${name()}"  age="${age()}"  phone="${phone()}"`), 0, 8, CONTENT_WIDTH, 1),
    );

    content.add(
      at(
        new Button('Load ~s~ample', {
          onClick: () => {
            name.set('Ada Lovelace');
            age.set('36');
            phone.set('555-123-4567');
            longValue.set(SAMPLE_LONG_VALUE);
            status.set('sample loaded');
          },
        }),
        0,
        10,
        15,
        2,
      ),
    );
    content.add(
      at(
        new Button('Chec~k~ fields', {
          default: true,
          onClick: () => {
            const allValid = inputs.map((input) => input.valid()).every(Boolean);
            status.set(allValid ? 'all fields valid' : 'check age and phone');
          },
        }),
        17,
        10,
        16,
        2,
      ),
    );
    content.add(
      at(
        new Button('~C~lear', {
          onClick: () => {
            name.set('');
            age.set('');
            phone.set('');
            longValue.set('');
            // Clearing starts a fresh editing pass, so discard validation results from old values.
            for (const input of inputs) {
              input.invalid = false;
              input.invalidate();
            }
            status.set('cleared');
          },
        }),
        35,
        10,
        12,
        2,
      ),
    );

    content.add(at(new Text(() => `Status: ${status()}`), 0, 12, CONTENT_WIDTH, 1));
    content.add(at(new Text('Tab · Shift+arrows select · Ctrl+A/C/X/V · mouse drag selects'), 0, 13, CONTENT_WIDTH, 1));
    content.add(
      at(new Text('Home/End · Ctrl+arrows jump · Ctrl+Backspace deletes · ◄/► scroll'), 0, 14, CONTENT_WIDTH, 1),
    );

    dialog.add(at(content, CONTENT_PADDING, CONTENT_PADDING, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    return app;
  },
});
