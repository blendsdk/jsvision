import {
  classicTheme,
  draculaTheme,
  gruvboxDarkTheme,
  horizonTheme,
  janusTheme,
  monochromeTheme,
  nordTheme,
  platinumTheme,
  slateTheme,
  solarizedDarkTheme,
  solsticeTheme,
  warpTheme,
  workbenchTheme,
} from '@jsvision/core';
import type { CapabilityProfile, Theme } from '@jsvision/core';
import {
  Commands,
  Text,
  Window,
  col,
  cover,
  createApplication,
  fixed,
  grow,
  inputBox,
  item,
  menuBar,
  messageBox,
  separator,
  signal,
  statusItem,
  statusLine,
  subMenu,
} from '@jsvision/ui';
import type { DesktopApplication, Group } from '@jsvision/ui';
import type { KanbanBoard } from '@jsvision/kanban';

import {
  DEFAULT_GITHUB_PROJECT_URL,
  GitHubProjectLoadError,
  loadGitHubProject,
  parseGitHubProjectUrl,
} from './github-project.js';
import type { GitHubProjectCard, GitHubProjectSnapshot, LoadGitHubProjectOptions } from './github-project.js';
import { createLocalGitHubProjectBoard } from './local-board.js';
import type { LocalGitHubProjectBoard } from './local-board.js';

/** Commands exposed by the standalone playground menu and focused tests. */
export const GITHUB_KANBAN_COMMANDS = Object.freeze({
  open: 'github-kanban.open',
  refresh: 'github-kanban.refresh',
  about: 'github-kanban.about',
  themePrefix: 'github-kanban.theme.',
});

/** Optional deterministic viewport and loader seams used by tests. */
export interface GitHubProjectKanbanOptions {
  /** Initial public project URL. */
  readonly initialUrl?: string;
  /** Fixed terminal dimensions for headless rendering. */
  readonly viewport?: { readonly width: number; readonly height: number };
  /** Loader replacement; production uses the public GitHub REST loader. */
  readonly loader?: (url: string, options?: LoadGitHubProjectOptions) => Promise<GitHubProjectSnapshot>;
}

/** Public control and inspection seams for the standalone GitHub Kanban app. */
export interface GitHubProjectKanbanApp {
  /** Fully composed desktop application. */
  readonly app: DesktopApplication;
  /** Loads or refreshes one public GitHub project URL. */
  load(url: string): Promise<void>;
  /** Runs the terminal application until quit. */
  run(): Promise<number>;
  /** Returns the currently mounted real board, when loading succeeded. */
  activeBoard(): KanbanBoard<GitHubProjectCard> | undefined;
  /** Returns the locally reordered cards displayed by the board. */
  localCards(): readonly GitHubProjectCard[];
  /** Returns current visible activity or loading feedback. */
  activity(): string;
  /** Returns the last successfully loaded public URL. */
  currentUrl(): string;
  /** Returns the active theme's menu label. */
  currentTheme(): string;
}

/** One named built-in theme exposed through the app's Theme menu. */
interface ThemeChoice {
  /** Stable command suffix. */
  readonly id: string;
  /** Menu label shown to the visitor. */
  readonly label: string;
  /** Complete JSVision theme. */
  readonly theme: Theme;
}

const THEMES: readonly ThemeChoice[] = Object.freeze([
  { id: 'classic', label: 'Classic', theme: classicTheme },
  { id: 'monochrome', label: 'Monochrome', theme: monochromeTheme },
  { id: 'slate', label: 'Slate', theme: slateTheme },
  { id: 'nord', label: 'Nord', theme: nordTheme },
  { id: 'dracula', label: 'Dracula', theme: draculaTheme },
  { id: 'solarized', label: 'Solarized Dark', theme: solarizedDarkTheme },
  { id: 'gruvbox', label: 'Gruvbox Dark', theme: gruvboxDarkTheme },
  { id: 'janus', label: 'Janus', theme: janusTheme },
  { id: 'warp', label: 'Warp', theme: warpTheme },
  { id: 'solstice', label: 'Solstice', theme: solsticeTheme },
  { id: 'platinum', label: 'Platinum', theme: platinumTheme },
  { id: 'workbench', label: 'Workbench', theme: workbenchTheme },
  { id: 'horizon', label: 'Horizon', theme: horizonTheme },
]);

/** Builds the complete project, theme, and help menu. */
function buildMenu(): ReturnType<typeof menuBar> {
  return menuBar([
    subMenu('~P~roject', [
      item('~O~pen GitHub URL…', GITHUB_KANBAN_COMMANDS.open, 'Ctrl+O'),
      item('~R~efresh from GitHub', GITHUB_KANBAN_COMMANDS.refresh, 'Ctrl+R'),
      separator(),
      item('E~x~it', Commands.quit, 'Alt-X'),
    ]),
    subMenu(
      '~T~heme',
      THEMES.map(({ id, label }) => item(label, `${GITHUB_KANBAN_COMMANDS.themePrefix}${id}`)),
    ),
    subMenu('~H~elp', [item('~A~bout this playground', GITHUB_KANBAN_COMMANDS.about, 'F1')]),
  ]);
}

/** Builds compact clickable instructions for terminal and mouse visitors. */
function buildStatus(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    statusItem('~Ctrl-O~ Project', GITHUB_KANBAN_COMMANDS.open, 'Ctrl+O'),
    statusItem('~Ctrl-R~ Refresh', GITHUB_KANBAN_COMMANDS.refresh, 'Ctrl+R'),
    statusItem('~Drag~ Move locally'),
    statusItem('~Wheel~ Scroll'),
  ]);
}

/** Converts an unknown failure into a concise display message without exposing response payloads. */
function loadErrorMessage(error: unknown): string {
  if (error instanceof GitHubProjectLoadError) return error.message;
  if (error instanceof Error && error.name === 'AbortError') return 'Loading cancelled.';
  return 'The public GitHub project could not be loaded.';
}

/** Removes every current child from a responsive content host. */
function clearHost(host: Group): void {
  for (const child of [...host.children]) host.remove(child);
}

/**
 * Creates the polished standalone public GitHub Projects Kanban playground.
 *
 * Cards may be moved freely in memory. No mutation endpoint or authentication token exists in this
 * application, and reloading restores the project snapshot from GitHub.
 *
 * @param caps Resolved terminal capabilities, including pointer drag support when available.
 * @param options Optional URL, viewport, and test loader seams.
 * @returns Ready-to-run desktop application and focused control seams.
 */
export function createGitHubProjectKanbanApp(
  caps: CapabilityProfile,
  options: GitHubProjectKanbanOptions = {},
): GitHubProjectKanbanApp {
  const loader = options.loader ?? loadGitHubProject;
  const activity = signal('Preparing public GitHub project…');
  const loadedUrl = signal(options.initialUrl ?? DEFAULT_GITHUB_PROJECT_URL);
  const themeName = signal('Classic');
  const host = col({ padding: 1, gap: 1, background: 'window' });
  const app = createApplication({
    caps,
    ...(options.viewport === undefined ? {} : { viewport: options.viewport }),
    theme: classicTheme,
    menuBar: buildMenu(),
    statusLine: buildStatus(),
  });
  const window = new Window('◆ GitHub Project Kanban · public playground');
  window.closable = false;
  window.minWidth = 36;
  window.minHeight = 12;
  window.setLayout({ rect: { x: 0, y: 0, width: app.desktop.bounds.width, height: app.desktop.bounds.height } });
  window.add(cover(host));
  app.desktop.addWindow(window);
  window.zoom();

  let mounted: LocalGitHubProjectBoard | undefined;
  let controller: AbortController | undefined;
  let generation = 0;

  /** Mounts one authoritative snapshot while retaining its cards only in local app state. */
  function showSnapshot(snapshot: GitHubProjectSnapshot): void {
    mounted?.dispose();
    mounted = createLocalGitHubProjectBoard(snapshot);
    clearHost(host);
    const content = col(
      {},
      fixed(new Text(`◆ ${snapshot.title}`), 1),
      fixed(
        new Text(
          `${snapshot.location.owner} · ${snapshot.cards.length} items · ${snapshot.columns.length} statuses · public GitHub data`,
        ),
        1,
      ),
      grow(mounted.board, 1, { min: 8 }),
      fixed(new Text(mounted.activity), 1),
    );
    host.add(grow(content));
    mounted.board.viewport.onCleanup(mounted.dispose);
    window.title.set(`◆ ${snapshot.title} · local playground`);
    activity.set(mounted.activity());
    host.invalidateLayout();
    app.loop.renderRoot.flush();
    app.loop.focusView(mounted.board.viewport);
  }

  /** Loads one URL and ignores stale completions after a newer request begins. */
  async function load(url: string): Promise<void> {
    const requestGeneration = generation + 1;
    generation = requestGeneration;
    controller?.abort();
    controller = new AbortController();
    activity.set('Loading public GitHub project…');
    clearHost(host);
    const loading = col(
      {},
      fixed(new Text('◆ GitHub Project Kanban'), 1),
      fixed(new Text('Reading statuses, labels, assignees, repositories, and project items…'), 2),
      grow(new Text(() => activity())),
    );
    host.add(grow(loading));
    host.invalidateLayout();
    app.loop.renderRoot.flush();
    try {
      const snapshot = await loader(url, { signal: controller.signal });
      if (generation !== requestGeneration) return;
      loadedUrl.set(url);
      showSnapshot(snapshot);
    } catch (error: unknown) {
      if (generation !== requestGeneration || (error instanceof Error && error.name === 'AbortError')) return;
      const message = loadErrorMessage(error);
      mounted?.dispose();
      mounted = undefined;
      activity.set(message);
      clearHost(host);
      const failure = col(
        {},
        fixed(new Text('Unable to load that public project', { severity: 'error' }), 1),
        fixed(new Text(message), 3),
        grow(new Text('Use Project → Open GitHub URL… to try another public organization or user project.')),
      );
      host.add(grow(failure));
      window.title.set('◆ GitHub Project Kanban · load failed');
      host.invalidateLayout();
      app.loop.renderRoot.flush();
    }
  }

  /** Opens the application-provided URL dialog and starts a validated public-project load. */
  async function promptForProject(): Promise<void> {
    const value = signal(loadedUrl());
    const entered = await inputBox(app, {
      title: 'Open public GitHub Project',
      label: '~U~RL',
      value,
      placeholder: DEFAULT_GITHUB_PROJECT_URL,
    });
    if (entered === null) return;
    try {
      parseGitHubProjectUrl(entered);
    } catch (error: unknown) {
      await messageBox(app, { title: 'Unsupported URL', text: loadErrorMessage(error) });
      return;
    }
    await load(entered);
  }

  app.onCommand(GITHUB_KANBAN_COMMANDS.open, () => void promptForProject());
  app.onCommand(GITHUB_KANBAN_COMMANDS.refresh, () => void load(loadedUrl()));
  app.onCommand(GITHUB_KANBAN_COMMANDS.about, () => {
    void messageBox(app, {
      title: 'About GitHub Project Kanban',
      text: 'Live public GitHub data · local drag and drop · no authentication · no GitHub changes. Refresh restores the source project.',
    });
  });
  for (const choice of THEMES) {
    app.onCommand(`${GITHUB_KANBAN_COMMANDS.themePrefix}${choice.id}`, () => {
      app.setTheme(choice.theme);
      themeName.set(choice.label);
      activity.set(`${choice.label} theme · project data unchanged`);
    });
  }

  return {
    app,
    load,
    run: () => app.run(),
    activeBoard: () => mounted?.board,
    localCards: () => mounted?.cards() ?? [],
    activity: () => mounted?.activity() ?? activity(),
    currentUrl: loadedUrl,
    currentTheme: themeName,
  };
}
