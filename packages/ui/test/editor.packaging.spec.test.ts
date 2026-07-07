/**
 * Specification test (immutable oracle) — RD-08 editor-family packaging (ST-33).
 *
 * Source: RD-08 AC-19 → ST-33 (codeops/features/jsvision-ui/plans/editor-family/07-testing-
 * strategy.md; 03-07 §Packaging). Every public symbol re-exports BY NAME from `@jsvision/ui`
 * (the published surface); the pure internals (`buffer/*`, the keymap tables, `undo.ts`,
 * `search.ts` helpers, `LineRing`) stay OFF the barrel; every `src/editor/` + `src/terminal/`
 * source file is ≤ 500 lines; the package declares zero runtime dependencies beyond core.
 * (Most exports landed with Phase 9 — files consumes them by name — so parts of this oracle
 * passed pre-11.2 by design; the justified pre-pass.)
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ui from '@jsvision/ui';
import type { EditorOptions, EditorDialogHandler, FindRec, ReplaceRec, LineEnding, EditorAction } from '@jsvision/ui';

const here = dirname(fileURLToPath(import.meta.url));

/** Recursively list every `.ts` source file under a directory. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

// ST-33 / AC-19 — every 03-07 §Packaging value symbol rides the barrel by name.
test('ST-33: the editor-family surface re-exports by name from @jsvision/ui', () => {
  for (const name of [
    'Editor',
    'Memo',
    'EditWindow',
    'Indicator',
    'Terminal',
    'terminalWriter',
    'findDialog',
    'replaceDialog',
    'confirmBox',
    'infoBox',
    'replacePrompt',
    'wireEditorDialogs',
    'defaultEditorDialog',
    'EditorCommands',
  ] as const) {
    expect(ui[name], name).toBeTruthy();
  }
  // The option/seam types resolve (type-only imports compile ⇒ re-exported).
  const opts: EditorOptions = {};
  const handler: EditorDialogHandler = ui.defaultEditorDialog;
  const rec: FindRec = { find: 'x', options: { caseSensitive: false, wholeWords: false } };
  const rrec: ReplaceRec = { ...rec, replace: 'y', promptOnReplace: true, replaceAll: false };
  const eol: LineEnding = 'lf';
  const action: EditorAction = 'charLeft';
  expect([opts, handler, rec, rrec, eol, action]).toBeTruthy();
  // A bare editor constructs and exposes the public surface.
  const ed = new ui.Editor();
  expect(typeof ed.setText).toBe('function');
  expect(typeof ed.execute).toBe('function');
  expect(typeof ed.attachGadgets).toBe('function');
});

// ST-33 — the pure internals stay OFF the published surface.
test('ST-33: internals (GapBuffer, LineRing, formatLine, resolveKey, UndoStack, scan) are not exported', () => {
  const bag = ui as Record<string, unknown>;
  for (const name of ['GapBuffer', 'LineRing', 'formatLine', 'resolveKey', 'UndoStack', 'scan', 'nextChar']) {
    expect(bag[name], name).toBeUndefined();
  }
});

// ST-33 / AC-19 — the ≤500-line architecture boundary for both new subsystems.
test('ST-33: each src/editor/ + src/terminal/ source file is ≤ 500 lines', () => {
  for (const dir of ['editor', 'terminal']) {
    for (const file of tsFiles(join(here, '..', 'src', dir))) {
      const lines = readFileSync(file, 'utf8').split('\n').length;
      expect(lines, file).toBeLessThanOrEqual(500);
    }
  }
});

// ST-33 — zero runtime dependencies beyond @jsvision/core (check:deps guards natives repo-wide).
test('ST-33: the ui package declares only @jsvision/core as a runtime dependency', () => {
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  expect(Object.keys(pkg.dependencies ?? {})).toEqual(['@jsvision/core']);
});
