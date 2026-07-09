# Preflight Report — RD-22 (Theming)

> **Artifact**: `requirements/RD-22-theming.md`
> **Scanned**: 2026-07-08 · **Skill**: preflight 3.3.2 · **Iteration**: 1
> **Codebase-grounded**: yes (core `color/`, ui `view/`, `event/`, `app/`)
> **Outcome**: ✅ PASSED — all 6 findings resolved and folded into RD-22 (AR-279…AR-283), 2026-07-08

⚠️ **Independence note**: RD-22 was authored 2026-07-08; this scan runs in a fresh (`/clear`)
session. Standard's-cited claims below are checked against the actual code, not memory.

---

## Codebase Context Summary

RD-22 is **accurately grounded** in the real code on its core claims — an unusually clean RD:

| RD claim | Verified against | Status |
|---|---|---|
| `themeRoleToStyle` returns `{fg,bg}`; add `attrs` pass-through | `packages/ui/src/view/theme-style.ts:15` | ✅ accurate — additive |
| `Style.attrs?: AttrMask`, `Attr.*` bits exist | `packages/core/src/engine/render/types.ts:33,40,56` | ✅ accurate |
| `RenderRootImpl.theme` is `readonly` → make mutable behind `setTheme` | `render-root.ts:225` (`private readonly theme`) | ✅ accurate |
| Reuse `fullCompose` for the swap; `originOf` exists | `render-root.ts:367,426` | ✅ accurate |
| `defaultTheme` byte-unchanged; golden-screen is the oracle | `theme.ts:249-333` (attr-free literal) | ✅ accurate |
| `toRgb` is the single color-validation boundary | `color.ts:66` | ✅ accurate |
| Draw path honours `Style.attrs` (so the attrs axis renders end-to-end) | `draw-context.ts:184` `color()`→`themeRoleToStyle`; `shadow()`:163 applies attrs; `buffer` writers store `cell.attrs` | ✅ feasible |

The `Theme` interface has **63 roles** (several with `border`/`title`/`icon`/`pattern` extras → ~70–78
mappable slots — the RD's "~70" is defensible when extras are counted). The findings below are
edge/consistency/completeness gaps, not foundational errors.

---

## Findings

### 🟠 PF-001 — Hot-swap won't reach the terminal when `setTheme` is called outside an input tick (MAJOR)

**Dimension**: 13 (Architecture Mismatch) / 6 (Feasibility)

The RD says the ui edits are only `render-root.ts` (add `setTheme`) and `application.ts`
(`Application.setTheme` "forwards to the loop's render root") — **no event-loop edit**. But under
an `Application`, the loop builds the `RenderRoot` with a **deferring scheduler** so *the loop* drives
`flush()` and hands the frame to the host via `onFrame` (CLAUDE.md; `event-loop.ts:189-206`). A frame
only reaches the terminal when the loop calls `renderRoot.flush()` **and** `this.onFrame?.(buffer())`
— exactly what `resize()` does explicitly (`event-loop.ts:234,243`).

Under the loop the render root is built with a **no-op `schedule`** (`event-loop.ts:193` — "the
loop drives flush itself, so the render root must not self-repaint"). So `renderRoot.setTheme()`
changes the theme and marks dirty but **does not repaint**; the frame is emitted only by a `runTick`,
which ends with `flush()`+`onFrame()` (`:367-368`), or by `resize()` (`:234,243`).

**The nuance** (verified): a `setTheme` call **from inside a tick** (e.g. an `onCommand` handler, the
normal designer path where a keypress cycles the seed) *does* repaint — the surrounding tick's
trailing `flush`+`onFrame` pushes it. The gap is a **bare imperative / async call**
(`app.setTheme(x)` at top level, from a `setInterval`, a promise callback): it marks dirty into the
no-op schedule and **the terminal shows the old theme until the next input tick**. Since
`Application.setTheme` is a public imperative API, this is a live footgun and it undermines the
robust reading of AC-13/AC-15.

**Evidence**: no-op schedule `event-loop.ts:186-195`; tick flush+push `:367-368`; resize push `:234,243`.

**Options**
- **(a) [Recommended]** Spec an `EventLoop.setTheme(theme)` seam that wraps the swap in `runTick`
  (`this.runTick(() => this.renderRoot.setTheme(theme))`) — reusing the tick's trailing
  `flush`+`onFrame` push for free, exactly as `resize()`/`healFocus` already do. `Application.setTheme`
  forwards to it. Add `event/event-loop.ts` to the Module-layout edit list. Smallest correct change;
  guarantees a repaint regardless of call context.
- **(b)** Have `RenderRoot.setTheme` itself call `flush()` synchronously **and** invoke the loop's
  `onFrame`. Rejected: the render root does not own `onFrame` (the loop does), so it would need a
  back-reference it doesn't have — a layering inversion.
- **(c)** Document that `setTheme` only takes visual effect on the next tick. Rejected: breaks the
  live-designer headline feature.

**Recommendation**: (a). One added module edit; the RD's "forwards to the loop's render root" phrasing
becomes "forwards to a loop `setTheme` seam that recomposes **and pushes the frame to the host**".

---

### 🟠 PF-002 — `foregroundOnAccent` and `accentForeground` are undefined near-synonyms in the 17-token alias set (MAJOR)

**Dimension**: 1 (Ambiguity) / 12 (Consistency) / 4 (Completeness)

The alias set (AR-266) is the RD's **central deliverable and public API**, yet no token's *meaning* is
defined — only names are listed. Two of them collide: **`foregroundOnAccent`** (text group) and
**`accentForeground`** (accent group) both read as "the text color used on an accent-colored surface".
The illustrative `rolesFromAliases` table uses **only `foregroundOnAccent`** (button, `listFocused`,
`menuSelected`); `accentForeground` appears nowhere. Either they mean different things (then the RD
must say what each is) or one is redundant bloat in a set the RD deliberately kept lean.

Adjacent under-specification: `backgroundSelected`, `borderMuted`, `accentMuted`, `foregroundDisabled`
have no stated semantics or mapping example, so the plan author must guess the contract of the very
tokens themes are authored in.

**Options**
- **(a) [Recommended]** Add a one-line semantic definition per token to AR-266, and resolve the
  collision — likely **drop `accentForeground`**, keeping `foregroundOnAccent` (the one the mapping
  uses), unless a distinct role (accent-as-text-on-a-neutral-surface) is intended, in which case
  rename to make the distinction explicit (e.g. `accentText`).
- **(b)** Keep both, defer the definitions to plan time. Rejected: a duplicated/ambiguous token
  hardens into the exported `ThemeColors` type and the serialized JSON schema — expensive to change
  post-ship.

**Recommendation**: (a). Token count and semantics should be pinned in the RD since they are the
public contract; the exact-17 assertion (AC-1) is meaningless while two tokens are indistinguishable.

---

### 🟠 PF-003 — `parseTheme`/`serializeTheme` spec omits the non-color role extras and the `pattern` glyph (MAJOR)

**Dimension**: 4 (Completeness) / 8 (Security) / 13 (Test Impact)

The Theme is **heterogeneous per role**: `desktop.pattern` is a **glyph string** (not a color);
`window`/`windowInactive`/`dialog` carry `border`/`title`/`icon`; **`historyWindow` carries
`border`/`icon` but *no* `title`** (`theme.ts:131`). The serialize/parse spec (Technical §"Serialize
format", Security §, AC-9) only describes validating **`fg`/`bg` colors + `attrs` + role presence** —
it never says how the ~15 extra color fields, the differing per-role *shape*, or the `pattern` glyph
are validated and round-tripped. Consequences:

- **AC-8 (lossless round-trip on all presets, incl. `turboVisionTheme`/`defaultTheme`) cannot be met**
  unless serialize/parse preserve `pattern` + every extra — `defaultTheme.desktop.pattern` is `'░'`.
- **Security**: `pattern` is drawn to the screen; a hostile JSON's `pattern` must be validated through
  **`sanitize`** (not `toRgb`). Injection is ultimately blocked at draw time (the RD correctly notes
  the draw path sanitizes), but a *validated-on-parse* guarantee is what AC-9/§Security claim, and the
  glyph field is outside their stated checks.
- Extra colors (`border`/`title`/`icon`) reach `encodeStyle` and so must also pass `toRgb`.

**Options**
- **(a) [Recommended]** Extend the serialize/parse spec + AC-9 to state: validate **every** color
  field including per-role extras via `toRgb`; validate `pattern` via `sanitize` (reject control
  bytes); enforce the **exact per-role shape** (required keys per role, e.g. `historyWindow` has no
  `title`); round-trip is lossless over extras + `pattern`. Add an explicit round-trip-of-`pattern`
  assertion.
- **(b)** Leave extras to plan time. Rejected: AC-8 and the §Security guarantee are unshippable as
  written without this, and per-role shape is easy to get wrong silently.

**Recommendation**: (a).

---

### 🟡 PF-004 — Strict "reject missing/extra roles" makes the serialized format brittle to Theme growth (MINOR)

**Dimension**: 13 (Migration & Compatibility)

`parseTheme` "require[s] the presence of every required role (missing/extra keys → `InvalidThemeError`)"
(Technical §, AC-9). This project **adds Theme roles almost every RD** (recent: `tableHeader`, `tab*`,
`progress*`, `calendar*`, `colorMarker`, `fileInfo`, `editor*`…). A theme JSON exported today therefore
**fails to parse the moment the Theme gains a role** (old file → missing key), and a theme authored on
a newer build fails on an older consumer (unknown key). For an export/share format this is a real
forward/backward-compat trap.

**Options**
- **(a) [Recommended]** Keep strict validation for v1 (safest — no partial themes) but **document the
  limitation explicitly** in the RD and add a `version`/`schema` field to the serialized envelope so a
  future migration can fill missing roles from `defaultTheme` rather than reject.
- **(b)** Relax now: unknown roles → warn+ignore, missing roles → fill from `defaultTheme`. More
  forgiving but a larger v1 surface and a partial-theme risk the RD explicitly wants to avoid.

**Recommendation**: (a) — accept the limitation, but name it and reserve a version field so it's not a
one-way door.

---

### 🟡 PF-005 — Token count is "~16 / base16-sized" in prose but "exactly 17" in AC-1 (MINOR)

**Dimension**: 12 (Consistency)

Feature Overview, AR-266, and the components table all say "~16 curated tokens" / "base16-sized", but
the enumeration is 4+4+3+2+4 = **17** and AC-1 asserts "exactly the 17 named tokens". base16 is a
16-*color* scheme, distinct from a 17-*semantic-token* alias set — the framing conflates them.

**Recommendation**: State "17 tokens" consistently (or make the number exactly 16 by resolving PF-002,
which may drop `accentForeground`). Cosmetic, but the alias set is the public type — pin the number.

---

### 🟡 PF-006 — `contrastRatio` / OKLab behavior on `'default'` (and named) colors is undefined (MINOR)

**Dimension**: 9 (Edge Cases) / 1 (Ambiguity)

`contrastRatio(a: Color, b: Color)` and the OKLab `ramp(seed: Color)` accept the full `Color` union,
which includes **`'default'`** — but `toRgb('default')` returns **`null`** (`color.ts:67`), which has
no luminance. AC-14 only tests hex inputs. `monochromeTheme` is required to use `'default'` (AC-11),
and the designer computes contrast on alias pairs; if any pair is `'default'` the result is undefined
(NaN? throw? treated as black?). Named ANSI colors (`toRgb` resolves them to `PALETTE` RGB) are fine.

**Options**
- **(a) [Recommended]** Define the contract: `contrastRatio`/`ramp` on a color that resolves to `null`
  (`'default'`) either throws a typed error or is documented as "resolve `'default'` to the caller-
  supplied fallback / treated as unknown → contrast check skipped". State it in the RD + one AC.
- **(b)** Constrain the signatures to exclude `'default'` (a `ResolvableColor` subtype). Cleaner types
  but a new type and friction for callers.

**Recommendation**: (a) — cheapest; document + one edge-case AC.

---

## Adversarial checklist (same-session-bias safeguards)

- **Phantom references**: every code symbol the RD names was verified present (table above). None stale.
- **Standard-bound behavior**: WCAG contrast (AC-14) — `#000/#fff` = 21, `c/c` = 1 is correct per WCAG
  2.x relative-luminance `(L1+0.05)/(L2+0.05)`. OKLab round-trip ≤1/255 (AC-5) is feasible for the
  in-gamut PALETTE colors.
- **"Additive / byte-unchanged" claim** independently checked: `defaultTheme` is an attr-free literal
  and `themeRoleToStyle` today emits no attrs → golden-screen invariance (AC-7) holds.

---

## Disposition

| # | Severity | Title | Decision (accepted 2026-07-08) | AR |
|---|---|---|---|---|
| PF-001 | 🟠 MAJOR | Hot-swap frame delivery needs a loop seam | `EventLoop.setTheme` (runTick-wrapped); `Application.setTheme` forwards to it | AR-279 |
| PF-002 | 🟠 MAJOR | `foregroundOnAccent` vs `accentForeground` collision | Drop `accentForeground`; define all → **16** tokens | AR-280 |
| PF-003 | 🟠 MAJOR | serialize/parse role-extras + `pattern` validation | Validate by field kind (extras via `toRgb`, `pattern` via `sanitize`, per-role shape) | AR-281 |
| PF-004 | 🟡 MINOR | serialized-format brittleness to Theme growth | `{version, roles}` envelope; strict v1; migration deferred | AR-282 |
| PF-005 | 🟡 MINOR | "~16" vs 17 token count | Fixed to **16** everywhere (folds into PF-002) | AR-280 |
| PF-006 | 🟡 MINOR | `contrastRatio`/ramp on `'default'` | `ramp` throws; `contrastRatio` → `NaN` (designer skips) | AR-283 |

**Status**: ✅ PASSED — all 6 findings resolved and folded into `RD-22-theming.md`; decisions logged as
AR-279…AR-283 in `00-ambiguity-register.md`. No CRITICAL findings; the RD was well-grounded and its
additive/backward-compat spine is sound. RD-22 is preflight-clear and may proceed to `make_plan`.
