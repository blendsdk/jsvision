# Designer & Story: Theming

> **Document**: 03-06-designer-and-story.md
> **Parent**: [Index](00-index.md)

## Overview

The user-facing dogfood: a live `demo:themes` theme-designer (real terminal) and a kitchen-sink
`Theming` story (headless-smoke-tested). Both live in `@jsvision/examples`. Per PA-7 the designer
splits into a **pure** `designer.ts` (the state machine — unit-tested + driven by a headless-walkthrough
e2e) and a real-TTY `main.ts` (`createApplication`, hand-verified per RD-22 AC-15).

## Implementation Details

### `themes-demo/designer.ts` — the pure state machine (PA-7)

A view-free, deterministic module that owns the designer's logic so it is unit-testable without a
terminal:

```ts
export interface DesignerState {
  mode: 'light' | 'dark';
  accent: Color;
  neutral?: Color;
  status: { danger?: Color; warning?: Color; success?: Color; info?: Color };
  depth: ColorDepth;                 // 'truecolor' | '256' | '16' | 'mono' — preview depth
}
export function currentTheme(s: DesignerState): Theme;              // = createTheme(seedsFrom(s))
export function cycleAccent(s, dir): DesignerState;                 // step through a seed list
export function cycleMode(s): DesignerState;
export function cycleDepth(s): DesignerState;                       // preview-depth toggle
export function randomizeSeed(s, i): DesignerState;                 // index-varied (no Math.random in tests)
export function exportJson(s): string;                             // = serializeTheme(currentTheme(s))
export function contrastWarnings(s): Array<{ pair: string; ratio: number }>; // alias fg/bg pairs < 4.5, NaN skipped
```

`contrastWarnings` calls `contrastRatio` on alias fg/bg pairs and **skips `NaN`** (unresolvable →
never a false alarm, AR-283); it flags pairs below 4.5 (WCAG AA text) without mutating the theme
(warn-only, AR-273).

### `themes-demo/main.ts` — the real-TTY designer (AC-15)

`createApplication` hosting a representative widget set (menu/status/dialog/list/buttons/etc.); key
bindings cycle `mode`/`accent`/`neutral`/status and the preview depth, calling `app.setTheme(
currentTheme(state))` on each change so every hosted component repaints live (`03-05`). An
export-to-JSON panel shows `exportJson(state)` and writes it to a file (examples may use `node:fs`); a
contrast-warning strip lists `contrastWarnings(state)`. Real-TTY, hand-verified (AC-15).

### `loadTheme` (Should-Have)

An examples-layer `loadTheme(path)` = `node:fs.readFileSync` + `parseTheme` — proves the round-trip
end-to-end (core stays pure; only the demo does fs). Used by `main.ts`'s import affordance.

### Kitchen-sink `Theming` story (AC-16)

`packages/examples/kitchen-sink/stories/theming.story.ts` exports `const themingStory: Story` in the
standard shape (`{ id: 'theming/presets', category: 'Theming', title: 'Theme presets', blurb, rd:
'RD-22', build(ctx) }`). `build(ctx)` returns a `Group` of absolutely-positioned representative
widgets (a labelled input, a couple of buttons, a small list, a status-ish row) painted under a chosen
preset, with a visible echo of the active preset name and a hint that the presets cycle. The shell
owns all chrome; the story never touches the desktop/host.

Registry: two edits to `stories/index.ts` — `import { themingStory } from './theming.story.js';` and
one entry in the `STORIES` array.

## Integration Points
- `designer.ts` consumes `createTheme`/`serializeTheme`/`contrastRatio` (core) — pure, headless.
- `main.ts` consumes `createApplication`/`Application.setTheme` (`03-05`).
- The story consumes the presets (`03-04`); the smoke test mounts **every** preset.

## Code Examples

```ts
// designer.ts is pure — a test can drive it with no terminal:
import { currentTheme, cycleAccent, exportJson } from './designer.js';
let s = { mode: 'dark', accent: '#3b82f6', status: {}, depth: 'truecolor' } as const;
s = cycleAccent(s, +1);
const theme = currentTheme(s);   // a valid Theme
const json = exportJson(s);      // serialized envelope
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| A contrast pair is unresolvable (`'default'`) | `contrastWarnings` skips it (`NaN` → no warning) | AR-283 |
| A low-contrast alias pair | Surfaced as a warning; the theme is **not** mutated | AR-273 |
| `loadTheme` given a malformed file | `parseTheme` throws `InvalidThemeError`; the demo reports it, keeps the current theme | AR-281 |

> **Traceability:** `00-ambiguity-register.md` (PA-7) + `../../requirements/00-ambiguity-register.md` (AR-273/AR-278/AR-283).

## Testing Requirements
- `designer.ts` unit tests: `currentTheme` is a valid `Theme`; `cycleAccent`/`cycleMode`/`cycleDepth`
  advance deterministically; `exportJson` round-trips via `parseTheme`; `contrastWarnings` skips `NaN`
  and flags a known low-contrast pair (ST-30…ST-33).
- A headless-walkthrough e2e (spawns `themes-demo/main.ts` in a headless/scripted mode, or drives
  `designer.ts`) asserts non-empty stdout showing a theme switch + a depth change + a JSON export
  (ST-34).
- The `Theming` story mounts+paints headlessly; the smoke test mounts **every** preset and asserts
  each paints (non-empty buffer), plus unique id + required metadata (ST-35, AC-16).
