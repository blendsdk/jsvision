# 02 — Current State

> **Plan**: layout-dsl-adoption/focus-traversal-primitive
> **CodeOps Skills Version**: 3.9.0

All references are to the current `feat/dsl-adoptation` tree.

## The focus manager — `packages/ui/src/event/focus.ts`

- Focus is stored **in the tree**: each `Group` has a `current` child pointer; following `current`
  from the root reaches the focused leaf. Re-entering a container restores its `current` (focus
  memory). `focusInto(view)` descends restore-or-first to a leaf (`focus.ts:122`).
- **`advance(direction)`** (`focus.ts:145`) is the traversal engine behind `focusNext`/`focusPrev`:
  - `active = focused.parent (a Group) ?? getRoot()`.
  - `candidates = active.children.filter(canReceiveFocus)`.
  - It picks the next/previous candidate **within `active`**, wrapping with `% candidates.length`, and
    `focusInto`s it. It has a robust "anchor no longer focusable" recovery branch (`focus.ts:161-181`).
  - **It never ascends past `active`.** Once focus is on a leaf inside a nested group, Tab cycles only
    within that group. This is the defect.
- `createFocusManager(getRoot)` is constructed at `event-loop.ts:197` as
  `createFocusManager(() => this.root)` — the manager only knows the **global** root, not the modal
  scope. (Group-scoping masks this today: `advance` never climbs high enough to leave a modal.)

## The scope ceiling already exists — `packages/ui/src/event/event-loop.ts`

- **`scopeRoot()`** (`event-loop.ts:492`): `this.modal.isActive() ? this.modal.topView() : this.root`.
  Dispatch already confines every phase to this subtree (`focusedLeafIn(scopeRoot())`,
  `routeContext.scopeRoot`). `modal.topView()`/`isActive()` are the open-modal stack (`event/modal.ts`).
- Public `EventLoop.focusNext()`/`focusPrev()` (`event-loop.ts:296-301`) wrap
  `this.focus.focusNext()`/`focusPrev()` in a `runTick`. The unbound-`Tab` dispatch path
  (`event/dispatch.ts:132`) calls `ctx.focusNext()` → `this.focus.focusNext()`
  (`event-loop.ts:540`). **Neither passes a scope today** — the fix threads `scopeRoot()` here.

## Widget focusability (probed) — what the traversal actually sees

| Widget | `focusable` | Note |
|--------|-------------|------|
| `Input` (`controls/input.ts:66`), `Button` (`controls/button.ts:53`) | `true` | leaf focus targets |
| `ScrollBar` (`scroll/scroll-bar.ts:69`), base `View` (`view.ts:94`), `History`, `FileInfoPane`, `Label` | `false` | passive chrome — skipped |
| `ListView`/`FileList`/`DirList` | container | focus target is the inner `.rows` (`ListRows`, focusable) `list-view.ts:85` — a **nested** focusable |
| `CheckGroup` (extends `Cluster`) | container | nested focusable children |

## Empirical characterization (throwaway probe, since deleted)

Tabbing the live dialogs recorded:

```
FileDialog  (fwd):  INIT=fileInput → fileList.rows → fileList.rows → … (stuck)
FileDialog  (back):        fileList.rows → fileList.rows → … (stuck)
ChDirDialog (fwd):  INIT=pathInput → dirList.rows → dirList.rows → … (stuck)
```

The current tab order is **degenerate** — Tab dead-ends in the list; buttons/history are unreachable.
The dialogs are usable only via hotkeys (Alt+letter), Enter/Esc, mouse, and arrows-in-list.

## Blast-radius sweep (what a DFS change touches)

- **Flat dialogs** (`editor` find/replace/confirm add all focusables flat via `dlg.add(at(...))`,
  `editor/dialogs.ts`; `message-box`): DFS of a flat tree == the current flat order → **preserved**.
- **Trapped dialogs** (`file`/`chdir` list; `formDialog` body sub-group, `forms/form-dialog.ts:228`;
  `CheckGroup`): Tab currently dead-ends inside → DFS **fixes** (Tab escapes to the buttons).
- **`SplitView`**: panes + splitters are flat siblings in a `track` group (`split-view.ts:156-163`) →
  DFS reaches them in order → **safe**.
- **`TabView`**: tab **switching** (Ctrl+PageUp/Down + Alt-hotkeys, not the Tab key, `tabs/tab-view.ts:18`)
  is **unaffected**. Plain-Tab traversal **changes as intended**: from the last focusable of the active
  page, Tab now **escapes** into the next focusable sibling after the `TabView` (tree order), where
  group-scoping previously wrapped within the page. This is the same desired behavior as everywhere else,
  not a regression; no existing oracle pins the old wrap. Confirm acceptable in the Phase 4.1 sweep.
- **Widgets that consume `tab` internally** (e.g. editor memo "lets Tab pass through") intercept in
  `onEvent` before `focusNext` runs → **unaffected**.

## Existing focus oracles (must survive unedited — see 07)

`event.focus.spec.test.ts` (ST-03…06), `event.focus.impl.test.ts` (restore-on-reentry `:29`,
descend-first `:56`, no-op cases, hidden-ancestor block), `event.hardening.spec.test.ts`
(disabled-anchor recovery `:263`, modal quit-cascade `:307`). None asserts the deep cross-group **exit**
being introduced; the root-level restore case (`impl:29-52`) operates on flat root siblings and is
unchanged.
