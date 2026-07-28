/**
 * Implementation coverage for the localized Theme Designer's responsive action geometry.
 *
 * The immutable documentation specification checks the authored contract. This test builds the
 * real example at a constrained-but-feasible viewport so constant-width centering cannot regress
 * without producing a concrete geometry failure.
 */
import { resolveCapabilities } from '@jsvision/core';
import { Dialog, Group, View, createRoot } from '@jsvision/ui';
import type { Application } from '@jsvision/ui';
import { expect, test } from 'vitest';
import themeDesigner from '../examples/i18n-theme-designer.js';

const caps = resolveCapabilities({
  env: {},
  platform: 'linux',
  override: { colorDepth: 'truecolor' },
}).profile;

test('keeps the wrapped Dutch action group inside a constrained feasible dialog', () => {
  createRoot((dispose) => {
    const built = themeDesigner.build({ width: 30, height: 24, caps });
    expect(built).not.toBeInstanceOf(View);
    const app = built as Application;
    app.loop.resize({ width: 30, height: 24 });

    const dialog = app.desktop?.children.find((child): child is Dialog => child instanceof Dialog);
    expect(dialog).toBeDefined();
    const actionGroup = dialog?.children.at(-1);
    expect(actionGroup).toBeInstanceOf(Group);

    const innerRightEdge = Math.max(0, (dialog?.bounds.width ?? 0) - 1);
    const innerBottomEdge = Math.max(0, (dialog?.bounds.height ?? 0) - 1);
    expect((actionGroup?.bounds.x ?? 0) + (actionGroup?.bounds.width ?? 0)).toBeLessThanOrEqual(innerRightEdge);
    expect((actionGroup?.bounds.y ?? 0) + (actionGroup?.bounds.height ?? 0)).toBeLessThanOrEqual(innerBottomEdge);
    expect(actionGroup?.bounds.height).toBeGreaterThan(2);

    dispose();
  });
});
