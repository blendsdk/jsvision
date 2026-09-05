/** Immutable GroupBox public-packaging and API-documentation specifications. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import * as ui from '../src/index.js';
import type { GroupBoxOptions, GroupBoxTitleAlignment } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

test('exports the class and both public types from the package entry point', () => {
  const alignment: GroupBoxTitleAlignment = 'center';
  const options: GroupBoxOptions = { title: 'Details', titleAlignment: alignment, padding: 1 };

  expect(typeof ui.GroupBox).toBe('function');
  expect(new ui.GroupBox(options)).toBeInstanceOf(ui.GroupBox);
});

test('documents the complete public surface without protected configuration storage', () => {
  const source = readFileSync(join(here, '..', 'src', 'group-box', 'group-box.ts'), 'utf8');

  expect(source).toMatch(/\/\*\*[\s\S]*?GroupBoxTitleAlignment/);
  expect(source).toMatch(/\/\*\*[\s\S]*?GroupBoxOptions/);
  for (const option of ['title', 'titleAlignment', 'padding', 'role', 'shadow']) {
    expect(source, `missing JSDoc for ${option}`).toMatch(
      new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/${'\\n'}\\s*readonly ${option}\\?`),
    );
  }
  expect(source).toMatch(/\/\*\*[\s\S]*?@example[\s\S]*?export class GroupBox/);
  expect(source).toMatch(/\/\*\*[\s\S]*?constructor\(options/);
  expect(source).toMatch(/\/\*\*[\s\S]*?override draw\(/);
  expect(source).not.toMatch(/protected readonly (title|titleAlignment|role)/);
});
