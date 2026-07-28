import { describe, expect, it, vi } from 'vitest';

import {
  createCodeEditorController,
  createCodeEditorLspCoordinator,
  createDocumentModel,
  createInProcessLspSession,
  type CodeEditorLspStateSnapshot,
} from '../index.js';

/** Creates a real document, deterministic session, coordinator, and attached controller. */
function createBridgeHarness(text = 'const value = 1;\n') {
  const document = createDocumentModel({
    text,
    uri: 'file:///workspace/bridge.ts',
    languageId: 'typescript',
  });
  const session = createInProcessLspSession({
    capabilities: {
      completion: true,
      diagnostics: true,
      documentFormatting: true,
    },
  });
  const coordinator = createCodeEditorLspCoordinator({
    document,
    session,
    uri: 'file:///workspace/bridge.ts',
    languageId: 'typescript',
  });
  const controller = createCodeEditorController({ document, lsp: coordinator });
  return { controller, coordinator, document, session };
}

describe('reactive language-service state bridge', () => {
  it('should publish one immutable snapshot and one controller invalidation for one response', async () => {
    // One accepted asynchronous response must become one immutable observable editor state change.
    const { controller, coordinator, session } = createBridgeHarness('con');
    const coordinatorSnapshots: CodeEditorLspStateSnapshot[] = [];
    const controllerSnapshots: unknown[] = [];
    const coordinatorSubscription = coordinator.subscribeState((snapshot) => {
      coordinatorSnapshots.push(snapshot);
    });
    const controllerSubscription = controller.subscribe((snapshot) => {
      controllerSnapshots.push(snapshot);
    });
    await coordinator.open();
    const completion = coordinator.requestCompletion({ line: 0, character: 3 });
    coordinatorSnapshots.length = 0;
    controllerSnapshots.length = 0;
    const previousCoordinatorState = coordinator.state;
    const previousControllerPresentation = controller.presentation;

    session.respond(completion.requestId, {
      items: [{ label: 'console', insertText: 'console' }],
    });
    await completion.settled;

    expect(coordinatorSnapshots).toHaveLength(1);
    expect(controllerSnapshots).toHaveLength(1);
    expect(coordinator.state).not.toBe(previousCoordinatorState);
    expect(controller.presentation).not.toBe(previousControllerPresentation);
    expect(Object.isFrozen(coordinator.state)).toBe(true);
    expect(Object.isFrozen(controller.presentation)).toBe(true);
    expect(previousCoordinatorState.presentation.completion).toBeUndefined();
    expect(coordinator.state.presentation.completion?.items[0]?.label).toBe('console');
    expect(controller.presentation.assistance.completion?.items[0]?.label).toBe('console');

    coordinatorSubscription.dispose();
    controllerSubscription.dispose();
  });

  it('should stop both coordinator and controller notifications after disposal', async () => {
    // Disposed subscribers and disposed controller bridges must never retain or notify an editor.
    const { controller, coordinator, session } = createBridgeHarness();
    const coordinatorListener = vi.fn();
    const controllerListener = vi.fn();
    const coordinatorSubscription = coordinator.subscribeState(coordinatorListener);
    const controllerSubscription = controller.subscribe(controllerListener);
    await coordinator.open();
    coordinatorListener.mockClear();
    controllerListener.mockClear();

    coordinatorSubscription.dispose();
    controllerSubscription.dispose();
    controller.dispose();
    session.publishDiagnostics('file:///workspace/bridge.ts', 0, [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
        message: 'late diagnostic',
      },
    ]);

    expect(coordinatorListener).not.toHaveBeenCalled();
    expect(controllerListener).not.toHaveBeenCalled();
    expect(controller.presentation.assistance.diagnostics.items).toHaveLength(0);
  });
});
