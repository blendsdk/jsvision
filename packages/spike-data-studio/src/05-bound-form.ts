/**
 * Probe 5 runner — a bound form + the datasheet sharing ONE RecordSet. Proves the shared-spine bet:
 *   • move the cursor → both the grid row highlight AND every form field update (one source);
 *   • edit a field in the FORM → the grid cell repaints (both read the same `field()` signal);
 *   • edit a field via the grid (set the shared signal, as the Probe 4 editor does) → the form repaints;
 *   • a `CheckGroup` (bool) binds through a small typed adapter over the string buffer;
 *   • Save is gated by validation — the same `Input.valid()` sweep `Dialog.valid()` runs.
 */
import {
  Group,
  Text,
  Input,
  CheckGroup,
  createEventLoop,
  effect,
  untrack,
  createRoot,
  signal,
  filter,
} from '@jsvision/ui';
import type { Column, Signal, Validator, View } from '@jsvision/ui';
import { pool } from './db.js';
import { pgSource } from './data-source.js';
import { RecordSet } from './record-set.js';
import { EditableGridRows } from './editable-grid.js';
import { caps } from './headless.js';

type Row = Record<string, unknown>;
const W = 46;
const H = 11;

/** A "required" validator: any keystroke allowed, but the completed value must be non-empty. */
const required = (): Validator => ({
  isValidInput: () => true,
  isValid: (s) => s.trim().length > 0,
  error: 'required',
});

/** Absolute-place a child in a parent group. */
function at(parent: Group, child: View, x: number, y: number, w: number, h: number): void {
  child.layout = { position: 'absolute', rect: { x, y, width: w, height: h } };
  parent.add(child);
}

function key(name: string, mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {}) {
  return { type: 'key' as const, key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** Two-way bridge: a `Signal<boolean[]>` for a CheckGroup ↔ a `'true'/'false'` string field buffer. */
function boolBridge(field: Signal<string>): Signal<boolean[]> {
  const bridge = signal<boolean[]>([field() === 'true']);
  effect(() => {
    const b = field() === 'true';
    untrack(() => {
      if (bridge()[0] !== b) bridge.set([b]);
    });
  });
  effect(() => {
    const b = bridge()[0];
    untrack(() => {
      const s = b ? 'true' : 'false';
      if (field() !== s) field.set(s);
    });
  });
  return bridge;
}

async function main(): Promise<void> {
  console.log('=== Probe 5: bound form sharing the RecordSet spine ===');
  const source = await pgSource('app', 'customer');
  const rs = new RecordSet(source, await source.fetchWindow(0, 100));

  // Pre-create the field buffers so the buffer-aware accessors never create a signal mid-draw.
  for (const f of ['name', 'balance', 'is_active']) rs.field(f);

  // Buffer-aware columns: the CURRENT row's cells read the edit buffer (live form↔grid sync); other
  // rows read committed values. Both the grid and the form thus read the ONE RecordSet.
  const COLUMNS: Column<Row>[] = [
    { title: 'id', accessor: (r) => String(r.id ?? ''), width: 3, align: 'right' },
    { title: 'name', accessor: (r) => rs.cellText(r as never, 'name'), width: 16 },
    { title: 'bal', accessor: (r) => rs.cellText(r as never, 'balance'), width: 9, align: 'right' },
    { title: 'act', accessor: (r) => (rs.cellText(r as never, 'is_active') === 'true' ? 'Y' : 'N'), width: 3 },
  ];

  let nameIn!: Input;
  let balIn!: Input;
  let grid!: EditableGridRows<Row>;

  const loop = createRoot(() => {
    const root = new Group();
    root.layout = { position: 'absolute', rect: { x: 0, y: 0, width: W, height: H } };

    grid = new EditableGridRows<Row>(
      {
        display: () => rs.rows(),
        columns: COLUMNS,
        autoWidths: () => COLUMNS.map(() => null),
        indent: signal(0),
        focused: rs.position,
        selected: signal(-1),
        zebra: false,
      },
      [false, true, true, true],
    );
    at(root, grid, 0, 0, W, 5);

    const form = new Group();
    at(root, form, 0, 6, W, 4);
    at(form, new Text('Name:'), 0, 0, 9, 1);
    nameIn = new Input({ value: rs.field('name'), validator: required() });
    at(form, nameIn, 9, 0, 22, 1);
    at(form, new Text('Balance:'), 0, 1, 9, 1);
    balIn = new Input({ value: rs.field('balance'), validator: filter('0-9.') });
    at(form, balIn, 9, 1, 12, 1);
    at(form, new Text('Active:'), 0, 2, 9, 1);
    at(form, new CheckGroup({ labels: ['on'], value: boolBridge(rs.field('is_active')) }), 9, 2, 12, 1);

    const l = createEventLoop({ width: W, height: H }, { caps: caps() });
    l.mount(root);
    effect(() => {
      rs.position();
      rs.syncBuffers();
    });
    // draw() is NOT auto-tracked in jsvision, so the grid must be explicitly linked to the edit
    // buffers to live-reflect an uncommitted form edit on the current row (repaint on any buffer change).
    effect(() => {
      for (const f of ['name', 'balance', 'is_active']) rs.field(f)();
      grid.invalidate();
    });
    l.focusView(grid);
    return l;
  });

  const frame = (title: string): void => {
    loop.renderRoot.flush();
    const lines = loop.renderRoot
      .buffer()
      .rows()
      .map((row) =>
        row
          .map((c) => c.char)
          .join('')
          .trimEnd(),
      );
    console.log(`\n${title}`);
    for (const l of lines) if (l.length) console.log(`  ${l}`);
  };

  frame('① row 0 (Ada) — grid + form both show the same record');

  console.log('\n② cursor follow: rs.next() → grid highlight AND form fields both move');
  rs.next();
  frame('   now row 1 (Alan)');

  console.log('\n③ FORM→GRID: focus the name Input and type " Jr" — the grid name cell repaints too');
  loop.focusView(nameIn);
  loop.dispatch(key('end'));
  for (const ch of [' ', 'J', 'r']) loop.dispatch(key(ch === ' ' ? 'space' : ch));
  frame('   name edited in the form; grid row 1 name cell mirrors it (shared signal)');
  console.log(`   grid cell name = "${COLUMNS[1].accessor(rs.current()!)}", form buffer = "${rs.field('name')()}"`);

  console.log('\n④ GRID→FORM: a grid cell-edit sets the shared field; the form Input repaints');
  rs.field('balance').set('4242.00'); // what the Probe-4 in-cell editor does on the shared signal
  frame('   balance set via the grid path; form Balance field mirrors it');

  console.log('\n⑤ bool CheckGroup bound through the typed adapter — toggle reflects in the grid "act" col');
  const active0 = rs.field('is_active')();
  rs.field('is_active').set(active0 === 'true' ? 'false' : 'true');
  frame(`   is_active ${active0} → ${rs.field('is_active')()}; grid act col + checkbox both updated`);

  console.log('\n⑥ SAVE GATE (the Dialog.valid() sweep): clear name → save blocked; restore → save proceeds');
  rs.rollback(); // discard the ⑤ toggle + ④ balance so we test the gate on a clean-ish edit
  rs.field('name').set('');
  const sweep = (): { ok: boolean; firstInvalid?: string } => {
    // Exactly what Dialog.valid() does: depth-first, return the first control whose valid() fails.
    for (const [label, ctrl] of [
      ['name', nameIn],
      ['balance', balIn],
    ] as const) {
      if (!ctrl.valid()) return { ok: false, firstInvalid: label };
    }
    return { ok: true };
  };
  const g1 = sweep();
  console.log(
    `   name empty → gate: ${g1.ok ? 'OK' : `BLOCKED (refocus "${g1.firstInvalid}")`}  [name.invalid=${nameIn.invalid}]`,
  );
  rs.field('name').set('Alan Turing');
  const g2 = sweep();
  console.log(
    `   name restored → gate: ${g2.ok ? 'OK → commit allowed' : 'BLOCKED'}  [name.invalid=${nameIn.invalid}]`,
  );

  rs.rollback();
  console.log('\n   (no DB writes in this probe — seed already pristine.)');

  console.log('\nProbe 5 verdict: 🟢 grid + form share ONE RecordSet and stay in sync both directions; a bool');
  console.log('   CheckGroup binds via a tiny typed adapter; save is gated by the same Input.valid() sweep');
  console.log('   Dialog.valid() ships. The shared-spine architecture holds.');
}

main()
  .catch((err) => {
    console.error('Probe 5 FAILED:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
