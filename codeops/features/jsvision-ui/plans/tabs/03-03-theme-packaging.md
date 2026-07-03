# Theme Roles & Packaging: Tabs (RD-17)

> **Document**: 03-03-theme-packaging.md
> **Parent**: [Index](00-index.md)

## Overview

The cross-package additive surface + the subsystem packaging + the mandatory kitchen-sink story and
`demo:tabs` walkthrough. Three concerns:
1. **Additive `tab*` theme roles** in `@jsvision/core` (GATE-1 `cpAppColor` decode).
2. **Subsystem packaging** — `src/tabs/` + explicit named re-exports; ≤500 lines; zero deps.
3. **Kitchen-sink story + headless demo** (NON-NEGOTIABLE showcase rule).

## Architecture

### Current Architecture
`Theme` (`core/src/engine/color/theme.ts:16-22`) is `{ fg, bg, hotkey? }` per role; `defaultTheme`
(`:296` area) is the single source of truth. The `tableHeader` role (`:154`/`:296`, `0x3F`) is the
precedent for a **documented extension colour** with no TV palette entry — a decoded design-choice byte.
`clusterDisabled` (`:86`, `0x38`) is the disabled-greying precedent.

### Proposed Changes
- Add **3 roles** (PA-3/AR-180): `tabActive`, `tabInactive`, `tabDisabled` — to the `Theme` interface and
  `defaultTheme`, each a `ThemeRole` with `fg`/`bg` (+ `hotkey` where the marked letter needs a distinct
  shortcut colour), pinned to exact attribute bytes at **GATE-1** through the `cpAppColor` chain.
- No existing role changes; additive only (AC-11).

## Implementation Details

### GATE-1 colour decode (attribute-byte pinning)

TV has no tab palette, so these are **documented extension colours** grounded in TV's window
active/inactive + disabled conventions (AR-180). The GATE-1 BEFORE task pins each byte by analogy to
the shipped decodes; the AFTER task records the resolution in the JSDoc + commit. Working proposal
(finalised at GATE-1):

| Role | Grounded in | Proposed byte (pin at GATE-1) |
| ---- | ----------- | ------------------------------ |
| `tabActive` | active window title / brighter foreground | e.g. `0x7F` white-on-lightGray (bright, "raised" tab) — **confirm at GATE-1** |
| `tabInactive` | `windowInactive` dimmed convention | e.g. `0x70` black-on-lightGray (dimmed) — **confirm at GATE-1** |
| `tabDisabled` | `clusterDisabled` (`0x38`) greying | e.g. `0x78` darkGray-on-lightGray — **confirm at GATE-1** |

> The exact bytes are **not** frozen by this doc — the fidelity directive requires the GATE-1 decode to
> pin them. The spec test (AC-11) asserts the roles **exist** and `encode()` does not throw + no existing
> role changed; it does **not** hard-code a byte (so a GATE-1 re-pin is not a spec violation).

#### ✅ GATE-1 decode result — ADOPTED button-face design (re-pinned 2026-07-03, tasks 1.1.1 + spike)

> **Design evolution (user-directed spike):** the first cut pinned `tab*` to the gray-dialog label
> palette (active `0x7F`/inactive `0x70`/disabled `0x78`). After a visual spike the user adopted a
> **button-face** look for the tabs — raised **green** faces (no drop-shadow) joined by a flat `─` dash
> instead of a `┬` notch. The `tab*` roles were therefore re-grounded in TV's **`cpButton` green
> palette** (still a documented extension — TV has no tab class, AR-172; the spec test asserts existence
> + `encode()` non-throw, never a literal byte, so a re-pin is not a spec violation).

Each is a `cpAppColor` `0xHL` byte (H = bg nibble, L = fg nibble):

| Role | Byte | Decode | Grounded in (shipped) |
| ---- | ---- | ------ | --------------------- |
| `tabActive` | `0x2F` | white-on-green + `hotkey` yellow | `buttonFocused` focused/default face `0x2F` — the brighter "raised" button face (`theme.ts` {@link buttonFocused}) |
| `tabInactive` | `0x20` | black-on-green + `hotkey` yellow | `button` normal face `0x20` (`theme.ts` {@link button}); `0x2E` yellow shortcut shown on **every** enabled tab |
| `tabDisabled` | `0x28` | darkGray-on-green, no hotkey | `buttonDisabled`/`clusterDisabled` `darkGray` greying, kept **on the green field** (green-dimmed) so the tab stays part of the strip |

Active vs. inactive follows the TV `TButton` face convention: the *selected* tab takes the brighter
**white** foreground (the focused/default face), the normal tab the **black** foreground — both on the
green button field. The **frame chrome** (corners/edges/`─` dash gaps/arrows) draws in `staticText`
(`0x70` black-on-lightGray) — the neutral gray line — so green button tabs sit on a gray frame bar. The
four tees `┬┴├┤` remain decoded + retained in `TAB_GLYPHS` as the GATE-1 reference set, but the adopted
design draws a plain `─` gap between tabs (no `┬`).

#### ✅ GATE-1 tee-glyph decode (task 1.1.1)

Line/corner glyphs reuse the shipped `frame.ts` `SINGLE_BORDER` code points verbatim (identical CP437 →
Unicode). The four tab-junction tees are the only fresh decode; all are **unambiguous-narrow** (width 1),
so none misaligns (the `×`/`■` East-Asian-ambiguous caveat does not apply):

| Glyph | CP437 | Unicode | Name |
| ----- | ----- | ------- | ---- |
| `─` | `0xC4` | U+2500 | box drawings light horizontal (reused) |
| `│` | `0xB3` | U+2502 | box drawings light vertical (reused) |
| `┌` | `0xDA` | U+250C | light down and right (reused) |
| `┐` | `0xBF` | U+2510 | light down and left (reused) |
| `└` | `0xC0` | U+2514 | light up and right (reused) |
| `┘` | `0xD9` | U+2518 | light up and left (reused) |
| `┬` | `0xC2` | U+252C | light down and horizontal — **tab/frame-top notch** (the between-tabs separator) |
| `┴` | `0xC1` | U+2534 | light up and horizontal — GATE-1 tee |
| `├` | `0xC3` | U+251C | light vertical and right — GATE-1 tee |
| `┤` | `0xB4` | U+2524 | light vertical and left — GATE-1 tee |

### New Types/Interfaces

```ts
// core/src/engine/color/theme.ts — additive:
export interface Theme {
  // ...existing roles unchanged...
  /** Active (selected) tab label. Extension colour (TV has no tab palette), cpAppColor-decoded. */
  readonly tabActive: ThemeRole;
  /** Inactive tab label; dimmed per the window-inactive convention. */
  readonly tabInactive: ThemeRole;
  /** Disabled tab label; greyed per the cluster-disabled convention. */
  readonly tabDisabled: ThemeRole;
}
```

### Packaging

- **New dir** `packages/ui/src/tabs/`: `tab-view.ts`, `tab-strip.ts`, `index.ts` (barrel). Per-file
  ≤500 lines. Pure TS, ESM/NodeNext (`.js` specifiers), zero runtime deps. *(AC-12)*
- **`index.ts`** barrels the public surface: `TabView`, `Tab`, `TabViewOptions`.
- **`src/index.ts`** (ui public entry) gains **explicit named re-exports** (the layout-convention rule,
  AR-81/102/113 — matching how layout/view/event/app-shell/controls/containers/table re-export):
  `export { TabView } from './tabs/index.js'; export type { Tab, TabViewOptions } from './tabs/index.js';`
- `yarn check:deps` must continue to pass (no native runtime dep).

### Kitchen-sink story + `demo:tabs` (NON-NEGOTIABLE)

- **Story** `packages/examples/kitchen-sink/stories/tabs.story.ts` exporting a `Story`:
  `{ id: 'containers/tabs', category: 'Containers', title: 'Tabs', blurb, rd: 'RD-17', build(ctx) }`
  (AR-182/185, PF-003). `build` returns a `Group` with a `TabView` of **≥3 tabs incl. one disabled +
  one closeable**, `~X~` hotkeys, distinct content per page, and a visible active-tab echo. One line
  added to `stories/index.ts`. Passes `test/kitchen-sink.smoke.spec.test.ts` (unique id, required
  metadata, mounts + paints headlessly). *(AC-13)*
- **Demo** `packages/examples/tabs-demo/main.ts` + a `"demo:tabs": "tsx tabs-demo/main.ts"` script in
  `packages/examples/package.json` — a headless dispatch-driven walkthrough, an ASCII frame per step:
  **render → Ctrl+PageDown switch → Alt-hotkey jump → close a tab → overflow-scroll** (matching
  `demo:containers`/`demo:tree`/`demo:table`). *(AC-13)*
- **E2E** `packages/examples/test/tabs-demo.e2e.test.ts` runs the demo child (via `tsx`) and asserts it
  completes + prints frames (matching `tree-demo.e2e`/`table-demo.e2e`).

## Integration Points
- **Core theme:** the additive roles extend the same `Theme` the frame/menu/status/controls/list/tree/
  table roles read; `defaultTheme` stays the single source of truth (lockstep version, `sync-versions`).
- **UI public entry:** explicit re-exports keep the tree-shakeable single-entry contract intact.
- **Examples:** the story + demo import `@jsvision/ui` (and `@jsvision/core` where a theme role is
  referenced) by name.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| GATE-1 re-pins a byte after the spec test is written | Spec asserts existence + `encode()` non-throw, not a literal byte → no spec violation | AR-180 / AC-11 |
| A `tab*` role omitted from `defaultTheme` | Typecheck fails (interface requires it) — caught by `yarn typecheck` | AC-11 |
| Story id collides with another | Smoke test asserts unique id; `containers/tabs` pinned (PF-003) | AR-185 / AC-13 |
| File exceeds 500 lines | Renderer already split (PA-4); packaging spec asserts ≤500 | AC-12 |

> **Traceability:** every strategy references the resolving AR entry (`00-ambiguity-register.md`).

## Testing Requirements
- `tabs-theme.spec.test.ts`: the 3 roles exist in `defaultTheme`; `encode()` of each does not throw; a
  snapshot of the full role set proves no existing role changed (AC-11).
- `tabs.packaging.spec.test.ts`: `TabView`/`Tab`/`TabViewOptions` re-exported from `src/index.ts`;
  files ≤500 lines; `check:deps` clean (AC-12).
- `kitchen-sink.smoke.spec.test.ts` (existing, extended): the `containers/tabs` story mounts + paints (AC-13).
- `tabs-demo.e2e.test.ts`: the headless demo completes with per-step frames (AC-13).
