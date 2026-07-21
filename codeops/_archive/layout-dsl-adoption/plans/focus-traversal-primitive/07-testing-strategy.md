# 07 — Testing Strategy

> **Plan**: layout-dsl-adoption/focus-traversal-primitive
> **CodeOps Skills Version**: 3.9.0

Spec-first (CodeOps): the new spec oracles are written and **red** on current code before `advance()`
changes; the existing oracles are **witnesses** that must stay green **unedited** (no immutable-spec
exception is used in this plan — AR-7). Verify: `TUI_SKIP_PERF=1 yarn verify` + `yarn bench`
no-regression. New tests are driven through the **public** loop surface (`focusNext`/`focusPrev`/
`getFocused` + dispatched `Tab`/`Shift-Tab`), mirroring `event.focus.spec.test.ts`.

## New spec oracles — `event.focus-traversal.spec.test.ts` (the DFS contract)

Expectations derive from RD-01 FR-3 + this plan's R-1…R-4, never from the implementation.

| ID | Setup (real `View`/`Group`, real loop) | Input → Expected |
|----|----------------------------------------|------------------|
| **ST-F1** | `root = [ g1=[a1, a2], b ]`, all leaves focusable | focus `a2` (last of `g1`); `focusNext` → **`b`** (Tab *exits* `g1`, does not wrap to `a1`). Today: traps on `a1`/`a2`. |
| **ST-F2** | `root = [ g1=[ g2=[a1], a2 ], b ]` | from `a1`: `focusNext` → `a2` → `b` → wrap `a1` (tree order across two nesting levels). `focusPrev` reverses exactly. |
| **ST-F3** | `root = [ a, g=[b, c] ]` | from `c` (last in scope) `focusNext` → **`a`** (wrap at scope). From `a` `focusPrev` → **`c`** (reverse wrap). |
| **ST-F4** (non-Tab restore) | `root = [ g1=[a1, a2], g2=[b1, b2] ]` | `focusNext`×2 → `a1, a2` (so `g1.current = a2`); `focusView(b1)` — a **non-Tab** jump into `g2` that leaves `g1` without a climb, so `g1`'s memory is kept; `focusNext` → `b2`; `focusNext` → **wrap restores `a2`** (`focusInto(g1)` restores its saved child because `g1` was left by a non-Tab path; `g2`, which Tab just exited, was reset — re-entering it would go to `b1`). Proves restore survives for non-Tab entry while continuous Tab stays pure tree order. |
| **ST-F5** (modal confinement) | desktop `root = [ bg(focusable), dialog ]`; run `dialog` via `execView` with children `[ok, cancel]` | `Tab` cycles **only** `ok ⇄ cancel` (wrap within the modal); `getFocused()` is **never** `bg`. Proves `scope = modal.topView()`. |
| **ST-F6** (DSL integration) | `dlg` built with the real DSL: `col(row(input), row(ok, cancel))` added to the dialog | `Tab`: `input → ok → cancel → wrap input`. The whole point — nested `col`/`row` is now traversable. |
| **ST-F7** (key path) | ST-F1's tree, focus `a2` | dispatched unbound **`Tab`** key → `b`; **`Shift-Tab`** back → `a2`; keys consumed (not delivered as plain keys), extending ST-04's key-path guarantee to the cross-group case. |

## Impl tests — `event.focus-traversal.impl.test.ts`

| ID | Assertion |
|----|-----------|
| **IMP-1** | Nothing focused: `focusNext` → first focusable in scope; `focusPrev` → last. |
| **IMP-2** | Disabled/removed anchor under DFS: disable the focused leaf, `focusNext` resumes from the nearest tree-order candidate in-direction (extends hardening `:263` to a nested group, then bubbles out). |
| **IMP-3** | No new **per-frame** allocation — the traversal runs per Tab keypress, not per frame. Per press it does O(depth) small `children.filter(canReceiveFocus)` allocations (one per climbed level) + O(depth) pointer writes for the exited-group reset; assert it is bounded by scope depth. `yarn bench` shows no hot-widget regression past the 16 ms off-CI ceiling. |
| **IMP-4** | `scope = null` (nothing mounted) → `focusNext`/`focusPrev` no-op. |

## Witnesses — MUST pass **unedited** (green before and after)

| ID | File / case |
|----|-------------|
| W-1…W-4 | `event.focus.spec.test.ts` ST-03 (current chain), ST-04 (flat wrap/skip + Tab key + consumed), ST-05 (container focusable iff descendant; descend; empty container skipped), ST-06 (repaint old+new, one flush). |
| W-5 | `event.focus.impl.test.ts:29` — restore on group re-entry. |
| W-6 | `event.focus.impl.test.ts:56` — descend into a group focuses its first focusable child. |
| W-7 | `event.focus.impl.test.ts` — focusView non-focusable no-op; zero-focusable no-op; hidden-ancestor block. |
| W-8 | `event.hardening.spec.test.ts:263` — `advance()` recovers from a disabled anchor. |
| W-9 | `event.hardening.spec.test.ts:307` — quit cascades through a modal stack (traversal change must not perturb modal lifecycle). |

## Done-criteria

- ST-F1…F7 green after implementation; **all witnesses W-1…W-9 green unedited**.
- IMP-1…IMP-4 green; `TUI_SKIP_PERF=1 yarn verify` green; `check:docs` green; `yarn bench` no-regression.
- No `*.spec.test.ts` (or impl) edited among the witnesses (AR-7).
