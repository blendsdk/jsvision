/** GroupBox implementation edge cases not duplicated by the public rendering specifications. */
import { expect, test } from 'vitest';
import { ScreenBuffer, defaultTheme, resolveCapabilities } from '@jsvision/core';
import { GroupBox } from '../src/group-box/index.js';
import { makeDrawContext } from '../src/view/index.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

test('leaves a one-cell interior border intact for a combining-mark-only caption', () => {
  const buffer = new ScreenBuffer(3, 2, { fg: 'default', bg: 'default' });
  const rect = { x: 0, y: 0, width: 3, height: 2 };
  const context = makeDrawContext(buffer, rect, rect, defaultTheme, caps);

  new GroupBox({ title: '\u0301' }).draw(context);

  expect(buffer.get(0, 0)?.char).toBe('┌');
  expect(buffer.get(1, 0)?.char).toBe('─');
  expect(buffer.get(2, 0)?.char).toBe('┐');
});
