# Preflight Report — RD-09 (Styled Error Text & Input Placeholder)

> ⚠️ **SAME-SESSION REVIEW** — RD-09 was authored in this same session by the same model that is
> now reviewing it. Systematic blind spots are likely; consider a fresh-session re-scan for full
> independence. To counteract bias, every claim below is grounded in the actual code via three
> independent read-only recon agents, and the three MAJOR findings were run past a fourth
> independent adversarial challenger before recommendations were recorded.

- **Artifact:** `requirements/RD-09-styled-error-text-input-placeholder.md` (+ register AR-25…32)
- **Type:** Requirements (single RD, extension of the jsvision-forms set)
- **Scan date:** 2026-07-15
- **Outcome:** ✅ **PASSED** — all 7 findings resolved and applied to RD-09 + the register (was
  BLOCKED on 3 MAJOR pending user decisions; decisions collected 2026-07-15).

---

## Codebase Context Summary (recon, all verified file:line)

- **Core theme roles** — `Theme` (`packages/core/src/engine/color/theme.ts:30`) has **65** roles
  (not the "63" stale doc-comments claim); role shape is `{ fg, bg, hotkey?, attrs? }` (RD says
  `{ fg, bg, attrs? }` — omits `hotkey?`). **No** `error`/`warning`/`danger`/`invalid`/`success`/
  `info` resolved role exists. `staticText = { fg: black, bg: lightGray }` (`theme.ts:293`).
- **Alias→role mapping** — `rolesFromAliases` (`roles.ts:39`) consumes 15/18 aliases; `danger`,
  `warning`, `info` are **dropped**; only `success` reaches a role (`indicatorDragging`,
  `roles.ts:107`). Confirms the RD's "half-wired alias" premise.
- **Alias defaults** — `create-theme.ts:117-120` seeds `danger:'#ef4444'`, `warning:'#f59e0b'`,
  `success:'#22c55e'`, `info:'#0ea5e9'`. Aliases are **required** in `ThemeColors` (`aliases.ts:64-72`).
- **`ThemeRoleName = keyof Theme`** (`packages/ui/src/view/types.ts:30`) → adding roles to the
  `Theme` interface auto-widens `ctx.color(role)`; **but** the compiler then *requires* the new
  roles in every full `: Theme` literal.
- **Text/Input** — `Text` ctor is `content: string | (() => string)` only (`text.ts:96`); `draw()`
  hardcodes `ctx.color('staticText')` (`text.ts:114`). `InputOptions = { value; maxLength?;
  validator? }` (`input.ts:33`), no placeholder; `draw()` delegates to `paintInput(ctx, s:
  InputPaintState)` — a **named interface** with the 6 fields (`input-render.ts:78`), not a bare
  object.
- **Sanitization** — two complementary layers: `sanitize()` drops ESC + C0(except tab/newline) + C1
  (`safety/sanitize.ts:42-52`); `ScreenBuffer.set()` spaces C0/DEL (`render/buffer.ts:158`). Every
  string reaches the buffer only via `ctx.text()`→`sanitize()`→`set()` — **no bypass path** on the
  public `DrawContext`. RD's AC #6 oracle is achievable; RD's Security §148 attribution (set→C0/DEL,
  sanitize→ESC/C1) is accurate.
- **theme-designer** — role rail is **derived** from `Object.keys(model.theme())`
  (`roles-panel.ts:56-62`), so new roles appear with **no code change** — but `RESERVED_ALIASES =
  {danger, warning}` (`roles-panel.ts:15`) creates a name collision (see PF-003).
- **Kitchen-sink** — story contract + smoke test confirmed; `forms.story` (rd RD-04) and
  `input.story` (rd RD-07) exist.

---

## Findings

### 🟠 PF-001 (MAJOR) — The "4 wrappers each own an inner `Input`" premise is wrong for 2 of 4; one real candidate is omitted
RD-09 (Must-Have bullet, AC #5, AR-30, Scope Decisions, Integration Points) states the placeholder
is forwarded by `DatePicker`/`ComboBox`/`ColorPicker`/`History` "the wrappers that expose an inner
`Input`". Verified against code:
- **`History` owns no `Input`** — the only `new Input(` in `dropdown/history.ts` is inside a JSDoc
  `@example` (line 46). It *borrows* a caller-supplied field (`link: Input`, `this.link = opts.link`,
  lines 61/71). Nothing to forward to.
- **`ColorPicker`'s hex `Input` is transient + gated** — built lazily inside `open()`/`buildContent`
  (`color-picker.ts:278`), only when `allowCustom` (line 276), rebuilt each open. It is not a
  persistent owned field, and it is a specialized `#rrggbb` editor where a generic placeholder is
  poor UX. (Note: my RD-era "never empty" reasoning was itself wrong — `colorToHex` returns `''` for
  `'default'` — so drop it on the *transient/gated/specialized* grounds, not "never empty".)
- **`DatePicker` + `ComboBox`** genuinely own a persistent inner `Input` with a meaningful empty
  state (`date-picker.ts:132-133`, `combo-box.ts:138/148`) — real candidates.
- **Omitted real candidate:** `inputBox()` (`dialog/message-box.ts:163`) is a modal prompt `Input`
  that typically starts empty — a placeholder is genuinely meaningful there.
- Caveat: DatePicker's field uses a `picture(mask)` validator that may already show a mask skeleton,
  making a placeholder partly redundant — a UX note for the plan, not a blocker.

**Options:** (a) rescope propagation to **DatePicker + ComboBox**, add **`inputBox`**, drop
History + ColorPicker; (b) DatePicker + ComboBox only; (c) keep all four (contradicts the code).
**Recommendation: (a).** The RD's list is wrong in both directions (2 non-candidates in, 1 candidate
out); (a) matches reality and keeps the feature useful.
**Confidence: High.** **Hardening:** independent challenger CONFIRMED; corrected the ColorPicker
rationale and confirmed inputBox.

### 🟠 PF-002 (MAJOR) — Theme-role integration surface is misdirected and incomplete
RD-09's Technical Requirements name "the generated presets + their round-trip oracle (see the
presets parity test)" as the site the plan must cover. Verified:
- **The round-trip oracle would NOT break** — `serialize.ts:33` derives `CANONICAL_ROLES =
  Object.keys(defaultTheme)`; the round-trip/parity specs (`serialize-theme.spec.test.ts:44/51`,
  `presets.impl.test.ts:44`, `create-theme.spec.test.ts:62`) are all key-derived and self-adapt.
- **The real mandatory edits** are three full `: Theme` literals that won't typecheck without the
  new roles: `defaultTheme` (`theme.ts:266`), `monochromeTheme` (`presets.ts:66`), and
  `rolesFromAliases`'s return (`roles.ts:40`). (Roles must be added as **required** members, matching
  every existing role.) The RD lists only `defaultTheme` + `rolesFromAliases`; **`monochromeTheme`
  is missing.**
- **Five UI inventory-tripwire specs break** and are unlisted: `packages/ui/test/{feedback,color,
  tabs,editor,date}-theme.spec.test.ts` each assert `Object.keys(defaultTheme)` has nothing beyond
  an allowlist (4 use a `LATER_ADDITIVE_ROLES` const; `color-theme` inlines it). Adding the roles
  makes `unexpected = ['error','warning']` → all 5 fail. Extending the allowlists is the **sanctioned**
  path (the comments cite RD-18/20/21 precedent) — not a spec-immutability violation.
- **Extra breakage under "derive from aliases":** wiring the roles from the `danger`/`warning`
  aliases means those aliases now *drive a role*, so theme-designer's `(reserved)` label becomes
  false — `theme-designer/test/roles-panel.spec.test.ts:16-17` + `RESERVED_ALIASES`
  (`roles-panel.ts:15`) must change.
- **Missing own-guard:** the tripwire comments say each additive RD "owns the byte-for-byte guard for
  its roles" — RD-09 should add its own spec pinning `error`/`warning` fg to `#ef4444`/`#f59e0b`.

**Options:** (a) replace the misdirected integration line with the accurate site list (3 literals +
5 tripwires + reserved-alias semantics + a new own-guard spec) and drop the round-trip-oracle claim;
(b) leave as-is. **Recommendation: (a)** — the plan's current-state analysis would otherwise chase a
test that won't break and miss 6 that will, producing a red-build surprise.
**Confidence: High.** **Hardening:** challenger CONFIRMED all counts exact; found the reserved-alias
break I'd missed.

### 🟠 PF-003 (MAJOR) — Role name `warning` collides with the existing `warning` alias
Adding a core `Theme` **role** named `warning` collides with the `warning` **alias**
(`aliases.ts:68`). Consequences (challenger judged this *understated*):
- theme-designer's derived rail would show **both** `α warning (reserved)` and `▸ warning`
  (`roles-panel.ts:29/62`).
- It breaks a real invariant: **no current role name equals any alias name** — `warning` would be
  the first collision (two-namespace separation is deliberate).
- The `error` role does **not** collide (differs from the `danger` alias) — so the RD's own
  `error`←`danger` / `warning`←`warning` naming is asymmetric, which is exactly what produces one
  collision and not the other.
- The public `severity` option value (`'error' | 'warning'`, AR-27) is **separate** from the
  internal role name and need not change.

**Options:** (a) keep role names `error`/`warning` (accept the collision, the misleading label, and
the invariant break); (b) **rename the roles to `dangerText`/`warningText`** (mirrors the alias
vocabulary + the `staticText` precedent, collides with neither alias), keeping the public
`severity: 'error' | 'warning'` ergonomics and mapping severity→role in `Text.draw()`; (c)
`errorText`/`warningText` (avoids collision but keeps the error-vs-danger vocabulary split).
**Recommendation: (b).** Load-bearing rule: role names must not equal alias names. Public API stays
semantic (`severity: 'error'|'warning'`); only the internal role identifiers change. This revises
user decisions AR-25/AR-27 on new information (the collision was not visible when they were made).
**Confidence: High.** **Hardening:** challenger CONFIRMED and judged the original finding understated.

### 🟡 PF-004 (MINOR) — AC #8 mis-states what `check:docs` enforces
AC #8 says the new `severity`/`placeholder` **options** must "carry `@example` JSDoc". But
`scripts/check-jsdoc.mjs` (Check B, lines 16-19/164-194) enforces `@example` only on exported
**classes/functions**; interfaces/`export type`s are exempt, and `InputOptions`/`TextOptions` are
`export type` (`controls/index.ts:16`). **Recommendation:** reword AC #8 — the gate requires the
`Text`/`Input` **class** `@example` blocks to stay valid and *demonstrate* the new options; it does
not enforce per-option examples. **Confidence: High** (grounded in the gate source).

### 🟡 PF-005 (MINOR) — Muted-placeholder style is "Should Have" but a Must-have AC depends on it
The composed muted style (`staticText` fg over `inputNormal` bg) is listed under **Should Have**
(RD §50), yet AC #3 (a required criterion) asserts the placeholder paints in exactly that style.
A Should-have cannot gate a Must acceptance criterion. **Recommendation:** move the muted-style
composition to **Must Have** (or relax AC #3). **Confidence: High** (internal inconsistency).

### 🟡 PF-006 (MINOR) — Stale "63 roles" strings will be doubly wrong after this RD
`Theme` already has **65** roles, but user-visible strings say "63": `theming.story.ts:70,97`
(a blurb *and* on-screen `Text`), `theme-designer/src/model/types.ts:32`,
`theme-designer/src/view/roles-panel.ts:2,38`, plus core doc-comments. Adding `error`/`warning`
makes the true count **67**. AC #7 covers only the placeholder/severity demo. **Recommendation:**
add a task to correct the visible role-count strings to 67 when the roles land (the doc-comments are
optional cleanup). **Confidence: High.**

### 🔵 PF-007 (OBSERVATION) — Role-bg precision + unspecified attrs
The RD's role table calls the `error`/`warning` bg "the container/dialog bg", but `staticText`'s bg
is a **fixed** `lightGray`, not a dynamic container lookup — on a non-gray surface a severity `Text`
paints a lightGray block (same behavior as today's `Text`, so not a regression). Also, no `attrs`
are specified for the new roles (⇒ plain red/amber, no bold) — confirm that's intended. Minor: the
RD's role shape `{ fg, bg, attrs? }` omits the optional `hotkey?` (new roles need only fg/bg).

---

## Pass/fail
✅ **PASSED** (2026-07-15). The three MAJOR findings were decided by the user and applied:
- **PF-003 → role names `dangerText`/`warningText`** (public `severity: 'error'|'warning'` unchanged);
- **PF-001 → propagation to `DatePicker` + `ComboBox` + `inputBox()`** (History/ColorPicker dropped);
- **PF-002 → integration surface rewritten** to the accurate sites (3 `: Theme` literals + 5 UI
  tripwire allowlists + reserved-alias semantics + a new own-guard spec; round-trip-oracle claim
  dropped).
- **PF-004/005/006/007** applied: AC #9 restates the `check:docs` scope; the muted-placeholder style
  moved to Must-Have; a Should-Have + AC #8 correct the stale "63"→"67" role-count strings; PF-007
  role-bg/`attrs` precision folded into Technical Requirements.

RD-09 and `00-ambiguity-register.md` (AR-25/27/30 + gate) were revised accordingly.

## Adversarial checklist (same-session safeguard)
- Behavior bound to an external standard? None — all claims are codebase-internal and cited.
- Did I verify against code rather than memory? Yes — 3 recon agents + 1 challenger, all with
  file:line.
- Biggest residual risk: the naming call (PF-003) reverses a prior user decision; surfaced explicitly
  for re-decision rather than silently applied.
