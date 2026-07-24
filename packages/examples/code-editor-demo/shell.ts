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
import { CODE_EDITOR_SCENARIOS, inspectCodeEditorScenario, runCodeEditorScenarioAction } from './scenarios.js';

const TAB_COMMAND = 'code-editor.tab';
const SHIFT_TAB_COMMAND = 'code-editor.shift-tab';

/** Live application seams used by interactive operation and headless shell tests. */
export interface CodeEditorShowcase {
  readonly app: DesktopApplication;
  readonly navigator: ListBox;
  run(): Promise<number>;
  select(index: number): void;
  activeScenarioId(): string;
  activeEditor(): CodeEditor;
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
        item('~E~dit', 'code-editor.action.edit'),
        item('~F~ind', 'code-editor.action.search'),
        item('~O~utline fold', 'code-editor.action.fold'),
        item('~C~ompletion', 'code-editor.action.completion'),
        item('For~m~at', 'code-editor.action.format'),
        item('~S~ave request', 'code-editor.action.save'),
        item('~N~avigate request', 'code-editor.action.navigate'),
        item('~T~heme', 'code-editor.action.theme'),
      ]),
    ]),
    statusLine: statusLine([
      statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
      statusItem('~Ctrl-R~ Reset', 'code-editor.reset', 'Ctrl+R'),
      statusItem('~↑↓ Enter~ Scenario'),
      statusItem('~Tab~ Editor'),
      statusItem('~F10~ Menu'),
    ]),
    keymap: createKeymap({ tab: TAB_COMMAND, 'shift+tab': SHIFT_TAB_COMMAND }),
  });
  let width = app.desktop.bounds.width;
  let height = app.desktop.bounds.height;
  let sidebarWidth = Math.min(28, Math.max(18, Math.floor(width / 3)));
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
  const help = new Text(
    'Tab/Shift-Tab indent · Ctrl+A/Z/Y · Ctrl+←→\nMouse select · double-click word · wheel scroll\nCtrl+C/X/V · Ctrl+/ comments · F10 menu · Alt-X exits',
  );
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

  const inspector = new Window('State / host events');
  inspector.focusable = false;
  inspector.movable = false;
  inspector.resizable = false;
  inspector.setLayout({
    rect: {
      x: sidebarWidth,
      y: Math.max(8, height - 7),
      width: Math.max(20, width - sidebarWidth),
      height: Math.min(7, height),
    },
  });
  let activeIndex = 0;
  let activeSurface = CODE_EDITOR_SCENARIOS[0]?.mount({
    capabilities: caps,
    width: Math.max(20, width - sidebarWidth),
    height: Math.max(6, height - 7),
  });
  if (activeSurface === undefined) throw new Error('The Code Editor showcase has no scenarios.');
  let editorWindow = activeSurface instanceof CodeEditorWindow ? activeSurface : undefined;
  const activeEditor = (): CodeEditor =>
    activeSurface instanceof CodeEditorWindow ? activeSurface.editor : activeSurface;
  const state = new Text(() => {
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
    rect: { x: 1, y: 1, width: Math.max(1, width - sidebarWidth - 2), height: 4 },
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
        height: Math.max(6, height - 7),
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
        y: Math.max(8, height - 7),
        width: Math.max(20, width - sidebarWidth),
        height: Math.min(7, height),
      },
    });
    state.setLayout({
      position: 'absolute',
      rect: { x: 1, y: 1, width: Math.max(1, width - sidebarWidth - 2), height: 4 },
    });
    activeSurface.setLayout({
      position: 'absolute',
      rect: {
        x: sidebarWidth,
        y: 0,
        width: Math.max(20, width - sidebarWidth),
        height: Math.max(6, height - 7),
      },
    });
    editorWindow?.onResized();
  };

  function select(index: number): void {
    const scenario = CODE_EDITOR_SCENARIOS[index];
    if (scenario === undefined) return;
    if (editorWindow === undefined) app.desktop.remove(activeSurface);
    else app.desktop.removeWindow(editorWindow);
    activeEditor().dispose();
    activeIndex = index;
    activeSurface = scenario.mount({
      capabilities: caps,
      width: Math.max(20, width - sidebarWidth),
      height: Math.max(6, height - 7),
    });
    editorWindow = activeSurface instanceof CodeEditorWindow ? activeSurface : undefined;
    mountEditorSurface();
  }

  const handlers: Record<string, () => void> = {
    'code-editor.reset': () => select(activeIndex),
    [TAB_COMMAND]: () => {
      if (app.loop.getFocused() === navigator.rows) app.loop.focusView(activeEditor());
      else activeEditor().routeKey({ key: 'Tab' });
    },
    [SHIFT_TAB_COMMAND]: () => {
      if (app.loop.getFocused() === activeEditor()) activeEditor().routeKey({ key: 'Tab', shift: true });
      else app.loop.focusView(activeEditor());
    },
  };
  for (let index = 0; index < CODE_EDITOR_SCENARIOS.length; index += 1) {
    handlers[`code-editor.select.${index}`] = () => select(index);
  }
  for (const action of ['edit', 'search', 'fold', 'completion', 'format', 'save', 'navigate', 'theme'] as const) {
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
  };
}
