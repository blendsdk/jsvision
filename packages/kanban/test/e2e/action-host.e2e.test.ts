/** Cross-package host oracle for Command-pointer routing through one Kanban action invocation. */
import { createBrowserDomInputAdapter } from '@jsvision/web';
import { describe, expect, it, vi } from 'vitest';

import { createKanbanActionRegistry, createKanbanActionRouter } from '../../src/index.js';
import type { KanbanActionInvocation } from '../../src/index.js';

describe('Kanban browser action host', () => {
  it('routes a macOS Command-click once and suppresses its matching SGR duplicate', () => {
    let pointerListener: ((event: unknown) => void) | undefined;
    const surface = {
      addEventListener(type: string, listener: (event: unknown) => void): void {
        if (type === 'pointerdown') pointerListener = listener;
      },
      removeEventListener(): void {
        pointerListener = undefined;
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 480 }),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    };
    const handler = vi.fn((_invocation: KanbanActionInvocation) => ({ kind: 'handled' as const }));
    const registry = createKanbanActionRegistry({ executePackageAction: handler });
    const router = createKanbanActionRouter({ registry });
    const adapter = createBrowserDomInputAdapter({
      surface,
      cells: () => ({ columns: 80, rows: 24 }),
      platform: 'darwin',
      onInput(event) {
        if (event.type !== 'mouse' || event.kind !== 'down' || event.primary !== true) return;
        router.invoke({
          actionId: 'kanban.selection.toggle',
          origin: 'pointer',
          target: { kind: 'card', cardKey: 42, revision: 'card-r1' },
          selection: { count: 0 },
          source: { state: 'ready', revision: 'source-r1' },
          view: { revision: 'view-r1' },
        });
      },
    });
    pointerListener?.({
      type: 'pointerdown',
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 100,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: true,
      preventDefault: vi.fn(),
    });
    const sgr = { type: 'mouse' as const, kind: 'down' as const, button: 0, x: 11, y: 6 };
    if (adapter.acceptTerminalInput(sgr)) {
      throw new Error('Matching SGR input must not reach the Kanban router.');
    }

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0]?.[0]).toMatchObject({
      actionId: 'kanban.selection.toggle',
      origin: 'pointer',
      target: { kind: 'card', cardKey: 42 },
    });
    adapter.dispose();
  });
});
