# RD-09: Styled Error Text & Input Placeholder

> **Document**: RD-09-styled-error-text-input-placeholder.md
> **Status**: Draft
> **Created**: 2026-07-15
> **Project**: jsvision Forms
> **Depends On**: — (independent UI/theme primitives; consumed by RD-05, RD-06, RD-08)
> **CodeOps Skills Version**: 3.7.0

---

## Feature Overview

Two presentation primitives that make forms (and the wider widget set) read well: a way to paint
text in a **semantic severity colour** (a danger-red error, an amber warning), and a **placeholder**
for the `Input` line editor. Today neither exists — `Text`/`Label` hard-code the `staticText` theme
role and accept no colour, the resolved `Theme` has no danger/warning *text* role at all (the `danger`/
`warning` colours live only as unused theme *aliases*), and `Input` has no placeholder option. So a
form's validation error is the same colour as its help text, and an empty field shows nothing about
what belongs there.

This RD closes that gap at the framework level so every downstream slice — the async-validation
error/"checking…" states (RD-06), the modal `formDialog` (RD-08), and the comprehensive showcase
(RD-05) — inherits proper error styling and placeholders for free. It is deliberately **presentation
only**: the store/validation engine is untouched, and the touched-gated reveal
(`field.touched() && field.error()`) stays app-composed exactly as the current showcase already does.

---

## Functional Requirements

### Must Have
- [ ] Two new semantic theme roles on `@jsvision/core`'s `Theme`: **`dangerText`** and
      **`warningText`**, derived from the existing `danger` / `warning` theme aliases
      (default fg `#ef4444` / `#f59e0b`). Role names deliberately differ from the `danger`/`warning`
      **alias** names — no role name may equal an alias name (a deliberate two-namespace separation).
- [ ] `createTheme({ danger, warning })` overrides flow through to the `dangerText` / `warningText`
      roles.
- [ ] `Text` gains an optional **`severity?: 'error' | 'warning'`** (the public value stays
      semantic); when set it paints via the matching role (`'error'`→`dangerText`,
      `'warning'`→`warningText`); when absent it paints via `staticText` exactly as today
      (backward compatible).
- [ ] `Input` gains an optional **`placeholder?: string | Signal<string>`**, painted in a muted style
      **whenever the bound value is empty** (regardless of focus) and gone after the first character.
- [ ] The placeholder muted style is composed from existing roles (`staticText` fg over
      `inputNormal` bg) — no bespoke `inputPlaceholder` role — themeable by inheritance, reliable
      across colour depths.
- [ ] The placeholder text is **never** part of the bound value — reading/submitting an untouched
      field yields `''`, not the placeholder.
- [ ] Placeholder propagation: forward a `placeholder` option to the Inputs that genuinely own a
      persistent field with a meaningful empty state — **`DatePicker`**, **`ComboBox`**, and the
      **`inputBox()`** modal prompt. (`History` owns no `Input`; `ColorPicker`'s hex field is a
      transient, `allowCustom`-gated, specialised `#rrggbb` editor — both excluded — PF-001.)
- [ ] Both new strings (severity `Text` content, `Input` placeholder) render through the existing
      control-byte sanitisation path (no raw C0/DEL/C1 reaches the buffer).
- [ ] The five UI inventory-tripwire specs that allowlist the role set have their allowlists extended
      (the sanctioned additive-role path), and theme-designer's `RESERVED_ALIASES` +
      `roles-panel.spec.test.ts` are updated because the `danger`/`warning` aliases now drive roles.
- [ ] Kitchen-sink stories updated to demonstrate the placeholder and severity-coloured text, each
      passing the headless smoke test.

### Should Have
- [ ] Correct the user-visible "63 roles" strings (already stale — the code has 65) to **67** when
      the two roles land: `theming.story.ts` blurb + on-screen `Text`, and the theme-designer
      role-count labels. (Core doc-comments saying "63" are optional cleanup.)

### Won't Have (Out of Scope)
- Per-field `field.reset()` — a store concern, deferred (GH #89 / a later store RD) — AR-31.
- `success` / `info` theme roles — only `dangerText` + `warningText` are needed now; add later if a
  use lands.
- A dedicated `inputPlaceholder` theme role — the composed muted style covers it (AR-29).
- Placeholder forwarding on `History` (owns no `Input`) or `ColorPicker` (transient/gated/specialised
  hex field) — PF-001.
- Reactive `severity` (a `() => Severity` getter) — content is already reactive; severity is static.
- A `@jsvision/forms` error-display helper — the app composes the touched-gated reveal (AR-32).

---

## Technical Requirements

### Semantic theme roles (`@jsvision/core`)

The `danger` / `warning` **aliases** already exist with defaults (`create-theme.ts:117-120` seeds
`danger: '#ef4444'`, `warning: '#f59e0b'`) but are never consumed into a `Theme` role
(`rolesFromAliases` drops them). This RD *promotes* them into two real roles, named to avoid the
alias names:

| Role | fg (default) | bg (default) | Notes |
|------|--------------|--------------|-------|
| `dangerText` | `c.danger` (`#ef4444`) | `lightGray` (matches `staticText.bg`) | danger-red body text |
| `warningText` | `c.warning` (`#f59e0b`) | `lightGray` (matches `staticText.bg`) | amber advisory text |

Roles are added as **required** members of `Theme` (matching every existing role); fg is sourced from
the aliases so `createTheme` overrides flow through; `attrs` is unset (plain colour, no bold). The bg
is `staticText`'s fixed `lightGray` — so, exactly like today's `Text`, a severity `Text` assumes the
grey-dialog surface; on a non-grey surface its bg block behaves as a plain `Text` does (not a
regression).

**Integration surface — the plan's current-state analysis must cover each (verified file:line):**
- **Three full `: Theme` literals** that will not typecheck until they carry the new required roles:
  `defaultTheme` (`color/theme.ts:266`), `monochromeTheme` (`color/presets.ts:66`), and
  `rolesFromAliases`'s return (`color/roles.ts:40`).
- **`createTheme` / alias plumbing** (`color/create-theme.ts`) — fg must reach the roles from
  `c.danger` / `c.warning`.
- **Five UI inventory-tripwire specs** that allowlist the role set and fail until extended (the
  *sanctioned* additive path per their own comments): `packages/ui/test/{feedback,color,tabs,editor,
  date}-theme.spec.test.ts` (four extend a `LATER_ADDITIVE_ROLES` const; `color-theme` inlines the
  allowlist).
- **theme-designer reserved-alias semantics** — because the `danger`/`warning` aliases now drive
  roles, their `(reserved)` label is no longer accurate: update `RESERVED_ALIASES`
  (`theme-designer/src/view/roles-panel.ts:15`) and `roles-panel.spec.test.ts:16-17`. (The rail is
  key-derived and shows the new roles with no other code change.)
- **A new own-guard spec** pinning `dangerText`/`warningText` fg to `#ef4444`/`#f59e0b` (each
  additive-role RD "owns the byte-for-byte guard for its roles").
- **Not** a concern: the serialize/round-trip parity oracles derive from `Object.keys(defaultTheme)`
  (`serialize.ts:33`) and self-adapt — they need **no** editing.

Core stays zero runtime deps (theme is pure TS).

### `Text` severity (`@jsvision/ui`)

`Text`'s constructor gains an optional second argument (the public value stays semantic —
`'error'`/`'warning'` — decoupled from the internal role names):

```ts
type TextSeverity = 'error' | 'warning';
interface TextOptions { severity?: TextSeverity }
// new Text(content) — unchanged; new Text(content, { severity: 'error' }) — danger-red
constructor(content: string | (() => string), opts?: TextOptions)
```

`draw()` maps severity → role — `'error'`→`dangerText`, `'warning'`→`warningText`, unset→`staticText`
— then `ctx.color(role)`. Everything else (reactive `() => string` content, `wrapText`, fill) is
unchanged.

### `Input` placeholder (`@jsvision/ui`)

`InputOptions` gains `placeholder?: string | Signal<string>`, threaded into the `paintInput` render
helper via a new `placeholder` field on its `InputPaintState` interface (`input-render.ts:14`). When
the bound value is `''`, paint the placeholder (resolved from string-or-signal) in the muted style
`{ fg: staticText.fg, bg: inputNormal.bg }`, clipped to the field width; when the value is non-empty,
paint nothing extra. The placeholder participates in **no** edit/selection/scroll math — it is
display-only over an empty field.

Propagation (per PF-001): only Inputs that genuinely own a persistent field with a meaningful empty
state get the forwarded option — **`DatePicker`** (`DatePickerOptions` → its inner `Input`),
**`ComboBox`** (`ComboBoxOptions` → both editable/select-only branches), and the **`inputBox()`**
modal prompt (`InputBoxOptions` → its bare `Input`). Excluded: `History` (owns no `Input` — the app
sets a placeholder on the field it passes in via `opts.link`) and `ColorPicker` (its hex `Input` is
transient, `allowCustom`-gated, and a specialised `#rrggbb` editor). Note DatePicker's `picture(mask)`
validator may already render a mask skeleton, so a placeholder there is partly redundant — still
supported.

---

## Integration Points

### With RD-05 (Comprehensive Forms Showcase)
The showcase renders validation errors via `Text` `severity: 'error'` and app-level advisory
warnings via `severity: 'warning'` (amber), and uses `Input` placeholders for its text fields.

### With RD-06 (Async Validation) / RD-08 (formDialog)
Async error and "checking…" states, and the modal form dialog, reuse the styled `Text` for their
error rows — no bespoke colouring.

### With the existing widget set & theming
Additive, backward-compatible: `new Text(content)` and existing `Input({ value })` calls are
unaffected; existing themes gain the new roles with defaults from their `danger`/`warning` aliases.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|----------|-------------------|--------|-----------|--------|
| Danger/advisory colour model | (a) semantic core roles · (b) hardcoded raw colour · (c) reuse an existing role | Add `dangerText` + `warningText` **core theme roles** from the existing aliases | Themeable + consistent; powers error text AND the showcase's amber advisories; completes a half-wired alias design | AR-25 |
| Role naming | (a) `error`/`warning` · (b) `dangerText`/`warningText` · (c) `errorText`/`warningText` | **`dangerText`/`warningText`** | A role named `warning` would collide with the existing `warning` **alias** (dup row in theme-designer; breaks the no-role-name=alias-name invariant); this mirrors the alias vocabulary + the `staticText` precedent | AR-25 / AR-27 |
| Styled-error primitive shape | (a) extend `Text` · (b) new `ErrorText` · (c) new `StyledText` | **Extend `Text`** with an optional `severity` | Smallest new surface; one primitive covers error + advisory; touched-gating stays app-side | AR-26 |
| Severity option type | semantic `'error'\|'warning'` vs general `role`/`style` bag | Semantic **`severity?: 'error' \| 'warning'`** (public), mapped to roles `dangerText`/`warningText` | Purpose-built, avoids speculative surface (feature guardrail); public value stays semantic, decoupled from role names | AR-27 |
| Placeholder visibility | (a) whenever empty · (b) only when empty + unfocused | **Whenever the value is empty** (gone on first char) | Dominant modern convention; clearest | AR-28 |
| Placeholder styling | new `inputPlaceholder` role vs composed muted style | **Composed muted style** (`staticText` fg over `inputNormal` bg) | Bounds the core change to the two severity roles; themeable by inheritance; reliable across depths | AR-29 |
| Placeholder propagation | (a) Input-only · (b) all "4 wrappers" · (c) only Inputs with an owned field + meaningful empty state | **`DatePicker` + `ComboBox` + `inputBox()`** | Matches the code: `History` owns no `Input`, `ColorPicker`'s is transient/gated/specialised; those are excluded, and the modal prompt is added | AR-30 |
| Per-field `field.reset()` | include vs defer | **Defer** (out of RD-09) | A store concern that reopens the locked Field handle (AR-14); keeps RD-09 a cohesive UI-primitive slice | AR-31 |
| Package span | — | `@jsvision/core` (roles) + `@jsvision/ui` (Text/Input) + `@jsvision/examples` (stories); **no forms change** | Presentation primitives; core stays zero-dep | AR-32 |

> **Traceability:** every decision references `00-ambiguity-register.md` (AR-25…AR-32).

---

## Security Considerations

- **Data sensitivity**: none — placeholder and severity-text strings are developer-supplied display
  copy, not user secrets/PII.
- **Input validation**: the placeholder is display-only and never enters the bound value, so it
  cannot be submitted or mistaken for user input.
- **Injection risks**: both new strings render through the existing sanitising path
  (`ScreenBuffer.set` replaces C0/DEL, `sanitize()` drops ESC/C1) — a placeholder or severity string
  carrying control bytes cannot paint a raw control cell. This is asserted by an oracle (below),
  mirroring RD-04's render-path contract. No `eval`/dynamic code; no shell/SQL/path surface (TUI).
- **Authentication & authorization / rate limiting / encryption / infrastructure**: N/A — an
  in-process rendering primitive with no I/O, endpoints, or persistence.

---

## Acceptance Criteria

1. [ ] `@jsvision/core` exposes `dangerText` and `warningText` as **required** roles on the resolved
       `Theme`; on `defaultTheme` their fg is exactly `#ef4444` and `#f59e0b` (from the
       `danger`/`warning` aliases), and `createTheme({ danger: '#c00', warning: '#fa0' })` makes the
       `dangerText`/`warningText` role fg exactly `#c00` / `#fa0`. Neither role name equals any
       `ThemeColors` alias name.
2. [ ] `new Text('x')` paints in the `staticText` role (unchanged); `new Text('x', { severity: 'error' })`
       paints every glyph with the `dangerText` role's fg, and `{ severity: 'warning' }` with the
       `warningText` role's fg (verified by reading the rendered cell attrs); existing
       `new Text(content)` call sites compile and render identically.
3. [ ] With `new Input({ value })` where `value()` is `''` and `placeholder: 'Name'`, the field paints
       `Name` in the muted style (`staticText` fg over `inputNormal` bg); after the value becomes
       `'A'`, the placeholder is not painted; the bound `value()` is `'A'` (never `'Name'`).
4. [ ] Boundary: an empty placeholder paints nothing; a placeholder longer than the field width is
       clipped to the width (no overflow/wrap).
5. [ ] `DatePicker`, `ComboBox`, and `inputBox()` each accept and forward a `placeholder` down to the
       `Input` they own, shown when that field is empty. (`History` and `ColorPicker` are out of scope
       for propagation — PF-001.)
6. [ ] A placeholder or severity-`Text` string of `'a\x00b\x1b[31mc\x9b'` paints no cell with a code
       point `< 0x20`, `=== 0x7f`, or in `0x80–0x9f` (render-path sanitisation, per RD-04's contract).
7. [ ] The two new roles ship with their guards: a new own theme spec pins `dangerText`/`warningText`
       fg to `#ef4444`/`#f59e0b`; the five UI inventory-tripwire specs
       (`{feedback,color,tabs,editor,date}-theme.spec.test.ts`) have their allowlists extended so they
       pass; theme-designer's `RESERVED_ALIASES` + `roles-panel.spec.test.ts` are updated for the
       now-consumed `danger`/`warning` aliases.
8. [ ] Kitchen-sink stories: `input.story` shows a placeholder; a story shows `severity: 'error'` +
       `'warning'` coloured text; both pass `kitchen-sink.smoke.spec.test.ts`. The user-visible
       "63 roles" count strings are corrected to **67** (`theming.story.ts` blurb + on-screen `Text`;
       theme-designer role-count labels).
9. [ ] `yarn verify` is green; `yarn check:docs` passes — the `Text` and `Input` **class** `@example`
       blocks are updated to demonstrate `severity` and `placeholder` (the gate enforces `@example`
       on exported classes/functions, **not** on the `TextOptions`/`InputOptions` type interfaces,
       which are `export type` and exempt); no banned CodeOps/TV references in shipped code.
10. [ ] Security requirements verified (render-path control-byte sanitisation of both new strings;
       placeholder excluded from the bound value).
