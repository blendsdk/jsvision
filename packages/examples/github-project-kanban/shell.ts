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
import type {
  KanbanBoard,
  KanbanSavedViewV1,
  KanbanTheme,
  KanbanViewTransition,
  KanbanViewTransitionResult,
} from '@jsvision/kanban';
import { createKanbanTheme } from '@jsvision/kanban';

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
  filterFirstStatus: 'github-kanban.view.first-status',
  clearView: 'github-kanban.view.clear',
  saveView: 'github-kanban.view.save',
  editFocused: 'github-kanban.card.edit-focused',
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
  /** Returns whether the showcase window currently fills the desktop. */
  isMaximized(): boolean;
  /** Toggles the showcase window between its maximized and restored geometry. */
  toggleMaximize(): void;
  /** Applies one local controller transition without changing GitHub. */
  applyLocalView(transition: KanbanViewTransition): KanbanViewTransitionResult;
  /** Captures the active controller state in the application-owned local view collection. */
  saveLocalView(name: string): boolean;
  /** Returns detached local saved views retained across project refreshes. */
  localSavedViews(): readonly KanbanSavedViewV1[];
  /** Applies one title patch to the imported in-memory card copy. */
  editLocalCard(cardKey: string | number, patch: { readonly title: string }): boolean;
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

/** Derives colorful, contrast-preserving Kanban accents from one application theme. */
function githubKanbanTheme(theme: Theme): KanbanTheme {
  return createKanbanTheme(theme, {
    'card.accent-1': { bg: theme.progressFill.fg, fg: theme.progressFill.bg },
    'card.accent-2': { bg: theme.warningText.fg, fg: theme.warningText.bg },
    'card.accent-3': { bg: theme.dangerText.fg, fg: theme.dangerText.bg },
    'card.accent-4': { bg: theme.statusBar.bg, fg: theme.statusBar.fg },
  });
}

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
    subMenu('~V~iew', [
      item('Filter ~f~irst status', GITHUB_KANBAN_COMMANDS.filterFirstStatus),
      item('~C~lear filters', GITHUB_KANBAN_COMMANDS.clearView),
      item('~S~ave current view…', GITHUB_KANBAN_COMMANDS.saveView),
    ]),
    subMenu('~C~ard', [item('~E~dit focused title…', GITHUB_KANBAN_COMMANDS.editFocused)]),
    subMenu('~H~elp', [item('~A~bout this playground', GITHUB_KANBAN_COMMANDS.about, 'F1')]),
  ]);
}

/** Builds compact clickable instructions for terminal and mouse visitors. */
function buildStatus(): ReturnType<typeof statusLine> {
  return statusLine([
    statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
    statusItem('~Ctrl-O~ Project', GITHUB_KANBAN_COMMANDS.open, 'Ctrl+O'),
    statusItem('~Ctrl-R~ Refresh', GITHUB_KANBAN_COMMANDS.refresh, 'Ctrl+R'),
    statusItem('~Ctrl-F~ Search'),
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
  const boardTheme = signal(githubKanbanTheme(classicTheme));
  const savedViews = signal<readonly KanbanSavedViewV1[]>(Object.freeze([]));
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
  window.resizeMode = 'outline';
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
    mounted = createLocalGitHubProjectBoard(snapshot, boardTheme);
    clearHost(host);
    // The window title owns project identity and the board owns its three-row view chrome. Giving the
    // remaining client area directly to the board preserves the card viewport used by drag/scroll play.
    const content = col({}, grow(mounted.board, 1, { min: 8 }));
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

  /** Applies one local view transition and mirrors its outcome in visible feedback. */
  function applyLocalView(transition: KanbanViewTransition): KanbanViewTransitionResult {
    if (mounted === undefined) return Object.freeze({ kind: 'unavailable', code: 'project-not-loaded' });
    const outcome = mounted.applyView(transition);
    mounted.announce(`Local view · ${outcome.kind} · GitHub unchanged`);
    return outcome;
  }

  /** Captures one named local view while preserving earlier captures across refresh. */
  function saveLocalView(name: string): boolean {
    if (mounted === undefined) return false;
    try {
      const saved = mounted.captureView(name);
      savedViews.set(Object.freeze([...savedViews(), saved]));
      mounted.announce(`Saved view · ${saved.name ?? 'Untitled'} · local only`);
      return true;
    } catch {
      mounted.announce('Saved view name is unavailable');
      return false;
    }
  }

  /** Edits one imported card title without granting the board remote mutation authority. */
  function editLocalCard(cardKey: string | number, patch: { readonly title: string }): boolean {
    return mounted?.editCard(cardKey, patch) ?? false;
  }

  /** Prompts for a local saved-view name through the application dialog service. */
  async function promptToSaveView(): Promise<void> {
    if (mounted === undefined) return;
    const name = signal('My GitHub view');
    const entered = await inputBox(app, { title: 'Save local view', label: '~N~ame', value: name });
    if (entered !== null) saveLocalView(entered);
  }

  /** Prompts for the focused card title and applies the detached text locally. */
  async function promptToEditFocusedCard(): Promise<void> {
    const focused = mounted?.board.inspection().interaction.focused;
    if (mounted === undefined || focused?.kind !== 'card') {
      mounted?.announce('Focus a card before editing');
      return;
    }
    const card = mounted.cards().find(({ key }) => key === focused.cardKey);
    if (card === undefined) return;
    const title = signal(card.title);
    const entered = await inputBox(app, { title: 'Edit local card title', label: '~T~itle', value: title });
    if (entered !== null) editLocalCard(card.key, { title: entered });
  }

  app.onCommand(GITHUB_KANBAN_COMMANDS.open, () => void promptForProject());
  app.onCommand(GITHUB_KANBAN_COMMANDS.refresh, () => void load(loadedUrl()));
  app.onCommand(GITHUB_KANBAN_COMMANDS.filterFirstStatus, () => {
    const status = mounted?.cards()[0]?.status;
    if (status === undefined) return;
    applyLocalView({
      kind: 'set-filters',
      filters: [{ fieldId: 'status', operatorId: 'github.equals', value: status }],
    });
  });
  app.onCommand(GITHUB_KANBAN_COMMANDS.clearView, () => applyLocalView({ kind: 'clear-filters' }));
  app.onCommand(GITHUB_KANBAN_COMMANDS.saveView, () => void promptToSaveView());
  app.onCommand(GITHUB_KANBAN_COMMANDS.editFocused, () => void promptToEditFocusedCard());
  app.onCommand(GITHUB_KANBAN_COMMANDS.about, () => {
    void messageBox(app, {
      title: 'About GitHub Project Kanban',
      text: 'Live public GitHub data · local drag and drop · no authentication · no GitHub changes. Refresh restores the source project.',
    });
  });
  for (const choice of THEMES) {
    app.onCommand(`${GITHUB_KANBAN_COMMANDS.themePrefix}${choice.id}`, () => {
      app.setTheme(choice.theme);
      boardTheme.set(githubKanbanTheme(choice.theme));
      themeName.set(choice.label);
      activity.set(`${choice.label} theme · project data unchanged`);
      mounted?.announce(`${choice.label} theme · project data unchanged`);
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
    isMaximized: () => window.isZoomed(),
    toggleMaximize: () => {
      window.zoom();
      app.loop.renderRoot.flush();
    },
    applyLocalView,
    saveLocalView,
    localSavedViews: savedViews,
    editLocalCard,
  };
}
