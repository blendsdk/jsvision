import { createKeymap, type CapabilityProfile } from '@jsvision/core';
import {
  Commands,
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
  const sidebar = new Window('Code Editor scenarios');
  sidebar.movable = false;
  sidebar.resizable = false;
  sidebar.setLayout({ rect: { x: 0, y: 0, width: sidebarWidth, height } });
  navigator.setLayout({
    position: 'absolute',
    rect: { x: 1, y: 2, width: Math.max(1, sidebarWidth - 2), height: Math.max(1, height - 7) },
  });
  sidebar.add(navigator);
  const help = new Text('Enter opens · Ctrl-R resets · Tab focuses editor · F10 menu · Alt-X exits');
  help.setLayout({
    position: 'absolute',
    rect: { x: 1, y: Math.max(1, height - 5), width: Math.max(1, sidebarWidth - 2), height: 3 },
  });
  sidebar.add(help);
  app.desktop.addWindow(sidebar);

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
  let editorWindow = windowFrom(activeSurface, CODE_EDITOR_SCENARIOS[0]?.title ?? 'Code Editor');
  const state = new Text(() => {
    const current = editorWindow.editor.controller.publicState;
    return [
      `scenario=${CODE_EDITOR_SCENARIOS[activeIndex]?.id ?? 'none'} language=${current.language}`,
      `Ln ${current.line}, Col ${current.visualColumn} selection=${current.selectionSize} modified=${current.modified}`,
      `service=${current.serviceState} readOnly=${current.readOnly} degraded=${current.degradation.notices.length}`,
      `features=${inspectCodeEditorScenario(activeSurface).configuredFeatures.join(',')}`,
      `host=${inspectCodeEditorScenario(activeSurface).hostEffects.join(',') || 'none'}`,
    ].join('\n');
  });
  state.setLayout({
    position: 'absolute',
    rect: { x: 1, y: 1, width: Math.max(1, width - sidebarWidth - 2), height: 4 },
  });
  inspector.add(state);
  app.desktop.addWindow(inspector);

  const mountEditorWindow = (): void => {
    editorWindow.movable = false;
    editorWindow.resizable = false;
    editorWindow.setLayout({
      rect: {
        x: sidebarWidth,
        y: 0,
        width: Math.max(20, width - sidebarWidth),
        height: Math.max(6, height - 7),
      },
    });
    editorWindow.onResized();
    app.desktop.addWindow(editorWindow);
    app.loop.focusView(editorWindow.editor);
  };

  /** Re-fits all persistent panes to the desktop after a terminal resize. */
  const layoutShell = (): void => {
    width = app.desktop.bounds.width;
    height = app.desktop.bounds.height;
    sidebarWidth = Math.min(28, Math.max(18, Math.floor(width / 3)));
    sidebar.setLayout({ rect: { x: 0, y: 0, width: sidebarWidth, height } });
    navigator.setLayout({
      position: 'absolute',
      rect: { x: 1, y: 2, width: Math.max(1, sidebarWidth - 2), height: Math.max(1, height - 7) },
    });
    help.setLayout({
      position: 'absolute',
      rect: { x: 1, y: Math.max(1, height - 5), width: Math.max(1, sidebarWidth - 2), height: 3 },
    });
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
    editorWindow.setLayout({
      rect: {
        x: sidebarWidth,
        y: 0,
        width: Math.max(20, width - sidebarWidth),
        height: Math.max(6, height - 7),
      },
    });
    editorWindow.onResized();
  };

  function select(index: number): void {
    const scenario = CODE_EDITOR_SCENARIOS[index];
    if (scenario === undefined) return;
    app.desktop.removeWindow(editorWindow);
    editorWindow.editor.dispose();
    activeIndex = index;
    activeSurface = scenario.mount({
      capabilities: caps,
      width: Math.max(20, width - sidebarWidth),
      height: Math.max(6, height - 7),
    });
    editorWindow = windowFrom(activeSurface, scenario.title);
    mountEditorWindow();
  }

  const handlers: Record<string, () => void> = {
    'code-editor.reset': () => select(activeIndex),
    [TAB_COMMAND]: () => {
      if (app.loop.getFocused() === navigator.rows) app.loop.focusView(editorWindow.editor);
      else editorWindow.editor.routeKey({ key: 'Tab' });
    },
    [SHIFT_TAB_COMMAND]: () => {
      if (app.loop.getFocused() === editorWindow.editor) editorWindow.editor.routeKey({ key: 'Tab', shift: true });
      else app.loop.focusView(editorWindow.editor);
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
  mountEditorWindow();
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
    activeEditor: () => editorWindow.editor,
  };
}

function windowFrom(surface: CodeEditor | CodeEditorWindow, title: string): CodeEditorWindow {
  return surface instanceof CodeEditorWindow
    ? surface
    : new CodeEditorWindow({ controller: surface.controller, title });
}
