/** Implementation hardening for accidental runtime exports from the public package barrel. */
import { describe, expect, it } from 'vitest';

import * as mainEntry from '../src/index.js';

describe('Kanban package runtime boundary hardening', () => {
  it('should not expose the package-owned viewport chrome seam', () => {
    expect(Object.hasOwn(mainEntry, 'setKanbanViewportHostChromeRows')).toBe(false);
    expect(Object.hasOwn(mainEntry, 'setViewportHostChromeRows')).toBe(false);
    expect(Object.hasOwn(mainEntry, 'readViewportHostChromeRows')).toBe(false);
  });
});
