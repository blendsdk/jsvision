# Current State: Theming

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The color subsystem in `@jsvision/core` (`packages/core/src/engine/color/`) already carries every
primitive this feature builds on — it just has no tier *below* the roles.

- **The `Theme` model** (`theme.ts`, 334 lines): `interface ThemeRole { readonly fg; readonly bg;
  readonly hotkey? }`; `interface Theme` = **63 named roles**, most a bare `ThemeRole`, some carrying
  role-only extras — `desktop` (`+ pattern: string`), `window`/`windowInactive`/`dialog`
  (`+ border/title/icon`), `historyWindow` (`+ border/icon`, **no** `title`). `defaultTheme` is the
  hand-authored literal (the classic gray-dialog/blue-window look), every color a named `PALETTE`
  entry.
- **The `Color` model** (`color.ts`): `Color = `#${string}` | Ansi16Name | 'default'`.
  `toRgb(color): Rgb | null` is the single validation boundary — `'default'` → `null`, a named ANSI-16
  → its reference RGB, `#rgb`/`#rrggbb` → parsed, anything else → `throw InvalidColorError`. Never a
  partial value.
- **The palette** (`palette.ts`): `PALETTE`, `ANSI16_ORDER`, `ANSI16_REFERENCE`, `isAnsi16Name`.
- **Depth-aware encoding** (`encode.ts`): `encodeStyle(fg, bg, attrs, caps)` emits SGR; **attributes
  are emitted independently of color depth** — at `mono` depth or with a `'default'` color only the
  attribute SGR codes are produced (confirmed `encode.ts:128-133`, doc `:111-112`). `Attr` → SGR:
  bold=1, dim=2, italic=3, underline=4, blink=5, reverse=7, strike=9.
- **Downsampling** (`downsample.ts`): `nearest256`/`nearest16` map any truecolor theme down to the
  terminal's depth via redmean — so themes are authored in truecolor and degrade automatically.
- **Attributes** (`render/types.ts`): `Attr` (bold=1<<0 … strike=1<<6; all-bits mask = 127),
  `AttrMask = number`, `Style { fg; bg; attrs? }`.
- **Sanitize** (`safety/sanitize.ts:35`): `sanitize(text): string` strips ESC/C0/C1 but **keeps `\t`
  and `\n`** — the canonical injection boundary for drawable glyphs.

On the ui side:

- **`themeRoleToStyle(role)`** (`view/theme-style.ts`): today a one-liner `return { fg: role.fg, bg:
  role.bg }` — the seam where a role becomes a paint `Style`.
- **`RenderRootImpl`** (`view/render-root.ts`): owns `private readonly theme: Theme` (`:225`),
  composes via `fullCompose()` (`:367`), and already has the exact pattern this feature needs —
  `setRevealAccelerators(on, scope)` (`:292`) changes a compose input and calls `markRelayout()`
  (`:300`, `needsReflow = true; scheduleFlush()`) to force one coalesced full recompose.
- **`EventLoopImpl`** (`event/event-loop.ts`): builds the render root with a **no-op `schedule`**
  (`:193-195`) so the loop alone drives painting; every public mutator runs through `runTick` (`:351`)
  whose tail is `renderRoot.flush(); onFrame?.(buffer); emitCaret()` (`:367-369`). `resize()`
  (`:232`) is the precedent for "push a frame to the host outside the event queue."
- **`createApplication`** (`app/application.ts`): assembles the loop; `Application.onCommand` forwards
  to `loop.onCommand` (`:282`) — the precedent for a thin `Application.setTheme` forward.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/engine/color/theme.ts` | `Theme`/`ThemeRole`/`defaultTheme` | **Edit**: add optional `attrs?: AttrMask` to `ThemeRole`. `Theme` + `defaultTheme` untouched. |
| `packages/core/src/engine/color/aliases.ts` | — | **New**: `ThemeColors` (16 tokens + docs). |
| `packages/core/src/engine/color/ramp.ts` | — | **New**: sRGB↔OKLab + `ramp`/`lighten`/`darken`/`mix`. |
| `packages/core/src/engine/color/create-theme.ts` | — | **New**: `ThemeOptions`, `createTheme`, `rolesFromAliases` (split → `roles.ts` per PA-8 if needed). |
| `packages/core/src/engine/color/contrast.ts` | — | **New**: `contrastRatio`. |
| `packages/core/src/engine/color/serialize.ts` | — | **New**: `serializeTheme`/`parseTheme`/`InvalidThemeError`. |
| `packages/core/src/engine/color/presets.ts` | — | **New**: 7 presets. |
| `packages/core/src/engine/color/index.ts` | Color barrel | **Edit**: re-export new symbols (values after the `theme.js` block `:26-27`; `ThemeColors` type-only). |
| `packages/core/src/engine/index.ts` | Core barrel | **Edit**: append new values to `:145-156`, `ThemeColors` to `:157`. |
| `packages/ui/src/view/theme-style.ts` | Role→Style | **Edit**: copy `role.attrs` into the returned `Style` when present. |
| `packages/ui/src/view/render-root.ts` | Render root | **Edit**: `theme` field mutable; add `RenderRoot.setTheme`. |
| `packages/ui/src/event/event-loop.ts` + `types.ts` | Event loop | **Edit**: add `EventLoop.setTheme` (runTick-wrapped). |
| `packages/ui/src/app/application.ts` | App shell | **Edit**: add `Application.setTheme` forwarding to the loop. |
| `packages/ui/src/index.ts` | ui barrel | **Edit**: nothing new to export (setTheme is on already-exported interfaces). |
| `packages/examples/themes-demo/{designer,main}.ts` | — | **New**: pure designer + real-TTY host. |
| `packages/examples/kitchen-sink/stories/theming.story.ts` + `index.ts` | Story | **New** + registry line. |
| `packages/examples/package.json` | Scripts | **Edit**: `"demo:themes": "tsx themes-demo/main.ts"`. |
| root `CHANGELOG.md` | Governance | **Edit**: `[Unreleased]` entry naming the new exports. |

## Gaps Identified

### Gap 1: No tier below the 63 flat roles
**Current:** authoring a theme = hand-writing all 63 roles. **Required:** derive them from 16 aliases
via `rolesFromAliases`, and derive the aliases from a few seeds via `createTheme`. **Fix:** `03-01` +
`03-02`.

### Gap 2: `ThemeRole` has no attribute axis
**Current:** a role is `{fg, bg, hotkey?}`; dim/bold/italic can't be themed. **Required:** optional
`attrs?: AttrMask` passed through `themeRoleToStyle`, golden-safe (absent on every `defaultTheme`
role). **Fix:** `03-03`.

### Gap 3: No theme serialization
**Current:** a theme exists only as a JS object. **Required:** lossless, injection-safe JSON
round-trip (versioned envelope, field-kind validation, no partial theme, no fs in core). **Fix:**
`03-03`.

### Gap 4: The theme is immutable at runtime
**Current:** `RenderRootImpl.theme` is `private readonly`; there is no way to swap it. **Required:**
`setTheme` on the render root, the loop, and the app, repainting from any call site. **Fix:** `03-05`.

### Gap 5: No presets, contrast helper, or designer
**Current:** only `defaultTheme` ships; nothing helps a user *build* a theme. **Required:** 7 presets,
`contrastRatio`, and a live designer. **Fix:** `03-04` + `03-01` + `03-06`.

## Dependencies

### Internal
- `Color`/`toRgb`/`InvalidColorError` (`color.ts`), `PALETTE`/`ANSI16_ORDER`/`ANSI16_REFERENCE`
  (`palette.ts`), `Attr`/`AttrMask`/`Style` (`render/types.ts`), `sanitize` (`safety/sanitize.ts`),
  `TuiError` (`safety/errors.ts` — `InvalidThemeError`'s base), `encodeStyle`/`downsample` (unchanged).
- ui: `RenderRoot`/`fullCompose`/`markRelayout`, `EventLoop`/`runTick`, `createApplication`.

### External
- None at runtime (core stays zero-dep). Dev-only: `esbuild` (treeshake test), `@xterm/headless`
  (depth-robustness golden), `tsx` (demo), `node:fs` (examples `loadTheme` + designer export).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| A generated role's fg/bg lands unreadable (low contrast) at some depth | Med | Med | Depth-robustness golden per preset (RD-22 AC-12); designer surfaces contrast warnings; PA-2 collapse keeps hues few and predictable. |
| `defaultTheme` output drifts silently via the `attrs` edit | Low | High | `attrs` is optional + absent on every default role; `themeRoleToStyle` omits it when absent; guarded by the `*-theme.spec` `toStrictEqual` oracles + a new attr-free-invariance test (PA-4). |
| Hostile theme JSON injects escape bytes via `pattern` | Low | High | `parseTheme` validates `pattern` as a single printable cell — `sanitize`-clean **and** no `\t`/`\n` **and** one cell wide (PA-5); all colors via `toRgb`. |
| `create-theme.ts` exceeds the 500-line budget (63-role map) | Med | Low | Split `rolesFromAliases` → `roles.ts` (PA-8); packaging spec enforces the budget. |
| OKLab round-trip loses precision → preset hex drift | Low | Med | Ramp round-trips sRGB→OKLab→sRGB within ≤1/255 for the 16 `PALETTE` colors (RD-22 AC-5); curated presets pin canonical hexes via explicit overrides, not ramp output (AC-10). |
