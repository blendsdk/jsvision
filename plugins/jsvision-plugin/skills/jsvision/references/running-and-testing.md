# Running & testing

jsvision apps run three ways, and the same view tree drives all three. Learn the **headless** mode
especially — it is how you prove an app works without a terminal, in CI, or in a unit test.

## Three run modes

1. **Node TTY** — the real thing: `await app.run()` on an interactive terminal. Restores the terminal
   on every exit path.
2. **Headless (compose to a buffer)** — mount the view tree, drive synthetic events, and read the
   composed cell buffer. No terminal needed. This is your test/verify mode.
3. **Browser** — `mountApp(...)` renders into an xterm.js terminal with no backend (see
   `app-lifecycle.md`).

## The headless-verify loop

Mount a tree, optionally dispatch synthetic events, then assert that cells were painted:

```ts
import { createEventLoop, resolveCapabilities } from '@jsvision/ui';

const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;

function paintedCells(rows: readonly { char: string }[][]): number {
  let n = 0;
  for (const row of rows) for (const cell of row) if (cell.char !== ' ') n += 1;
  return n;
}

const loop = createEventLoop({ width: 40, height: 12 }, { caps });
loop.mount(root); // paints the first frame synchronously
expect(paintedCells(loop.renderRoot.buffer().rows())).toBeGreaterThan(0);
```

- **Read the buffer:** `loop.renderRoot.buffer()` → a `ScreenBuffer`; `.rows()` is `Cell[][]`, and
  each cell has `.char`, `.fg`, `.bg`. A view that painted nothing leaves only spaces.
- **Synthetic events:** `loop.dispatch({ type: 'key', key: 'enter', ctrl: false, alt: false, shift:
false })` and `loop.dispatch({ type: 'mouse', kind: 'down', button: 0, x, y })` (mouse coordinates
  are 1-based). A dispatched event flushes one frame automatically.
- **Signal writes outside a dispatch** need a manual `loop.renderRoot.flush()` before you read the
  buffer (gotcha 6).
- **Modals:** `const result = await loop.execView(dialog)` resolves to the terminating command
  (`'ok'`/`'cancel'`); drive it with `loop.emitCommand('ok')`. Assert a veto by checking the promise
  has not settled after `await Promise.resolve()`.

If you only need to paint (no events), `createRenderRoot({ width, height }, { caps })` +
`rr.mount(root)` + `rr.flush()` is the lighter tool.

**See the screen, don't just count cells.** `paintedCells > 0` proves _something_ rendered; to catch
clipping, overlap, or a view in the wrong place, print the actual composed screen with
the available JSVision render command or `scripts/render-app.mjs` (a headless ASCII screenshot at any size, optionally after driving keys).
Use it whenever a layout doesn't look right — a missing view usually means it collapsed to `{0,0}`
(run the available JSVision doctor or `scripts/jsvision-doctor.mjs`, which flags a missing `measure()`).

## Smoke tests

Every app the scaffolder makes ships a smoke test that builds the app and asserts `paintedCells > 0`
after a reflow. Extend that pattern per feature: mount, drive the interaction, assert on the buffer
or a bound signal. The recipe modules in `packages/examples/recipes/` and their
`recipes.smoke.spec.test.ts` are worked examples of exactly this.

## In this monorepo

- Start a new app with the repository generator; in the JSVision monorepo this creates `packages/<name>/` with a smoke test.
- Run it: `yarn workspace @jsvision/<name> start` (needs a real terminal).
- Verify it: `yarn verify` (typecheck + tests, including the app's smoke test).
