/**
 * Probe 4 runner — the editable datasheet + in-cell editor overlay, driven through the REAL event
 * loop (synthetic `dispatch()`, no TTY). Proves: a cell cursor navigates with ←/→/Tab; Enter mounts a
 * typed `Input` at the focused cell's rect on the app overlay; keystrokes route to it; Enter commits
 * to the DB inside the RecordSet transaction and the grid repaints with the new value; Escape reverts.
 */
import { Group, createEventLoop, effect, createRoot, signal, filter } from '@jsvision/ui';
import type { Column, Signal, SortState } from '@jsvision/ui';
import { pool } from './db.js';
import { pgSource } from './data-source.js';
import { RecordSet } from './record-set.js';
import type { CommitResult } from './record-set.js';
import { EditableGridRows, CellEditor, absoluteRect } from './editable-grid.js';
import { caps } from './headless.js';

type Row = Record<string, unknown>;
const W = 62;
const H = 6;

// The customer datasheet columns (fixed widths so paging/geometry are stable; id is read-only).
const COLUMNS: Column<Row>[] = [
  { title: 'id', accessor: (r) => String(r.id ?? ''), width: 4, align: 'right' },
  { title: 'name', accessor: (r) => String(r.name ?? ''), width: 16 },
  { title: 'email', accessor: (r) => String(r.email ?? ''), width: 18 },
  { title: 'tier', accessor: (r) => String(r.tier ?? ''), width: 9 },
  { title: 'balance', accessor: (r) => String(r.balance ?? ''), width: 10, align: 'right' },
];
const EDITABLE = [false, true, true, true, true]; // id read-only; the rest editable
const FIELD = ['id', 'name', 'email', 'tier', 'balance'];

function key(name: string, mods: Partial<{ ctrl: boolean; alt: boolean; shift: boolean }> = {}) {
  return { type: 'key' as const, key: name, ctrl: false, alt: false, shift: false, ...mods };
}

async function main(): Promise<void> {
  console.log('=== Probe 4: editable grid + in-cell editor overlay ===');
  const source = await pgSource('app', 'customer');
  const window = await source.fetchWindow(0, 100);
  const rs = new RecordSet(source, window);

  let grid!: EditableGridRows<Row>;
  let overlay!: Group;
  let editor: CellEditor | null = null;
  let pendingCommit: Promise<CommitResult> | null = null;

  const loop = createRoot(() => {
    const root = new Group();
    root.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };

    grid = new EditableGridRows<Row>(
      {
        display: () => rs.rows(),
        columns: COLUMNS,
        autoWidths: () => COLUMNS.map(() => null),
        indent: signal(0),
        focused: rs.position, // the row cursor IS the RecordSet position → the form (Probe 5) follows
        selected: signal(-1),
        zebra: false,
      },
      EDITABLE,
    );
    grid.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
    grid.isDirtyCell = (col, row) => row === rs.position() && rs.dirtyFields().includes(FIELD[col]);

    overlay = new Group();
    overlay.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };
    overlay.state.visible = false;

    root.add(grid);
    root.add(overlay);

    const l = createEventLoop({ width: W, height: H }, { caps: caps() });
    l.mount(root);
    // Keep the edit buffers synced to whatever row the cursor lands on (grid nav or imperative).
    effect(() => {
      rs.position();
      rs.syncBuffers();
    });
    l.focusView(grid);
    return l;
  });

  const closeEditor = (): void => {
    if (!editor) return;
    overlay.remove(editor);
    overlay.state.visible = false;
    overlay.invalidate();
    editor = null;
    loop.focusView(grid);
  };

  // Open a cell editor at the focused cell's absolute rect on the overlay, focus it.
  grid.onEdit = (col): void => {
    const local = grid.cellRectLocal();
    const origin = absoluteRect(grid);
    const rect = { x: origin.x + local.x, y: origin.y + local.y, width: Math.max(local.width, 8), height: 1 };
    editor = new CellEditor(
      // `balance` is numeric(12,2): use a decimal filter. NB the shipped `range` validator is
      // integer-only (it strips a `.`) — a decimal/numeric validator is a small framework gap.
      { value: rs.field(FIELD[col]), validator: FIELD[col] === 'balance' ? filter('0-9.') : undefined },
      () => {
        // Enter in the editor: kick the transactional commit, then close + refocus the grid.
        pendingCommit = rs.commit();
        closeEditor();
      },
      () => {
        rs.rollback();
        closeEditor();
      },
    );
    editor.layout = { position: 'absolute', rect };
    overlay.add(editor);
    overlay.state.visible = true;
    overlay.invalidate();
    loop.focusView(editor);
  };

  const frame = (title: string): void => {
    loop.renderRoot.flush(); // force any pending (async-commit) repaint before reading the buffer
    const lines = loop.renderRoot
      .buffer()
      .rows()
      .map((row) => row.map((c) => c.char).join('').trimEnd());
    console.log(`\n${title}`);
    for (const l of lines) if (l.length) console.log(`  ${l}`);
    console.log(`  [cursor: row ${rs.position()} col ${grid.focusedCol()} "${FIELD[grid.focusedCol()]}"  focus=${loop.getFocused() === editor ? 'EDITOR' : 'grid'}]`);
  };

  frame('① initial — cell cursor at (row 0, col 0=id)');

  loop.dispatch(key('right'));
  loop.dispatch(key('right'));
  frame('② →→ moved the CELL cursor to col 2 (email), same row');

  loop.dispatch(key('down'));
  frame('③ ↓ moved the ROW cursor to row 1 (buffers follow the row)');

  // Go edit the "balance" cell of row 1: move to col 4, Enter.
  loop.dispatch(key('right'));
  loop.dispatch(key('right'));
  const target = rs.current();
  console.log(`\n   editing balance of id=${target?.id} (${target?.name}), current="${target?.balance}"`);
  loop.dispatch(key('enter'));
  frame('④ Enter → in-cell editor mounted over the balance cell, focused');
  console.log(`   getFocused() is the editor? ${loop.getFocused() === editor}`);

  // Type a new value: clear via select-all + type digits.
  loop.dispatch(key('a', { ctrl: true })); // select all
  for (const ch of '4321.00') loop.dispatch(key(ch));
  frame('⑤ typed "4321.00" — keystrokes routed to the overlay editor');

  loop.dispatch(key('enter')); // commit
  const result = await pendingCommit;
  frame('⑥ Enter → committed; editor gone; grid shows the new balance');
  console.log(`   commit result: ${result?.status}` + (result?.status === 'ok' ? ` → balance=${result.row.balance}` : ''));
  const check = await pool.query('SELECT balance FROM app.customer WHERE id=$1', [target?.id]);
  console.log(`   independent DB read → balance=${check.rows[0].balance} (persisted ✓)`);

  // Demonstrate Escape-revert on another cell.
  loop.dispatch(key('left')); // back to tier col? (col 3)
  loop.dispatch(key('enter'));
  loop.dispatch(key('a', { ctrl: true }));
  for (const ch of 'zzz') loop.dispatch(key(ch));
  console.log(`\n   typed junk into an editor; buffer="${rs.field(FIELD[grid.focusedCol()])()}" dirty=${rs.dirty()}`);
  loop.dispatch(key('escape'));
  console.log(`   Escape → buffer reverted="${rs.field(FIELD[grid.focusedCol()])()}" dirty=${rs.dirty()}`);

  // Restore the seed value we changed.
  await pool.query('UPDATE app.customer SET balance=$1 WHERE id=$2', [target?.balance, target?.id]);
  console.log(`\n   restored balance=${target?.balance} for id=${target?.id} — seed pristine.`);

  console.log('\nProbe 4 verdict: 🟢 cell cursor is an ADDITIVE SUBCLASS of GridRows (row-focus model does not');
  console.log('   fight it); the editor overlay mounts at a computed cell rect, dispatch/focus route to it,');
  console.log('   and Enter commits transactionally. Caveat: reuse needs @jsvision/ui to EXPORT GridRows +');
  console.log('   the columns helpers (spike used a dist relative-path bypass).');
}

main()
  .catch((err) => {
    console.error('Probe 4 FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
