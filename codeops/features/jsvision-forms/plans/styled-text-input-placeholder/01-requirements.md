# Requirements: Styled Text Severity & Input Placeholder

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source**: [RD-09](../../requirements/RD-09-styled-error-text-input-placeholder.md) — the OWNING requirements doc

This plan implements RD-09 in full. RD-09 owns the functional requirements, scope decisions, and
acceptance criteria; this is a delta view only.

## Scope of this plan (delta view)

### In this plan
- **Two core theme roles** `dangerText`/`warningText` from the `danger`/`warning` aliases (RD Must-Have) — 03-01
- **`Text.severity?: 'error' | 'warning'`** mapped to the roles (RD Must-Have) — 03-02
- **`Input.placeholder?: string | Signal<string>`**, muted-when-empty, never in the value (RD Must-Have) — 03-02
- **Propagation** to `DatePicker` + `ComboBox` + `inputBox()` (RD Must-Have / AR-30) — 03-02
- **Render-path sanitisation** of both new strings (RD Must-Have) — 07 ST-U9
- **Guards**: own byte-guard + the five inventory-tripwire allowlist extensions + reserved-alias specs (RD Must-Have) — 07
- **Kitchen-sink demos** for placeholder + severity (RD Must-Have) — 03-03
- **Correct "63"→"67"** role-count strings + mechanical `length` guard (RD Should-Have) — 03-03 / 07 ST-C2

### Deferred / out of this plan
- Per-field `field.reset()` — a store concern (RD Won't-Have / AR-31 / GH #89)
- `success`/`info` roles, a dedicated `inputPlaceholder` role, reactive `severity`, a `@jsvision/forms`
  error helper — all RD Won't-Have

## Plan-local decisions

Only decisions NOT already fixed by RD-09 (see `00-ambiguity-register.md` AR-P rows):

| Decision | Chosen | AR Ref |
| -------- | ------ | ------ |
| Verify command | `yarn verify` | AR-P1 |
| Role placement in interface/literals | Appended (additive convention) | AR-P2 |
| Per-theme fg/bg (mono achromatic, generated `c.*`) | staticText-bg rule; `{fg:W,bg:B}` at mono | AR-P3 |
| `createTheme` reach | No logic change; only `rolesFromAliases` + stale docs | AR-P4 |
| `placeholder` signal reactivity | Subscribe on mount when a signal is passed | AR-P5 |
| Own-guard + story targets | Core-side guard spec; `input.story` + `theming.story` demos | AR-P6 |

## Acceptance Criteria

The RD owns the ten acceptance criteria (RD-09 §Acceptance Criteria). This plan adds no plan-local
criteria beyond them; the AC → ST coverage map is in `07-testing-strategy.md`.
