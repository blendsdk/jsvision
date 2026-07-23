# Testing Strategy: Styled Text Severity & Input Placeholder

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

| Code type | Target |
| --------- | ------ |
| Theme roles / render logic (core+ui) | 90% |
| Control glue (wrappers, stories) | 70% |

Tests are `@jsvision`-native: mount headlessly on a `RenderRoot`, paint, and read back cell
glyph/attrs — the same technique RD-01…04 used. No mocks (the render path is a real object).

## 🚨 Specification Test Cases (MANDATORY — derived from RD-09 + 03-01/03-02, never from code)

> IMMUTABLE ORACLE RULE: if the implementation disagrees with a case below, the implementation is
> wrong. Every case traces to an RD acceptance criterion / AR entry. The `Source` column stays in
> this doc — the in-code traceability comment quotes the behaviour in plain language, never an
> `ST-`/`AR-`/`requirements/` id.

### Core theme roles — `packages/core/test/severity-text-theme.spec.test.ts`

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-C1 | `defaultTheme.dangerText` / `.warningText` | `toStrictEqual({ fg: '#ef4444', bg: PALETTE.lightGray })` / `({ fg: '#f59e0b', bg: PALETTE.lightGray })` | RD AC #1 / AR-25, AR-P3 |
| ST-C2 | `Object.keys(defaultTheme)` | `.length === 67`; includes `dangerText` + `warningText`; **neither role name is a `ThemeColors` alias name** | RD AC #1 / PF-003, PF-006 |
| ST-C3 | `createTheme({ mode:'light', accent:'#3b82f6', danger:'#c00', warning:'#fa0' })` | `.dangerText.fg === '#c00'`, `.warningText.fg === '#fa0'`; with no override, `.dangerText.fg === '#ef4444'` | RD AC #1 / AR-25, AR-P4 |
| ST-C4 | `monochromeTheme.dangerText` / `.warningText` | `toStrictEqual({ fg: '#ffffff', bg: '#000000' })` (achromatic, no `attrs`) | AR-P3 (RD "no bold") |

> Coupling guards `create-theme.spec` ST-8 and `presets.spec` ST-21 (existing) must stay green —
> they prove the roles are wired through every generation path. No edit to them.

### `Text.severity` — `packages/ui/test/text-severity.spec.test.ts`

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-U1 | `new Text('x')` painted on `defaultTheme` | every glyph cell has `staticText` fg (black) — unchanged | RD AC #2 / AR-26 |
| ST-U2 | `new Text('x', { severity: 'error' })` | every glyph cell has `dangerText` fg (`#ef4444`) | RD AC #2 / AR-27 |
| ST-U3 | `new Text('x', { severity: 'warning' })` | every glyph cell has `warningText` fg (`#f59e0b`) | RD AC #2 / AR-27 |

### `Input.placeholder` — `packages/ui/test/input-placeholder.spec.test.ts`

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-U4 | `Input({ value: signal(''), placeholder: 'Name' })`, width 10 | cols 1.. paint `Name` in muted style (`fg = staticText.fg`, `bg = inputNormal.bg`) | RD AC #3 / AR-28, AR-29 |
| ST-U5 | then `value.set('A')` | placeholder not painted; field shows `A` | RD AC #3 / AR-28 |
| ST-U6 | read the bound signal of an untouched placeholder field | `value() === ''` (never `'Name'`) | RD AC #3/#10 / AR-28 |
| ST-U7 | `placeholder: ''` over empty value | nothing extra painted (blank field) | RD AC #4 |
| ST-U8 | `placeholder` longer than the field width | clipped to `width - 1`; no cell beyond width; no wrap | RD AC #4 |
| ST-U9 | placeholder **and** severity-`Text` content `'a\x00b\x1b[31mc\x9b'` rendered | no painted cell has a code point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f` | RD AC #6/#10 / AR-22 |
| ST-U10 | `DatePicker({ value: signal(null), placeholder: 'YYYY-MM-DD' })` with empty text | the inner `Input` shows the placeholder | RD AC #5 / AR-30 |
| ST-U11 | `ComboBox({ …, editable: true, placeholder: 'Pick…' })`, empty text | the inner `Input` shows the placeholder | RD AC #5 / AR-30 |
| ST-U12 | `inputBox` opened with `placeholder`, empty value | its prompt `Input` shows the placeholder | RD AC #5 / AR-30 |

### Stories — `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (extend)

| #    | Input / Scenario | Expected | Source |
|------|------------------|----------|--------|
| ST-S1 | mount the placeholder demo (`controls/input`) + the severity demo | each has a unique id, required metadata, and paints ≥1 non-blank cell; the placeholder is visible over the empty field — assert it on an **unfocused** field (or a substring from col 2), so an auto-focused mount's caret reversing col 1 (see the impl caret case below) doesn't make the assertion brittle | RD AC #8 / kitchen-sink gate |

> **⚠️ AUTHORING RULE:** expectations above come from RD-09 + 03-01/03-02, not from imagined output.
> `inputBox` (ST-U12) mounts through the same modal host the existing `message-box` tests use; if no
> headless host is available for a *spec* test, ST-U12 drops to an impl test asserting the option
> threads into the constructed `Input`, and AC #5's `inputBox` clause is met there — recorded, not
> silently dropped.

## Test Categories

### Specification Tests (BEFORE implementation)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/core/test/severity-text-theme.spec.test.ts` | ST-C1…C4 | 03-01 roles |
| `packages/ui/test/text-severity.spec.test.ts` | ST-U1…U3 | `Text.severity` |
| `packages/ui/test/input-placeholder.spec.test.ts` | ST-U4…U12 | `Input.placeholder` + propagation |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` (extend) | ST-S1 | stories |

### Existing specs edited (sanctioned allowlist extension — NOT a spec rewrite)

| Test File | Edit |
| --------- | ---- |
| `packages/ui/test/feedback-theme.spec.test.ts` | append `dangerText`,`warningText` to `LATER_ADDITIVE_ROLES` (before `:141`) |
| `packages/ui/test/tabs-theme.spec.test.ts` | append to `LATER_ADDITIVE_ROLES` (before `:140`) |
| `packages/ui/test/date-theme.spec.test.ts` | append to `LATER_ADDITIVE_ROLES` (before `:156`) |
| `packages/ui/test/editor-theme.spec.test.ts` | append to the inline `LATER_ADDITIVE_ROLES` (`:159`) |
| `packages/ui/test/color-theme.spec.test.ts` | add both to the inlined `knownKeys` Set (before `:132`) |
| `packages/theme-designer/test/roles-panel.spec.test.ts` | **revise** the docstring premise (`:4-6`) + the two `(reserved)` assertions (`:16-17`) so danger/warning are **no longer** reserved (they now drive `dangerText`/`warningText`) |

> The five UI edits are the *sanctioned additive path* the tripwires' own comments authorise; every
> pre-existing byte assertion stays unchanged. The theme-designer `roles-panel.spec` edit is different
> in kind: this change *invalidates that oracle's stated premise* ("danger/warning drive no built-in
> role"), so revising it is the sanctioned oracle-follows-requirement update mandated by RD-09 AC #7,
> not a spec rewrite for convenience. Editing the `danger` alias in the designer now re-colours
> `dangerText` (`model.ts:84-85` + `setAlias`), so the `(reserved)` label would otherwise be false.

### Implementation Tests (AFTER implementation)

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `packages/ui/test/text-severity.impl.test.ts` | reactive `() => string` content + `severity` together; role-mapping table incl. `undefined` | Med |
| `packages/ui/test/input-placeholder.impl.test.ts` | `placeholder` as `Signal<string>` repaints an empty field; caret reverses col 1 over the placeholder; focused vs unfocused muted bg; `maxLength`/`validator` unaffected | High |

## Verification Checklist
- [ ] All ST-C/ST-U/ST-S cases defined with concrete input/output pairs (above)
- [ ] Every ST case traces to an RD AC / AR entry
- [ ] Spec tests written BEFORE implementation; verified to FAIL (red phase)
- [ ] All spec tests pass after implementation (green phase)
- [ ] The five inventory tripwires + coupling guards (`create-theme`, `presets`, `serialize-theme`,
      `view.drawcontext-role`) all green
- [ ] Impl tests written for the reactive/edge paths
- [ ] `yarn verify` green; `yarn check:deps` green (no new dep); `yarn check:docs` green

## AC → ST coverage matrix (RD-09 §Acceptance Criteria)

| RD AC | Covered by |
| ----- | ---------- |
| AC 1 (roles required, exact hex, override-flow, no alias-name clash) | ST-C1, ST-C2, ST-C3 |
| AC 2 (`Text.severity` role mapping; back-compat) | ST-U1, ST-U2, ST-U3 (+ build/typecheck) |
| AC 3 (placeholder muted/empty/first-char/never-in-value) | ST-U4, ST-U5, ST-U6 |
| AC 4 (empty + over-width boundaries) | ST-U7, ST-U8 |
| AC 5 (forward to DatePicker/ComboBox/inputBox) | ST-U10, ST-U11, ST-U12 |
| AC 6 (render-path sanitisation of both strings) | ST-U9 |
| AC 7 (own-guard + 5 tripwires + reserved-alias) | ST-C1/C2 + tripwire edits + roles-panel.spec **revised** (danger/warning no longer reserved) + `RESERVED_ALIASES` updated |
| AC 8 (stories + "63"→"67") | ST-S1 + count corrections + ST-C2 length guard |
| AC 9 (`yarn verify`/`check:docs` green; class `@example`s updated; no banned refs) | verify tasks (99 Phase 4) |
| AC 10 (security verified) | ST-U9, ST-U6 |
