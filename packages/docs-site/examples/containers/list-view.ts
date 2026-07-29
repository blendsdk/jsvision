/**
 * A typed ListView laboratory showing stable sorting, independent focus/selection, activation, and
 * prefix type-ahead over domain objects.
 */
import { Dialog, Group, Label, ListView, Text, at, signal } from '@jsvision/ui';
import { defineExample } from '../_contract.js';
import { demoApp } from '../../src/demo-shell.js';

interface Person {
  readonly name: string;
  readonly age: number;
}

const CONTENT_WIDTH = 48;
const CONTENT_HEIGHT = 12;

export default defineExample({
  title: 'List View Lab',
  blurb: 'Navigate a sorted typed collection while focus, committed selection, and type-ahead stay visible.',
  build: (ctx) => {
    const app = demoApp(ctx, { themeMenu: true });
    const people = signal<Person[]>([
      { name: 'Grace', age: 37 },
      { name: 'Linus', age: 28 },
      { name: 'Alan', age: 41 },
      { name: 'Ada', age: 36 },
    ]);
    const focused = signal(0);
    const selected = signal(-1);
    const selectedName = signal('none');
    const list = new ListView<Person>({
      items: people,
      getText: (person) => `${person.name} · ${person.age}`,
      focused,
      selected,
      sorted: true,
      typeAhead: true,
      onSelect: (_index, person) => selectedName.set(person.name),
    });
    const dialog = new Dialog({ title: ' List View Lab ', width: 52, height: 16 });
    dialog.closable = false;
    const content = new Group();

    content.add(at(new Text('Typed items use sorted getText labels.'), 0, 0, 48, 1));
    content.add(at(new Label('~P~eople', list.rows), 0, 2, 10, 1));
    content.add(at(list, 11, 2, 21, 6));
    content.add(
      at(
        new Text(
          () =>
            `Focus: ${
              people()
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))[focused()]?.name ?? 'none'
            }`,
        ),
        34,
        2,
        14,
        2,
      ),
    );
    content.add(at(new Text(() => `Selected: ${selectedName()}`), 34, 5, 14, 2));
    content.add(at(new Text('↑↓/Pg/Home/End navigate · Enter selects'), 0, 9, 48, 1));
    content.add(at(new Text('Type a prefix (try G) · Alt+P focuses rows'), 0, 10, 48, 1));
    content.add(at(new Text('Focus and selection use separate signals.'), 0, 11, 48, 1));

    dialog.add(at(content, 1, 1, CONTENT_WIDTH, CONTENT_HEIGHT));
    app.desktop.addWindow(dialog);
    app.loop.focusView(list.rows);
    return app;
  },
});
