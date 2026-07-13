# Testing Strategy: Theming

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Core theme logic (ramp, createTheme, rolesFromAliases, serialize, contrast) | 90% |
| Hot-swap seams (render-root / loop / app) | 80% |
| Examples (designer, story) | 60% |

Test names state behavior (`should … when …`). Spec tests are the immutable oracle: a spec-test
failure after implementation means the implementation is wrong, not the test.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from RD-22 (`../../requirements/RD-22-theming.md`), the `03-XX` specs, and the ambiguity
> registers. Expectations come from the SPEC, never from imagined implementation output. The
> in-code traceability comment quotes behavior in plain language — never an `ST-`/`AR-`/`AC-` id or a
> `requirements/` path (per the JSDoc ban).

### Aliases, Ramp & Contrast (`03-01`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | sRGB→OKLab→sRGB round-trip for each of the 16 `PALETTE` colors | ≤ 1/255 per-channel error | RD-22 AC-5 / AR-268 |
| ST-2 | `lighten(c, 0.2)` / `darken(c, 0.2)` | OKLab L strictly increases / strictly decreases | RD-22 AC-5 |
| ST-3 | `mix(a, b, 0)` / `mix(a, b, 1)` / `mix(a, b, 0.5)` | `=== a` / `=== b` / an OKLab-interpolated midpoint | AR-268 |
| ST-4 | `ramp('default', 5)` (and `lighten`/`darken`/`mix` with a `'default'` seed) | throws `InvalidColorError` | AR-283 |
| ST-5 | `contrastRatio('#000000','#ffffff')` ; `contrastRatio(c, c)` | `21` (±0.01) ; `1` | RD-22 AC-14 |
| ST-6 | `contrastRatio('default', '#ffffff')` | `NaN` (never throws) | RD-22 AC-14 / AR-283 |
| ST-7 | `ThemeColors` member count | exactly 16 tokens; no `accentForeground` | RD-22 AC-1 / AR-280 |

### createTheme & rolesFromAliases (`03-02`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-8 | `rolesFromAliases(colors)` | assignable to `Theme`; every `defaultTheme` role key present at runtime | RD-22 AC-2 / AR-267 |
| ST-9 | `createTheme({ mode:'dark', accent:'#3b82f6' })` | every role's `fg`/`bg` parses via `toRgb` (no throw) | RD-22 AC-3 |
| ST-10 | `createTheme(…, { overrides:{ accent:'#ff0000' } })` ; `roleOverrides:{ desktop:{ pattern:'▒' } }` | accent-derived roles (`button.bg`, `listFocused.bg`) resolve to `#ff0000` ; only `desktop.pattern` changes | RD-22 AC-4 |
| ST-11 | `createTheme(mode:'light')` vs `mode:'dark'` `background` | light `background` has higher relative luminance (asserted by `contrastRatio` direction) | RD-22 AC-3 |

### Attrs & Serialize (`03-03`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-12 | `themeRoleToStyle({fg,bg,attrs:Attr.bold})` ; `themeRoleToStyle({fg,bg})` | `.attrs === Attr.bold` ; **no** `attrs` key present | RD-22 AC-6 / PA-4 |
| ST-13 | `parseTheme(serializeTheme(t))` for every preset + a `createTheme` output | deep-equals `t`, incl. `desktop.pattern` (`'░'`) and `monochrome` `attrs` | RD-22 AC-8 |
| ST-14 | `serializeTheme(t)` shape | `{ "version": 1, "roles": { … } }` with stable key order | RD-22 AC-8 / AR-282 |
| ST-15 | `parseTheme` with `#zz0000` in `desktop.fg` | throws `InvalidThemeError`; no partial theme | RD-22 AC-9 |
| ST-16 | `parseTheme` with `#zz0000` in a role **extra** (`window.border`) | throws `InvalidThemeError` | RD-22 AC-9 / AR-281 |
| ST-17 | `parseTheme` with `desktop.pattern` = control byte / `\x1b[…` / `\t` / `\n` / two cells / empty | throws `InvalidThemeError` | RD-22 AC-9 / PA-5 / P-AC-2 |
| ST-18 | `parseTheme` with `attrs` = `999` / `-1` / `1.5` | throws `InvalidThemeError` | RD-22 AC-9 |
| ST-19 | `parseTheme` with a missing role / an unknown role / `historyWindow` carrying a `title` | throws `InvalidThemeError` | RD-22 AC-9 / AR-281 |
| ST-20 | `parseTheme` with non-JSON input / `version: 2` | throws `InvalidThemeError` (no migration in v1) | RD-22 AC-9 / AR-282 |

### Presets & Governance (`03-04`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-21 | The 7 preset exports | all valid `Theme`s; `turboVisionTheme === defaultTheme` | RD-22 AC-10 |
| ST-22 | `nordTheme.background` / dracula / solarizedDark / gruvboxDark | `'#2e3440'` / `'#282a36'` / `'#002b36'` / `'#282828'` (each curated preset pins ≥1 canonical hex) | RD-22 AC-10 |
| ST-23 | The existing `*-theme.spec` `toStrictEqual` oracles + a `themeRoleToStyle` attr-free test | pass unchanged (proves `defaultTheme` output is unchanged — the real oracle, not golden-screen) | PA-4 / RD-22 AC-7 |
| ST-24 | `monochromeTheme` | no chromatic color (every fg/bg is `'default'`/black/white/gray); focused vs normal differ **only** in `attrs` | RD-22 AC-11 / AR-272 |
| ST-25 | Each preset composing a representative widget set at `truecolor`/`256`/`16`/`mono` | non-empty output at every depth, no error | RD-22 AC-12 |
| ST-26 | A one-preset esbuild bundle | the other six preset names absent from the bundle text | RD-22 AC-17 |
| ST-27 | `theme-packaging.spec` | new symbols importable from `@jsvision/core`; every pre-existing color export still resolves; each new file ≤ 500 lines | P-AC-3 / RD-22 AC-17 |

### Hot-swap (`03-05`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-28 | `renderRoot.setTheme(nordTheme)` after mounting `defaultTheme`, then `flush()` | exactly one recomposed frame; buffer differs from pre-swap; `originOf` of an unchanged view preserved | RD-22 AC-13 |
| ST-29 | A bare `app.setTheme(nordTheme)` with **no** surrounding dispatch | the host buffer repaints (`onFrame` fires) — the frame is pushed outside an input tick | RD-22 AC-13 / AR-279 |

### Designer & Story (`03-06`)

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-30 | `currentTheme(state)` | a valid `Theme` (every role parses via `toRgb`) | RD-22 AC-15 |
| ST-31 | `cycleAccent` / `cycleMode` / `cycleDepth` | advance deterministically (index-varied, no `Math.random` in tests) | RD-22 AC-15 |
| ST-32 | `parseTheme(exportJson(state))` | deep-equals `currentTheme(state)` | RD-22 AC-15 |
| ST-33 | `contrastWarnings(state)` with a `'default'` pair and a known low-contrast pair | the `NaN` pair is skipped; the low-contrast pair is flagged; the theme is unmodified | RD-22 AC-14 |
| ST-34 | Headless walkthrough e2e of the designer | non-empty stdout showing a theme switch + a depth change + a JSON export; exit 0 | RD-22 AC-15 |
| ST-35 | The kitchen-sink smoke test mounting **every** preset + the `Theming` story | each paints (non-empty buffer); story has a unique id + required metadata | RD-22 AC-16 |

> **⚠️ AUTHORING RULE:** every expectation above is derived from RD-22 / the `03-XX` specs / the AR
> registers — not from imagined implementation output.

## Test Categories

### Specification Tests (from ST-cases above)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/core/test/ramp.spec.test.ts` | ST-1…ST-4 | OKLab ramp |
| `packages/core/test/contrast.spec.test.ts` | ST-5, ST-6 | contrast |
| `packages/core/test/create-theme.spec.test.ts` | ST-7…ST-11 | aliases + builder + mapping |
| `packages/ui/test/theme-style.spec.test.ts` | ST-12 | `themeRoleToStyle` attrs |
| `packages/core/test/serialize-theme.spec.test.ts` | ST-13…ST-20 | serialize/parse (incl. security) |
| `packages/core/test/presets.spec.test.ts` | ST-21…ST-24 | presets + `defaultTheme` invariance |
| `packages/core/test/presets-depth.spec.test.ts` | ST-25 | depth-robustness golden (`@xterm/headless`) |
| `packages/core/test/theme-packaging.spec.test.ts` | ST-27 | additive-surface + line budget |
| `packages/core/test/treeshake.spec.test.ts` (extend) | ST-26 | preset tree-shake |
| `packages/ui/test/render-theme-swap.spec.test.ts` | ST-28 | `RenderRoot.setTheme` |
| `packages/ui/test/app-theme-swap.spec.test.ts` | ST-29 | `EventLoop`/`Application.setTheme` |
| `packages/examples/test/themes-designer.spec.test.ts` | ST-30…ST-33 | pure designer |
| `packages/examples/test/themes-demo.e2e.test.ts` | ST-34 | designer walkthrough (e2e project) |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (extend) | ST-35 | `Theming` story |

### Implementation Tests (edge cases, internals)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `*.impl.test.ts` siblings | OKLab gamut-clamp edges, ramp step count boundaries, serialize key-order stability, `createTheme` neutral-omitted default, `roleOverrides` deep-merge depth, `setTheme` re-entrant-from-`onCommand` single-frame coalescing | High/Med |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Designer walkthrough | spawn `tsx themes-demo/main.ts` (headless/scripted) | exit 0; stdout shows a theme switch + depth change + JSON export (ST-34) |
| Round-trip via fs | `loadTheme(serialize→file)` | deep-equals the source theme |

## Test Data

### Fixtures Needed
- The 16 `PALETTE` colors (existing) for the OKLab round-trip.
- Canonical preset hexes (Nord/Dracula/Solarized/Gruvbox) as inline literals in `presets.spec`.
- Malformed theme-JSON strings (bad color, bad pattern, bad attrs, wrong shape, non-JSON) for the
  `parseTheme` rejection matrix.

### Mock Requirements
- None beyond the existing test doubles. Hot-swap tests use the real `RenderRoot`/`EventLoop`; the
  app-swap test uses the app-shell TTY doubles (`CaptureStream`/`FakeInput`, `requireTty:false`).

## Verification Checklist
- [ ] All ST-1…ST-35 defined with concrete input/output pairs (above)
- [ ] Every ST case traces to an RD-22 AC / AR / PA entry
- [ ] Spec tests written BEFORE implementation and verified to FAIL (red phase) each phase
- [ ] All spec tests pass after implementation (green phase)
- [ ] Impl tests written for edge cases + internals
- [ ] Security: `parseTheme` rejection matrix (ST-15…ST-20) passes; core does no fs (RD-22 AC-18)
- [ ] `defaultTheme` invariance: the existing `*-theme.spec` oracles pass unchanged (ST-23)
- [ ] No regressions in existing tests; coverage meets goals
