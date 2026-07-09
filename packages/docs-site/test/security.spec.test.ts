/**
 * Specification test (immutable oracle) — security boundaries (AC-10).
 *
 *  (a) A seeded file whose content carries a raw ESC byte, painted through the
 *      real docs-site render path, has the control byte stripped — `sanitize` is
 *      the injection boundary, so no raw escape ever reaches the terminal.
 *  (c) The Play component renders the example blurb as text (bound via `{{ }}`),
 *      never via `v-html`, so a crafted blurb cannot inject markup.
 *
 * (ST-14 (b) the one-dialog cap and (d) the error panel are covered in
 * play-controller.spec.)
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from 'vitest';
import { resolveCapabilities } from '@jsvision/core';
import { createRoot, Text } from '@jsvision/ui';
import { demoShell } from '../src/demo-shell.js';
import { HOME, seedFs } from '../examples/files/file-dialog.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
const VP = { width: 80, height: 24 };
const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLAY_VUE = readFileSync(join(PKG_ROOT, '.vitepress/theme/components/PlayExample.vue'), 'utf8');

test('ST-14(a): a raw ESC byte in seeded file content is stripped when painted', () => {
  const raw = seedFs().readFile(`${HOME}/notes.txt`);
  expect(raw).toContain('\x1b'); // the fixture really carries a control byte

  createRoot((dispose) => {
    const view = new Text(raw);
    view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 60, height: 6 } };
    const app = demoShell({ content: view, caps, viewport: VP, chrome: 'minimal' });
    const frame = app.loop.renderRoot
      .buffer()
      .rows()
      .map((r) => r.map((c) => c.char).join(''))
      .join('\n');
    expect(frame).not.toContain('\x1b'); // sanitize stripped it at the draw boundary
    dispose();
  });
});

test('ST-14(c): the Play component binds the blurb as text, never v-html', () => {
  expect(PLAY_VUE).not.toContain('v-html');
  expect(PLAY_VUE).toContain('{{ props.blurb }}');
});
