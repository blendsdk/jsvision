# Task T-01: Own widgets' constructor-time computeds (fix #37)

> **Type**: Task (lightweight) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.0
> **Progress**: 9/9 tasks (100%) · **Last Updated**: 2026-07-07
> **Tracks**: GitHub issue [#37](https://github.com/blendsdk/tui/issues/37)

## Objective

Four core `@jsvision/ui` widgets create a reactive `computed()` **in their constructor**, before
the view's owner scope exists (scopes are created at `mount()`, `view.ts:225`). An unowned computed
never auto-disposes (a leak) and fires the dev warning `a computation was created outside any
createRoot() scope …` — which, in a live TTY, `console.warn` can print straight over the screen.

Fix it at the source: add a `View.derived()` helper that returns a **stable accessor** immediately
(so the identity handed to child views at construction is preserved) but builds the backing
`computed` **lazily under the view's own mount-time scope**, so it is always owned and disposed at
unmount. Then swap the five constructor `computed()` sites onto it. Finally, revert the now-redundant
caller-side `createRoot` mitigation in `@jsvision/files`.

## Decisions (user-confirmed 2026-07-07)

- **D1 — Helper home:** a `protected derived<T>(fn: () => T): () => T` **method on `View`**
  (`packages/ui/src/view/view.ts`), reusing the existing `runWithOwner`/`getOwner`/`computed`
  imports; available on `Group` too (Tree/DataGrid). Mirrors `bind()`/`onCleanup()` as owner-scope
  methods. (Rejected: a standalone `viewComputed(view, fn)` — adds an import per site, less
  discoverable.)
- **D2 — Pre-mount read:** if the accessor is read before mount (`this.scope === null`), evaluate
  `fn()` **directly** (correct value, no persisted computed); the owned + memoized computed is built
  on the first post-mount read. Never throws, never leaks — safe because the accessor is captured by
  child views at construction. (Rejected: throw like `bind()` — risks breaking a legitimate
  pre-mount natural-size measure.)
- **D2b — Remount safety (scope-keyed memo):** the memoized computed is **keyed to the scope it was
  built under**. After an unmount→remount the view holds a fresh scope (`view.ts` `createRoot` runs
  again), so on the next read `derived()` re-derives the computed under the new scope instead of
  returning the previous mount's *disposed* one (a disposed computed reads frozen + has no signal
  edges — `owner.ts:144-147`, `scheduler.ts:185`). This mirrors `bind()`'s per-mount effect and keeps
  the primitive correct for `Show`/`For`-remounted widgets. (Rejected: a plain one-time memo —
  silently breaks reactivity on remount, and the "no accumulation" disposal test would pass green over
  it; PF-001.)

- **D3 — Files mitigation:** **revert** the `createRoot` wrapper added to `openFile`/`changeDir`
  (commit `fd45c7d`, `packages/files/src/openers.ts`) — redundant once the widgets self-own. The
  revert is safe because **both** dialogs' constructor-time leak is the inherited `displayItems`
  computed (**site #1**, `list-rows.ts:125`): `FileDialog`→`FileList extends ListView` and
  `ChDirDialog`→`DirList extends ListView<DirNode>` (`dir-list.ts:39`) — neither `FileList` nor
  `DirList` defines a computed of its own (DirList uses `Tree`/`flattened` nowhere), so once site #1
  self-owns, the `createRoot` wrappers own nothing. *(Prior wording attributed the ChDir leak to
  `Tree.flattened`; that was wrong — DirList extends `ListView`, not `Tree`. T-01.7 also fixes the
  matching stale comments in `openers.ts:92` and the regression test.)*
  **Flagged deviation from the literal choice:** *keep* the openers' existing "opening a dialog emits
  no unowned-computation warning" regression test (`openers.impl.test.ts`) — after the revert it
  still passes **because of** the widget-level fix, making it the end-to-end integration guard for
  #37. Removing it would delete the exact test that catches a regression of this bug. Confirm at
  review; if you'd rather drop it too, T-01.7 removes it instead.
- **D4 — Verify command:** `yarn verify`.

## Affected sites (verified)

| # | File:line | Field |
|---|-----------|-------|
| 1 | `packages/ui/src/list/list-rows.ts:125` | `displayItems` (ListView/ListBox inherit) |
| 2 | `packages/ui/src/tree/tree.ts:88` | `flattened` (the `Tree` widget itself — tree demo / kitchen-sink) |
| 3 | `packages/ui/src/table/data-grid.ts:94` | `autoWidths` (passed to `GridHeader`/`GridRows`) |
| 4 | `packages/ui/src/table/data-grid.ts:95` | `display` (passed to `GridHeader`/`GridRows`) |
| 5 | `packages/ui/src/dropdown/combo-box.ts:131` | `filtered` |

## Tasks

**Spec tests first (red):**

- [x] T-01.1 Spec regression test — constructing each of `ListBox`, `ListView`, `DataGrid`, `Tree`,
      `ComboBox` **outside any reactive scope** (bare `new`) emits **no** `auto-disposed` /
      unowned-computation warning (capture `console.warn`). One test per widget.
      *(`test/owned-computeds.spec.test.ts`; verified red 2026-07-07.)*
- [x] T-01.2 Spec disposal **+ remount-reactivity** test — (a) mount→unmount a widget repeatedly;
      assert the derived computed is disposed each cycle (no accumulation) via an `onCleanup`/dispose
      probe on the view scope; **(b)** after an unmount→**remount**, a source-signal write still
      updates a read through the derived accessor (guards D2b: the memo re-derives under the new
      scope — a one-time memo would read frozen/stale here). *(A "no accumulation" assertion alone
      passes trivially on a one-time-memo impl, so (b) is the real guard.)*
      *(In `owned-computeds.spec.test.ts` via a `Show`-toggled `ComboBox` (public `filtered`).)*
- [x] T-01.3 Run the new tests — confirm they **fail red** against the current constructors.
      *(2026-07-07: the 5 T-01.1 tests fail red on the unowned-computation warning; T-01.2 passes on
      current code — the constructor `computed` is unowned so the scope-probe + reactivity both hold
      pre-fix — it is the fix-design guard the preflight added, red only against a wrong one-time-memo
      fix, exactly as PF-001 noted.)*

**Implement (green):**

- [x] T-01.4 Add `protected derived<T>(fn: () => T): () => T` to `View` (`view.ts`): a stable
      accessor that memoizes a `computed(fn)` built under `runWithOwner(this.scope, …)` on first
      post-mount read; pre-mount (`this.scope === null`) returns `fn()` directly (D2). **Scope-keyed
      memo (D2b):** capture the `this.scope` the computed was built under alongside it; on a read
      where the memoized scope `!== this.scope` (i.e. after an unmount→remount into a fresh scope),
      **re-derive** under the current scope — a bare one-time memo would return the previous mount's
      *disposed* computed (frozen value, dropped signal edges; `owner.ts:144-147`, `scheduler.ts:185`),
      silently breaking reactivity for a `Show`/`For`-remounted widget. Makes `derived()` remount-safe
      like `bind()`. JSDoc per project convention; cite #37 + `bind()` as the sibling owner-scope helper.
- [x] T-01.5 Swap the five sites (table above) `computed(…)` → `this.derived(…)`. No read-site
      changes (each field stays a `() => T`). Confirm the accessor identity handed to child views in
      Tree/DataGrid is unchanged (still one stable function per field).
      *(Swapped all 5; removed the now-unused `computed` import from each of the 4 files. `derived()`
      returns a single stable closure per field — identity fixed for the view's life.)*
- [x] T-01.6 Run the Phase-1 tests — confirm **green**; existing `ui` suites (list/tree/table/
      dropdown/view) unchanged (no rendered-output or reactive-behavior change).
      *(2026-07-07: typecheck clean; full `@jsvision/ui` unit suite 1281/1281 green.)*

**Revert mitigation + impl tests & hardening:**

- [x] T-01.7 Revert the `openFile`/`changeDir` `createRoot` wrapper in
      `packages/files/src/openers.ts` to bare `new FileDialog(…)` / `new ChDirDialog(…)` (remove the
      `createRoot` import + `dispose()` `finally` calls). **Keep** the openers' no-warning regression
      test (D3) — verify it still passes via the widget fix. *(If review vetoes keeping it, remove
      that test here instead.)* Also correct the stale attribution while editing here: the
      `openers.ts:92` comment ("the DirList's `flattened`") and the kept regression test's comment
      ("DirList `flattened`") both name the wrong computed — DirList's leak is the inherited
      `displayItems` (site #1); update both to say so.
      *(Reverted both openers to bare `new …Dialog(...)`; removed the `createRoot` import + `dispose()`
      `finally`. Kept the regression test (D3) — it still passes via the widget fix; corrected its
      comment + the `openers.ts` comments to name the inherited `displayItems`, not `Tree.flattened`.
      files: typecheck clean, 146/146 unit green.)*
- [x] T-01.8 Impl test for `derived()` — a pre-mount read returns `fn()`'s value without creating a
      persisted computed; the first post-mount read creates one owned by the view scope and memoizes
      it (same accessor identity across reads); and after an unmount→remount the memo re-keys to the
      new scope — the first post-remount read builds a **fresh** computed owned by the new scope (not
      the disposed one), same stable accessor identity throughout (D2b).
      *(`test/owned-computeds.impl.test.ts`, 3 tests green: pre-mount direct-eval + no leak warning,
      post-mount owned/memoized, remount re-key still reactive.)*
- [x] T-01.9 Full `yarn verify` green across all packages (ui + core + files + examples) + no new
      lint findings; then `/gitcm`.
      *(2026-07-07: `yarn verify` 11/11 turbo tasks green; `yarn lint` (eslint + prettier) clean.
      Commit pending user confirmation.)*

**Verify**: `yarn verify`
