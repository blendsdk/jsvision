/**
 * The live-preview widget scene — a broad arrangement of representative widgets that exercise the
 * theme roles a user cares about, laid out on a tall canvas the preview panel scrolls. It repaints
 * automatically when the app swaps the theme (every cell is drawn from the active theme). It is a
 * **preview**: every widget is made non-focusable (deep-inert) so the gallery never steals focus or
 * clicks from the editing panels — the preview scrolls, but its widgets are not interactive.
 */
import {
  Group,
  Text,
  Button,
  Input,
  CheckGroup,
  RadioGroup,
  ListBox,
  ProgressBar,
  Spinner,
  Slider,
  ScrollBar,
  TabView,
  DataGrid,
  Tree,
  Calendar,
  signal,
  at,
} from '@jsvision/ui';
import type { View, Tab, Column, SortState, TreeNode, CalendarDate } from '@jsvision/ui';

/** The fixed content size of the gallery canvas — the preview panel scrolls a viewport over it. */
export const GALLERY_SIZE = { width: 64, height: 48 };

/** Recursively make a view and all its descendants non-focusable, so the preview never takes focus. */
function deepInert<T extends View>(v: T): T {
  v.focusable = false;
  if (v instanceof Group) for (const child of v.children) deepInert(child);
  return v;
}

/** A small section heading. */
function heading(g: Group, label: string, y: number): void {
  g.add(at(new Text(label), 1, y, GALLERY_SIZE.width - 2, 1));
}

/** A tab page — a titled paragraph inside a group (the TabView body insets it). */
function tabPage(lines: string[]): Group {
  const page = new Group();
  lines.forEach((line, i) => page.add(at(new Text(line), 1, i, Math.max(1, line.length), 1)));
  return page;
}

/** One row of the DataGrid demo. */
interface Person {
  readonly name: string;
  readonly age: number;
  readonly role: string;
}

/** A tree node with children (empty for a leaf). */
function node(value: string, children: TreeNode<string>[] = []): TreeNode<string> {
  return { value, children };
}

/**
 * Build the preview gallery — a themed canvas exercising buttons, an input, check/radio groups, a
 * list with a scroll bar, a progress bar, spinner and slider, a tab view, a data grid, a tree, and a
 * calendar. Every widget is deep-inert (non-focusable) so it is a pure preview.
 *
 * @returns A {@link Group} of {@link GALLERY_SIZE}; place it absolutely (or inside a scroller).
 * @example
 * import { buildGallery, GALLERY_SIZE } from './view/gallery.js';
 * import { Scroller } from '@jsvision/ui';
 * const scroller = new Scroller({ content: buildGallery(), extent: GALLERY_SIZE, scrollbars: 'both' });
 */
export function buildGallery(): Group {
  const g = new Group();
  g.background = 'window';

  g.add(at(new Text('Preview — every widget repaints as you edit'), 1, 0, GALLERY_SIZE.width - 2, 1));

  // Buttons: default / normal / disabled (the shadow, default-face, and disabled roles).
  heading(g, 'Buttons', 2);
  g.add(at(new Button('~O~K', { default: true }), 2, 3, 8, 2));
  g.add(at(new Button('~C~ancel', {}), 11, 3, 12, 2));
  g.add(at(new Button('~D~isabled', { disabled: true }), 24, 3, 14, 2));

  // A labelled input.
  g.add(at(new Text('Name:'), 2, 6, 6, 1));
  g.add(at(new Input({ value: signal('editable text') }), 9, 6, 28, 1));

  // Check + radio groups.
  g.add(at(new CheckGroup({ labels: ['~B~old', '~I~talic'], value: signal([true, false]) }), 2, 8, 16, 2));
  g.add(at(new RadioGroup({ labels: ['~L~eft', '~R~ight'], value: signal(0) }), 20, 8, 16, 2));

  // A list + a vertical scroll bar, then a progress bar, spinner, and slider.
  heading(g, 'List · scroll bar · progress · spinner · slider', 11);
  g.add(
    at(
      new ListBox({
        items: signal(['Nord', 'Dracula', 'Gruvbox', 'Solarized', 'Slate']),
        focused: signal(1),
        selected: signal(1),
      }),
      2,
      12,
      20,
      5,
    ),
  );
  g.add(
    at(new ScrollBar({ value: signal(35), min: 0, max: 100, orientation: 'vertical', pageStep: 10 }), 23, 12, 1, 5),
  );
  g.add(at(new ProgressBar({ value: signal(0.66) }), 28, 12, 24, 1));
  g.add(at(new Spinner({ frame: signal(2), preset: 'dots', label: 'Working…' }), 28, 14, 24, 1));
  g.add(at(new Slider({ value: signal(60), min: 0, max: 100 }), 28, 16, 24, 1));

  // A tab view (folder tabs + a page body).
  heading(g, 'Tabs', 18);
  const tabs = signal<Tab[]>([
    { title: '~G~eneral', content: tabPage(['General settings', 'Name, theme, language.']) },
    { title: '~D~isplay', content: tabPage(['Display options', 'Resolution, colours.']), closeable: true },
    { title: '~N~etwork', content: tabPage(['Network', 'Proxy, timeouts.']) },
  ]);
  g.add(at(new TabView({ tabs, active: signal(0) }), 2, 19, 50, 7));

  // A data grid (sticky header + zebra rows + a focused row).
  heading(g, 'Data grid', 27);
  const people = signal<Person[]>([
    { name: 'Alice Johnson', age: 30, role: 'Engineer' },
    { name: 'Bob Smith', age: 25, role: 'Designer' },
    { name: 'Carol White', age: 42, role: 'Manager' },
    { name: 'Dave Brown', age: 28, role: 'Engineer' },
    { name: 'Eve Davis', age: 35, role: 'Analyst' },
  ]);
  const columns: Column<Person>[] = [
    { title: 'Name', accessor: (p) => p.name, width: 'auto', maxWidth: 16 },
    { title: 'Age', accessor: (p) => String(p.age), width: 5, align: 'right', compare: (a, b) => a.age - b.age },
    { title: 'Role', accessor: (p) => p.role, width: '1fr' },
  ];
  g.add(
    at(
      new DataGrid<Person>({
        rows: people,
        columns,
        focused: signal(1),
        selected: signal(1),
        sort: signal<SortState>(null),
        zebra: true,
      }),
      2,
      28,
      52,
      7,
    ),
  );

  // A tree + a calendar, side by side.
  heading(g, 'Tree · calendar', 36);
  const engine = node('engine', [node('render.ts'), node('input.ts')]);
  const src = node('src', [node('index.ts'), engine, node('version.ts')]);
  const tree = new Tree<string>({
    roots: signal<TreeNode<string>[]>([src, node('README.md'), node('package.json')]),
    getText: (name) => name,
    focused: signal(0),
    selected: signal(-1),
  });
  tree.expand(src);
  tree.expand(engine);
  g.add(at(tree, 2, 37, 26, 10));

  const cal = new Calendar({
    value: signal<CalendarDate | null>({ year: 2026, month: 9, day: 15 }),
    firstDayOfWeek: 1,
    showWeekNumbers: true,
  });
  g.add(at(cal, 30, 37, 32, 11));

  return deepInert(g);
}
