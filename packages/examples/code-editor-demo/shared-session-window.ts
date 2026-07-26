import { Text } from '@jsvision/ui';
import {
  CodeEditor,
  CodeEditorWindow,
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  type CodeEditorController,
} from '@jsvision/code-editor';

import { DemoLspSession } from './demo-lsp-session.js';
import type { CodeEditorDemoAction, CodeEditorDemoFixture, CodeEditorDemoMountContext } from './scenarios.js';

/**
 * Window that visibly composes two independent editors without introducing tabs or a file manager.
 *
 * The inherited editor is the primary document. The secondary editor owns a separate controller;
 * only their language-service transport is shared by the scenario that constructs this window.
 */
export class SharedSessionCodeEditorWindow extends CodeEditorWindow {
  /** Independently focusable peer whose controller owns the second document. */
  public readonly secondaryEditor: CodeEditor;
  readonly #divider = new Text('shared transport · isolated documents');

  public constructor(primary: CodeEditorController, secondary: CodeEditorController) {
    super({ controller: primary, title: 'Two isolated editors · one LSP session', lineNumbers: true });
    this.secondaryEditor = new CodeEditor({ controller: secondary, lineNumbers: true });
    this.add(this.secondaryEditor);
    this.add(this.#divider);
    this.#layoutEditors();
  }

  /** Re-fits both document surfaces whenever the host window changes geometry. */
  public override onResized(): void {
    super.onResized();
    this.#layoutEditors();
  }

  /** Maximizes or restores the window while keeping both editors in the available content area. */
  public override zoom(): void {
    super.zoom();
    this.#layoutEditors();
  }

  /** Disposes both document-owned editors. */
  public disposeEditors(): void {
    this.editor.dispose();
    this.secondaryEditor.dispose();
  }

  #layoutEditors(): void {
    const rect = this.layout.rect ?? { x: 0, y: 0, width: 60, height: 16 };
    const contentWidth = Math.max(0, rect.width - 2);
    const contentHeight = Math.max(0, rect.height - 3);
    const dividerWidth = contentWidth >= 38 ? 1 : 0;
    const firstWidth = Math.max(0, Math.floor((contentWidth - dividerWidth) / 2));
    const secondWidth = Math.max(0, contentWidth - dividerWidth - firstWidth);
    this.editor.setLayout({
      position: 'absolute',
      rect: { x: 1, y: 1, width: firstWidth, height: contentHeight },
    });
    this.secondaryEditor.setLayout({
      position: 'absolute',
      rect: { x: 1 + firstWidth + dividerWidth, y: 1, width: secondWidth, height: contentHeight },
    });
    this.#divider.setLayout({
      position: 'absolute',
      rect: { x: 1 + firstWidth, y: 1, width: dividerWidth, height: contentHeight },
    });
    this.editor.resizeViewport(firstWidth, contentHeight);
    this.secondaryEditor.resizeViewport(secondWidth, contentHeight);
  }
}

/** Resources and content-free inspection returned by the shared-session scenario factory. */
export interface SharedSessionScenarioMount {
  /** Visible window containing both independently focusable editors. */
  readonly surface: SharedSessionCodeEditorWindow;
  /** Starts shared protocol setup once. */
  ready(): Promise<void>;
  /** Returns detached enum-only host events for both peers. */
  hostEffects(): readonly string[];
  /** Concrete actions supported by this specialized surface. */
  readonly actions: ReadonlyMap<CodeEditorDemoAction, () => Promise<void>>;
  /** Releases both coordinators, the transport, and both editor/controller stacks. */
  dispose(): Promise<void>;
}

/** Creates the two-document showcase composition while keeping its lifecycle in one module. */
export function createSharedSessionScenarioMount(
  scenarioId: string,
  fixture: CodeEditorDemoFixture,
  context: CodeEditorDemoMountContext,
): SharedSessionScenarioMount {
  const session = new DemoLspSession();
  const firstDocument = createDocumentModel({
    text: fixture.text,
    languageId: fixture.languageId,
    uri: `memory://code-editor-demo/${scenarioId}/first`,
  });
  const secondDocument = createDocumentModel({
    text: 'const secondDocument = true;\n',
    languageId: 'typescript',
    uri: `memory://code-editor-demo/${scenarioId}/second`,
  });
  const firstEvents: string[] = [];
  const secondEvents: string[] = [];
  const record = (events: string[], event: string): void => {
    if (!sharedHostEvents.has(event)) return;
    if (events.length >= 32) events.shift();
    events.push(event);
  };
  const firstCoordinator = createCodeEditorLspCoordinator({
    document: firstDocument,
    session,
    uri: `file:///code-editor-demo/${scenarioId}/first.ts`,
    languageId: firstDocument.languageId,
    host: async (effect) => {
      record(firstEvents, effect.kind);
      return true;
    },
  });
  const secondCoordinator = createCodeEditorLspCoordinator({
    document: secondDocument,
    session,
    uri: `file:///code-editor-demo/${scenarioId}/second.ts`,
    languageId: secondDocument.languageId,
    host: async (effect) => {
      record(secondEvents, effect.kind);
      return true;
    },
  });
  const surface = new SharedSessionCodeEditorWindow(
    createCodeEditorController({ document: firstDocument, lsp: firstCoordinator }),
    createCodeEditorController({ document: secondDocument, lsp: secondCoordinator }),
  );
  let disposed = false;
  let readiness: Promise<void> | undefined;
  surface.setLayout({ rect: { x: 0, y: 0, width: context.width, height: context.height } });
  surface.onResized();

  const ready = (): Promise<void> => {
    readiness ??= Promise.all([firstCoordinator.open(), secondCoordinator.open()]).then(() => {
      if (disposed) return;
      session.publishDiagnostic(firstDocument.uri ?? '', Number(firstDocument.identity.revision));
      session.publishDiagnostic(secondDocument.uri ?? '', Number(secondDocument.identity.revision));
      surface.editor.invalidate();
      surface.secondaryEditor.invalidate();
    });
    return readiness;
  };
  const actions = new Map<CodeEditorDemoAction, () => Promise<void>>([
    [
      'peer-edit',
      async () => {
        surface.secondaryEditor.insertText('// peer edit\n');
        await surface.secondaryEditor.whenIdle();
      },
    ],
  ]);

  return Object.freeze({
    surface,
    ready,
    hostEffects: () =>
      Object.freeze([
        ...firstEvents.map((event) => `first:${event}`),
        ...secondEvents.map((event) => `second:${event}`),
      ]),
    actions,
    async dispose() {
      disposed = true;
      await readiness?.catch(() => undefined);
      await Promise.all([firstCoordinator.close(), secondCoordinator.close()]);
      session.dispose();
      surface.disposeEditors();
    },
  });
}

const sharedHostEvents = new Set(['navigate', 'workspace-edit', 'command-authorization']);
