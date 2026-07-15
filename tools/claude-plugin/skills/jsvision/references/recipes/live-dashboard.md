# Recipe: live / dashboard (and browser-hosted)

A progress bar plus a spinner, advanced by a per-tick signal bump — and the same app mounted in a
browser terminal via `@jsvision/web` with no backend.

Key points:

- Progress is a `Signal<number>` in `[0,1]`; count whole steps and derive the fraction so the bar
  lands on exactly `1.0` (accumulating `+= 1/steps` drifts on floating point).
- The `Spinner` holds no clock — you advance its `frame` signal (or use the `runSpinner` helper).
- In a real app, mutate the signals then emit a no-op command per tick so the loop coalesces one
  repaint (gotcha 6).
- The browser variant keeps its xterm wiring in one small function; `buildDashboard` stays plain
  `@jsvision/ui`, so it also runs on a TTY and headless.

Full module: `packages/examples/recipes/live-dashboard.ts`.

```ts
/** Handles for the live-dashboard recipe. */
export interface Dashboard {
  /** The mountable root (progress bar + spinner). */
  root: Group;
  /** Progress fraction in `[0, 1]`. */
  value: Signal<number>;
  /** The spinner frame index (advancing it animates the spinner). */
  frame: Signal<number>;
  /** Advance one tick: bump progress and step the spinner. */
  tick(): void;
  /** Whether progress has reached 100%. */
  done(): boolean;
}

/**
 * Build a live dashboard: a determinate {@link ProgressBar} plus an indeterminate {@link Spinner},
 * both bound to signals and advanced by {@link Dashboard.tick}. In a real app, drive `tick()` from a
 * timer (or `runSpinner`) and emit a no-op command per tick so the loop coalesces one repaint.
 *
 * @param opts - `steps` controls how many ticks fill the bar (default 10).
 * @returns The dashboard handles (see {@link Dashboard}).
 * @example
 * const dash = buildDashboard({ steps: 20 });
 * setInterval(() => { dash.tick(); app.loop.emitCommand('tick'); }, 100);
 */
export function buildDashboard(opts?: { steps?: number }): Dashboard {
  const steps = opts?.steps ?? 10;
  const value = signal(0);
  const frame = signal(0);

  const bar = new ProgressBar({ value, caption: true, label: 'Downloading', labelPosition: 'left' });
  const spinner = new Spinner({ frame, preset: 'dots', label: () => (value() >= 1 ? 'Done' : 'Working…') });

  // Compose with the layout DSL: a one-row bar over a one-row spinner, 1 cell of gap between them.
  // `fill` gives the column a flex weight of 1 so it takes its parent's leftover space — the whole
  // viewport when mounted directly as a render root, or the interior when hosted in a Window.
  const root = col({ gap: 1, fill: true }, fixed(bar, 1), fixed(spinner, 1));

  // Count whole steps and derive the fraction, so the bar lands on exactly 1.0 (not 0.999…) at the
  // last tick — accumulating `+= 1/steps` drifts on floating point.
  let count = 0;
  const tick = (): void => {
    count = Math.min(steps, count + 1);
    value.set(count / steps);
    frame.set(frame() + 1);
  };

  return { root, value, frame, tick, done: () => value() >= 1 };
}

/**
 * Run the same dashboard in a browser terminal via `@jsvision/web` — no Node backend. Pass any
 * xterm.js `Terminal` (or a compatible headless double); returns the mounted app (call `dispose()` to
 * tear it down).
 *
 * @param term - the terminal to render into.
 * @param opts - forwarded to {@link buildDashboard}.
 * @returns The mounted app handle.
 * @example
 * import { Terminal } from '@xterm/xterm';
 * const term = new Terminal({ allowProposedApi: true });
 * term.open(document.getElementById('app'));
 * mountDashboardInBrowser(term);
 */
export function mountDashboardInBrowser(term: BrowserTerminal, opts?: { steps?: number }): MountedApp {
  const caps = buildBrowserCaps();
  const app = createApplication({ caps, viewport: { width: 40, height: 12 } });
  const dash = buildDashboard(opts);

  const win = new Window('Live Dashboard');
  win.layout.rect = { x: 1, y: 1, width: 36, height: 8 };
  win.add(dash.root);
  app.desktop.addWindow(win);

  return mountApp({ element: { tagName: 'div' }, app, caps, term });
}
```
