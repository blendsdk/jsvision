/**
 * Validation & lifecycle · Row gate — a per-row `validateRow` cross-field gate runs when the cursor
 * leaves a row that was edited. Here End must be after Start.
 *
 * The key distinction from a per-cell `validate` (see the Per-cell demo): a cross-field gate cannot
 * reject the value at the point of entry — reaching a new valid combination often means passing through
 * a transiently-invalid state (raise Start first, then End). So `validateRow` SAVES each individually
 * valid cell and instead traps the row-LEAVE: edit a row so End ≤ Start, then try to leave (arrow /
 * Enter / click a different row) and the cursor refocuses the `end` field and stays put — the value is
 * saved, but the row will not release until End > Start. An untouched row leaves freely. The red lock
 * banner spells this out so the "saved but locked" state is unmistakable.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { Button, Group, Text, signal } from '@jsvision/ui';
import { column, fromRows, EditableDataGrid } from '@jsvision/datagrid';
import { at } from '../../story.js';
import type { Story } from '../../story.js';

interface Span {
  id: number;
  start: number;
  end: number;
}

export const rowGateStory: Story = {
  id: 'datagrid/validation-lifecycle/row-gate',
  category: 'Validation & lifecycle',
  title: 'Row gate (cross-field)',
  rd: 'RD-12',
  blurb: 'validateRow saves each valid cell but locks the row-leave until the cross-field rule holds.',
  build(ctx) {
    const rows = signal<Span[]>([
      { id: 1, start: 1, end: 9 },
      { id: 2, start: 3, end: 7 },
      { id: 3, start: 2, end: 5 },
    ]);
    const vetoNextRevert = signal(false);
    const outcome = signal('Outcome: ready — make Start ≥ End, then try to leave the row');
    const num = (id: 'start' | 'end', title: string) =>
      column<Span, number>({
        id,
        title,
        value: (r) => r[id],
        parse: (t) => Number(t),
        set: (r, v) => {
          r[id] = v;
        },
        editor: { kind: 'integer' },
        width: 8,
      });
    const grid = new EditableDataGrid<Span>({
      columns: [num('start', 'Start'), num('end', 'End')],
      source: fromRows(rows, { rowKey: (r) => r.id }),
      validateRow: (r) =>
        r.end > r.start ? { ok: true } : { ok: false, message: 'End must be after Start', field: 'end' },
      onRevertRow: () => {
        if (vetoNextRevert()) {
          vetoNextRevert.set(false);
          outcome.set('Outcome: veto kept the invalid edits for retry; press Esc again');
          return false;
        }
        outcome.set('Outcome: restored the original row; ↑/↓ now releases navigation');
        return true;
      },
      zebra: true,
    });

    const root = new Group();
    const gridH = Math.max(1, ctx.height - 6);
    root.add(at(new Text('Esc reverts row changes · Alt+V vetoes for retry'), 0, 0, ctx.width, 1));
    // Keep the grid before the button in child order so the showcase's first-focusable traversal lands
    // on the primary workspace. The button still receives Alt+V through its post-process hotkey path.
    root.add(at(grid, 0, 3, ctx.width, gridH));
    root.add(
      at(
        new Button('Arm ~V~eto', {
          onClick: () => {
            vetoNextRevert.set(!vetoNextRevert());
            outcome.set(
              vetoNextRevert()
                ? 'Outcome: Alt+V veto armed — the next Esc keeps edits for retry'
                : 'Outcome: veto disarmed — Esc may restore the row',
            );
          },
        }),
        0,
        1,
        14,
        2,
      ),
    );
    root.add(at(new Text('Enter edits · Tab commits · ↑/↓ tests leave'), 16, 1, Math.max(1, ctx.width - 16), 1));
    // The lock banner: red only while the row is trapped (there is an active message), blank once it
    // clears. It states plainly that the value was saved but the row will not release — the exact point
    // that separates a cross-field row gate from a per-cell reject.
    root.add(
      at(
        new Text(
          () => {
            const m = grid.activeMessage();
            return m ? `ROW LOCKED — ${m}. Value saved; the cursor stays here until End > Start.` : '';
          },
          { severity: 'error' },
        ),
        0,
        ctx.height - 3,
        ctx.width,
        1,
      ),
    );
    root.add(at(new Text(outcome), 0, ctx.height - 2, ctx.width, 1));
    root.add(
      at(new Text(() => `Active message: ${grid.activeMessage() ?? '(none)'}`), 0, ctx.height - 1, ctx.width, 1),
    );
    return root;
  },
};
