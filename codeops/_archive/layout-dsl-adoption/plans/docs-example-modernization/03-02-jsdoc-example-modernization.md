# JSDoc Example Modernization: docs-example-modernization

> **Document**: 03-02-jsdoc-example-modernization.md
> **Parent**: [Index](00-index.md)
> **Covers**: FR-3, FR-4, FR-5, FR-6 · AR-1, AR-6

## Overview

The sweep proper: 53 `position:'absolute'` lines across 37 files become `at()` calls, the two
flex-shaped examples adopt `row()`/`col()`/`grow()`/`fixed()`, `split-view.ts:109` adopts `cover()`,
and the four defects the planning probe found get fixed.

Nothing here changes runtime behaviour — these are comments. The entire risk is *wrongness*, which
is why [03-01](03-01-example-compile-guard.md) lands first and is green before a single line here
is edited.

## Architecture

### Current architecture

Every layout-shaped example hand-writes the raw `LayoutProps` field:

```ts
 * const btn = new Button('~O~K', { onClick: () => {} });
 * btn.layout = { position: 'absolute', rect: { x: 1, y: 1, width: 10, height: 2 } };
```

### Proposed changes

```ts
 * const btn = at(new Button('~O~K', { onClick: () => {} }), 1, 1, 10, 2);
```

The builder (`packages/ui/src/view/dsl/absolute.ts:42-50`) takes four numbers **or** a `Rect`, so
every existing example converts without restructuring. Each edited example must add `at` to its
existing `@jsvision/ui` import line — an example that uses a symbol it does not import is exactly
what the guard now catches, so this is enforced rather than remembered.

## Implementation details

### FR-3 — the two flex examples

**`packages/ui/src/view/group.ts:44-58.`** The current block builds a `root` with
`direction:'row', gap:1, padding:1` and two `fr`-weighted `Panel`s. The DSL form composes the same
thing declaratively:

```ts
 * const left = new Panel('left');
 * const right = new Panel('right');
 * const root = row({ gap: 1, padding: 1 }, grow(left), grow(right));
 * root.background = 'desktop';
 *
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * createRenderRoot({ width: 40, height: 8 }, { caps }).mount(root);
```

One consequence to keep, not lose: the original carries the comment
`// added back-to-front: 'left' then 'right'` on its `add()` calls. `row(...)` adds in argument
order, so paint order is still left-then-right, but the *lesson* about back-to-front paint order
disappears with the explicit `add()` calls. Keep it as a short comment on the `row(...)` line —
`Group`'s documentation is the natural place for a reader to learn that, and dropping it would make
this a documentation regression dressed as a modernization.

**`packages/ui/src/editor/indicator.ts:35-43.`** A column of editor-over-indicator:

```ts
 * const root = col(grow(editor), fixed(indicator, 1));
```

`attachGadgets` and the surrounding prose are untouched.

### FR-4 — the 53 absolute lines

Mechanical, one file at a time. The full list is not restated here — it is regenerated on demand:

```
grep -rn "^ \* .*\.layout = .*position: 'absolute'" packages/*/src
```

**Baseline 53 lines across 37 files; AC-2 requires it to reach zero.** The **ten** files carrying
more than one: `dialog/buttons.ts` (6), `controls/text.ts` (3), `dialog/dialog.ts` (3), and
`controls/label.ts`, `dropdown/history.ts`, `controls/button.ts`, `feedback/progress-bar.ts`,
`scroll/scroller.ts`, `surface/surface-view.ts`, **`packages/forms/src/form-dialog.ts`** (2 each).
*(The last was missing from an earlier draft of this list — task 2.2.8 always counted it, but an
executor using this paragraph as the worklist would have converted one of its two lines and left
AC-2 at 1.)*

Two things to watch, both learned from #114:

- **`at()` returns the view**, so a `const x = new W(); x.layout = …;` pair collapses to
  `const x = at(new W(), …)`. Prefer the collapsed form — the one-line-instead-of-two saving is the
  whole didactic argument for AR-1 — but not where the example subsequently needs the variable
  before it is placed.
- **Do not convert a raw write that is not a placement.** Two distinct groups are correctly raw and
  must survive the sweep: `packages/ui/src/layout/` documents the raw `LayoutProps`/`LayoutBox` API
  itself (`layout.ts:42-44` shows `LayoutBox` literals, `types.ts:61` a prose default-list) — note
  neither actually matches AC-3's `.layout = ` grep — and `packages/ui/src/view/dsl/` carries three
  **prose** references to the raw field inside the documentation of the builders that replace it
  (`absolute.ts:21`, `flex.ts:5`, `index.ts:4`). It is that second group that **AC-3** carves out,
  because it is the group that actually survives the grep.

### FR-5 — `split-view.ts:109`

```ts
 * split.layout = { position: 'fill' };   →   cover(split);
```

Note `split-view.ts:103`'s `direction: 'row'` is a **`SplitView` constructor option**, not a layout
prop. It is not touched. This is called out because a careless grep for `direction:` flags it, and
that is precisely the kind of mis-attribution that cost #114 an investigation
([02](02-current-state.md) is the analogous record there).

### FR-6 — the four defects (AR-6)

**The `createEventLoop` arity — `tree.ts:66`, `tabs/tab-view.ts:177`, `table/data-grid.ts:69`.**
All three write `createEventLoop({ width, height })` where the signature
(`packages/ui/src/event/event-loop.ts:622`) needs a second options argument. `caps` is the **only**
required member of `EventLoopOptions` (`packages/ui/src/event/types.ts:37-39`), so the fix is:

```ts
 * const caps = resolveCapabilities({ env: {}, platform: 'linux' }).profile;
 * const loop = createEventLoop({ width: 40, height: 10 }, { caps });
```

Correct in-repo siblings for the *call shape*: `packages/ui/src/dialog/dialog.ts:72` and
`packages/ui/src/dialog/buttons.ts:29`. `group.ts:57-58` is the model for obtaining `caps` via
`resolveCapabilities`, but it documents `createRenderRoot` — a different API — so do not copy it as
a `createEventLoop` sibling.

Each of the three must also import `resolveCapabilities`. **Import it from `@jsvision/ui`**, the
package the example already imports from — `tree.ts:67` and `tab-view.ts:178` have no
`@jsvision/core` import line to add it to, and `packages/ui/src/index.ts:20` re-exports the symbol,
so a single import line is both legal and simpler. (The repo does it both ways today —
`group.ts:39` from core, `datagrid/src/grid.ts:274` from ui — and both compile, so the guard cannot
arbitrate; pick the one-line form and stay consistent across all three.)

**The unreachable export — `app/application.ts:275`.** The example imports `syncOverlayVisible` from
`@jsvision/ui` and fails `TS2305`. The symbol is **not** a phantom: it exists at
`app/application.ts:288`, carries a public-style JSDoc with its own `@example`, is exported from
`app/index.ts:8`, is used cross-subsystem by `menu/controller.ts`, and is pinned by
`packages/ui/test/dropdown.seams.spec.test.ts:26`. It is missing from exactly one place — the root
barrel `packages/ui/src/index.ts`. Execution rules between four branches:

0. **The root-barrel omission is the defect.** The symbol is subsystem-exported, cross-subsystem
   consumed, spec-tested and `@example`-documented — everything the repo treats as public except the
   final re-export. If that is the finding, **surface it for a maintainer ruling** rather than
   working around it; adding one line to the barrel makes the existing example correct as written.
1. If the symbol exists under a different public name, use that name.
2. If it exists but is genuinely internal, rewrite the example so it does not need it.
3. If it does not exist at all, rewrite the example without it.

An earlier draft offered only branches 1–3 and pre-committed to "in no case is a new public export
added". That pre-judged branch 0 out of existence and would have enshrined a one-line barrel
omission as permanent. The concern behind it stands and still governs branches 1–3: **growing the
public API surface to satisfy a documentation plan is the tail wagging the dog**, and any barrel
change drifts the plugin API-ref snapshot (`yarn plugin:sync --fix`) that this plan otherwise avoids
entirely. So branch 0 is a *finding to escalate*, not a licence to export. Whichever branch is
taken is recorded as **AR-R1** in the register.

### Interaction with the allowlist

Six of the blocks this sweep edits are on the allowlist that task **1.3.1** generates
([02](02-current-state.md) §"The layout surface this plan edits"). Under AR-9 the edits are
permitted so long as no *new* error appears — the guard enforces exactly that.

**Four entries leave the list in this phase**: the three `TS2554` arity blocks (task 2.3.1) and
`application.ts::syncOverlayVisible` (task 2.3.2). All four are in the pre-sweep list because Phase
1 generates it from the pre-sweep repo, where all four genuinely fail. Leaving any of them behind
fails the build as a stale entry (AR-11), so removal is self-enforcing rather than a thing to
remember — but each fixing task names its own removal explicitly so nobody has to discover it from a
red build. Net movement for the phase: **−4, +0** (AC-6).

**One trap the guard cannot see for you.** Five of the six edited allowlisted blocks are
grandfathered on `TS2304`, and a forgotten `at` import is *also* `TS2304`. This is why
[03-01](03-01-example-compile-guard.md) compares the full diagnostic **code set plus the named
identifier** rather than a single first code — without that, a botched conversion in `buttons.ts`
(6 of the 53 lines) would pass silently.

## Code examples

### Before / after — the dominant shape

```ts
// before
 * const list = new ListView({ items, focused });
 * list.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 30, height: 8 } };
 * root.add(list);

// after
 * root.add(at(new ListView({ items, focused }), 0, 0, 30, 8));
```

## Error handling

| Error case | Handling strategy | AR |
|---|---|---|
| An edited example forgets to import `at`/`cover`/`row`/`col` | The guard fails the block on `TS2304` — **but only because 03-01 compares the code *set* and the named identifier.** On a not-already-allowlisted block a bare first-code check would suffice; on the five `TS2304`-grandfathered blocks it would not, and those are exactly the blocks this sweep edits most heavily. This is the primary reason 03-01 is sequenced first | AR-2, AR-9 |
| A raw write under `packages/ui/src/layout/` or `packages/ui/src/view/dsl/` is converted by mistake | AC-3 carves out `view/dsl/` (the group that survives the grep); the layout engine's own docs must show the raw API | AR-1 |
| A `TS2554` block is fixed but its allowlist entry is left behind | Guard fails with a stale-entry error | AR-11 |
| `syncOverlayVisible` turns out to be a root-barrel omission | Branch 0 — surfaced for a maintainer ruling, not silently worked around and not silently exported; recorded as AR-R1 | AR-6 |
| The collapsed `const x = at(new W(), …)` form breaks an example that needs the view first | Keep the two-line form for that block; the saving is didactic, not mandatory | AR-1 |

## Testing requirements

- The guard ([03-01](03-01-example-compile-guard.md)) is the oracle for every edit in this document.
  There is no separate test: an example that compiles and is not allowlisted is correct by the
  standard this plan establishes.
- **AC-2 / AC-3 / AC-5** are acceptance greps run at the end of the phase — one-shot completeness
  checks, deliberately not permanent tests, because a permanent ban on the raw prop would forbid
  `packages/ui/src/layout/` from documenting its own API.
- `check:docs` must stay green — the sweep must not introduce a banned reference or drop an
  `@example` tag.
