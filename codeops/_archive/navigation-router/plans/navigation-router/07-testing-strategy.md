# Testing Strategy: Navigation / Screen Router

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

Spec-first: each ST-# is an immutable oracle derived from requirements/AR — write it, watch it go red,
implement, watch it go green. All ST oracles are **headless** (vitest `unit` project; no TTY). Impl
tests (`*.impl.test.ts`) cover internals/edges beyond these.

## Phase 0 — de-risking spike oracles

| ST | Given → Expect | Traces |
|----|----------------|--------|
| ST-1 | `createApplication({ content: plainView })` → `plainView` is the `fr:1` body; `app.desktop === undefined`; emitting `Commands.tile`/`cascade` is unhandled (no window op). | R-1, R-7 / AR-2, AR-10 |
| ST-2 | `createApplication({})` (no content) → body is a `Desktop`; `app.desktop instanceof Desktop`; `Commands.tile` tiles windows (regression — unchanged behavior). | AR-2, AR-10 |
| ST-3 | `chromeHost.setStatus([a,b])` → the status line's command items become `[a,b]` and activating `a` emits its command; `setStatus(null)` → the base items return. | R-3 / AR-21 |
| ST-4 | `chromeHost.setMenu(items)` then open the menu → navigation/activation uses the NEW items (controller rebuilt); `setMenu(null)` → base menu navigates. | R-3 / AR-21 |
| ST-5 | With a status item bound to command `c`: `loop.enableCommand(c,false)` → on the next frame the item draws greyed **with no other trigger**; `enableCommand(c,true)` → un-greyed. | R-8 / AR-11 |
| ST-6a | Focus restore across `back()` to a **warm** (`keepAlive`) frame restores the **exact** previously-focused view. *Fixed oracle — up-front.* | R-6 / AR-19 |
| ST-6b | Focus restore across `back()` to a **disposed+rebuilt** frame: the captured **index-path** resolves the same-position focusable leaf in the rebuilt tree and focuses it; `firstFocusableLeaf` is the guaranteed floor when the path does not resolve. *Finalized by the Phase 0 spike — see the decision below.* | R-6 / AR-19 |

### AR-19 middle-tier decision (Phase 0 spike outcome)

The spike measured the **index-path** resolver (`focusPath` capture → `viewAtPath` resolve, `router/focus.ts`) against a dispose→rebuild of an identically-structured screen. It restores the exact same-position leaf with no per-route configuration. **Decision: the index-path resolver is the automatic middle tier.** A route only needs `focusKey` when its rebuild *reshapes* the tree (so a stored index no longer maps to the same control); `firstFocusableLeaf` is the best-effort floor when neither the exact ref, a `focusKey`, nor the path resolves. Finalized restore order: **exact (warm) → `focusKey` (explicit override) → index-path (automatic) → first-focusable floor.**

**Phase 0 exit = ST-1…ST-5 + ST-6a/6b green + the AR-19 middle-tier decision recorded in this doc + `03-02`.**

## Phase 1 — router core (stack, params, location)

| ST | Given → Expect | Traces |
|----|----------------|--------|
| ST-7 | `push('detail',{id:42})` → `location()` deep-equals `{name:'detail',params:{id:42}}`; the router body shows `detail`'s `bundle.view`. | R-2, R-4 / AR-3 |
| ST-8 | Stack ops: `canGoBack()` is `false` at root and `true` after a `push`; `back()` returns to the prior screen; `back()` at root is a **no-op** (state unchanged, no throw). | R-2, R-4 / AR-12 |
| ST-9 | `replace('x')` swaps the top without changing depth; `reset('home')` collapses to a single frame (`canGoBack() === false`). | R-2 |
| ST-10 | Params flow: the value passed to `push` reaches `build`'s `ctx.params` unchanged; `location().params` is the same. (Type-safety is asserted by a compile-time type test / `// @ts-expect-error` on a wrong param.) | R-2 / AR-8, AR-14 |
| ST-11 | `initial:{name:'detail',params:{id:1}}` builds the initial screen with `{id:1}`. | R-2 / AR-14 |
| ST-12 | `build` throws → `push` does not throw; the current screen stays mounted; the app logger received the error. | — / AR-13 |
| ST-13 | `serialize`/`parse` round-trip: `parse(serialize(p))` deep-equals `p` for a route's params (codec designed; no `restore()` asserted — deferred to #19). | R-4 / AR-9 |
| ST-18 | **Reactivity** (not just value): an `effect` reading `location()` re-runs on `push`/`back`/`replace`, and one reading `canGoBack()` re-runs when depth crosses 1 — proving the accessors are reactive, not snapshot getters. | R-4 / AR-9 |

## Phase 2 — keep-alive + chrome contributions

| ST | Given → Expect | Traces |
|----|----------------|--------|
| ST-14 | `keepAlive:false` (default): after `push` then `back`, the popped screen was disposed (its `onCleanup` fired) and a return rebuilds it fresh. | R-5 / AR-7 |
| ST-15 | `keepAlive:true`: mutate the screen's local state, `push` away, `back` → the state survives (screen not re-`build`t; same `view` instance). | R-5 / AR-7 |
| ST-16 | Chrome contribution: a screen with `status` replaces the bar on activation; a screen without `status` shows the base; `withBase(base,[x])` yields `[...base, x]`. | R-3 / AR-4 |

## Phase 3 — demos (kitchen-sink smoke)

| ST | Given → Expect | Traces |
|----|----------------|--------|
| ST-17 | Both router stories mount headlessly, paint a non-empty frame, and carry a unique id + required metadata: the **drill-down browser** story (its `keepAlive` list preserves scroll across `back()`) and the multi-step **wizard** story (`navigation/wizard`, its first-step `Account` title + `Next` action paint). The `wizard-demo` e2e additionally proves the "Next greys until the step validates" gate — an invalid `emitCommand('wizard.next')` is dropped — and keepAlive-preserved values across a Back round-trip. *(Wizard half re-widened here once `@jsvision/forms` merged — AR-24 / GH #91.)* | R-9 / AR-11, AR-7 |

## Verification

- **Per task**: the relevant ST/impl tests green.
- **Per phase**: `yarn verify` green (lint → typecheck → build → test → check:docs), plus the
  kitchen-sink smoke for Phase 3.
- **Regression**: the full existing `@jsvision/ui` + `@jsvision/core` suites stay green (additive-only
  changes; ST-2 pins the Desktop path).
- **Verify command** (AR-20): `yarn verify`.
