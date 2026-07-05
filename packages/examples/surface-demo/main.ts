/**
 * Surface-family walkthrough (RD-19) — a narrated, headless console demo of `@jsvision/ui`'s
 * `Surface` + `SurfaceView`: an offscreen 12×8 labelled `Surface` displayed through a 6×4 passive
 * `SurfaceView`, panned by writing `delta` — right, then down, then **past the edge** (the whole view
 * fills with `windowInactive` empty-area spaces, the `tsurface.cpp` null/out-of-bounds case), then
 * recentred. Rendered through a real `RenderRoot` (no TTY); prints a composed ASCII frame per step.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:surface
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import { Group, Surface, SurfaceView, createEventLoop, signal } from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

interface Point {
  x: number;
  y: number;
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => (cell.char === '' ? ' ' : cell.char)).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** A 12×8 offscreen canvas whose cell (x,y) holds a distinct letter — so a pan is unmistakable. */
function buildSurface(): Surface {
  const rows: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    let line = '';
    for (let x = 0; x < 12; x += 1) line += String.fromCharCode(65 + ((x + y * 12) % 26));
    rows.push(line);
  }
  return Surface.from(rows);
}

function main(): void {
  console.log('Surface family (RD-19) — a passive SurfaceView panned over an offscreen Surface.\n');
  const surface = buildSurface();
  const delta = signal<Point>({ x: 0, y: 0 });
  const view = new SurfaceView({ surface, delta });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 6, height: 4 } };
  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: 6, height: 4 }, { caps });
  loop.mount(root);
  loop.renderRoot.flush();

  const frame = (t: string): void => {
    printFrame(`${t}  [delta = (${delta().x}, ${delta().y})]`, loop.renderRoot.buffer().rows());
  };
  const pan = (d: Point): void => {
    delta.set(d);
    loop.renderRoot.flush();
  };

  frame('Step 1 — the 6×4 viewport at the top-left of the 12×8 surface');
  pan({ x: 3, y: 0 });
  frame('Step 2 — pan right: delta.x = 3 reveals the middle columns');
  pan({ x: 3, y: 2 });
  frame('Step 3 — pan down: delta.y = 2 reveals the lower rows');
  pan({ x: 20, y: 20 });
  frame(
    'Step 4 — pan past the edge: the surface is off-screen → the whole view is the empty area (windowInactive spaces)',
  );
  pan({ x: 0, y: 0 });
  frame('Step 5 — recentre: delta = (0, 0) is back at the top-left');

  console.log('\nDone — SurfaceView is passive; the app drives `delta` (arrows, a ScrollBar, or code).');
}

main();
