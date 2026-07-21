# RD-22: Theming — a Fluent-inspired, TUI-sized color theme system

> **Document**: RD-22-theming.md
> **Status**: Draft
> **Created**: 2026-07-08 (`make_requirements` — theming system; new capability, not a TV port)
> **Project**: jsvision UI (`@jsvision/ui`) + `@jsvision/core` (color subsystem) + `@jsvision/examples`
> **Depends On**: `@jsvision/core` (done — the `Theme`/`ThemeRole` model `color/theme.ts`, the `Color` model + `toRgb` `color.ts`, the DOS-16 `PALETTE` + `ANSI16_ORDER`/reference tables `palette.ts`, depth-aware `encode`/`encodeStyle` + `downsample` `encode.ts`/`downsample.ts`, `Attr`/`AttrMask` `render/types.ts`); RD-03 (View/Group spine — done; `RenderRoot`/`themeRoleToStyle`/`DrawContext.color`/`role`), RD-05 (App shell — done; `createApplication`/`Application`, the kitchen-sink host), RD-01/02/04 (reactive/layout/event — done; the designer demo composes over them)
> **Set**: Standalone capability RD (post the RD-12+ widget set). No sibling RDs.
> **CodeOps Skills Version**: 3.3.2

---

## Feature Overview

A **color theme system** for jsvision that makes it easy to build, share, and switch terminal-UI
color schemes — the way a modern design system does, sized for a terminal. Today a `Theme` is a flat
record of ~70 named roles (`menuBar`, `buttonDefault`, `listFocused`, …), each a literal `{fg, bg}`
pair; authoring a new look (a dark theme, an enterprise palette) means hand-writing all ~70 roles.
This RD adds the two tiers *below* the roles so a whole theme derives from a handful of inputs:

```
seeds  (mode + accent + optional neutral/status + per-alias overrides)
  │  createTheme()
  ▼
global ramps  (perceptual OKLab lighten/darken of each seed)
  ▼
16 semantic ALIASES  (foreground / background / accent / border / status …)
  │  rolesFromAliases()
  ▼
the existing ~70 CONTROL ROLES  →  the flat `Theme` widgets already read
```

The flat `Theme` record stays the runtime contract every widget reads through `DrawContext.color()`
— **nothing in any widget changes**, and the built-in **`defaultTheme` (the classic Turbo Vision
look) is byte-for-byte unchanged** and remains the default. Everything here is **additive**, with one
small enabling change in the render root (runtime theme hot-swap).

The deliverables: a `createTheme()` builder (both seed-generated *and* discrete-authored themes), a
lean semantic alias tier, an optional per-role **text-attribute** axis (dim/bold/italic/underline as
theming levers), lossless JSON **serialize/parse**, a curated set of **presets**
(`monochrome`, `turboVision`, `slate`, `nord`, `dracula`, `solarizedDark`, `gruvboxDark`), **runtime
hot-swap** (`renderRoot.setTheme` / `app.setTheme`), and a live **TUI theme-designer** demo that
dogfoods the whole thing.

**Not a Turbo Vision port.** The `Theme` model is jsvision's own (it already exists and diverges
from TV's `cpAppColor` attribute-chain). TV is inspiration only; there is **no** GATE-1/GATE-2
fidelity obligation here — new components and deliberate divergences carry none (per the TV-fidelity
directive). The one fidelity constraint is *backward*: `defaultTheme`'s rendered output must not
change (the golden-screen suite is its oracle).

**Truecolor is a given.** `encode.ts` already emits 24-bit truecolor and `downsample.ts` already maps
any theme down to `256`/`16`/`mono` via redmean nearest-color. Themes are therefore **authored in
truecolor** and degrade automatically; the designer must let the user *preview at a chosen depth* so
they can see what a low-color terminal shows.

The components in scope:

| Piece | Package | Role |
|-------|---------|------|
| Semantic **alias tier** (`ThemeColors`) | `@jsvision/core` | 16 curated semantic tokens — the middle layer themes are expressed in. |
| **OKLab ramp** generator | `@jsvision/core` | Pure, zero-dep perceptual lighten/darken of a seed color into shades. |
| **`createTheme(options)`** builder | `@jsvision/core` | `seeds → ramps → aliases → rolesFromAliases → Theme`; supports per-alias overrides (discrete authoring). |
| **`rolesFromAliases(colors)`** mapping | `@jsvision/core` | The one canonical function turning the 16 aliases into all ~70 `Theme` roles + extras. |
| **`ThemeRole.attrs`** axis | `@jsvision/core` | Optional text-attribute mask per role (dim/bold/…); passed through `themeRoleToStyle`. |
| **`serializeTheme` / `parseTheme`** | `@jsvision/core` | Lossless, validated JSON round-trip (no filesystem). |
| **Presets** | `@jsvision/core` | Tree-shakeable named exports: `monochromeTheme`, `turboVisionTheme` (= `defaultTheme`), `slateTheme`, `nordTheme`, `draculaTheme`, `solarizedDarkTheme`, `gruvboxDarkTheme`. |
| **`RenderRoot.setTheme` / `Application.setTheme`** | `@jsvision/ui` | Runtime hot-swap → one full recompose. |
| **Contrast check** (`contrastRatio`) | `@jsvision/core` | Pure WCAG-ratio helper; the designer surfaces warnings (never auto-mutates). |
| **`demo:themes` designer** + kitchen-sink `Theming` story | `@jsvision/examples` | Live: cycle seeds, repaint every component, export JSON, depth/16-color preview toggle, contrast warnings. |

---

## Functional Requirements

### Must Have

#### The semantic alias tier — `ThemeColors` (AR-266, AR-280)
- [ ] A new exported interface **`ThemeColors`** with exactly these **16** tokens, each a `Color`,
  each carrying the documented meaning below (the token contract is public — themes are authored in
  these names, so each is defined here, not left to the plan):
  - **text (4):**
    - `foreground` — default body text, on `background`.
    - `foregroundMuted` — de-emphasized text (secondary labels, inactive chrome), on a surface.
    - `foregroundDisabled` — disabled-control text, on a surface.
    - `foregroundOnAccent` — text/glyphs drawn **on an `accent` background** (buttons, focused list
      rows, selected menu/status items). *(This is the only "text-on-accent" token — the earlier
      `accentForeground` is dropped as a synonym, AR-280.)*
  - **surface (4):**
    - `background` — the base app/desktop field.
    - `backgroundRaised` — a raised surface above the base (menu/status bar, window interior).
    - `backgroundSunken` — a recessed surface (input fields).
    - `backgroundSelected` — the fill behind a selected-but-unfocused row/item.
  - **accent (2):** `accent` — the brand/primary color (button & selection backgrounds);
    `accentMuted` — a dimmer accent for a focused/pressed accent surface.
  - **line (2):** `border` — frame/divider lines; `borderMuted` — a dimmer line for inactive chrome.
  - **status (4):** `danger`, `warning`, `success`, `info` — each an fg-on-surface status color
    (also the source for `hotkey` accents, e.g. `statusBar.hotkey = danger`).
- [ ] No hover/pressed interaction matrix (a TUI has no hover; existing focused/disabled/selected
  states are carried by the role tier, not the alias tier).

#### The OKLab ramp generator (AR-268)
- [ ] A pure, zero-dependency **`ramp(seed, steps)`** (and the primitives it needs: sRGB↔OKLab
  conversion, `lighten`/`darken`/`mix` in OKLab) producing perceptually-even shades of a seed color.
- [ ] Works entirely in `#rrggbb` space at the boundary (accepts a `Color`, returns `Color`s); the
  OKLab math is internal. Output downsamples through the existing `encode` path unchanged.
- [ ] **Unresolvable seed:** the OKLab primitives require a color with RGB. `'default'` resolves to
  `null` via `toRgb` and has no RGB, so `ramp`/`lighten`/`darken`/`mix` **throw `InvalidColorError`**
  on a seed that resolves to `null`. `createTheme` seeds (`accent`/`neutral`/status) are therefore
  documented as **resolvable colors only** (hex or named) — a generated theme never seeds from
  `'default'` (AR-283).

#### `createTheme(options)` — the builder (AR-269)
- [ ] **`createTheme(options: ThemeOptions): Theme`** where `ThemeOptions` is:
  - **required** `mode: 'light' | 'dark'`
  - **required** `accent: Color` (the brand seed)
  - **optional** `neutral?: Color` (else derived from `mode`)
  - **optional** `danger?`, `warning?`, `success?`, `info?: Color` (else sensible defaults)
  - **optional** `overrides?: Partial<ThemeColors>` — per-alias discrete overrides applied *after*
    generation (the "author discrete colors" path; satisfies "I want both")
  - **optional** `roleOverrides?: Partial<Theme>` — a final escape hatch to override individual
    *roles* directly (deep-merged last)
- [ ] Pipeline: seeds → OKLab ramps → a `ThemeColors` object → `rolesFromAliases()` → a full `Theme`;
  `overrides` merge at the alias step, `roleOverrides` merge at the role step.

#### `rolesFromAliases(colors)` — the canonical mapping (AR-267)
- [ ] **`rolesFromAliases(colors: ThemeColors): Theme`** authored once, producing **every** role in
  `Theme` including the role-only extras (`window.border`/`title`/`icon`, `dialog.*`,
  `desktop.pattern`, every `hotkey` accent). Each role maps to alias tokens (e.g. `button →
  {fg: foregroundOnAccent, bg: accent}`, `listFocused → {fg: foregroundOnAccent, bg: accent}`,
  `inputNormal → {fg: foreground, bg: backgroundSunken}`, `statusBar → {fg: foreground, bg:
  backgroundRaised, hotkey: danger}`, `desktop.pattern → '░'`).
- [ ] **`defaultTheme` is NOT rewritten onto aliases** — it stays the existing hand-authored literal,
  byte-for-byte unchanged, and remains the render-root default. `turboVisionTheme` is exported as an
  alias of it.

#### The text-attribute axis — `ThemeRole.attrs` (AR-271)
- [ ] `ThemeRole` gains an **optional** `attrs?: AttrMask` field. `themeRoleToStyle(role)` copies it
  into the returned `Style.attrs` (omitted when absent).
- [ ] **`defaultTheme` roles carry no `attrs`** → `themeRoleToStyle` output for every existing role is
  unchanged → the golden-screen suite passes byte-identical.
- [ ] Attributes survive `mono` depth (already true in `encodeStyle` — attrs emit even with no color),
  so an attribute-driven theme stays legible on a monochrome terminal.

#### Serialize / parse (AR-274, AR-281, AR-282)
- [ ] Pure **`serializeTheme(theme: Theme): string`** → canonical JSON with a **version envelope**
  `{ "version": 1, "roles": { <roleName>: {…} } }` and stable key order (AR-282). The `version` field
  is a forward-compat reserve: v1 validation is strict (below), but a future schema change can migrate
  older payloads instead of hard-rejecting them.
- [ ] Pure **`parseTheme(json: string): Theme`** → validates **by field kind**, throwing a typed
  `TuiError` subclass (`InvalidThemeError`) on any malformed field and **never** returning a partial
  theme (AR-281):
  - every **color** field — `fg`, `bg`, `hotkey`, **and per-role extras** `border`/`title`/`icon` —
    via `toRgb` (rejecting malformed hex / unknown names);
  - the `desktop.pattern` **glyph string** via `sanitize` (a control byte / escape sequence is
    rejected — a hostile pattern must never reach the screen);
  - each `attrs` value as a finite integer within the known `Attr` bits;
  - the **exact per-role shape** — the required key set for each role, including that `historyWindow`
    carries `border`+`icon` but **no** `title`, and `desktop` carries `pattern`;
  - the presence of every required role and rejection of any unknown role.
- [ ] **No filesystem access** (core stays zero-dep / fs-free).

#### Presets (AR-270, AR-272)
- [ ] Tree-shakeable named exports, each a fully-realized `Theme`:
  - **`monochromeTheme`** — zero color; conveys all state via attributes (bold/reverse/underline/dim);
    readable at `mono` depth (AR-272).
  - **`turboVisionTheme`** — `= defaultTheme` (the classic look; the default).
  - **`slateTheme`** — an enterprise, muted blue-gray professional look (generated).
  - **`nordTheme`**, **`draculaTheme`**, **`solarizedDarkTheme`**, **`gruvboxDarkTheme`** — curated
    community palettes (each seeded/overridden to match its canonical hex values).

#### Runtime hot-swap (AR-276, AR-279)
- [ ] **`RenderRoot.setTheme(theme: Theme): void`** — replaces the active theme and forces **one full
  recompose** (reuses `fullCompose`); the render root's `theme` field changes from `readonly` to
  mutable behind the method. A swap is one coalesced frame; the damage diff emits only changed cells.
- [ ] **`EventLoop.setTheme(theme: Theme): void`** — the loop owns the render root and builds it with
  a **no-op schedule** (the loop drives `flush()` itself), and a frame reaches the host only via the
  tick's trailing `flush()`+`onFrame()`. So the loop seam wraps the swap in its own tick
  (`runTick(() => renderRoot.setTheme(theme))`), guaranteeing the recomposed frame is **pushed to the
  host regardless of call context** — including a bare imperative/async call between input ticks
  (AR-279).
- [ ] **`Application.setTheme(theme: Theme): void`** forwards to `EventLoop.setTheme` (NOT straight to
  the render root — a direct call would mark dirty into the no-op schedule and not repaint until the
  next input tick).

#### Contrast helper (AR-273, AR-283)
- [ ] Pure **`contrastRatio(a: Color, b: Color): number`** (WCAG 2.x relative-luminance ratio, 1–21,
  computed on resolved sRGB). Never called inside `createTheme` — it does **not** auto-adjust colors.
- [ ] **Unresolvable input:** if either color resolves to `null` (`'default'` — no fixed luminance,
  it is whatever the terminal chooses), `contrastRatio` returns **`NaN`**, documented as "contrast
  unknown". The designer treats `NaN` as *skip* (no warning, never a false alarm) rather than
  throwing inside the render/preview loop. (`monochromeTheme` legitimately uses `'default'`, AR-283.)

#### The designer demo + showcase (AR-278)
- [ ] **`demo:themes`** — a live TUI theme-designer (real terminal): cycle `mode`/`accent`/`neutral`/
  status seeds, watch every hosted component repaint live via `setTheme`, an **export-to-JSON** panel
  (via `serializeTheme`), a **preview-depth toggle** (truecolor/256/16/mono), and **contrast
  warnings** on low-ratio alias pairs. Writes the exported JSON to a file (examples may use `node:fs`).
- [ ] A **kitchen-sink `Theming` story** demonstrating preset switching over a representative widget
  set; **every preset mounts + paints** in the headless smoke test.

### Should Have
- [ ] A `loadTheme(json)` convenience in the **examples** layer (reads a file + `parseTheme`) to prove
  the round-trip end-to-end; core exposes only the pure `parseTheme`.
- [ ] The designer offers a "copy accent from …" and randomize-seed affordance for exploration.

### Won't Have (Out of Scope)
- **Font / typeface theming** — terminals cannot load fonts; not possible (documented rationale).
- **Glyph-set / border-style theming** (single vs double vs rounded vs ASCII) — a *structural* axis,
  not color; the existing `caps.glyphs` ASCII fallback already covers the compatibility case. Deferred.
- **A hover/pressed interaction-state token matrix** — no hover in a TUI (AR-266).
- **Fluent-parity token count** (~600 tokens, `Set.…Rest/Hover/Pressed` naming) — deliberately
  rejected as bloat (AR-266); we adopt the *tiering idea*, not the size.
- **Auto-adjusting colors for contrast** inside `createTheme` — warn-only, author intent preserved
  (AR-273).
- **Filesystem I/O in `@jsvision/core`** — `parseTheme`/`serializeTheme` are pure; fs lives in the
  demo (AR-274).
- **Per-terminal palette remapping** (OSC 4 setting the terminal's own 16 slots) — we downsample to
  the terminal's palette, we don't reprogram it. Future consideration.
- **Cross-version theme-file migration** — the serialized envelope carries a `version` field, but v1
  only *validates* it (strict role-set match); actually migrating an older/newer payload's role set is
  a future consideration (AR-282). A theme file authored against a different `Theme` role set is
  rejected, not upgraded.

---

## Technical Requirements

### Module layout (AR-265)

```
packages/core/src/engine/color/
  theme.ts        # (edit) ThemeRole gains optional attrs?; Theme unchanged; defaultTheme unchanged
  theme-style.ts  # N/A — lives in ui; see below
  aliases.ts      # (new) ThemeColors interface + token docs
  ramp.ts         # (new) OKLab conversions + ramp/lighten/darken/mix (pure, zero-dep)
  create-theme.ts # (new) ThemeOptions + createTheme() + rolesFromAliases()
  contrast.ts     # (new) contrastRatio() (WCAG luminance)
  serialize.ts    # (new) serializeTheme/parseTheme + InvalidThemeError
  presets.ts      # (new) monochrome/slate/nord/dracula/solarizedDark/gruvboxDark (+ turboVision alias)
  index.ts        # (edit) re-export the new public symbols
packages/ui/src/view/
  theme-style.ts  # (edit) pass role.attrs → Style.attrs
  render-root.ts  # (edit) RenderRoot.setTheme(); theme field mutable behind it
packages/ui/src/event/
  event-loop.ts   # (edit) EventLoop.setTheme() — runTick-wrapped swap so the frame reaches the host
packages/ui/src/app/
  application.ts  # (edit) Application.setTheme() forwards to EventLoop.setTheme
packages/examples/
  theme-designer/ # (new) demo:themes — live designer (main.ts + pure designer.ts)
  kitchen-sink/stories/theming.story.ts  # (new) + registry line
```

All new core symbols re-export from `packages/core/src/engine/index.ts`; ui symbols from
`packages/ui/src/index.ts`. Files target 200–500 lines.

### The alias→role mapping model (AR-267)

`rolesFromAliases` is the semantic contract: it names, for every one of the ~70 roles, which alias
token(s) it draws from. It is authored once against the current `Theme` shape and is the single place
a generated theme's "meaning" lives. Illustrative excerpt (full mapping specified at plan time):

| Role | fg | bg | extra |
|------|----|----|-------|
| `desktop` | `foregroundMuted` | `background` | `pattern: '░'` |
| `window` | `foreground` | `backgroundRaised` | `border/title: foreground`, `icon: accent` |
| `windowInactive` | `foregroundMuted` | `backgroundRaised` | `border/title/icon: foregroundMuted` |
| `menuBar` / `statusBar` | `foreground` | `backgroundRaised` | `hotkey: danger` |
| `menuSelected` / `statusSelected` | `foregroundOnAccent` | `accent` | `hotkey: danger` |
| `button` | `foregroundOnAccent` | `accent` | — |
| `buttonFocused` | `foregroundOnAccent` | `accentMuted` | `hotkey: warning` |
| `inputNormal` / `inputSelected` | `foreground` | `backgroundSunken` | — |
| `listNormal` | `foreground` | `backgroundRaised` | — |
| `listFocused` | `foregroundOnAccent` | `accent` | — |
| `danger`-ish roles (e.g. error text) | `danger` | `background` | — |

> **Traceability of coverage:** the plan MUST enumerate all ~70 roles so none is missed;
> `rolesFromAliases` returning a `Theme` that type-checks is the compile-time guarantee of completeness.

### OKLab ramp (AR-268)

- sRGB → linear → OKLab (Björn Ottosson's matrices) and back; `lighten(c, amount)` / `darken(c,
  amount)` adjust OKLab **L**; `mix(a, b, t)` interpolates in OKLab. Clamp to gamut on the way back.
- `neutral` ramp: a low-chroma ramp anchored on the `neutral` seed (or a `mode`-appropriate near-gray
  when omitted). `accent` ramp: shades of the accent seed for `accent`/`accentMuted`.
- Light vs dark `mode` inverts which end of the neutral ramp becomes `background` vs `foreground`.

### Hot-swap (AR-276, AR-279)

`RenderRootImpl.theme` becomes a mutable field; `setTheme(t)` assigns it and calls the existing
full-recompose path (equivalent to `markRelayout()`'s full compose) so every cached compose context
re-resolves against the new colors in one coalesced frame. No new diffing — `serialize()` already
emits only the cells that changed.

**Frame delivery to the host.** Under a loop the render root is built with a **no-op `schedule`** (the
loop calls `flush()` once per tick and hands the frame to the host via `onFrame`), and a bare
`renderRoot.setTheme()` therefore marks dirty but does not repaint until the next input tick. So the
loop exposes `EventLoop.setTheme(t)` that wraps the swap in a tick — `runTick(() =>
renderRoot.setTheme(t))` — reusing the tick's trailing `flush()`+`onFrame()` push (the same mechanism
`resize()` and `healFocus` already rely on). `Application.setTheme` forwards to this loop seam, so a
theme swap repaints the terminal immediately from any call site (a command handler, the designer's
seed-cycle, or a plain imperative call).

### Serialize format (AR-274, AR-281, AR-282)

`serializeTheme` emits a **versioned envelope** — `{ "version": 1, "roles": { <roleName>: {fg, bg,
hotkey?, attrs?, …role extras} } }` — with stable key order. `parseTheme` validates **by field kind**
(not just `fg`/`bg`): every color field — including the per-role extras `border`/`title`/`icon` —
through `toRgb`; the `desktop.pattern` glyph through `sanitize` (control bytes rejected); `attrs` as a
finite integer within the known `Attr` bits; the **exact per-role shape** (required keys per role —
`historyWindow` has `border`+`icon` and no `title`; `desktop` has `pattern`); and the presence of
every required role, rejecting any unknown role (→ `InvalidThemeError`, no partial theme).

Round-trip is **lossless over every field**, including `attrs` (the `monochrome` preset) and
`desktop.pattern` (`'░'` in `defaultTheme`). The `version` field is a forward-compat reserve: v1
rejects a mismatched role set, but a future schema bump can migrate an older payload (e.g. fill a
newly-added role from `defaultTheme`) instead of hard-failing — so exported theme files aren't
silently invalidated the next time the `Theme` gains a role.

---

## Integration Points

### With RD-03 (View/Group spine)
- `themeRoleToStyle` (ui) gains attribute pass-through; `RenderRoot` gains `setTheme`. `DrawContext.
  color()`/`role()` are unchanged — widgets read the swapped theme automatically on the next compose.

### With RD-05 (App shell) / RD-04 (Event loop)
- The loop gains `EventLoop.setTheme` (a `runTick`-wrapped render-root swap so the frame is pushed to
  the host); `Application.setTheme` forwards to it. The kitchen-sink shell wires a theme-switch
  affordance for the `Theming` story.

### With `@jsvision/core` color subsystem
- Reuses `Color`/`toRgb`/`PALETTE`/`ANSI16_ORDER`/`encode`/`downsample`/`Attr`. The new modules extend
  `color/`; `defaultTheme` and every existing export are untouched.

### With RD-09/RD-13 governance
- The API-stability + treeshake + a11y-golden tests gain the new exports; presets must tree-shake
  (unused presets absent from a one-symbol bundle).

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| One RD or split | Single phased RD / RD-22 + RD-23 | **Single RD-22, phased plan** | Cohesive concern | AR-264 |
| Package layering | All-in-ui / split by concern | **core=model, ui=hot-swap, examples=designer** | `Theme`/`Color`/`encode` already in core | AR-265 |
| Alias set | ~16 base16-sized / Fluent-parity | **16 curated tokens** (each defined) | Base16 proves ~16 is right for a TUI | AR-266, AR-280 |
| Role derivation | one `rolesFromAliases` / rewrite defaultTheme | **one mapping; defaultTheme stays literal** | Protects the golden TV output | AR-267 |
| Ramp algorithm | OKLab / HSL | **OKLab/OKLCH** | Perceptually even at truecolor; zero-dep | AR-268 |
| Seed shape | fixed / seeds+overrides | **mode+accent required; optional neutral/status + overrides** | Supports both generated & discrete | AR-269 |
| Preset list | (chosen set) | **mono·turboVision·slate·nord·dracula·solarizedDark·gruvboxDark** | Covers mono→enterprise→dark tastes | AR-270 |
| Attrs axis | optional attrs / none | **optional `ThemeRole.attrs`** | Dark/minimal themes lean on dim/bold; golden-safe | AR-271 |
| monochrome semantics | attr-only / grayscale | **zero-color, attribute-driven** | Max compatibility, works at `mono` | AR-272 |
| Contrast | warn-only / auto-adjust | **WCAG warn-only in designer** | Respects authored intent | AR-273 |
| Export/load | core fs / pure + fs-in-demo | **pure serialize/parse; fs in demo** | Core stays zero-dep | AR-274 |
| API names | (chosen) | **createTheme/ThemeOptions/ThemeColors/serializeTheme/parseTheme/setTheme/preset exports** | Consistent, discoverable | AR-275 |
| Hot-swap | setTheme+full recompose / reactive theme | **setTheme + full recompose** | Simplest; reuses fullCompose | AR-276 |
| Hot-swap frame delivery | renderRoot only / loop seam | **`EventLoop.setTheme` (runTick-wrapped)** | The loop's no-op schedule means only a tick pushes a frame to the host | AR-279 |
| Accent-fg tokens | keep both / drop the synonym | **drop `accentForeground`; keep `foregroundOnAccent`** (16-token set) | The two were indistinguishable; only one is used | AR-280 |
| parse validation | colors+attrs only / by field kind | **by field kind (extras via `toRgb`, `pattern` via `sanitize`, per-role shape)** | Lossless round-trip + injection-safe parse | AR-281 |
| Serialized format | flat map / versioned envelope | **`{version,roles}` envelope, strict v1** | Forward-compat reserve without a partial-theme risk | AR-282 |
| Unresolvable colors | throw everywhere / defined per helper | **`ramp` throws; `contrastRatio` → `NaN` (skip)** | `'default'` has no RGB; never crash the render/preview loop | AR-283 |

> **Traceability:** every decision references its Ambiguity Register entry. See
> `00-ambiguity-register.md` (AR-264…AR-283).

---

## Security Considerations

- **Data sensitivity:** none — a theme is public color/attribute data. No PII, credentials, or tokens.
- **Input validation:** the only external input is a **theme JSON** fed to `parseTheme`. It MUST
  validate **every color field — `fg`/`bg`/`hotkey` and the per-role extras `border`/`title`/`icon`** —
  through the existing `toRgb` allowlist (`'default'` | named ANSI-16 | `#rgb`/`#rrggbb`), reject any
  other string, validate the **`desktop.pattern` glyph through `sanitize`** (a control byte or escape
  sequence is rejected — the pattern is tiled across the desktop, so an unchecked glyph is the one
  field that could carry an escape payload), validate `attrs` as an in-range integer bitmask, and
  require the exact per-role shape + role set — throwing `InvalidThemeError` (a `TuiError`) with **no
  partial return**. This mirrors `toRgb`'s existing guarantee that a malformed color can never leak
  bytes into the escape stream, and extends it to the one non-color drawable field.
- **Injection risks:** colors and glyphs already pass through the canonical `sanitize` boundary and
  `encodeStyle` (crash-safe: a bad color degrades to no-color, never throws in the render loop). A
  hostile theme JSON therefore cannot inject escape sequences — the worst case is a rejected parse or
  an unreadable-but-safe color. **`parseTheme` must not `eval`** or accept a JS object literal; JSON
  only.
- **Authentication & authorization:** N/A (a client-side SDK; no server, no endpoints).
- **Encryption / rate limiting / infrastructure:** N/A.
- **Filesystem:** `@jsvision/core` performs **no** file I/O; only the examples designer reads/writes a
  theme file (a dev tool). Any consumer that loads a theme file does so through its own fs + the pure
  `parseTheme` validator.
- **Security testing:** a spec test MUST assert `parseTheme` rejects malformed colors, out-of-range
  `attrs`, missing/extra roles, and non-JSON input (each → `InvalidThemeError`, no partial theme).

---

## Acceptance Criteria

1. [ ] **`ThemeColors`** is exported from `@jsvision/core` with exactly the **16** named tokens in
   AR-266 (4 text + 4 surface + 2 accent + 2 line + 4 status); each typed `Color`. There is no
   `accentForeground` token (dropped as a synonym of `foregroundOnAccent`, AR-280).
2. [ ] **`rolesFromAliases(colors)`** returns a value assignable to `Theme` (every role + extra
   present); a compile check + a runtime test assert no role key is missing.
3. [ ] **`createTheme({ mode: 'dark', accent: '#3b82f6' })`** returns a valid `Theme`; every role's
   `fg`/`bg` parses via `toRgb`; `mode: 'light'` yields a light `background` (higher luminance than the
   dark variant's `background`, asserted by `contrastRatio` direction).
4. [ ] **`createTheme(..., { overrides: { accent: '#ff0000' } })`** produces a theme whose
   accent-derived roles (e.g. `button.bg`) resolve to the override, proving discrete authoring; and
   `roleOverrides` deep-merges a single role.
5. [ ] **OKLab ramp** round-trips sRGB→OKLab→sRGB within ≤1/255 per channel for the 16 `PALETTE`
   colors; `lighten(c, x)` strictly increases OKLab L and `darken` strictly decreases it.
6. [ ] **`ThemeRole.attrs`**: `themeRoleToStyle({fg,bg,attrs: Attr.bold})` returns `Style.attrs ===
   Attr.bold`; `themeRoleToStyle({fg,bg})` returns a style with `attrs` absent/undefined.
7. [ ] **Golden-screen invariance:** the existing golden-screen suite passes **byte-identical** with
   this RD merged (proves `defaultTheme` + `themeRoleToStyle` output is unchanged for attr-free roles).
8. [ ] **`serializeTheme`∘`parseTheme`** is the identity on all shipped presets (deep-equal), and on a
   `createTheme(...)` output — **including non-color fields**: `defaultTheme.desktop.pattern` (`'░'`)
   and the `monochrome` preset's `attrs` survive the round-trip byte-for-byte. Serialized output is a
   `{version, roles}` envelope.
9. [ ] **`parseTheme`** throws `InvalidThemeError` (a `TuiError`) and returns nothing for: a malformed
   hex color (`#zz0000`) in **any** color field including a role extra (`window.border`), an unknown
   color name, a **`desktop.pattern` containing a control byte / escape sequence**, an `attrs` value
   outside the known `Attr` bits, a missing role, a role of the wrong shape (e.g. `historyWindow` with
   a `title`), an extra unknown role, and non-JSON input. No partial theme is ever returned.
10. [ ] **Presets:** `monochromeTheme`, `turboVisionTheme` (`=== defaultTheme`), `slateTheme`,
    `nordTheme`, `draculaTheme`, `solarizedDarkTheme`, `gruvboxDarkTheme` are all exported and are
    valid `Theme`s. `nordTheme`'s `background` equals Nord's canonical `#2e3440` (or its documented
    nearest); each curated preset pins ≥1 canonical hex in a test.
11. [ ] **`monochromeTheme`** uses no chromatic color (every role's fg/bg is `'default'`, black, white,
    or a gray) and distinguishes focused/selected/disabled states via `attrs` (asserted: focused vs
    normal differ only in `attrs`, not hue).
12. [ ] **Depth robustness:** every shipped preset composes a representative widget set without error
    and produces non-empty output at all four depths (`truecolor`/`256`/`16`/`mono`) — a golden test
    per depth.
13. [ ] **Hot-swap:** `renderRoot.setTheme(nordTheme)` after mounting `defaultTheme` produces exactly
    one recomposed frame whose buffer differs from the pre-swap buffer; `originOf` for an unchanged
    view is preserved. `EventLoop.setTheme`/`Application.setTheme` produce the same effect **and push
    the frame to the host** (`onFrame` fires) even when called **outside an input tick** — asserted by
    a bare imperative `app.setTheme(nordTheme)` (no surrounding dispatch) repainting the host buffer.
14. [ ] **`contrastRatio('#000000', '#ffffff') === 21`** (±0.01) and `contrastRatio(c, c) === 1`;
    **`contrastRatio('default', x)` is `NaN`** (unresolvable → contrast unknown) and the designer
    skips a warning for a `NaN` pair (never a false alarm); the designer surfaces a warning for any
    alias fg/bg pair with ratio < 4.5 (WCAG AA text) without altering the theme.
15. [ ] **`demo:themes`** runs on a real TTY: cycling a seed live-repaints every hosted component,
    the JSON export panel reflects the current theme, and the depth toggle changes the preview.
16. [ ] **Kitchen-sink `Theming` story** is registered and mounts+paints headlessly; the smoke test
    mounts **every preset** and asserts each paints (non-empty buffer, unique story id, required
    metadata).
17. [ ] **Governance:** the new public symbols appear in the API-stability snapshot; presets
    tree-shake (a one-symbol bundle excludes unused presets); `check:docs` passes (every new public
    export carries an `@example`).
18. [ ] Security requirements verified: `parseTheme` input validation + injection-safety tests
    (criterion 9) pass; core performs no filesystem access.

---

## Complexity Estimates

| Area | Complexity |
|------|-----------|
| `ThemeColors` + `rolesFromAliases` (the ~70-role mapping) | **L** |
| OKLab ramp + `createTheme` | **M** |
| `ThemeRole.attrs` pass-through | **S** |
| `serializeTheme`/`parseTheme` + validation | **M** |
| Presets (7) | **M** (curated palettes need per-preset tuning) |
| Hot-swap (`setTheme`) | **S** |
| Contrast helper | **S** |
| `demo:themes` designer + `Theming` story | **L** |
