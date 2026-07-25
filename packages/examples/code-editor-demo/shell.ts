import { createKeymap, type CapabilityProfile } from '@jsvision/core';
import {
  Commands,
  Group,
  ListBox,
  Text,
  View,
  Window,
  createApplication,
  item,
  menuBar,
  signal,
  statusItem,
  statusLine,
  subMenu,
  type DesktopApplication,
  type DispatchEvent,
  type DrawContext,
} from '@jsvision/ui';
import { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';
import {
  CODE_EDITOR_SCENARIOS,
  disposeCodeEditorScenario,
  inspectCodeEditorScenario,
  runCodeEditorScenarioAction,
  waitForCodeEditorScenario,
} from './scenarios.js';
import { SharedSessionCodeEditorWindow } from './shared-session-window.js';
import { readyCodeEditorQaResult, runCodeEditorQaCheck, type CodeEditorQaCheckResult } from './qa-checks.js';

const TAB_COMMAND = 'code-editor.tab';
const SHIFT_TAB_COMMAND = 'code-editor.shift-tab';
const NEXT_PEER_COMMAND = 'code-editor.next-peer';
const RUN_QA_CHECK_COMMAND = 'code-editor.run-check';

/** Live application seams used by interactive operation and headless shell tests. */
export interface CodeEditorShowcase {
  readonly app: DesktopApplication;
  readonly navigator: ListBox;
  run(): Promise<number>;
  select(index: number): void;
  activeScenarioId(): string;
  activeEditor(): CodeEditor;
  /** Runs the selected scenario's documented QA action and evaluates its public outcome. */
  runCurrentQaCheck(): Promise<void>;
  /** Waits for a check started through F5 or the application command router. */
  whenQaCheckSettled(): Promise<void>;
  /** Returns the immutable result currently displayed in the QA evidence panel. */
  qaResult(): CodeEditorQaCheckResult;
}

/** Invisible command router for menu and status-line scenario actions. */
class ShowcaseCommands extends View {
  public override postProcess = true;

  public constructor(private readonly handlers: Readonly<Record<string, () => void>>) {
    super();
    this.state.visible = false;
  }

  /** Intentionally draws nothing because this view only receives routed commands. */
  public override draw(_context: DrawContext): void {}

  public override onEvent(event: DispatchEvent): void {
    if (event.event.type !== 'command') return;
    const handler = this.handlers[event.event.command];
    if (handler === undefined) return;
    handler();
    event.handled = true;
  }
}

/**
 * Composes a real JSVision application with keyboard/menu navigation, a live editor, help, and a
 * state inspector. The same `select` seam lets headless tests drive the live shell.
 */
export function createCodeEditorShowcase(caps: CapabilityProfile): CodeEditorShowcase {
  const app = createApplication({
    caps,
    menuBar: menuBar([
      subMenu('~F~ile', [item('~R~eset scenario', 'code-editor.reset', 'Ctrl-R'), item('E~x~it', Commands.quit)]),
      subMenu(
        '~S~cenarios',
        CODE_EDITOR_SCENARIOS.map((scenario, index) => item(scenario.title, `code-editor.select.${index}`)),
      ),
      subMenu('~A~ctions', [
        item('~R~un current QA check', RUN_QA_CHECK_COMMAND, 'F5'),
        item('~E~dit', 'code-editor.action.edit'),
        item('~F~ind', 'code-editor.action.search'),
        item('~O~utline fold', 'code-editor.action.fold'),
        item('~T~heme', 'code-editor.action.theme'),
        item('Switch ~l~anguage', 'code-editor.action.language'),
        item('Focus next editor peer', NEXT_PEER_COMMAND, 'Ctrl-Tab'),
      ]),
    ]),
    statusLine: statusLine([
      statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
      statusItem('~Ctrl-R~ Reset', 'code-editor.reset', 'Ctrl+R'),
      statusItem('~↑↓ Enter~ Scenario'),
      statusItem('~F5~ Run QA', RUN_QA_CHECK_COMMAND, 'F5'),
      statusItem('~Tab~ Editor'),
      statusItem('~F10~ Menu'),
    ]),
    keymap: createKeymap({
      tab: TAB_COMMAND,
      'shift+tab': SHIFT_TAB_COMMAND,
      'ctrl+tab': NEXT_PEER_COMMAND,
      f5: RUN_QA_CHECK_COMMAND,
    }),
  });
  let width = app.desktop.bounds.width;
  let height = app.desktop.bounds.height;
  let activeIndex = 0;
  let sidebarWidth = Math.min(28, Math.max(18, Math.floor(width / 3)));
  const qaPanelHeight = (): number =>
    CODE_EDITOR_SCENARIOS[activeIndex]?.qa === undefined
      ? Math.min(7, height)
      : Math.min(11, Math.max(5, Math.floor(height / 2)));
  const editorHeight = (): number => Math.max(6, height - qaPanelHeight());
  const navigator = new ListBox({
    items: signal(CODE_EDITOR_SCENARIOS.map((scenario) => scenario.title)),
    focused: signal(0),
    typeAhead: true,
    onSelect: (index) => select(index),
  });
  const sidebar = new Group();
  sidebar.background = 'window';
  const sidebarTitle = new Text('Code Editor scenarios');
  sidebar.add(sidebarTitle);
  sidebar.add(navigator);
  const help = new Text('F5 runs the selected QA check\nTab enters editor · F10 menu\nCtrl-R reset · Alt-X exits');
  sidebar.add(help);

  /** Fits the borderless navigation list and its fixed help footer to the left application edge. */
  const layoutSidebar = (): void => {
    const helpHeight = Math.min(3, height);
    sidebar.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: sidebarWidth, height } });
    sidebarTitle.setLayout({
      position: 'absolute',
      rect: { x: 0, y: 0, width: sidebarWidth, height: Math.min(1, height) },
    });
    navigator.setLayout({
      position: 'absolute',
      rect: { x: 0, y: 1, width: sidebarWidth, height: Math.max(0, height - helpHeight - 1) },
    });
    help.setLayout({
      position: 'absolute',
      rect: { x: 0, y: height - helpHeight, width: sidebarWidth, height: helpHeight },
    });
  };
  layoutSidebar();
  app.desktop.add(sidebar);

  const inspector = new Window('QA guide / live evidence');
  inspector.focusable = false;
  inspector.movable = false;
  inspector.resizable = false;
  inspector.setLayout({
    rect: {
      x: sidebarWidth,
      y: editorHeight(),
      width: Math.max(20, width - sidebarWidth),
      height: Math.max(0, height - editorHeight()),
    },
  });
  let activeSurface = CODE_EDITOR_SCENARIOS[0]?.mount({
    capabilities: caps,
    width: Math.max(20, width - sidebarWidth),
    height: editorHeight(),
  });
  if (activeSurface === undefined) throw new Error('The Code Editor showcase has no scenarios.');
  let editorWindow = activeSurface instanceof CodeEditorWindow ? activeSurface : undefined;
  const qaResultState = signal(readyCodeEditorQaResult(CODE_EDITOR_SCENARIOS[activeIndex]?.qa));
  let qaGeneration = 0;
  let pendingQaCheck = Promise.resolve();
  const activeEditor = (): CodeEditor => {
    if (
      activeSurface instanceof SharedSessionCodeEditorWindow &&
      app.loop.getFocused() === activeSurface.secondaryEditor
    ) {
      return activeSurface.secondaryEditor;
    }
    return activeSurface instanceof CodeEditorWindow ? activeSurface.editor : activeSurface;
  };
  const state = new Text(() => {
    const scenario = CODE_EDITOR_SCENARIOS[activeIndex];
    const guide = scenario?.qa;
    const qaResult = qaResultState();
    if (guide !== undefined) {
      return [
        `Check: ${scenario?.title ?? 'Unavailable'}`,
        `Why: ${guide.purpose}`,
        `How: F5 - ${guide.steps.join(' -> ')}`,
        `Expect: ${guide.expected}`,
        `Result: ${qaResult.status.toUpperCase()} - ${qaResult.observed}`,
      ].join('\n');
    }
    const current = activeEditor().controller.publicState;
    return [
      `scenario=${CODE_EDITOR_SCENARIOS[activeIndex]?.id ?? 'none'} language=${current.language}`,
      `Ln ${current.line}, Col ${current.visualColumn} selection=${current.selectionSize} modified=${current.modified}`,
      `service=${current.serviceState} readOnly=${current.readOnly} degraded=${current.degradation.notices.length}`,
      `features=${inspectCodeEditorScenario(activeSurface).configuredFeatures.join(',')} folds=${activeEditor().controller.folds.length}`,
      `host=${inspectCodeEditorScenario(activeSurface).hostEffects.join(',') || 'none'}`,
    ].join('\n');
  });
  state.setLayout({
    position: 'absolute',
    rect: {
      x: 1,
      y: 1,
      width: Math.max(1, width - sidebarWidth - 2),
      height: Math.max(1, qaPanelHeight() - 2),
    },
  });
  inspector.add(state);
  app.desktop.addWindow(inspector);

  const mountEditorSurface = (): void => {
    activeSurface.setLayout({
      position: 'absolute',
      rect: {
        x: sidebarWidth,
        y: 0,
        width: Math.max(20, width - sidebarWidth),
        height: editorHeight(),
      },
    });
    if (activeSurface instanceof CodeEditorWindow) {
      editorWindow = activeSurface;
      editorWindow.movable = true;
      editorWindow.resizable = true;
      editorWindow.castsShadow = true;
      editorWindow.onResized();
      app.desktop.addWindow(editorWindow);
    } else {
      editorWindow = undefined;
      app.desktop.add(activeSurface);
    }
    void waitForCodeEditorScenario(activeSurface).then(() => state.invalidate());
    app.loop.focusView(activeEditor());
  };

  /** Re-fits all persistent panes to the desktop after a terminal resize. */
  const layoutShell = (): void => {
    width = app.desktop.bounds.width;
    height = app.desktop.bounds.height;
    sidebarWidth = Math.min(28, Math.max(18, Math.floor(width / 3)));
    layoutSidebar();
    inspector.setLayout({
      rect: {
        x: sidebarWidth,
        y: editorHeight(),
        width: Math.max(20, width - sidebarWidth),
        height: Math.max(0, height - editorHeight()),
      },
    });
    state.setLayout({
      position: 'absolute',
      rect: {
        x: 1,
        y: 1,
        width: Math.max(1, width - sidebarWidth - 2),
        height: Math.max(1, qaPanelHeight() - 2),
      },
    });
    activeSurface.setLayout({
      position: 'absolute',
      rect: {
        x: sidebarWidth,
        y: 0,
        width: Math.max(20, width - sidebarWidth),
        height: editorHeight(),
      },
    });
    editorWindow?.onResized();
  };

  function select(index: number): void {
    const scenario = CODE_EDITOR_SCENARIOS[index];
    if (scenario === undefined) return;
    if (editorWindow === undefined) app.desktop.remove(activeSurface);
    else app.desktop.removeWindow(editorWindow);
    void disposeCodeEditorScenario(activeSurface);
    qaGeneration += 1;
    activeIndex = index;
    activeSurface = scenario.mount({
      capabilities: caps,
      width: Math.max(20, width - sidebarWidth),
      height: editorHeight(),
    });
    editorWindow = activeSurface instanceof CodeEditorWindow ? activeSurface : undefined;
    qaResultState.set(readyCodeEditorQaResult(scenario.qa));
    layoutShell();
    mountEditorSurface();
  }

  /** Runs and evaluates the active scenario's one documented QA interaction. */
  async function runCurrentQaCheck(): Promise<void> {
    const guide = CODE_EDITOR_SCENARIOS[activeIndex]?.qa;
    if (guide === undefined) {
      qaResultState.set(readyCodeEditorQaResult(undefined));
      state.invalidate();
      return;
    }
    const generation = ++qaGeneration;
    const surface = activeSurface;
    qaResultState.set(Object.freeze({ status: 'running', action: guide.action, observed: 'Check in progress.' }));
    state.invalidate();
    const check = runCodeEditorQaCheck(surface, guide).then((result) => {
      if (generation !== qaGeneration || surface !== activeSurface) return;
      qaResultState.set(result);
      state.invalidate();
      activeEditor().invalidate();
    });
    pendingQaCheck = check;
    await check;
  }

  const handlers: Record<string, () => void> = {
    'code-editor.reset': () => select(activeIndex),
    [RUN_QA_CHECK_COMMAND]: () => {
      void runCurrentQaCheck();
    },
    [TAB_COMMAND]: () => {
      if (app.loop.getFocused() === navigator.rows) app.loop.focusView(activeEditor());
      else activeEditor().routeKey({ key: 'Tab' });
    },
    [SHIFT_TAB_COMMAND]: () => {
      if (app.loop.getFocused() === activeEditor()) activeEditor().routeKey({ key: 'Tab', shift: true });
      else app.loop.focusView(activeEditor());
    },
    [NEXT_PEER_COMMAND]: () => {
      if (!(activeSurface instanceof SharedSessionCodeEditorWindow)) return;
      const next =
        app.loop.getFocused() === activeSurface.secondaryEditor ? activeSurface.editor : activeSurface.secondaryEditor;
      app.loop.focusView(next);
      state.invalidate();
    },
  };
  for (let index = 0; index < CODE_EDITOR_SCENARIOS.length; index += 1) {
    handlers[`code-editor.select.${index}`] = () => select(index);
  }
  for (const action of [
    'edit',
    'search',
    'fold',
    'completion',
    'hover',
    'signature',
    'symbols',
    'diagnostic-detail',
    'snippet',
    'format',
    'replace',
    'save',
    'navigate',
    'navigation-back',
    'close',
    'external-change',
    'cancel-recover',
    'host-accept',
    'host-reject',
    'host-conflict',
    'theme',
    'language',
  ] as const) {
    handlers[`code-editor.action.${action}`] = () => {
      void runCodeEditorScenarioAction(activeSurface, action).then(() => state.invalidate());
    };
  }
  app.desktop.add(new ShowcaseCommands(handlers));
  mountEditorSurface();
  const resizeApplicationChrome = app.loop.onResize;
  app.loop.onResize = (size) => {
    resizeApplicationChrome?.(size);
    layoutShell();
  };
  const initialRows = app.loop.renderRoot.buffer().rows();
  app.loop.resize({ width: initialRows[0]?.length ?? width, height: initialRows.length });
  app.loop.focusView(navigator.rows);

  return {
    app,
    navigator,
    run: () => app.run(),
    select,
    activeScenarioId: () => CODE_EDITOR_SCENARIOS[activeIndex]?.id ?? 'none',
    activeEditor,
    runCurrentQaCheck,
    whenQaCheckSettled: () => pendingQaCheck,
    qaResult: () => qaResultState(),
  };
}
