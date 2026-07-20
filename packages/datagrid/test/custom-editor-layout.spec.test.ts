/**
 * Specification test (immutable oracle) — what mounting does to a custom editor's own layout.
 *
 * `editor: { kind: 'custom', create }` is the documented escape hatch for a caller's own editor
 * widget, and `create` returns a view the caller built and may have configured. Mounting **replaces**
 * that view's layout rather than merging into it: the editor always fills its cell, and any
 * descriptor the caller set — padding, a stacking direction, a size, a stale rect — is discarded.
 *
 * That is easy to mistake for an oversight when reading the source, which is exactly what happened
 * once: the assignment was briefly converted to a merge-preserving tag, silently changing what a
 * published extension seam does to a caller's view. This test makes that change fail loudly.
 */
import { test, expect } from 'vitest';
import { Group, View, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { DrawContext } from '@jsvision/ui';
import { column, toEngineColumn } from '../src/column.js';
import { EditableGridRows } from '../src/editable-grid-rows.js';

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

interface Person {
  id: number;
  name: string;
}

/** A caller's own editor widget, focusable so the mount can hand it the keyboard. */
class CustomEditor extends View {
  override focusable = true;
  draw(ctx: DrawContext): void {
    ctx.text(0, 0, 'custom');
  }
}

const W = 20;
const H = 5;

/**
 * Mount a one-column grid whose editor is a caller factory returning `editor`, and begin editing.
 * Returns the overlay the editor mounts into.
 */
function buildAndEdit(editor: CustomEditor): Group {
  const NAME = column<Person, string>({
    id: 'name',
    title: 'Name',
    value: (r) => r.name,
    width: 8,
    parse: (t) => t,
    set: (r, v) => {
      r.name = v;
    },
    editor: { kind: 'custom', create: () => editor },
  });

  const rows: Person[] = [{ id: 1, name: 'Ada' }];
  const typedColumns = [NAME];
  const engineCols = typedColumns.map(toEngineColumn);
  const overlay = new Group();
  overlay.setLayout({ position: 'fill' });
  const grid = new EditableGridRows<Person>({
    display: () => rows,
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: signal(0),
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns,
    overlay,
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
  });
  grid.setLayout({ position: 'fill' });
  const container = new Group();
  container.setLayout({ position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } });
  container.add(grid);
  container.add(overlay);
  const root = new Group();
  root.add(container);
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(grid);

  loop.dispatch({ type: 'key', key: 'f2', ctrl: false, alt: false, shift: false });
  loop.renderRoot.flush();
  return overlay;
}

// The caller's whole descriptor is replaced — not merged into — when the editor mounts.
test('a custom editor factory loses its own layout when the editor is mounted', () => {
  const editor = new CustomEditor();
  editor.setLayout({
    padding: 2,
    direction: 'col',
    size: { kind: 'fixed', cells: 3 },
    rect: { x: 99, y: 99, width: 1, height: 1 },
  });

  const overlay = buildAndEdit(editor);

  // Non-vacuity: the editor really mounted, so the descriptor below belongs to a live view. The
  // overlay's own child is the host wrapper that owns the Enter/Esc handling; the editor is inside it.
  expect(overlay.children.length).toBe(1);
  const host = overlay.children[0] as Group;
  expect(host.children).toEqual([editor]);

  // Exactly the one property the mount writes — everything the caller set is gone.
  expect(editor.layout).toEqual({ position: 'fill' });
  expect(editor.bounds.width).toBeGreaterThan(0);
  expect(editor.bounds.height).toBeGreaterThan(0);
});

// A factory that sets nothing lands on the same descriptor, so the contract has no two paths.
test('a custom editor that sets no layout of its own gets the same fill descriptor', () => {
  const editor = new CustomEditor();

  const overlay = buildAndEdit(editor);

  expect(overlay.children.length).toBe(1);
  expect((overlay.children[0] as Group).children).toEqual([editor]);
  expect(editor.layout).toEqual({ position: 'fill' });
});
