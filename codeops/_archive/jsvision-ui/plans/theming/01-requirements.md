# Requirements: Theming

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-22](../../requirements/RD-22-theming.md) — the OWNING requirements doc

RD-22 owns the feature's requirements, scope decisions (AR-264…AR-283), and 18 acceptance criteria.
This document is the **plan delta** only — what this plan implements, what it defers, the plan-local
decisions the RD left open, and the plan-local acceptance criteria added on top of the RD's.

## Scope of this plan (delta view)

### In this plan (all of RD-22 Must-Have)

- **Alias tier** — the 16-token `ThemeColors` interface (RD-22 §"The semantic alias tier"; AR-266/AR-280). → `03-01`
- **OKLab ramp** — `ramp`/`lighten`/`darken`/`mix` + sRGB↔OKLab (AR-268; unresolvable-seed throw AR-283). → `03-01`
- **`contrastRatio`** — WCAG helper; `NaN` on unresolvable input (AR-273/AR-283). → `03-01`
- **`createTheme(options)`** + **`rolesFromAliases(colors)`** — the builder + the 63-role mapping (AR-267/AR-269; fidelity PA-2). → `03-02`
- **`ThemeRole.attrs`** — optional per-role attribute mask + `themeRoleToStyle` pass-through (AR-271). → `03-03`
- **`serializeTheme`/`parseTheme`** — versioned envelope + field-kind validation + `InvalidThemeError` (AR-274/AR-281/AR-282). → `03-03`
- **7 presets** — `monochrome`/`turboVision`/`slate`/`nord`/`dracula`/`solarizedDark`/`gruvboxDark` (AR-270/AR-272). → `03-04`
- **Hot-swap** — `RenderRoot`/`EventLoop`/`Application.setTheme` (AR-276/AR-279; mechanism PA-3). → `03-05`
- **Designer + story** — `demo:themes` + kitchen-sink `Theming` story (AR-278; shape PA-7). → `03-06`

### Should-Have (in this plan)

- **`loadTheme(json)`** convenience in the examples layer (reads a file + `parseTheme`) — proves the
  round-trip end-to-end; core stays pure (RD-22 §Should-Have). → `03-06`
- Designer "randomize seed" / "copy accent" affordances (RD-22 §Should-Have). → `03-06`

### Deferred / out of this plan

Per RD-22 §"Won't Have": font/typeface theming, glyph-set/border-style theming, a hover/pressed
token matrix, Fluent-parity token counts, contrast auto-adjustment, filesystem I/O in core,
per-terminal palette remapping (OSC 4), and **cross-version theme-file migration** (the `version`
field is a forward-compat reserve only; v1 strictly validates the role set — AR-282).

## Plan-local decisions

Only decisions **not** already in RD-22. Full detail in `00-ambiguity-register.md`.

| Decision | Chosen | Ref |
| -------- | ------ | --- |
| Verify command (per-phase vs. final gate) | `yarn verify` per phase; `+ yarn lint` + per-package `typecheck` at the final gate | PA-1 |
| Generated-theme role fidelity | Semantic collapse to the 16 aliases | PA-2 |
| Hot-swap mechanism vs. the real render root | `setTheme` = mutable `theme` field + `markRelayout()` (mirrors `setRevealAccelerators`); loop seam wraps in `runTick` | PA-3 |
| True `defaultTheme`-unchanged oracle | The `*-theme.spec` `toStrictEqual` tests + a `themeRoleToStyle` attr-free-invariance test (not golden-screen) | PA-4 |
| `desktop.pattern` glyph validation | Single printable cell (not merely `sanitize`-clean) | PA-5 |
| Additive-surface governance guard | New `theme-packaging.spec` + CHANGELOG `[Unreleased]` entry | PA-6 |
| `demo:themes` shape | Pure `designer.ts` + real-TTY `main.ts` | PA-7 |
| File-split contingency | Split `rolesFromAliases` → `roles.ts` if `create-theme.ts` nears 500 lines | PA-8 |

## Acceptance Criteria (plan-local additions to RD-22's AC-1…AC-18)

The RD owns AC-1…AC-18. This plan adds three criteria that operationalize the plan-time corrections:

- **P-AC-1** — `defaultTheme` invariance is proven by the existing `*-theme.spec` `toStrictEqual`
  oracles passing unchanged **and** a new `themeRoleToStyle` test asserting an attr-free role returns
  a `Style` with no `attrs` key (refines RD-22 AC-7 per PA-4).
- **P-AC-2** — `parseTheme` rejects a `desktop.pattern` that is empty, multi-cell, or contains a tab
  or newline, in addition to control/escape bytes (refines RD-22 AC-9 per PA-5).
- **P-AC-3** — a new `theme-packaging.spec` asserts every new `@jsvision/core` public symbol is
  importable, every pre-existing color export still resolves, and each new source file is ≤ 500 lines;
  the CHANGELOG `[Unreleased]` section names the new exports (operationalizes RD-22 AC-17 per PA-6).
