/**
 * Navigation-router walkthrough — a narrated, headless console demo of `@jsvision/ui`'s screen
 * router: a **drill-down browser** (the tig/lazygit/k9s shape). A `list` screen of repositories
 * drills into a `detail` screen on Enter, and `Esc`/Back returns — with the list kept **warm**
 * (`keepAlive`), so its scroll position survives the round-trip. Each screen also contributes its own
 * status line, so the shared bar swaps as you navigate and restores the app base on return.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:router
 *
 * It builds a router as the application `content` body, mounts it through `createApplication`
 * (headless — no `run()`/TTY), then drives a synthetic key sequence: focus the list, arrow down to
 * scroll it, Enter to drill into a repo, Esc to go back — printing a composed ASCII frame after each
 * step and proving the list's focused row (its scroll) is unchanged across the round-trip.
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import {
  Group,
  Text,
  Button,
  ListView,
  createApplication,
  createRouter,
  col,
  fixed,
  grow,
  signal,
  statusLine,
  statusItem,
  type DispatchEvent,
} from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string, mods: Partial<Pick<KeyEvent, 'alt' | 'ctrl' | 'shift'>> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const line of rows) console.log(`|${line.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** The route map: a `list` of repos and a `detail` view keyed by the chosen list index. */
type Routes = { list: void; detail: { index: number } };

/** The detail screen: a repository read-out with a Back button; `Esc` also returns to the list. */
class DetailScreen extends Group {
  /** See `Esc` before the focused view does, so Back works from anywhere on the screen. */
  override preProcess = true;

  constructor(repo: string, onBack: () => void) {
    super();
    // Assigned directly rather than built: this view is the container itself, so there is no builder
    // call that could produce it — only its children are composed with the DSL below.
    this.layout = { direction: 'col', padding: 1, gap: 1 };
    this.background = 'window';
    this.onBackCb = onBack;
    this.add(fixed(new Text(`Repository: ${repo}`), 1));
    this.add(fixed(new Text('Branch: main · 128 commits · MIT license'), 1));
    this.add(fixed(new Button('~B~ack', { command: 'detail.back', onClick: onBack }), 2));
  }

  private readonly onBackCb: () => void;

  override onEvent(ev: DispatchEvent): void {
    if (ev.event.type === 'key' && ev.event.key === 'escape') {
      this.onBackCb();
      ev.handled = true;
    }
  }
}

function main(): void {
  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

  const repos = signal(Array.from({ length: 20 }, (_, i) => `repo-${String(i + 1).padStart(2, '0')}`));
  const listFocused = signal(0); // the list's scroll/focus row — read to prove keep-alive preserves it

  // The list screen is built once (keepAlive) and reused, so the list widget can be created up front
  // and captured — the walkthrough below focuses it and reads its scroll. The route closures call back
  // into `router` — deferred, so they run only after it exists (onSelect drills into the chosen repo;
  // Back pops the stack).
  const listView = new ListView<string>({
    items: repos,
    getText: (r) => r,
    focused: listFocused,
    onSelect: (index) => router.push('detail', { index }),
  });

  const router = createRouter<Routes>({
    initial: { name: 'list' },
    routes: {
      list: {
        keepAlive: true, // keep the list warm so its scroll survives a drill-down round-trip
        build: () => {
          const screen = col(
            { padding: 1, gap: 0 },
            fixed(new Text('Repositories — ↑↓ to navigate, Enter to open'), 1),
            grow(listView),
          );
          // Either form works: a background can also ride on the builder props, as
          // `col({ background: 'window' }, …)` — see the drill-down story.
          screen.background = 'window';
          return { view: screen }; // no status → the app base bar shows
        },
      },
      detail: {
        build: (ctx) => ({
          view: new DetailScreen(repos()[ctx.params.index], () => router.back()),
          status: [statusItem('~Esc~ Back to list', 'detail.back', 'Escape')], // this screen's own status
        }),
      },
    },
  });

  const app = createApplication({
    caps,
    content: router,
    statusLine: statusLine([statusItem('↑↓/Enter navigate'), statusItem('~Alt-X~ Quit', 'quit', 'Alt+X')]),
    viewport: { width: 46, height: 16 },
  });
  app.loop.renderRoot.flush();

  // Step 1 — the list screen, showing the app's base status bar.
  printFrame('Frame 1 — list screen (app base status bar)', app.loop.renderRoot.buffer().rows());
  console.log(`  location: ${JSON.stringify(router.location())}  · list focused row: ${listFocused()}`);

  // Step 2 — focus the list and arrow down three rows to scroll it.
  app.loop.focusView(listView.rows);
  for (let i = 0; i < 3; i += 1) app.loop.dispatch(key('down'));
  printFrame('Frame 2 — arrowed down; the list scrolled', app.loop.renderRoot.buffer().rows());
  const scrolledRow = listFocused();
  console.log(`  list focused row after ↓↓↓: ${scrolledRow}`);

  // Step 3 — Enter drills into the focused repo; the detail screen's own status bar takes over.
  app.loop.dispatch(key('enter'));
  printFrame('Frame 3 — Enter → detail screen (its own status bar)', app.loop.renderRoot.buffer().rows());
  console.log(`  location: ${JSON.stringify(router.location())}  · canGoBack: ${router.canGoBack()}`);

  // Step 4 — Esc returns to the warm list: same instance, scroll row preserved, base status restored.
  app.loop.dispatch(key('escape'));
  printFrame('Frame 4 — Esc → back to the warm list (scroll preserved)', app.loop.renderRoot.buffer().rows());
  const restoredRow = listFocused();
  console.log(`  location: ${JSON.stringify(router.location())}  · list focused row: ${restoredRow}`);

  const preserved = restoredRow === scrolledRow;
  console.log(
    `\nkeepAlive: the list's scroll row survived the drill-down round-trip → ${preserved ? 'PASS' : 'FAIL'} (${scrolledRow} → ${restoredRow})`,
  );
  console.log(
    'Done — a drill-down browser: push/back navigation, per-screen status chrome, and a keepAlive list that keeps its scroll.',
  );
}

main();
