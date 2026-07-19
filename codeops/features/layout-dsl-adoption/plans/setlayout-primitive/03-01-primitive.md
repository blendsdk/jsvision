# 03-01 — the `setLayout` primitive (P1)

Implements [FR-1, FR-2, FR-3](01-requirements.md). One method on `View`
(`packages/ui/src/view/view.ts`), additive: nothing existing changes shape.

## The method

```ts
setLayout(patch: Partial<LayoutProps>): void {
  this.layout = { ...this.layout, ...patch };
  this.invalidateLayout();
}
```

Placed next to `invalidateLayout()` (`view.ts:211`), which it calls.

**Why the field, not a `_layout` backing store.** The issue's sketch pairs `setLayout` with
`get layout()`. That cannot ship in P1: a TypeScript class field cannot override a base-class
accessor, and 11 subclasses write `override layout: LayoutProps = {…}` as a field initializer
([02 §5](02-current-state.md)). Introducing the getter breaks all 11 immediately rather than at P4.
The getter is P4's problem (AR-3, AR-7).

**Why shallow, emphatically.** `LayoutProps.size` is a discriminated union. A deep merge would leave
the previous variant's fields behind — switching `fixed`→`fr` would produce
`{kind:'fr', weight:1, cells:1}`, a token that satisfies no branch cleanly. Shallow merge swaps
`size` and `rect` atomically. **ST-S2 exists specifically to fail if this is ever "improved" to a
deep merge**, and the code carries a comment saying so in plain language — this is the kind of
non-obvious invariant CLAUDE.md asks to be explained rather than left to be rediscovered.

The one thing shallow loses is per-side `padding`. Nothing needs it today; if it ever does, `padding`
gets handled specifically — never a blanket deep merge.

**Why unconditional invalidation.** `invalidateLayout()` is `this.host?.markRelayout()`, and
`markRelayout` sets a flag then calls a `scheduleFlush()` that early-returns when a flush is already
pending ([02 §1](02-current-state.md)). On an unmounted view `host` is `null` and the call is a
no-op; on a mounted one it is a flag write. There is no cost worth a conditional, and a conditional
would reintroduce exactly the "set and forget silently doesn't repaint" defect being removed.

## JSDoc

`setLayout` is public API on a public class, so it needs the full treatment (NFR-5): what it does,
the shallow-merge contract and *why* it is shallow, the auto-invalidation, and an `@example` that is
correct enough to paste. The `layout` field's own JSDoc gains a sentence naming `setLayout` as the
preferred write path — **in prose, with no `@deprecated` tag** (AR-6), because tagging it strikes
through ~118 call sites in every editor and in the generated TypeDoc for a removal that is deferred.

Neither comment may reference a plan, issue, or RD identifier (CLAUDE.md). The rationale is stated in
plain language or not at all.

## The API-reference snapshot

Editing `View`'s JSDoc drifts the committed plugin API-reference snapshot under
`tools/claude-plugin/`, which `yarn verify` checks via `check-plugin`. `yarn plugin:sync --fix` is
deterministic and needs no API key. It is a task in the phase, not something to discover at the gate.

## What P1 does not do

No call site changes. The field stays settable; every one of the 138 existing writes keeps compiling
and behaving identically. P1 is provable on its own: the spec tests pass, the whole suite is
untouched, and nothing has migrated yet.
