# 03-02 — DemoShell

Owner of: the reusable shell that wraps every example (and RD-07 sample apps) into a mountable
`Application`, with two chrome modes.

## Public shape

```ts
// packages/docs-site/src/demo-shell.ts
import type { Application, View } from '@jsvision/ui';
import type { CapabilityProfile, Theme } from '@jsvision/core';

export interface DemoShellOptions {
  readonly content: Application | View;   // the example's build() result
  readonly caps: CapabilityProfile;
  readonly viewport: { width: number; height: number };
  readonly chrome: 'minimal' | 'full';    // AR-7
  readonly theme?: Theme;                  // default: turboVisionTheme (AR-8)
  readonly onDepthChange?: (depth: 'truecolor' | '256' | '16' | 'mono') => void; // buildBrowserCaps() colorDepth union — re-mount hook (AR-9)
}

export function demoShell(opts: DemoShellOptions): Application;
```

- **Normalization:** if `content` is a bare `View`, DemoShell builds a `createApplication(...)` and
  places the view (single-component demos); if it is already an `Application`, DemoShell attaches its
  menu/status to that app (full-app demos like `apps/desktop`). Either way it returns the `Application`
  that `mountApp` mounts (AR-14).
- **Modal-subject examples** (`files/file-dialog`, `controls/form-dialog`): a bare-placed `Dialog` is
  **not** modal (no focus trap, no `valid()`-gate close, and `×`/Esc would `endModal` on an empty
  stack). Such an example's `build()` returns an `Application` that opens its `Dialog` via
  `loop.execView(...)` on start; DemoShell attaches chrome around it. DemoShell does not special-case a
  widget type — the example owns the modal open.

## Chrome modes (AR-7, AR-17)

### `full` — apps & multi-widget demos
- A **menu bar**: `≡` → About; **View** → Theme (the 13 presets, default Turbo Vision) + Depth
  (truecolor / 256 / 16 / mono). A **status line** with the classic hotkey row.
- Built from the same `menuBar`/`subMenu`/`item`/`statusLine`/`statusItem` used by
  `web-xterm/app.ts` `buildApp` — that file is the template.

### `minimal` — single-component demos
- The component **centered** in the viewport (layout: a padded column), **no menu bar**.
- A **compact status line** exposing only: **Theme** (cycle), **Depth** (cycle), **About** — as status
  items. About stays reachable everywhere (AR-17) without burying the widget.

Both modes share one builder for the About/theme/depth wiring; only the presentation differs.

## Theme & depth (AR-8, AR-9)

- **Theme:** the Theme submenu / status "Theme" item calls `app.setTheme(preset)` — live hot-swap, one
  recompose, no reopen (AC-4). Presets imported from `@jsvision/core` (`turboVisionTheme`, `nordTheme`,
  … all 13).
- **Depth:** the Depth submenu / status "Depth" item invokes `onDepthChange(depth)`, which the Play
  layer (03-03) turns into a **re-mount** with `buildBrowserCaps({ colorDepth: depth })` (caps is
  readonly — C3). DemoShell itself does not swap caps; it only signals intent.

## About dialog + site-meta (AR-7 / D3b)

```ts
// packages/docs-site/src/site-meta.ts
export const SITE_META = {
  name: 'JSVision',
  version: __JSVISION_VERSION__,   // injected by VitePress `define` from the root package.json (build-time)
  links: { repo: 'https://github.com/blendsdk/jsvision', docs: '/' },
} as const;
```

- The version is read from the **root `package.json`** at build time and injected via a Vite `define`
  (or a small virtual module) — not hardcoded (D3b). Because `docs-site#typecheck` now covers `src/**`,
  add an ambient `declare const __JSVISION_VERSION__: string;` (e.g. an `env.d.ts` in the tsconfig
  `include`) so `tsc --noEmit` resolves the `define` global. The About action opens a `messageBox`-style
  dialog (from `@jsvision/ui`) showing `name`, `version`, and links.

## Reuse note (RD-07)
RD-07 sample apps import `demoShell` with `chrome:'full'`; this module is their shared shell too (AR-7).

## Tests (see 07)
- ST-4 DemoShell(minimal) centers a component + a compact status line with an About item.
- ST-5 DemoShell(full) shows a menu bar (About + View→Theme/Depth) + status line.
- ST-9 theme switch repaints live (via `setTheme`), default Turbo Vision.
