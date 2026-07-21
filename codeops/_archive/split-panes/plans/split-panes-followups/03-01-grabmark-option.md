# Component Spec: Reactive grab-mark option (item 1)

> **Document**: 03-01-grabmark-option.md
> **Parent**: [Index](00-index.md) · **Requirements**: F1–F6

The only shipped-source change in this plan. `packages/core` is untouched.

## API changes

### `SplitViewOptions` (`packages/ui/src/split/split-view.ts`)

Add one optional field:

```ts
/**
 * Whether each splitter draws the `▓` grab mark at its midpoint. Defaults to `true`. This is only the
 * initial value — the live state lives in the public {@link SplitView.grabMark} signal, so you can
 * flip it at runtime.
 */
grabMark?: boolean;
```

### `SplitView` (`packages/ui/src/split/split-view.ts`)

Add a public reactive signal, seeded from the option:

```ts
/**
 * Whether the splitters draw their `▓` grab mark. Seeded from {@link SplitViewOptions.grabMark}
 * (default `true`); write it to show/hide the mark on every divider at runtime — the splitters repaint
 * on the next frame.
 */
readonly grabMark: Signal<boolean>; // declared here; assigned once in the constructor
```

- In the constructor, assign it **before** the splitters are created (each `Splitter` reads
  `owner.grabMark`): `this.grabMark = signal(opts.grabMark ?? true);` — a single assignment to the
  `readonly` field, no class-field initializer.
- `SplitView implements SplitOwner`, so exposing `grabMark` also satisfies the widened interface.
- `signal` is currently imported? It is **not** — `split-view.ts` imports `type { Signal }` only. Add
  the value import `import { signal } from '../reactive/index.js';` (the same module `splitter.ts`
  uses). *(Guards the TS6133-style pitfall in reverse — a missing value import.)*

The `@example` on the `SplitView` class JSDoc gains one line showing the toggle, e.g.:

```ts
split.grabMark.set(false); // hide the ▓ grab marks; .set(true) restores them
```

### `SplitOwner` (`packages/ui/src/split/splitter.ts`)

Widen the interface the splitter drives:

```ts
export interface SplitOwner {
  beginDrag(index: number, ev: DispatchEvent): void;
  resizeBy(index: number, delta: number): void;
  /** Whether splitters draw the `▓` grab mark (read live so a toggle repaints). */
  grabMark: Signal<boolean>;
}
```

Add `import type { Signal } from '../reactive/index.js';` to `splitter.ts`.

### `Splitter` (`packages/ui/src/split/splitter.ts`)

1. **Bind the flip** — extend the existing `onMount` bind so a `grabMark` change repaints (draw is not
   auto-tracked):
   ```ts
   this.onMount(() => {
     this.bind(() => {
       this.dragging();
       this.owner.grabMark();
     });
   });
   ```
2. **Gate the draw** — read `owner.grabMark()` once and guard the grab-mark lines:
   ```ts
   const style = ctx.color(this.dragging() ? 'splitterDragging' : 'splitter');
   const row = this.direction === 'row';
   ctx.fill(row ? '│' : '─', style);
   if (this.owner.grabMark()) {
     if (row) ctx.text(0, Math.floor(ctx.size.height / 2), '▓', style);
     else ctx.text(Math.floor(ctx.size.width / 2), 0, '▓', style);
   }
   ```
   Update the `draw` JSDoc: "…then the static `▓` grab mark at the midpoint **when
   `owner.grabMark()` is true**."

## Behavior

- **Default true** → identical to today's output (F1, AR-11). No existing caller sets the option.
- **`false` at construction** → no `▓` anywhere; only the line paints (F3).
- **Runtime flip** → `split.grabMark.set(v)` notifies; each splitter's bound reader schedules a frame;
  `draw` re-runs and the `▓` appears/disappears (F2, F4). Works in `row` and `col` and for every
  splitter (they all read the same owner signal).

## Story wiring (F5) — `packages/examples/kitchen-sink/stories/split.story.ts`

- Make the returned root a small local `Group` subclass with `override preProcess = true` and an
  `onEvent` that, on key `g`, flips `grabMark` on both the outer and inner `SplitView` and sets
  `ev.handled = true`; all other events fall through so the focused splitter's arrows still work
  (AR-12, mirroring `drill-down.story.ts`).
- Update the hint/blurb to mention `‹g› grab mark`.
- The two `SplitView`s already exist in the story; keep references to flip both.

## Non-goals

- No per-splitter control, no theme role, no change to `Splitter`'s constructor signature (it reads
  the owner, not a new arg) — AR-3.
