# 03-01 — the `setLayout` primitive (P1)

Implements [FR-1, FR-2, FR-2a, FR-3](01-requirements.md). One method on `View`
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
accessor, and there are 10 `override layout: LayoutProps = {…}` field initializers across 9 subclasses
([02 §5](02-current-state.md)). Introducing the getter breaks all 10 immediately rather than at P4.
The getter is P4's problem (AR-3, AR-7) — and not even sufficient for it, since a getter would not
stop the 9 in-place `layout.rect = …` mutations ([02 §5.5](02-current-state.md)).

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

Note what this does **not** claim: no site in the codebase currently depends on the new invalidation
(AR-5). Every runtime path that re-tags a mounted view already invalidates through a surrounding
`bind(…, { relayout: true })`. The unconditional call is a correctness default for *future* callers,
not a repair of a live defect.

**An explicit `undefined` resets, and that is the contract** (FR-2a). Spread semantics mean
`setLayout({ size: undefined })` clears `size`, and the engine reads it back as the default —
`normalizeProps` (`layout/types.ts:206-221`) uses `??` and `=== undefined` throughout, never `in`, so
`normalizeSize(undefined) → {kind:'auto'}`. Documented, not merely tolerated.

## JSDoc

`setLayout` is public API on a public class, so it needs the full treatment (NFR-5): what it does,
the shallow-merge contract and *why* it is shallow, the auto-invalidation, and an `@example` that is
correct enough to paste. Two constraints a caller cannot infer must be stated explicitly:

1. **An explicit `undefined` resets that prop to its layout default** (FR-2a) — including the un-set
   idiom `setLayout({ position: 'flow' })`, after which a stale `rect` is simply ignored.
2. **A `setLayout` call inside a constructor is erased by a subclass field initializer.** A base
   constructor body runs *before* a subclass's `override layout = {…}`, so a base that calls
   `setLayout` in its constructor loses the write entirely in any subclass that declares one. Prefer
   `setLayout` after construction or in `onMount`. There is no such call today; the note exists
   because this JSDoc is about to make `setLayout` the recommended idiom.

The `layout` field's own JSDoc gains a sentence naming `setLayout` as the preferred write path —
**in prose, with no `@deprecated` tag** (AR-6), because tagging it strikes through every remaining
call site in every editor and in the generated TypeDoc for a removal that is deferred.

Neither comment may reference a plan, issue, or RD identifier (CLAUDE.md). The rationale is stated in
plain language or not at all.

**The `@example` is not machine-checked here.** `check-jsdoc.mjs`'s missing-`@example` check
(Check B, `:15-17,161-187`) walks only classes and functions re-exported from a package barrel; it
never descends into class members, so a method's missing `@example` passes `yarn check:docs` cleanly.
Treat the requirement as a review obligation, not a gated one.

## The API-reference snapshot

**Adding a public member to `View`** drifts the committed plugin API-reference snapshot under
`tools/claude-plugin/`, which `yarn verify` checks via `check-plugin`. The mechanism is worth stating
correctly, because the obvious guess is wrong: `api-extract.mjs` emits member **signatures without
JSDoc** (`classMemberSig`, `:86-101`), so the snapshot moves when a member is **added or its
signature changes** — *not* when an existing member's JSDoc is edited. That means the `layout` field's
new prose sentence alone would drift nothing, while `setLayout(patch: Partial<LayoutProps>): void`
will.

`yarn plugin:sync --fix` is deterministic and needs no API key. It is a task in the phase, not
something to discover at the gate.

Related, and not covered by that regeneration: the hand-written
`tools/claude-plugin/skills/jsvision/references/widget-authoring.md:30` still tells widget authors to
call `this.invalidateLayout()` after a layout change. Once `setLayout` is the preferred write path
that guidance is stale, and `plugin:sync` will not touch it — it is not generated.

## What P1 does not do

No call site changes. The field stays settable; every one of the 82 existing executable writes keeps
compiling and behaving identically. P1 is provable on its own: the spec tests pass, the whole suite
is untouched, and nothing has migrated yet.
