/**
 * Tabs walkthrough (RD-17) — a narrated, headless console demo of `@jsvision/ui`'s `TabView`: a
 * folder-tab container rendered, switched with Ctrl+PageDown, jumped-to by an Alt-hotkey, a tab
 * closed via its `×`, then overflow-scrolled — all driven by synthetic `dispatch()` (no TTY),
 * printing a composed ASCII frame after each step. The faithful folder-tab chrome (`┌ label ┬ label
 * ┐` + `│`/`└─┘` + `×`/`◄`/`►`) renders exactly as on a real terminal.
 *
 * Run it:
 *
 *   yarn workspace @jsvision/examples demo:tabs
 *
 * Dev-only example — not part of the published package. Imported by name (`@jsvision/ui`), exactly as
 * a consumer would. `.js` per NodeNext.
 */
import { resolveCapabilities } from '@jsvision/core';
import type { KeyEvent } from '@jsvision/core';
import { Group, Text, TabView, createEventLoop, signal } from '@jsvision/ui';
import type { Tab } from '@jsvision/ui';

/** A synthetic decoded key (no terminal needed). */
function key(name: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { type: 'key', key: name, ctrl: false, alt: false, shift: false, ...mods };
}

/** Print a render root's composed buffer as an ASCII grid framed by a ruler. */
function printFrame(title: string, rows: readonly { char: string }[][]): void {
  const width = rows[0]?.length ?? 0;
  console.log(`\n${title}`);
  console.log(`+${'-'.repeat(width)}+`);
  for (const row of rows) console.log(`|${row.map((cell) => cell.char).join('')}|`);
  console.log(`+${'-'.repeat(width)}+`);
}

/** Build a page as a `Group` with a couple of text lines. */
function page(line: string): Group {
  const g = new Group();
  g.background = 'staticText'; // neutral gray content field (tab* roles are now green button faces)
  g.add(placed(new Text(line), 1, 0));
  return g;
}

/** Absolutely place a view at page-local (x, y) with a generous width. */
function placed<T extends { layout: unknown }>(view: T, x: number, y: number): T {
  (view as { layout: unknown }).layout = { position: 'absolute', rect: { x, y, width: 40, height: 1 } };
  return view;
}

const caps = resolveCapabilities({ env: {}, platform: 'linux', override: { colorDepth: 'truecolor' } }).profile;

const WIDTH = 46;
const HEIGHT = 8;

/** Walk the tabbed container: render → Ctrl+PageDown → Alt-jump → close → overflow. */
function main(): void {
  const tabs = signal<Tab[]>([
    { title: '~G~eneral', content: page('General settings') },
    { title: '~D~isplay', content: page('Display options'), closeable: true },
    { title: '~N~etwork', content: page('Network config') },
    { title: '~A~dvanced', content: page('Advanced (disabled)'), disabled: true },
  ]);
  const active = signal(0);
  let lastClosed = '(none)';
  const view = new TabView({ tabs, active, onClose: (t) => (lastClosed = t.title.replace(/~/g, '')) });
  view.layout = { position: 'absolute', rect: { x: 0, y: 0, width: WIDTH, height: HEIGHT } };

  const root = new Group();
  root.add(view);
  const loop = createEventLoop({ width: WIDTH, height: HEIGHT }, { caps });
  loop.mount(root);
  loop.focusView(view.strip); // focus inside the view so the global chords + Alt-hotkey act on it
  const frame = (title: string): void => printFrame(title, loop.renderRoot.buffer().rows());

  // Step 1 — the initial render: 4 folder tabs, General active, Advanced greyed.
  frame('Frame 1 — render: ┌ General ┬ Display× ┬ Network ┬ Advanced ┐ (General active)');

  // Step 2 — Ctrl+PageDown switches to the next enabled tab (Display).
  loop.dispatch(key('pagedown', { ctrl: true }));
  frame('Frame 2 — Ctrl+PageDown → Display');
  console.log(`  active: #${active()}`);

  // Step 3 — Alt+N jumps to the Network tab (skipping the disabled Advanced).
  loop.dispatch(key('n', { alt: true }));
  frame('Frame 3 — Alt+N → Network');
  console.log(`  active: #${active()}`);

  // Step 4 — close the closeable Display tab (index 1) via its × handler.
  view.closeTab(1);
  loop.renderRoot.flush();
  frame('Frame 4 — closed Display (×): General ┬ Network ┬ Advanced');
  console.log(`  last closed: ${lastClosed} · active: #${active()}`);

  // Step 5 — many long tabs overflow the strip → ◄/► arrows appear, active auto-scrolled into view.
  tabs.set([
    ...tabs(),
    { title: 'Diagnostics', content: page('Diagnostics') },
    { title: 'Extensions', content: page('Extensions') },
    { title: 'Experimental', content: page('Experimental') },
  ]);
  view.select(4); // a middle tab, so hidden tabs remain on BOTH sides (◄ and ►)
  loop.renderRoot.flush();
  frame('Frame 5 — overflow: ◄ … ► arrows, the active tab auto-scrolled into view');

  console.log(
    '\nDone — a TabView rendered, switched (Ctrl+PageDown), jumped (Alt-hotkey), closed (×), and overflow-scrolled.',
  );
}

main();
