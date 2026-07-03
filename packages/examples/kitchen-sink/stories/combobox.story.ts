/**
 * Story: `ComboBox<T>` (RD-14) — the dropdown selector in both modes: an **editable** combo (free
 * text + case-insensitive filter, `value` tracks an exact match else null) and a **select-only**
 * combo (read-only field + type-ahead picker). Each shows its live bound value/text echo.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Group, ComboBox, Label, Text, signal } from '@jsvision/ui';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const comboBoxStory: Story = {
  id: 'dropdown/combobox',
  category: 'Dropdowns',
  title: 'ComboBox',
  rd: 'RD-14',
  blurb: 'ComboBox: editable (free text + filter) or select-only (read-only picker + type-ahead).',
  build(ctx: StoryContext) {
    const width = Math.max(40, ctx.width - 2);

    // Editable: type to filter the candidate list; value = the exact getText-match of text, else null.
    const langs = signal(['TypeScript', 'JavaScript', 'Python', 'Rust', 'Go', 'Zig']);
    const langText = signal('');
    const langValue = signal<string | null>(null);
    const editCombo = new ComboBox<string>({
      items: langs,
      getText: (s) => s,
      value: langValue,
      text: langText,
      editable: true,
    });

    // Select-only: the field is read-only; typing drives the open list's type-ahead.
    const colors = signal(['Red', 'Green', 'Blue', 'Cyan', 'Magenta', 'Yellow']);
    const colorValue = signal<string | null>('Blue');
    const pickCombo = new ComboBox<string>({
      items: colors,
      getText: (s) => s,
      value: colorValue,
      editable: false,
    });

    const g = new Group();
    g.add(at(new Label('~L~anguage', editCombo.input), 1, 0, 10, 1));
    g.add(at(editCombo, 12, 0, 18, 1));
    g.add(
      at(
        new Text(() => `text="${langText()}"  value=${langValue() === null ? 'null' : `"${langValue()}"`}`),
        1,
        2,
        width,
        1,
      ),
    );

    g.add(at(new Label('~C~olor', pickCombo.input), 1, 4, 8, 1));
    g.add(at(pickCombo, 12, 4, 18, 1));
    g.add(at(new Text(() => `value = "${colorValue() ?? ''}"`), 1, 6, width, 1));

    g.add(at(new Text('Editable: type to filter, ↓ / Alt+↓ / ▐↓▌ to open, Enter to pick.'), 1, 8, width, 1));
    g.add(
      at(
        new Text('Select-only: open then type a letter to jump (type-ahead); the field is read-only.'),
        1,
        9,
        width,
        1,
      ),
    );
    return g;
  },
};
