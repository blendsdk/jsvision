import type { CapabilityProfile } from '@jsvision/core';
import {
  Commands,
  Text,
  Window,
  col,
  cover,
  createApplication,
  createRoot,
  fixed,
  grow,
  item,
  menuBar,
  statusItem,
  statusLine,
  subMenu,
} from '@jsvision/ui';
import type { DesktopApplication } from '@jsvision/ui';
import type { KanbanBoard } from '@jsvision/kanban';

import { createShowcaseBoard } from '../kanban-showcase/work-items.js';
import type { ShowcaseCard } from '../kanban-showcase/work-items.js';

/** Optional deterministic viewport used by the window-host laboratory tests. */
export interface KanbanWindowLabViewport {
  /** Terminal width in cells. */
  readonly width: number;
  /** Terminal height in cells. */
  readonly height: number;
}

/** Public seams for manually and automatically checking a Kanban inside a real Window. */
export interface KanbanWindowLab {
  /** Desktop application that owns the translated window. */
  readonly app: DesktopApplication;
  /** The real board mounted inside the window. */
  readonly board: KanbanBoard<ShowcaseCard>;
  /** Runs until the standard quit command is handled. */
  run(): Promise<number>;
  /** Releases the board owner and event loop. Safe to call more than once. */
  dispose(): void;
}

const LAB_CARDS: readonly ShowcaseCard[] = Object.freeze([
  { key: 1, columnId: 'backlog', title: 'Click and drag this card', status: 'Ready' },
  { key: 2, columnId: 'active', title: 'Drop into this lane', status: 'In progress' },
  { key: 3, columnId: 'active', title: 'Then drag another card', status: 'Blocked' },
  { key: 4, columnId: 'done', title: 'Window input stays responsive', status: 'Done' },
]);

/**
 * Creates a deliberately small Kanban hosted by the same desktop-managed Window path as the GitHub demo.
 *
 * Loading, imported metadata, and large responsive fixtures are intentionally absent. If interaction
 * fails here, the translated window/input path is implicated; if it succeeds, the GitHub-specific
 * composition or data path remains the meaningful difference.
 *
 * @param caps Resolved terminal capabilities, including SGR mouse input.
 * @param viewport Optional fixed dimensions for deterministic tests.
 * @returns A ready-to-run diagnostic application.
 */
export function createKanbanWindowLab(caps: CapabilityProfile, viewport?: KanbanWindowLabViewport): KanbanWindowLab {
  let built: ReturnType<typeof createShowcaseBoard> | undefined;
  const disposeBoard = createRoot((dispose) => {
    built = createShowcaseBoard({
      cards: LAB_CARDS,
      density: 'compact',
      initialActivity: 'Click focuses · drag card 1 to In progress · drag again · Alt-X exits',
    });
    return dispose;
  });
  if (built === undefined) throw new Error('The Kanban window laboratory could not create its board.');

  const app = createApplication({
    caps,
    ...(viewport === undefined ? {} : { viewport }),
    menuBar: menuBar([subMenu('~F~ile', [item('E~x~it', Commands.quit, 'Alt-X')])]),
    statusLine: statusLine([
      statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
      statusItem('~Click~ Focus'),
      statusItem('~Drag~ Move'),
      statusItem('~Wheel~ Scroll'),
    ]),
  });
  const window = new Window('Kanban · Window input isolation');
  window.closable = false;
  window.minWidth = 42;
  window.minHeight = 14;
  const desktopWidth = app.desktop.bounds.width;
  const desktopHeight = app.desktop.bounds.height;
  window.setLayout({
    rect: {
      x: Math.min(2, Math.max(0, desktopWidth - 1)),
      y: Math.min(1, Math.max(0, desktopHeight - 1)),
      width: Math.max(1, desktopWidth - 4),
      height: Math.max(1, desktopHeight - 2),
    },
  });
  const host = col(
    { padding: 1, gap: 1, background: 'window' },
    fixed(new Text('Only the real Window host is under test. Click a card, then perform two drops.'), 1),
    grow(built.board, 1, { min: 8 }),
    fixed(new Text(() => `Result: ${built!.activity()}`), 1),
  );
  window.add(cover(host));
  app.desktop.addWindow(window);
  app.loop.renderRoot.flush();
  app.loop.focusView(built.board.viewport);

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    disposeBoard();
    app.loop.dispose();
  };
  return {
    app,
    board: built.board,
    run: async () => {
      try {
        return await app.run();
      } finally {
        dispose();
      }
    },
    dispose,
  };
}
