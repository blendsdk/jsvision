# Current State: Styled Text Severity & Input Placeholder

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

All line numbers verified against the branch at plan time (`feat/forms`). Where the plan threads a
new option, the exact target line is given.

## Existing Implementation

### What exists — core theming (`@jsvision/core`)

- **`Theme`** is a flat interface of **65** required roles, each `ThemeRole = { fg, bg, hotkey?, attrs? }`
  (`color/theme.ts:15-27` role shape; interface `theme.ts:30-246`). No `dangerText`/`warningText`/
  `error`/`warning`/`danger`/`success`/`info` role exists. `staticText = { fg: black, bg: lightGray }`
  (`theme.ts:293`).
- **`defaultTheme`** (`theme.ts:266-352`) is the hand-authored DOS-16 literal — every role a
  `PALETTE.*` token pair. **`monochromeTheme`** (`presets.ts:66-132`) is the achromatic literal
  (`W`/`B`/`G` only, state shown via `attrs`). **`rolesFromAliases`** (`roles.ts:39-113`) builds a
  full `Theme` from the 18 `ThemeColors` aliases — the generator behind every `createTheme` preset.
  All three are full `: Theme` literals, so the compiler forces every role into each.
- **The `danger`/`warning` aliases already exist and are already seeded** — `aliasesFromSeeds`
  sets `danger: options.danger ?? '#ef4444'`, `warning: options.warning ?? '#f59e0b'`
  (`create-theme.ts:117-118`); both are **required** members of `ThemeColors`. But `rolesFromAliases`
  **never consumes** `c.danger`/`c.warning` — only `c.success` reaches a role
  (`indicatorDragging`, `roles.ts:107`). So the aliases are a half-wired design: seeded, overridable,
  but driving nothing. Their doc-comments say so — `create-theme.ts:31,33`: *"Reserved for app
  content — drives no built-in role."*
- **`createTheme`** merges `aliasesFromSeeds(options)` with `options.overrides`, then calls
  `rolesFromAliases` (`create-theme.ts:156-159`). So **any `danger`/`warning` override already
  reaches `rolesFromAliases`'s input** — the only missing link is the two roles inside it.

### What exists — UI controls (`@jsvision/ui`)

- **`Text`** (`controls/text.ts`) — ctor is `constructor(content: string | (() => string))`
  (`text.ts:96`), no options; `draw()` hard-codes `const style = ctx.color('staticText')`
  (`text.ts:114`) and paints wrapped lines with it. Reactive `() => string` content already repaints
  via `this.bind(content)` on mount (`text.ts:102`).
- **`Input`** (`controls/input.ts`) — `InputOptions = { value; maxLength?; validator? }`
  (`input.ts:33-40`), no placeholder. `draw()` delegates to `paintInput(ctx, { value, focused,
  selStart, selEnd, curPos, firstPos })` (`input.ts:180-188`). The value binding on mount
  (`input.ts:132-147`) is the model for reactive re-paint.
- **`paintInput`** (`controls/input-render.ts:78-105`) fills the field with the focus/normal role,
  paints the scrolled value at column 1, edge arrows, selection band, and a reversed-cell caret.
  Its state is the named interface **`InputPaintState`** (`input-render.ts:14-27`) — 6 readonly
  fields. There is **no** placeholder concept.
- **Input-owning wrappers** (recon-verified thread points):
  - `DatePicker` — `DatePickerOptions` (`date/date-picker.ts:55-74`); inner Input at
    **`date-picker.ts:133`** `new Input({ value: this.text, validator: picture(this.spec.mask), maxLength: … })`.
  - `ComboBox` — `ComboBoxOptions<T>` (`dropdown/combo-box.ts:35-54`); single inner Input (ternary,
    both branches) at **`combo-box.ts:148`**.
  - `inputBox()` — `InputBoxOptions` (`dialog/message-box.ts:40-49`), fn at `message-box.ts:156`;
    inner Input at **`message-box.ts:161`** (first arg to `at(…)`).
  - **Excluded** (AR-30/PF-001): `History` owns no runtime Input — its only `new Input(` is a JSDoc
    `@example` (`dropdown/history.ts:46`); it borrows `opts.link` (`history.ts:71`). `ColorPicker`'s
    hex Input is lazy + `allowCustom`-gated inside `open()` (`color/color-picker.ts:276-278`).

### What exists — guards, theme-designer, stories

- **Five UI inventory tripwires** assert `Object.keys(defaultTheme)` holds nothing beyond an
  allowlist. Four use a `LATER_ADDITIVE_ROLES` const, one inlines it. Each carries a comment that
  extending the allowlist for a *later, sanctioned additive RD* is explicitly allowed and does not
  weaken its own guarantee (`feedback-theme.spec.test.ts:118-122`, mirrored in the others).
- **theme-designer** derives its role rail from `Object.keys(model.theme())` (`roles-panel.ts:57`),
  so the two new **roles** appear on the rail with **no rail-code change**. **But** the `(reserved)`
  **alias** annotation must change: `RESERVED_ALIASES = new Set(['danger','warning'])`
  (`roles-panel.ts:15`) suffixes those alias rows `(reserved)`, and its docstrings (`roles-panel.ts:12,19`)
  + the spec oracle (`test/roles-panel.spec.test.ts:4-6,16-17`) justify it as "danger/warning **drive
  no built-in role** → editing them changes nothing." Once `rolesFromAliases` consumes `c.danger`/
  `c.warning`, that premise is false: `setAlias('danger', c)` forces derive mode and re-runs
  `createTheme({overrides:{danger:c}})` → `rolesFromAliases` → `dangerText.fg = c` (`model.ts:84-85`
  + `setAlias`), so **editing the `danger` alias now recolours `dangerText`**. Per RD-09 AC #7, drop
  `danger`/`warning` from `RESERVED_ALIASES` (aliases that drive a role are not reserved — exactly like
  `success`, `roles.ts:107`), correct the `roles-panel.ts:12,19` docstrings, and revise
  `roles-panel.spec.test.ts` so it asserts danger/warning are **no longer** reserved. Keeping the
  label would ship a claim the plan simultaneously scrubs from core (`create-theme.ts:31,33`,
  `aliases.ts:65,67`). See 03-01/07/99.
- **Coupling guards that auto-adapt** (pass once the roles are threaded through generation — no edit,
  but must stay green): `core/test/create-theme.spec.test.ts:61-63` (ST-8: `rolesFromAliases`
  contains every `defaultTheme` key), `core/test/presets.spec.test.ts:62-66` (ST-21: every preset
  does too), `core/test/serialize-theme.spec.test.ts:51` (key-set round-trip), and
  `ui/test/view.drawcontext-role.impl.test.ts:26` (loops all keys).
- **Own-guard convention:** per-role byte-for-byte specs pin `toStrictEqual({fg,bg})`. Core-role
  guards live in `packages/core/test/` (e.g. `slider-theme.spec.test.ts:19-27`); UI-added-role guards
  live in `packages/ui/test/`. The two new roles are **core** roles → their guard belongs core-side.
- **Stories** (`packages/examples/kitchen-sink/`) — `Story = { id, category, title, blurb, rd?, build }`
  (`stories/story.ts:37-56`). `input.story.ts` (id `controls/input`), `theming.story.ts` (id
  `theming/presets`), `forms.story.ts` (id `forms/form`) all exist. The smoke test
  (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`) requires each story to have truthy
  `id`/`category`/`title`/`blurb`, unique ids, and to paint ≥1 non-blank cell; it asserts **no** role
  count.

## Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/core/src/engine/color/theme.ts` | `Theme` interface + `defaultTheme` literal | Add `dangerText`/`warningText` to the interface + the literal (fg `#ef4444`/`#f59e0b`, bg `PALETTE.lightGray`) — 03-01 |
| `packages/core/src/engine/color/roles.ts` | `rolesFromAliases` generator | Map `c.danger`/`c.warning` into the two roles (bg `c.backgroundRaised`) — 03-01 |
| `packages/core/src/engine/color/presets.ts` | `monochromeTheme` literal | Add the two roles achromatic (`{fg:W,bg:B}`, attrs unset) — 03-01 |
| `packages/core/src/engine/color/create-theme.ts` | alias seeding + doc | **No logic change**; correct the stale `danger?`/`warning?` "drives no built-in role" doc (`:31,33`) — 03-01 / AR-P4 |
| `packages/core/src/engine/color/aliases.ts` | alias docs + "63" strings | Correct role-count prose (`:3,9,18`) — 03-03 |
| `packages/core/src/engine/color/index.ts` | barrel doc | Correct "63 roles" (`:35`) — 03-03 |
| `packages/ui/src/controls/text.ts` | `Text` | Add `TextSeverity`/`TextOptions`; `severity` ctor arg; map severity→role in `draw()`; update the class `@example` — 03-02 |
| `packages/ui/src/controls/index.ts` · `packages/ui/src/index.ts` | UI barrels | Re-export `TextOptions`/`TextSeverity` (sibling convention — every control's Options type is barrel-exported; today the barrel exports `Text` but no `Text*Options`) — 03-02 |
| `packages/ui/src/controls/input.ts` | `Input` | Add `InputOptions.placeholder`; resolve + subscribe; pass to `paintInput`; update the class `@example` — 03-02 |
| `packages/ui/src/controls/input-render.ts` | `paintInput` / `InputPaintState` | Add `placeholder?: string`; paint it muted when value empty — 03-02 |
| `packages/ui/src/date/date-picker.ts` | `DatePicker` | Add `placeholder` option; forward at `:133` — 03-02 |
| `packages/ui/src/dropdown/combo-box.ts` | `ComboBox` | Add `placeholder` option; forward at `:148` — 03-02 |
| `packages/ui/src/dialog/message-box.ts` | `inputBox()` | Add `placeholder` to `InputBoxOptions`; forward at `:161` — 03-02 |
| `packages/ui/test/{feedback,tabs,date,editor,color}-theme.spec.test.ts` | inventory tripwires | Extend each allowlist with the two role names (sanctioned) — 07 |
| `packages/theme-designer/src/view/roles-panel.ts` | designer rail + reserved-alias label + "63" prose | No rail change; **drop `danger`/`warning` from `RESERVED_ALIASES` (`:15`)** + correct the reserved docstrings (`:12,19`); correct role-count prose (`:2,38`) — 03-01/03-03 |
| `packages/theme-designer/test/roles-panel.spec.test.ts` | reserved-alias spec oracle | Revise the docstring premise + the two `(reserved)` assertions (`:4-6,16-17`) so danger/warning are **no longer** reserved (they now drive roles) — 07 |
| `packages/theme-designer/src/model/types.ts` | designer doc | Correct "63" prose (`:7,32`) — 03-03 |
| `packages/examples/kitchen-sink/stories/input.story.ts` | Input story | Demonstrate a placeholder — 03-03 |
| `packages/examples/kitchen-sink/stories/theming.story.ts` | Theming story | Add a severity demo (or a sibling story); correct "63"→"67" (`:70,97`) — 03-03 |
| **NEW** `packages/core/test/severity-text-theme.spec.test.ts` | own-guard | Pin `dangerText`/`warningText` fg + `Object.keys(defaultTheme).length === 67` — 07 |
| **NEW** `packages/ui/test/text-severity.spec.test.ts`, `input-placeholder.spec.test.ts` (+ impl) | new specs | ST-cases for `Text.severity` + `Input.placeholder` — 07 |

## Gaps Identified

### Gap 1: No severity text role
**Current:** `Text` always paints `staticText`; the `Theme` has no danger/warning text role.
**Required:** two required roles `dangerText`/`warningText` from the `danger`/`warning` aliases; a
`Text.severity` option that selects them. **Fix:** 03-01 + 03-02.

### Gap 2: No placeholder
**Current:** an empty `Input` shows nothing. **Required:** a muted placeholder over an empty value,
never part of the bound value, forwarded to `DatePicker`/`ComboBox`/`inputBox`. **Fix:** 03-02.

### Gap 3: Stale role-count copy
**Current:** user-visible strings say "63 roles" — **already wrong** (the true count is **65**).
**Required:** correct to **67** when the two roles land, and pin the count mechanically so it can't
drift again. **Fix:** 03-03 + the `length === 67` guard in 07. See the reconciliation note below.

> **Role-count reconciliation (do not skip):** the strings say **63**, reality is **65**
> (`Object.keys(defaultTheme).length`), and the post-RD target is **67**. The "63" was authored two
> roles ago and never updated. The plan corrects every "63" to **67** and adds a `length === 67`
> assertion so the number is guarded, not hand-maintained.

## Dependencies

### Internal
- `Text`/`Input` depend on `DrawContext.color(role)` resolving the new roles — automatic, since
  `ThemeRoleName = keyof Theme` (`ui/src/view/types.ts:30`) widens the moment the roles land in the
  interface.
- Placeholder forwarding depends only on the three wrappers' own Input construction sites.

### External
- None. Core stays zero runtime deps (theme is pure TS); `zod`/`@jsvision/forms` are **not** touched
  (AR-32).

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Adding a **required** role breaks a `: Theme` literal or a coupling guard the plan missed | Low | Med (red build) | 03-01 enumerates all three literals + recon confirmed the coupling guards auto-adapt; the red→green ordering catches any miss |
| `defaultTheme` mixing a hex fg (`#ef4444`) into an otherwise DOS-16 palette theme | Low | Low | Intentional — AC #1 pins `#ef4444` on `defaultTheme` and keeps it identical to the `createTheme` default; hex downsamples to red at low depth |
| Placeholder-as-`Signal` not repainting on change | Low | Low | AR-P5: subscribe on mount when a signal is passed, mirroring the value binding |
| DatePicker mask skeleton makes a placeholder partly redundant | Known | Low | Supported anyway; documented UX note (RD §150) — not a blocker |
