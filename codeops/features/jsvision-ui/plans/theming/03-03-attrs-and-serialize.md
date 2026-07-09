# Attrs & Serialize: Theming

> **Document**: 03-03-attrs-and-serialize.md
> **Parent**: [Index](00-index.md)

## Overview

Two additive core capabilities: an optional per-role **text-attribute** axis (`ThemeRole.attrs`) that
themes can lean on (dim/bold/italic/underline), passed through `themeRoleToStyle`; and a lossless,
injection-safe JSON **serialize/parse** round-trip. Lives in `packages/core/src/engine/color/theme.ts`
(the `attrs` field), `packages/ui/src/view/theme-style.ts` (the pass-through), and
`packages/core/src/engine/color/serialize.ts` (the round-trip).

## Implementation Details

### `ThemeRole.attrs` (AR-271)

`packages/core/src/engine/color/theme.ts` — add one optional field:

```ts
export interface ThemeRole {
  readonly fg: Color;
  readonly bg: Color;
  readonly hotkey?: Color;
  readonly attrs?: AttrMask;   // NEW — optional text-attribute mask (dim/bold/italic/…)
}
```

`Theme` and `defaultTheme` are otherwise **untouched**; **no** `defaultTheme` role carries `attrs`
(so every existing role's serialized/rendered output is unchanged). `AttrMask` is imported from
`../render/types.js` (already the source of `Color`).

`packages/ui/src/view/theme-style.ts` — copy `attrs` through **only when present**, so an attr-free
role returns exactly `{ fg, bg }` (the invariance PA-4 depends on):

```ts
export function themeRoleToStyle(role: ThemeRole): Style {
  return role.attrs === undefined
    ? { fg: role.fg, bg: role.bg }
    : { fg: role.fg, bg: role.bg, attrs: role.attrs };
}
```

Attributes survive `mono` depth (confirmed: `encodeStyle` emits attribute SGR independently of color
depth / `'default'` colors — `encode.ts:128-133`), so an attribute-driven theme (the `monochrome`
preset) stays legible on a monochrome terminal.

### `serialize.ts` — versioned, lossless, validated round-trip (AR-274, AR-281, AR-282)

```ts
export class InvalidThemeError extends TuiError {}
export function serializeTheme(theme: Theme): string;      // → { "version": 1, "roles": { … } }
export function parseTheme(json: string): Theme;            // validates by field kind; throws or returns a full Theme
```

**`serializeTheme`** emits a versioned envelope with **stable key order**:

```json
{ "version": 1, "roles": { "desktop": { "fg": "…", "bg": "…", "pattern": "░" }, "menuBar": { … }, … } }
```

Role order follows the canonical `defaultTheme` key order; within a role the key order is fixed
(`fg`, `bg`, `hotkey?`, `attrs?`, then structural extras in a fixed order). `version: 1` is a
forward-compat reserve (AR-282) — v1 validation is strict; a future schema bump can migrate an older
payload instead of hard-failing (cross-version migration itself is out of scope, RD-22 §Won't-Have).

**`parseTheme`** — JSON-only (`JSON.parse`, **never** `eval` / object literals), validating **by
field kind** and returning a **full** `Theme` or nothing:

1. **Structure** — the top level must be `{ version: 1, roles: {…} }`; a `version` other than `1` is
   rejected in v1 (strict role-set match, no migration).
2. **Role set** — exactly the canonical role set. The required roles + each role's *structural* extras
   are **derived from `defaultTheme`** at parse time (`Object.keys(defaultTheme)` and, per role, its
   own non-`fg`/`bg`/`hotkey`/`attrs` keys), so the validator stays correct automatically if `Theme`
   gains a role/extra — no 63 hand-written shapes. A missing role or an unknown role → reject.
3. **Per-role shape** — required keys `{ fg, bg }` ∪ that role's structural extras (`desktop`→`pattern`;
   `window`/`windowInactive`/`dialog`→`border`/`title`/`icon`; `historyWindow`→`border`/`icon` and
   **no** `title`); optional keys `{ hotkey, attrs }` on any role; **any other key → reject**.
4. **By field kind:**
   - every **color** field — `fg`, `bg`, `hotkey`, and the extras `border`/`title`/`icon` — via `toRgb`
     (malformed hex / unknown name → reject);
   - the `desktop.pattern` **glyph** as a **single printable cell** (PA-5): reject unless
     `sanitize(pattern) === pattern` **and** it contains no `\t`/`\n` **and** it occupies exactly one
     display cell — `sanitize` alone keeps tab/newline, so a length/width check is required;
   - each `attrs` value as a **finite integer within the known `Attr` bits** (`0 ≤ attrs ≤ 127`, no
     fractional/NaN/out-of-range bits).
5. **No partial theme** — any failure throws `InvalidThemeError` (a `TuiError`); a partially-built
   theme is never returned.

**No filesystem access** — `serialize`/`parse` are pure strings; fs lives only in the examples layer
(`03-06`).

## Integration Points
- `themeRoleToStyle` (ui) is the only consumer of `attrs`; `RenderRootImpl.drawDropShadow` already
  reads `style.attrs ?? Attr.none`, so no render-root change is needed for attrs.
- `serialize`/`parse` operate on any `Theme` — presets (`03-04`), `createTheme` output (`03-02`), or a
  hand-authored theme.

## Code Examples

```ts
import { serializeTheme, parseTheme, monochromeTheme, InvalidThemeError } from '@jsvision/core';

const json = serializeTheme(monochromeTheme);  // attrs + pattern survive
const back = parseTheme(json);                 // deep-equals monochromeTheme

try { parseTheme('{"version":1,"roles":{"desktop":{"fg":"#zz0000","bg":"#000","pattern":"░"}, …}}'); }
catch (e) { if (e instanceof InvalidThemeError) { /* malformed color rejected, no partial theme */ } }
```

## Error Handling

| Error Case | Handling Strategy | Ref |
| ---------- | ----------------- | --- |
| Malformed hex / unknown name in **any** color field (incl. `window.border`) | `toRgb` throws → wrapped as `InvalidThemeError`; no partial theme | AR-281 |
| `desktop.pattern` = empty / multi-cell / contains `\t` or `\n` / control byte | reject → `InvalidThemeError` | PA-5, AR-281 |
| `attrs` non-integer / NaN / outside `Attr` bits | reject → `InvalidThemeError` | AR-281 |
| Missing role / unknown role / wrong per-role shape (e.g. `historyWindow` with `title`) | reject → `InvalidThemeError` | AR-281 |
| `version` ≠ 1 | reject in v1 (no migration) | AR-282 |
| Non-JSON input | `JSON.parse` throws → wrapped as `InvalidThemeError` | AR-281 |

> **Traceability:** `00-ambiguity-register.md` (PA-5) + `../../requirements/00-ambiguity-register.md` (AR-271/AR-274/AR-281/AR-282).

## Testing Requirements
- `themeRoleToStyle({fg,bg,attrs:Attr.bold}).attrs === Attr.bold`; `themeRoleToStyle({fg,bg})` has no
  `attrs` key (ST-12 — the PA-4 invariance).
- `serializeTheme∘parseTheme` is identity on every preset + a `createTheme` output, incl.
  `defaultTheme.desktop.pattern` and `monochrome`'s `attrs` (ST-13); output is a `{version,roles}`
  envelope (ST-14).
- `parseTheme` rejection matrix — malformed color in any field, bad pattern (control/tab/newline/multi-cell),
  out-of-range attrs, missing/extra role, wrong shape, non-JSON — each `InvalidThemeError`, no partial
  theme (ST-15…ST-20).
