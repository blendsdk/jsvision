# 03-02 — Duplicate Accelerators (GH #6)

> **Parent**: [Index](00-index.md) · **Requirement**: [R2](01-requirements.md#r2--duplicate-accelerator-warning-gh-6) · **AR**: AR-7…AR-13
> **Files**: `packages/ui/src/menu/builders.ts` (submenu check), `menu/menubar.ts` (bar-title check); `view/view.ts`; `controls/button.ts`, `label.ts`, `cluster.ts`; `tabs/tab-view.ts` (data-level tab check); `dialog/dialog.ts`; a shared warn util; `index.ts`; tests under `packages/ui/test/`

## Design

Two pieces: a **pure validator** (view-free, fully testable) and a thin **enumeration + wiring** layer
that feeds it from each scope.

### 1. Pure validator (the testable core)

```ts
/** One within-scope accelerator collision: the shared char and the 0-based indices that claim it. */
export interface DuplicateAccelerator {
  readonly char: string;      // lowercase
  readonly indices: number[]; // positions in the input list, in order
}

/**
 * Find every char claimed by more than one entry, case-insensitively. Pure — no view/reactive dep.
 * @param chars One accelerator char (or '') per scope entry, in scope order; '' = no accelerator.
 */
export function findDuplicateAccelerators(chars: readonly string[]): DuplicateAccelerator[];
```

- Lowercase-normalize; ignore `''`/null entries (separators, no-hotkey items).
- Group indices by char; emit only groups of length ≥ 2, in first-appearance order.
- Lives in a pure module (e.g. `packages/ui/src/menu/accelerators.ts`) exported from the barrel with an
  `@example`.

### 2. Shared dev-warn (AR-11)

Promote a scope-tagged warn used by every scope. Keep it screen-safe and `NODE_ENV`-gated:

```ts
/** Dev-only warning, prefixed `[jsvision/ui <scope>]`; silent under NODE_ENV=production. */
export function devWarn(scope: string, message: string): void;
```

- Add as a shared `ui` util (e.g. `packages/ui/src/shared/warnings.ts`); the existing
  `reactive/warnings.ts` keeps its `reactive` prefix (either re-implemented in terms of the shared one
  with `scope='reactive'`, or left as-is — implementer's call, no behavior change).
- No other `console.*` added to `src`.

### 3. Enumeration seam (AR-10)

Add an **optional** method on `View`, default empty, overridden by accelerator-bearing views:

```ts
/** The Alt-hotkey chars this view claims in its focus scope (lowercase), for duplicate detection. Default none. */
accelerators(): readonly string[] { return []; }
```

Overrides (used by the **Dialog** focus-scope walk):
- `Button` → `this.parsed.hotkey ? [hotkey] : []`.
- `Label` → same.
- `Cluster` (CheckGroup/RadioGroup/MultiCheckGroup) → its per-item `parsed[].hotkey` (a disabled item
  still contributes, AR-12).

Tabs need **no** `accelerators()` override: the tab scope is checked at the data level over `tabs()`
(see §4), not by a subtree walk.

### 4. Scope-root checks (AR-7, AR-9)

- **Submenu items (build-time, plain data):** in `menu/builders.ts`, `subMenu(title, items)` runs
  `findDuplicateAccelerators(items.map(hotkeyOf))` and `devWarn('menu', …)` on any collision. Separators
  map to `''` (skipped). Nested submenus are built innermost-first, so each level is checked exactly once.
- **Menu-bar titles (build-time, plain data):** the `menuBar(tops)` builder lives in
  `menu/menubar.ts` (**not** `builders.ts` — it constructs a `MenuBar` view). Run the same check over the
  top titles' hotkeys there (in `menuBar()` / when `MenuBar.items` is set), `devWarn('menu', …)`.
- **Tab strip (build/data-level):** the tab scope is **strip tabs only** — check
  `findDuplicateAccelerators(tabs().map(hotkeyOf))` on `TabView` (which owns the tab data + Alt-dispatch),
  `devWarn('tabs', …)`. Do **not** descend into page contents: a page `Button`/`Label` sharing a char with
  a tab is a different focus interaction and is out of scope for v1.
- **Dialog focus scope (mount-time):** a small shared helper walks the `Dialog` subtree collecting
  `view.accelerators()` (flattened, in document order) once on `Dialog` mount (the modal focus scope root),
  then runs the validator, `devWarn('dialog', …)`. The walk **stops at a nested scope boundary** (a nested
  `Dialog`/`TabView` owns its own check) so a child scope's accelerators don't false-positive against the
  parent. **Caveat:** the walk sees only statically-added (`add()`) children present at mount; a
  reactively-inserted (`addDynamic`/`Show`/`For`) button won't be re-checked — acceptable, since dialog
  chrome is composed statically.

All checks are dev-gated (they call `devWarn`, itself `NODE_ENV`-gated).

## Behavior notes / invariants

- **Same char across different scopes is never a conflict** (AR-13): each scope root runs its own check
  over only its own entries.
- **Case-insensitive** throughout (hotkeys are already lowercased by `parseTilde`).
- **Menu items have no disabled flag** (AR-12) — no disabled distinction at the menu tier; a disabled
  `Cluster` item still contributes its hotkey (it still shadows a later item at runtime).
- The message names the scope, the char, and the colliding labels/positions, e.g.
  `duplicate accelerator 'x' in this menu: "Exit" and "Export" — only the first is reachable`. **No PII**
  beyond the developer-authored labels.
- Zero runtime cost in production (all warns compiled out by the `NODE_ENV` guard; the validator only
  runs from the dev-gated call sites — construction/mount, not per-frame).

## Out of scope (fast-follow)

- **StatusLine** chord duplicates (`matchesChord`, a different mechanism, AR-7).
- A strict throw mode; auto-resolution of a conflict.

## Acceptance (maps to ST-9…ST-18)

- `findDuplicateAccelerators` returns every within-scope collision, case-insensitively; none for
  no-dup / cross-scope-reuse / separator-only inputs.
- A menu with two items sharing a hotkey emits exactly one dev warning at build; silent under
  `NODE_ENV=production`.
- A `Dialog` with two `Button`s sharing an Alt-hotkey warns once on mount; a `TabView` with two tabs
  sharing `~X~` warns once.
- No warning across different menus/scopes; no `console.*` added outside the sanctioned `devWarn`.
