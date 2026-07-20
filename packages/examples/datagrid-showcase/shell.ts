/**
 * The datagrid-showcase **shell** — the app: a `createApplication` desktop with a persistent sidebar
 * `ListBox` navigator, a per-category menu bar generated from the story registry, a clickable status
 * line, and a full-screen grey {@link StoryWindow} canvas that swaps to the selected demo.
 *
 * Navigation runs entirely through the command path: selecting a sidebar row or a menu item (or calling
 * `app.loop.emitCommand(story.id)`) routes a command to the post-process {@link CommandSink}, which
 * shows the demo. That single seam is what the headless walkthrough oracle drives — it dispatches each
 * demo's id and reads the painted buffer, never touching the TTY-bound `run()`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import {
  createApplication,
  menuBar,
  subMenu,
  item,
  separator,
  statusLine,
  statusItem,
  Commands,
  cover,
  Group,
  Text,
  View,
  Window,
  ListBox,
  signal,
  createRoot,
  type DispatchEvent,
  type DrawContext,
} from '@jsvision/ui';
import type { DesktopApplication } from '@jsvision/ui';
import type { CapabilityProfile } from '@jsvision/core';
import { EditableDataGrid, gridKeymap, installGridNavigation, type NavGrid } from '@jsvision/datagrid';
import { StoryWindow, CommandSink } from './window.js';
import { STORIES } from './stories/index.js';
import { at, firstFocusable } from './story.js';
import type { Story } from './story.js';

/** The persistent navigator sidebar width, in cells. */
export const SIDEBAR_W = 24;

/** One navigator row: a non-selectable category header, or a selectable story. */
type NavRow = { readonly header: string } | { readonly story: Story };

/** Build the parallel sidebar model: interleaved category headers + story rows. */
function buildNavRows(cats: Map<string, Story[]>): { rows: NavRow[]; labels: string[] } {
  const rows: NavRow[] = [];
  const labels: string[] = [];
  for (const [cat, list] of cats) {
    rows.push({ header: cat });
    labels.push(`─ ${cat} ─`);
    for (const story of list) {
      rows.push({ story });
      labels.push(`  ${story.title}`);
    }
  }
  return { rows, labels };
}

/** Showcase navigation command names (not built-in shell commands). */
const CMD_HOME = 'showcase.home';
const CMD_NEXT = 'showcase.next';
const CMD_PREV = 'showcase.prev';

/** Mark a string's first character as its `Alt` hotkey (`'Editing'` → `'~E~diting'`). */
function withHotkey(s: string): string {
  return `~${s[0]}~${s.slice(1)}`;
}

/** Group the registry by category, preserving first-seen order. */
function categoriesOf(stories: readonly Story[]): Map<string, Story[]> {
  const map = new Map<string, Story[]>();
  for (const story of stories) {
    const list = map.get(story.category);
    if (list !== undefined) list.push(story);
    else map.set(story.category, [story]);
  }
  return map;
}

/** Build the menu bar: a system menu, one submenu per category (its stories), and a Nav menu. */
function buildMenu(cats: Map<string, Story[]>): ReturnType<typeof menuBar> {
  const categoryMenus = [...cats.entries()].map(([cat, list]) =>
    subMenu(
      withHotkey(cat),
      list.map((s) => item(s.title, s.id)),
    ),
  );
  return menuBar([
    subMenu('≡', [item('~W~elcome', CMD_HOME, 'F1'), separator(), item('E~x~it', Commands.quit, 'Alt-X')]),
    ...categoryMenus,
    subMenu('~N~av', [item('~N~ext demo', CMD_NEXT), item('~P~rev demo', CMD_PREV)]),
  ]);
}

/** Build the status line: exit + navigation hints (all clickable; the chords fire where parseable). */
function buildStatus(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    statusItem('~F1~ Welcome', CMD_HOME, 'F1'),
    statusItem('~Tab~ Sidebar↔Demo'),
    statusItem('~^→~ Next', CMD_NEXT),
    statusItem('~^←~ Prev', CMD_PREV),
  ]);
}

/**
 * An invisible pre-process view that turns `Ctrl`+Left/Right into prev/next-demo navigation, regardless
 * of the focus chain (a convenience alongside the menu + clickable status items).
 */
class NavKeys extends View {
  override preProcess = true;

  constructor(
    private readonly onNext: () => void,
    private readonly onPrev: () => void,
  ) {
    super();
    this.state.visible = false;
  }

  override draw(_ctx: DrawContext): void {
    // invisible
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'key' || !inner.ctrl) return;
    if (inner.key === 'right') {
      this.onNext();
      ev.handled = true;
    } else if (inner.key === 'left') {
      this.onPrev();
      ev.handled = true;
    }
  }
}

/** Build the welcome/index catalog view (shell-owned, so it can enumerate the registry). */
function buildWelcome(cats: Map<string, Story[]>, w: number, h: number): Group {
  const g = new Group();
  let y = 0;
  g.add(at(new Text('DataGrid Showcase — a live tour of @jsvision/datagrid.'), 1, y, w - 2, 1));
  y += 1;
  g.add(at(new Text('One navigable demo per capability, grown one cluster per release.'), 1, y, w - 2, 1));
  y += 2;
  for (const [cat, list] of cats) {
    g.add(at(new Text(`${cat} (${list.length})`), 1, y, 32, 1));
    y += 1;
    for (const s of list) {
      g.add(at(new Text(`  • ${s.title} — ${s.blurb}`), 2, y, w - 4, 1));
      y += 1;
    }
    y += 1;
  }
  g.add(
    at(
      new Text('Open a demo from the sidebar or menu (F10 / Alt-letter) · Ctrl+→ / Ctrl+← cycle · Alt-X exit.'),
      1,
      Math.max(y, h - 1),
      w - 2,
      1,
    ),
  );
  // Fill the canvas interior so the absolutely-positioned rows above have space to lay out.
  cover(g);
  return g;
}

/**
 * Depth-first collect every {@link EditableDataGrid} in a built demo subtree. A grid satisfies the
 * structural `NavGrid` shape, so the shell can install cell-traversal on it without knowing the row type;
 * a master-detail demo yields both grids and the nav handler advances only the focused one.
 */
function collectGrids(view: View): NavGrid[] {
  const found: NavGrid[] = [];
  const walk = (v: View): void => {
    if (v instanceof EditableDataGrid) found.push(v);
    if (v instanceof Group) for (const child of v.children) walk(child);
  };
  walk(view);
  return found;
}

/** The composed showcase: the app + a `run()` that drives it to the `quit` command. */
export interface Showcase {
  /** The composed application (loop + desktop + chrome). */
  readonly app: DesktopApplication;
  /** Run the showcase until `quit`; resolves the exit code. */
  run(): Promise<number>;
  /**
   * The number of demo reactive owners disposed so far. A read-only test seam: the headless walkthrough
   * reads it to confirm that swapping demos tears the previous demo's reactive graph down (no leak /
   * double-mount). It increments once per demo→demo swap, never on the initial welcome.
   */
  disposedCount(): number;
}

/**
 * Compose the datagrid showcase over the given capabilities.
 *
 * @param caps Resolved terminal capabilities for the render.
 * @returns The app, a `run()` entry point, and the `disposedCount()` test seam.
 */
export function createDatagridShowcase(caps: CapabilityProfile): Showcase {
  const cats = categoriesOf(STORIES);
  // Bind Tab/Shift+Tab to the grid-navigation commands app-wide. The framework otherwise swallows an
  // unbound Tab for widget focus-traversal, so cell traversal can only arrive as a loop command. This is
  // safe globally: when no grid holds focus the handler falls back to the loop's own focus traversal, so
  // Tab still moves between the sidebar and canvas on the welcome screen and in non-grid contexts.
  const app = createApplication({
    caps,
    menuBar: buildMenu(cats),
    statusLine: buildStatus(),
    keymap: gridKeymap,
  });

  const dw = app.desktop.bounds.width;
  const dh = app.desktop.bounds.height;

  // The demo canvas — shrunk to the right of the persistent navigator sidebar.
  const canvas = new StoryWindow('');
  canvas.layout.rect = { x: SIDEBAR_W, y: 0, width: dw - SIDEBAR_W, height: dh };
  app.desktop.addWindow(canvas);

  /**
   * Open a modal view and resolve its terminating result — the `StoryContext.execView` seam. `execView`
   * requires the view already in the tree, so we add it to the desktop and remove it after.
   */
  const execModal = async (modal: View): Promise<unknown> => {
    if (!(modal instanceof Window)) return undefined; // dialogs are Windows
    app.desktop.addWindow(modal);
    try {
      return await app.loop.execView(modal);
    } finally {
      app.desktop.removeWindow(modal);
    }
  };

  // The navigator: a persistent left sidebar of category headers + demo rows. Selecting a demo row
  // swaps the canvas (map the row index through `navRows`, never a flat `STORIES` index). Type-ahead
  // filters as you type.
  const { rows: navRows, labels: navLabels } = buildNavRows(cats);
  const navItems = signal(navLabels);
  const navFocused = signal(0);
  // The sidebar lives for the whole app lifetime; own its computeds in a persistent root so they are
  // properly scoped (not leaked as an out-of-root computation).
  let sidebarList!: ListBox;
  createRoot(() => {
    sidebarList = new ListBox({
      items: navItems,
      focused: navFocused,
      typeAhead: true,
      onSelect: (i) => {
        const row = navRows[i];
        if (row !== undefined && 'story' in row) showStory(row.story);
      },
    });
  });
  const sidebar = new StoryWindow('Demos');
  sidebar.layout.rect = { x: 0, y: 0, width: SIDEBAR_W, height: dh };
  sidebar.add(at(sidebarList, 0, 0, SIDEBAR_W - 2, dh - 2));
  app.desktop.addWindow(sidebar);

  let currentIndex = -1; // -1 = the welcome screen
  // Disposes the reactive owner of the currently-shown demo's build() (its signals/computeds/effects),
  // so swapping demos never leaks reactive computations. `null` on the welcome screen.
  let disposeStory: (() => void) | null = null;
  // Unregisters the Tab/Shift+Tab handlers installed for the current demo's grids (if any), so each demo
  // owns exactly its own grids and swapping never stacks stale handlers. `null` when the demo has no grid.
  let uninstallNav: (() => void) | null = null;
  // Count of demo owners actually disposed — the read-only `disposedCount()` seam reads this.
  let disposed = 0;

  /** Tear down the previous demo's reactive graph before showing the next content. */
  function disposePrevious(): void {
    if (uninstallNav !== null) {
      uninstallNav();
      uninstallNav = null;
    }
    if (disposeStory !== null) {
      disposeStory();
      disposed += 1; // a real demo owner was torn down (not the initial welcome, where it is null)
    }
    disposeStory = null;
  }

  /** Swap the canvas to a new content view, set its title, and focus its first control. */
  function showView(view: View, title: string): void {
    for (const child of [...canvas.children]) canvas.remove(child);
    canvas.add(view);
    canvas.title.set(title);
    canvas.invalidateLayout();
    const focusTarget = firstFocusable(view);
    if (focusTarget !== null) app.loop.focusView(focusTarget);
  }

  /** Show a demo: a blurb header + its live build() body, filling the canvas interior. */
  function showStory(story: Story): void {
    disposePrevious();
    currentIndex = STORIES.indexOf(story);
    const rect = canvas.layout.rect ?? { x: SIDEBAR_W, y: 0, width: dw - SIDEBAR_W, height: dh };
    const iw = rect.width - 2; // interior (1-cell border each side)
    const ih = rect.height - 2;
    const holder = new Group();
    cover(holder);
    const chip = story.rd !== undefined ? `[${story.rd}] ` : '';
    holder.add(at(new Text(`${chip}${story.blurb}`), 0, 0, iw, 2)); // 2 rows so long blurbs don't clip
    const bodyW = iw;
    const bodyH = Math.max(1, ih - 3);
    // Build inside a disposable owner so any signal/computed/effect the demo creates is torn down when
    // we navigate away (disposed in disposePrevious), not leaked across swaps.
    let body: Group;
    createRoot((dispose) => {
      disposeStory = dispose;
      body = story.build({ caps, width: bodyW, height: bodyH, execView: execModal });
    });
    holder.add(at(body!, 0, 3, bodyW, bodyH));
    // Light up Tab/Shift+Tab cell-traversal for whatever grids the demo built. Every grid-bearing story
    // constructs EditableDataGrid instances, so a subtree walk finds them with no per-story wiring; the
    // uninstaller is torn down on the next swap by disposePrevious.
    const grids = collectGrids(body!);
    if (grids.length > 0) uninstallNav = installGridNavigation(app.loop, grids);
    showView(holder, `${story.category} / ${story.title}`);
  }

  /** Show the welcome/index catalog. */
  function showWelcome(): void {
    disposePrevious();
    currentIndex = -1;
    const rect = canvas.layout.rect ?? { x: SIDEBAR_W, y: 0, width: dw - SIDEBAR_W, height: dh };
    const iw = rect.width - 2;
    const ih = rect.height - 2;
    showView(buildWelcome(cats, iw, ih), 'DataGrid Showcase');
  }

  const step = (delta: number): void => {
    const base = currentIndex < 0 ? 0 : currentIndex;
    const next = (base + delta + STORIES.length) % STORIES.length;
    const target = STORIES[next];
    if (target !== undefined) showStory(target);
  };

  const handlers: Record<string, () => void> = {
    [CMD_HOME]: showWelcome,
    [CMD_NEXT]: () => step(1),
    [CMD_PREV]: () => step(-1),
  };
  for (const story of STORIES) handlers[story.id] = () => showStory(story);
  app.desktop.add(new CommandSink(handlers));
  app.desktop.add(
    new NavKeys(
      () => step(1),
      () => step(-1),
    ),
  );

  showWelcome();

  // Force one full layout pass before the first paint. A freshly-mounted absolute canvas isn't sized
  // until a full reflow, so the very first content shown (the welcome) would otherwise compose into
  // zero space. Re-laying out at the current viewport (read from the composed buffer) fixes it; the
  // host emits resize only on SIGWINCH, so we can't rely on a start-up resize to do this for us.
  const firstRows = app.loop.renderRoot.buffer().rows();
  app.loop.resize({ width: firstRows[0]?.length ?? dw, height: firstRows.length });

  // Focus starts in the sidebar navigator (Tab moves to the demo canvas and back).
  app.loop.focusView(sidebarList.rows);

  return { app, run: () => app.run(), disposedCount: () => disposed };
}
