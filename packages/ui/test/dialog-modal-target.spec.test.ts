/** Immutable contract for exact modal completion when dialogs are nested. */
import { resolveCapabilities } from '@jsvision/core';
import { describe, expect, it } from 'vitest';

import { Dialog, Group, createEventLoop } from '../src/index.js';

const CAPS = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

describe('Dialog exact modal completion', () => {
  it('should never close a nested dialog when its parent requests completion', async () => {
    const root = new Group();
    const loop = createEventLoop({ width: 60, height: 18 }, { caps: CAPS });
    loop.mount(root);
    const editor = new Dialog({ title: 'Editor', width: 40, height: 12 });
    const confirmation = new Dialog({ title: 'Confirm', width: 30, height: 8 });
    root.add(editor);
    root.add(confirmation);
    const editorResult = loop.execView<string>(editor);
    const confirmationResult = loop.execView<string>(confirmation);

    expect(editor.finishModal('committed')).toBe(false);
    let parentSettled = false;
    void editorResult.then(() => {
      parentSettled = true;
    });
    await Promise.resolve();
    expect(parentSettled).toBe(false);

    expect(confirmation.finishModal('yes')).toBe(true);
    await expect(confirmationResult).resolves.toBe('yes');
    expect(editor.finishModal('committed')).toBe(true);
    await expect(editorResult).resolves.toBe('committed');
  });
});
