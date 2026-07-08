/**
 * `demo:layout-dsl` — a live, interactive playground for the declarative layout DSL.
 *
 * Run it (needs a real terminal):
 *
 *   yarn workspace @jsvision/examples demo:layout-dsl
 *
 * A split screen: a legend on the left listing every DSL parameter and the key that cycles it, and a
 * live preview on the right built entirely with the DSL (`col`/`row`/`grow`/`fixed`/`spacer`/`stack`
 * + `centered`/`topRight`/`bottomRight`). Press a key and the preview re-flows instantly; resize the
 * terminal and it re-solves for free.
 *
 * Keys: `m` mode (flow/stack) · `d` direction · `j` justify · `a` align · `s` sizing · `g` gap ·
 * `p` padding · `c` centered overlay · `x` corner overlays · `q`/`Alt-X`/`Ctrl-C` quit.
 *
 * The whole screen (the left/right split, the legend column) is itself laid out with the DSL — the
 * demo dogfoods the very API it showcases. Dev-only example, imported by name (`@jsvision/ui`) exactly
 * as a consumer would. The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { resolveCapabilities } from '@jsvision/core';
import {
  createApplication,
  statusLine,
  statusItem,
  Commands,
  Group,
  Text,
  View,
  col,
  row,
  grow,
  fixed,
} from '@jsvision/ui';
import type { DispatchEvent } from '@jsvision/ui';
import { createState, snapshot, applyKey, buildPreviewTree, formatLegend, type PlaygroundState } from './playground.js';

/**
 * An invisible pre-process key sink: it sees each key before any focused view, maps it to a parameter
 * change (or quit), and consumes it. Invisible and non-focusable — its only job is global keys.
 */
class KeySink extends View {
  override preProcess = true;

  constructor(
    private readonly pg: PlaygroundState,
    private readonly onQuit: () => void,
  ) {
    super();
    this.state.visible = false; // never drawn; exists only to intercept keys
  }

  override draw(): void {
    // intentionally empty — invisible
  }

  override onEvent(ev: DispatchEvent): void {
    const e = ev.event;
    if (e.type !== 'key') return;
    if (e.key === 'q' || (e.key === 'c' && e.ctrl)) {
      this.onQuit();
      ev.handled = true;
      return;
    }
    if (applyKey(this.pg, e.key)) ev.handled = true;
  }
}

/** Build the status line — a single quit accelerator; the full key map lives in the legend panel. */
function buildStatusLine(): ReturnType<typeof statusLine> {
  return statusLine([statusItem('~Alt-X~ Quit', Commands.quit, 'Alt+X')]);
}

/** Compose the split-screen tree with the DSL, wiring the reactive legend + live preview. */
function buildScreen(state: PlaygroundState): Group {
  // Left: a reactive legend that re-renders whenever any parameter changes.
  const legend = new Text(() => formatLegend(snapshot(state)));
  const controls = col({ padding: 1 }, grow(legend));

  // Right: a preview host (a 1-cell padded margin acts as a frame) whose single DSL child is rebuilt
  // reactively on every parameter change and filled into the host via `position:'fill'`.
  const previewHost = new Group();
  previewHost.background = 'desktop';
  previewHost.layout = { padding: 1 };
  previewHost.onMount(() => {
    previewHost.bind(
      () => snapshot(state), // reader: subscribe to every parameter signal
      (p) => {
        for (const child of [...previewHost.children]) previewHost.remove(child);
        const tree = buildPreviewTree(p);
        tree.layout = { ...tree.layout, position: 'fill' };
        previewHost.add(tree);
      },
      { relayout: true },
    );
  });

  const screen = row({ gap: 1, padding: 1 }, fixed(controls, 30), grow(previewHost));
  // Fill the desktop content box (preserving the row's own direction — `at()` would replace it).
  screen.layout = { ...screen.layout, position: 'fill' };
  return screen;
}

/** Compose, wire, and run the application until `quit`; returns the exit code. */
async function main(): Promise<number> {
  if (process.stdout.isTTY !== true) {
    process.stdout.write(
      'demo:layout-dsl needs a real interactive terminal (TTY).\n' +
        'Run it directly:  yarn workspace @jsvision/examples demo:layout-dsl\n',
    );
    return 0;
  }

  const caps = resolveCapabilities({
    override: { mouse: { sgr: true, drag: true, wheel: true }, unicode: { utf8: true } },
  }).profile;

  const app = createApplication({ caps, statusLine: buildStatusLine() });
  const state = createState();

  app.desktop.add(buildScreen(state));
  app.desktop.add(new KeySink(state, () => app.loop.emitCommand(Commands.quit)));

  return app.run();
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exit(1);
  });
