/**
 * View/Group spine walkthrough (RD-03) — a narrated console demo of `@jsvision/ui`'s retained
 * widget tree composing a themed frame on `@jsvision/core`'s `ScreenBuffer`.
 *
 * Run it (works anywhere, no TTY needed — the spine is independently renderable):
 *
 *   yarn workspace @jsvision/examples demo:view
 *
 * It builds a small app-shell tree (a desktop background, a menu-bar header, two body panels laid
 * out by the RD-02 reflow pass, and a reactive status line), mounts it through a `RenderRoot`,
 * and prints the composed cell grid as ASCII so you can *see* a `View`/`Group` tree become a
 * frame. Then it changes a signal and re-flushes to show the reactive repaint loop in action.
 *
 * Dev-only example — not part of the published package. The package is imported by name
 * (`@jsvision/ui`), exactly as a consumer would.
 */
import { resolveCapabilities } from '@jsvision/core';
import { View, Group, createRenderRoot, signal, type DrawContext, type ThemeRoleName } from '@jsvision/ui';

/** A leaf widget: fills its theme role and draws a one-line label inset by a cell. */
class Label extends View {
  constructor(
    private readonly read: () => string,
    private readonly role: ThemeRoleName,
  ) {
    super();
  }
  draw(ctx: DrawContext): void {
    const style = ctx.color(this.role);
    ctx.fill(' ', style);
    ctx.text(1, 0, this.read(), style);
  }
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) {
    console.log(`|${row.map((cell) => cell.char).join('')}|`);
  }
  console.log(`+${'-'.repeat(width)}+`);
}

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

// --- Build the retained view tree (app-shell shape) ---------------------------------------------
const header = new Group();
header.layout = { direction: 'col', size: { kind: 'fixed', cells: 1 } };
header.background = 'menuBar';
const title = new Label(() => 'jsvision — View/Group spine (RD-03)', 'menuBar');
title.layout = { size: { kind: 'fixed', cells: 1 } };
header.add(title);

const body = new Group();
body.layout = { direction: 'row', size: { kind: 'fr', weight: 1 }, gap: 1 };
const left = new Label(() => 'Left panel (fr 1)', 'window');
left.layout = { size: { kind: 'fr', weight: 1 } };
const right = new Label(() => 'Right panel (fr 1)', 'dialog');
right.layout = { size: { kind: 'fr', weight: 1 } };
body.add(left);
body.add(right);

const ticks = signal(0);
const status = new Label(() => `Count: ${ticks()}  (reactive status line)`, 'statusBar');
status.layout = { size: { kind: 'fixed', cells: 1 } };
status.onMount(() => {
  // Repaint the status line whenever `ticks` changes — the canonical reactive-attribute pattern.
  status.bind(
    () => ticks(),
    () => {},
  );
});

const root = new Group();
root.layout = { direction: 'col', padding: 1 };
root.background = 'desktop';
root.add(header);
root.add(body);
root.add(status);

// --- Mount + compose the first frame ------------------------------------------------------------
const renderRoot = createRenderRoot({ width: 54, height: 10 }, { caps });
renderRoot.mount(root);
printFrame('Frame 1 — mounted + reflowed (count = 0):', renderRoot.buffer().rows());
renderRoot.flush(); // settle the bind's initial coalesced repaint before measuring the next diff

// --- Drive the reactive repaint loop ------------------------------------------------------------
ticks.set(42);
renderRoot.flush(); // force the coalesced frame synchronously for the demo
const diff = renderRoot.serialize();
printFrame('Frame 2 — after ticks.set(42) → status line repainted:', renderRoot.buffer().rows());
console.log(`\nDamage diff for the change: ${diff.length} bytes — only the status line was recomposed.`);

console.log('Done — a retained View/Group tree, reflowed by RD-02 and repainted reactively.');
