# 03-03 — Play Component

Owner of: the plain-TS `PlayController` (lifecycle, testable) and the client-only Vue Play component
(DOM/modal glue). Split so the disposal logic is drivable headlessly (AR-10).

## PlayController (plain TS — no Vue, no DOM assumptions beyond an element)

```ts
// packages/docs-site/src/play/play-controller.ts
// Reuse buildBrowserCaps()'s union so the two can never drift; never re-declare the depth literals.
export type ColorDepth = NonNullable<import('@jsvision/web').BrowserCapsOptions['colorDepth']>;
// = 'truecolor' | '256' | '16' | 'mono'
export interface PlaySize { width: number; height: number; }

export interface PlayControllerOptions {
  readonly entry: import('../../examples/index.js').ExampleEntry;
  readonly createTerminal: (el: HostElement) => TerminalLike; // caller supplies xterm (never imported here)
  readonly size?: PlaySize;        // default 80×24 (AR-19 size selector)
  readonly depth?: ColorDepth;     // default 'truecolor'
}

export interface PlayController {
  open(el: HostElement): Promise<void>;   // lazy: load module, build DemoShell, mountApp, focus-ready
  close(): void;                            // dispose in reverse; null refs
  remount(next: { size?: PlaySize; depth?: ColorDepth }): Promise<void>; // Reset / size / depth (AR-9/19)
  readonly isOpen: boolean;
}

export function createPlayController(opts: PlayControllerOptions): PlayController;
```

### Lifecycle (AR-10, AC-3)
- `open(el)`: `await entry.load()` → `defineExample` → `demoShell({ content: def.build(ctx), chrome:
  entry.chrome, caps: buildBrowserCaps({ colorDepth: depth }), viewport: size })` → `createTerminal(el)`
  → `mountApp({ element: el, app, caps, term })` → attach key-reclaim → ready.
- `close()`: detach reclaim → dispose the mounted app / loop → `term.dispose()` → remove listeners →
  **null every reference**. Idempotent (double-close is a no-op).
- `remount(next)`: `close()` then `open(el)` with the merged size/depth — the **shared re-mount seam**
  for Reset (same params), size selector, and depth change (AR-9/19). State resets by design.
- **Error handling (AR-15):** `open()`/`build()`/`mountApp` are wrapped; on throw, render an **error
  panel** into `el` (message + a short "this example failed to load" hint) and log to console — never
  leave a blank/half-painted terminal. `isOpen` stays false; `close()` still cleans up.

### One-dialog singleton (AR-10, AC-10)
- A module-level `activeController` reference. Opening a new dialog first `close()`s the active one,
  guaranteeing at most one live `Terminal` (AC-10). The Vue component goes through this singleton.

## The Vue Play component (client-only — AR-16, C4)

```
packages/docs-site/.vitepress/theme/components/PlayExample.vue
```

- Props: `id` (the registry `id`). Renders: a labelled **Play button**, the **focus hint**, the modal
  **dialog** (a DOM overlay hosting the terminal element), a **× button**, and a **backdrop**.
- **Client-only + SSR-safe (C4):** wrapped so it only mounts in the browser; `@xterm/xterm` (+ fit +
  webgl) and the `PlayController` are loaded via **dynamic `import()` inside `onMounted`** — never at
  module top level (xterm touches `document`/canvas and would break VitePress SSR). This also
  code-splits xterm out of the initial bundle.
- **Terminal creation** stays in the component (`createTerminal`): `new Terminal({...})` + fit + webgl,
  `term.open(el)`, `fit.fit()` — mirroring `web-xterm/main.ts`. The controller never imports xterm.
- **Close / focus (AR-11):** the **× button** and a **backdrop click** call `controller.close()`.
  **Escape is NOT bound** by the modal — it flows into the terminal so the hosted TUI keeps Esc. The
  focus hint reads e.g. *"Terminal focused — click × or outside to exit."*
- **Reclaim (AC-5):** on open, `attachKeyReclaim(term, { isFocused: () => dialogOpenAndFocused })`; on
  close, the returned detach runs. Reclaimed chords `preventDefault()` (F-keys, Alt/Ctrl chords) so
  `F10` opens the TUI menu, not a browser action.
- **Reset / size selector (AR-19):** dialog chrome offers **Reset** (`remount({})`) and a **size**
  toggle (80×24 / 100×30 → `remount({ size })`). Depth is driven from DemoShell's Depth item through
  the same `remount({ depth })`.

## Deep-link (AR-19)

- On page mount, read `?example=<id>`. If it matches a registry entry: **scroll to + highlight** that
  example's Play region and **open its dialog**, but **do not auto-focus the terminal** (the reader
  clicks to focus — avoids an unexpected focus trap). On a no-keyboard device (03-04), deep-link shows
  the fallback instead of opening a terminal.

## CSP (AR-16)
- Nothing here uses `eval`/`new Function`; the dynamic import is same-origin (`'self'`). A **CSP-compat
  verification task** (03-06 / Phase 3) confirms the built page raises **0 CSP violations** headlessly;
  no policy loosening unless xterm provably trips it.

## Tests (see 07)
- ST-6/ST-7 open paints first frame + DemoShell chrome (Tier-2 headless mount).
- ST-8 20× open/close no leak (leak-smoke, AR-18 file-dialog).
- ST-10 reclaim: F10 `defaultPrevented` while focused; restored on close.
- ST-14 one-dialog cap; error panel on a throwing example.
