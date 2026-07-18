/**
 * Shared fixture for the golden-screen / a11y golden tests: one small representative grid composed
 * into a real screen buffer and pre-seeded into all four grid role states on FOUR DISTINCT cells so
 * none masks another under the body's overpaint precedence (cursor > gridInvalid > gridDirty).
 *
 * Roles are seeded through the body's own injected registries — the same public seams the dirty /
 * selection specs drive — rather than by replaying an edit/commit (which would leave an editor
 * holding focus and suppress the cursor overpaint):
 *   - gridCursor      → the focused body cell (row 0, col 0) while the body holds focus
 *   - gridDirty       → a fg-only `•` marker over a cell in the injected dirty registry (row 1, col b)
 *   - gridSelectedRow → a selected, non-focused row band (row 2)
 *   - gridInvalid     → a solid failed-validation band over a cell in the error registry (row 3, col a)
 *
 * A `SortHeader` with a two-key sort paints the `▲`/`▼` sort arrows (no funnel — the columns are
 * unfiltered and do not opt into an always-visible one, so no `▽`, which has no ASCII fallback). A
 * single-line box frame is drawn around the scene so the box-drawing chrome (`┌─│`) is present too.
 * The composed buffer holds raw theme colours + raw Unicode glyphs; the depth/glyph downsample happens
 * at `serialize` time, so one built scene can be re-serialized across the whole capability matrix.
 */
import { Group, createEventLoop, resolveCapabilities, signal } from '@jsvision/ui';
import type { Column } from '@jsvision/ui';
import type { ScreenBuffer } from '@jsvision/core';
import { column, toEngineColumn } from '../../src/column.js';
import type { GridColumn } from '../../src/column.js';
import { EditableGridRows } from '../../src/editable-grid-rows.js';
import { SortHeader } from '../../src/sort-header.js';
import { createDirtyRegistry, cellKey } from '../../src/editing.js';
import { createErrorRegistry } from '../../src/error-registry.js';
import type { Key } from '../../src/selection.js';
import type { SortKey } from '../../src/sort.js';
import type { FilterModel } from '../../src/filter.js';

/** A screen cell coordinate. */
export interface Coord {
  readonly x: number;
  readonly y: number;
}

/** The built golden scene: a composed buffer plus the coordinates each assertion reads. */
export interface GoldenGrid {
  /** The composed buffer (grid + header + box frame), holding raw colours/glyphs — serialize at any caps. */
  readonly buffer: ScreenBuffer;
  /** Screen coords of the cell bearing each role (for depth-correct colour-mode reads). */
  readonly cells: {
    /** The focused cell → `gridCursor` (read the bg). */
    readonly cursor: Coord;
    /** The `•` dirty marker cell → `gridDirty` (fg-only; read the fg). */
    readonly dirty: Coord;
    /** A selected, non-focused row cell → `gridSelectedRow` (read the bg). */
    readonly selected: Coord;
    /** A failed-validation cell → `gridInvalid` (read the bg). */
    readonly invalid: Coord;
  };
  /** Box-frame sample cells, for the ASCII-fallback reads. */
  readonly frame: {
    /** Top-left corner `┌` → `+`. */
    readonly corner: Coord;
    /** A top-edge cell `─` → `-`. */
    readonly topEdge: Coord;
    /** A left-edge cell `│` → `|`. */
    readonly leftEdge: Coord;
  };
  /** Buffer width in columns. */
  readonly width: number;
  /** Buffer height in rows. */
  readonly height: number;
}

interface Rec {
  readonly id: number;
  readonly a: string;
  readonly b: string;
  readonly c: string;
}

// Short, all-ASCII data so the ASCII-fallback scan can treat any surviving non-ASCII cell as a real
// chrome-fallback gap (user data text is out of the ASCII-floor scope — here it simply is ASCII).
const DATA: readonly Rec[] = [
  { id: 1, a: 'Al', b: 'X1', c: 'p' }, // row 0 → cursor
  { id: 2, a: 'Bo', b: 'Y2', c: 'q' }, // row 1 → dirty (col b)
  { id: 3, a: 'Cy', b: 'Z3', c: 'r' }, // row 2 → selected
  { id: 4, a: 'Di', b: 'W4', c: 's' }, // row 3 → invalid (col a)
  { id: 5, a: 'Ed', b: 'V5', c: 't' }, // row 4 → normal (contrast)
];

// Column geometry (local x): a[0,8) │@8  b[9,17) │@17  c[18,24). Marker for col b sits at its right
// edge (9 + 8 − 1 = 16).
const COL_B_MARKER_X = 16;

const W = 30;
const H = 8;
// Content is inset by one cell so the drawn box frame never overwrites the header/body glyphs.
const INSET_X = 1;
const HEADER_Y = 1;
const BODY_Y = 2;

/** Single-line box-drawing glyphs for the panel frame (degrade to `+ - |` under `boxDrawing:false`). */
const FRAME = { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' } as const;

/**
 * Paint a single-line frame around the whole buffer, perimeter cells only. Unlike `ScreenBuffer.box`
 * (which `fillRect`s its interior first), this preserves the already-composed inset content.
 */
function drawFrame(buffer: ScreenBuffer): void {
  const style = { fg: 'default', bg: 'default' } as const;
  buffer.set(0, 0, FRAME.tl, style);
  buffer.set(W - 1, 0, FRAME.tr, style);
  buffer.set(0, H - 1, FRAME.bl, style);
  buffer.set(W - 1, H - 1, FRAME.br, style);
  for (let x = 1; x < W - 1; x += 1) {
    buffer.set(x, 0, FRAME.h, style);
    buffer.set(x, H - 1, FRAME.h, style);
  }
  for (let y = 1; y < H - 1; y += 1) {
    buffer.set(0, y, FRAME.v, style);
    buffer.set(W - 1, y, FRAME.v, style);
  }
}

/** Build the golden scene fresh (each call is independent). */
export function buildGoldenGrid(): GoldenGrid {
  const cols: GridColumn<Rec>[] = [
    column<Rec, string>({ id: 'a', title: 'Alpha', value: (r) => r.a, width: 8 }),
    column<Rec, string>({ id: 'b', title: 'Beta', value: (r) => r.b, width: 8 }),
    column<Rec, string>({ id: 'c', title: 'Gamma', value: (r) => r.c, width: 6 }),
  ];
  const engineCols: Column<Rec>[] = cols.map(toEngineColumn);
  const columnIds = ['a', 'b', 'c'];

  const dirty = createDirtyRegistry();
  const errors = createErrorRegistry();
  const selectedKeys = signal<ReadonlySet<Key>>(new Set());

  const overlay = new Group();
  overlay.layout = { position: 'absolute', rect: { x: INSET_X, y: BODY_Y, width: W - 2, height: H - 3 } };

  const body = new EditableGridRows<Rec>({
    display: () => DATA as Rec[],
    columns: engineCols,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    focused: signal(0),
    selected: signal(-1),
    zebra: false,
    focusedCol: signal(0),
    typedColumns: cols,
    overlay,
    rowKey: (r) => r.id,
    bumpVersion: () => undefined,
    dirty,
    errors,
    selectedKeys,
  });
  body.layout = { position: 'absolute', rect: { x: INSET_X, y: BODY_Y, width: W - 2, height: H - 3 } };

  // A two-key sort paints both arrows: col a ascending (▲, priority 1), col b descending (▼, priority 2).
  const sort = signal<SortKey[]>([
    { columnId: 'a', dir: 'asc' },
    { columnId: 'b', dir: 'desc' },
  ]);
  const header = new SortHeader<Rec>({
    columns: engineCols,
    columnIds,
    autoWidths: () => engineCols.map(() => null),
    indent: signal(0),
    sort,
    onHeaderClick: () => undefined,
    // Empty filter model + no opt-in → no funnel ▽ is drawn (which has no ASCII fallback).
    filterModel: signal<FilterModel>(new Map()),
    onFunnelClick: () => undefined,
  });
  header.layout = { position: 'absolute', rect: { x: INSET_X, y: HEADER_Y, width: W - 2, height: 1 } };

  const root = new Group();
  root.add(header);
  root.add(body);
  root.add(overlay);

  const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;
  const loop = createEventLoop({ width: W, height: H }, { caps });
  loop.mount(root);
  loop.focusView(body); // the body must hold focus for the cursor overpaint to paint

  // Seed the four role states on distinct cells (PF-006 non-overlap):
  dirty.add(cellKey(2, 'b')); // row 1 (id 2), col b → gridDirty `•`
  selectedKeys.set(new Set<Key>([3])); // row 2 (id 3) → gridSelectedRow band
  errors.set(cellKey(4, 'a'), 'invalid'); // row 3 (id 4), col a → gridInvalid band

  loop.renderRoot.flush();
  const buffer = loop.renderRoot.buffer();
  // Draw the panel frame onto the inset ring the content never touches. `ScreenBuffer.box` fills its
  // whole rect first (erasing the composed content), so paint just the perimeter cells with `set`.
  drawFrame(buffer);

  return {
    buffer,
    cells: {
      cursor: { x: INSET_X + 2, y: BODY_Y + 0 }, // row 0, col a interior
      dirty: { x: INSET_X + COL_B_MARKER_X, y: BODY_Y + 1 }, // row 1, col b marker
      selected: { x: INSET_X + 2, y: BODY_Y + 2 }, // row 2, col a interior
      invalid: { x: INSET_X + 2, y: BODY_Y + 3 }, // row 3, col a interior
    },
    frame: {
      corner: { x: 0, y: 0 },
      topEdge: { x: 4, y: 0 },
      leftEdge: { x: 0, y: 3 },
    },
    width: W,
    height: H,
  };
}
