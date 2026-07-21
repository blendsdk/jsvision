# Foundation: `ev.emit` primitive · Theme roles · `controls/` subsystem

> **Document**: 03-01-foundation.md
> **Parent**: [Index](00-index.md)

The cross-cutting prerequisites every later control depends on. Three pieces: the additive command-emit
primitive (PA-1), the faithful control theme roles (PA-5), and the `controls/` subsystem skeleton (PA-4).

## A. The `ev.emit()` dispatch-envelope primitive (PA-1)

### Proposed change
A focused control raises a typed command directly from `onEvent`. The loop's `RouteContext` already
carries `emitCommand` (`event/dispatch.ts:31`); expose it on the per-event envelope.

```ts
// view/types.ts — DispatchEvent gains two optional accessors sourced from the active RouteContext:
export interface DispatchEvent {
  readonly event: AppEvent;
  handled: boolean;
  readonly local?: Point;
  /** Raise a typed command onto the current dispatch tick (RD-06 PA-1). Present when a RouteContext
   *  is active (always, during real dispatch); undefined only in bare unit-constructed envelopes. */
  readonly emit?: (command: string, arg?: unknown) => void;
  /** Focus another view (RD-06 PA-10) — used by `Label` to focus its link. Same source/availability
   *  as `emit`. */
  readonly focusView?: (view: View) => void;
}
```
- **Wiring (single enrichment point in `route()`):** `route()` (`event/dispatch.ts:88`) is the one path
  every event passes through before reaching a view (key, command-cascade, and mouse all flow through it),
  and it delivers one envelope to many views — so enrich there, not "per phase". Add `emit` + `focusView`
  to the `RouteContext` interface (`dispatch.ts:23` — it currently carries `emitCommand`/`focusNext`/
  `focusPrev`/`hitTestRoute` but **not** `focusView`), source them in `event-loop.ts routeContext()`
  (`:198` — `emit: (c,a) => this.registry.emit(c,a)`, `focusView: (v) => this.focus.focusView(v)`, the
  same `focus.focusView` already handed to `hitTestRoute` at `:219`), then at the top of `route()` build
  one enriched envelope `const ev2 = { ...ev, emit: ctx.emit, focusView: ctx.focusView }` and use `ev2`
  for the mouse branch + the pre/focus/post sweeps. The `hit-test.ts` `{ ...ev2, local }` spread then
  propagates both accessors to mouse-local envelopes. A fresh object respects the `readonly` envelope
  fields; intra-ui, additive, no loop re-shape (mirrors the RD-05 `setCapture`/`onFrame` seams). Existing
  call sites are unaffected (both fields are new + optional).

### Error handling
| Case | Strategy | Ref |
|------|----------|-----|
| `ev.emit` called with no active context (bare test envelope) | optional-chained `ev.emit?.(…)` ⇒ no-op; controls never assume it exists | PA-1 |
| command disabled | the registry drops a disabled command (existing RD-04 behavior) | PA-1 |

## A2. Per-view focus-change reactivity primitive (PF-009)

### Why
`View.state.focused` is a **plain** boolean (`view/view.ts:38`); the focus manager flips it and calls
`invalidate()` on **only** the view whose focus changed (`event/focus.ts:99-109`), and partial recompose
repaints only that view's own subtree (`view/render-root.ts:253-263`). So a `bind(() => v.state.focused)`
never re-fires (plain field ⇒ no subscription), and a view cannot react to **another** view's focus. A
control reflecting its **own** focus is fine (it is the invalidated view; its `draw()` re-reads
`state.focused`). But two RD-06 needs cross that boundary: **`Label`** must repaint when its **link's**
focus flips (AC-2/ST-04), and **`Input`** must run its blocking validator on **focus-loss** (PA-2). Both
require focus to be **observable**.

### Proposed change (additive, minimal)
Add a lazy per-view focus-change signal the focus manager pokes when it flips `state.focused`:
```ts
// view/view.ts — additive, lazy (only created when first observed; non-observing views pay nothing):
/** @internal Reactive focus-change tick (PF-009). Lazily created by `focusSignal()`. */
focusTick?: Signal<void>;
/** Subscribe to this view's focus changes (returns a signal that ticks on every focus flip). */
focusSignal(): Signal<void> { return (this.focusTick ??= signal(undefined, { equals: () => false })); }
```
- `event/focus.ts focusLeaf()`: after each `old.state.focused = false` / `view.state.focused = true`,
  also `old.focusTick?.set()` / `view.focusTick?.set()` (poke only if someone observes it). Additive —
  existing plain-field readers are unaffected; the `equals: () => false` makes every flip notify.
- **Label** (03-02): `onMount(() => this.bind(() => this.link.focusSignal(), () => this.invalidate()))` —
  the link's focus tick re-runs the effect, which repaints the Label (it re-reads `link.state.focused`).
- **Input** (03-05): `onMount(() => this.bind(() => this.focusSignal(), () => { if (!this.state.focused)
  this.runBlockingValidation(); }))` — fires `valid()` on the focused→unfocused transition.

> This is a **second additive primitive** (alongside `ev.emit`/`ev.focusView`) + an additive RD-04
> focus-manager edit — so RD-06 is **not** zero-spine-work (02-current-state corrected). Both are additive
> and break no existing call site (PF-009).

### Error handling
| Case | Strategy | Ref |
|------|----------|-----|
| nobody observes a view's focus | `focusTick` stays `undefined`; the focus manager's `?.set()` is a no-op (zero cost) | PF-009 |
| Label's link never focusable | `focusSignal()` still exists; it simply never ticks (no highlight) | PF-009 |

## B. Faithful `cpGrayDialog` control theme roles (PA-5)

### Proposed change
Add to `@jsvision/core` `Theme` + `defaultTheme` the control roles, each decoded from
`app.h:142` `cpAppColor[ cpGrayDialog[slot] ]` (`dialogs.h:42-72` slot map). **Buttons reuse** the
existing `button` (slot 10, `0x20` black/green) + `buttonFocused` (slot 12, `0x2F` white/green).

```ts
// core/src/engine/color/theme.ts — additive roles (exact bytes pinned FROM app.h in the spec test):
readonly staticText: ThemeRole;        // slot 6  (verified 0x70 black/lightGray)
readonly label: ThemeRole;             // slot 7  (label normal)
readonly labelSelected: ThemeRole;     // slot 8  (link focused)
readonly labelShortcut: ThemeRole;     // slot 9  (hotkey accent)
readonly buttonDefault: ThemeRole;     // slot 11
readonly buttonDisabled: ThemeRole;    // slot 13
readonly buttonShortcut: ThemeRole;    // slot 14 (button hotkey accent)
readonly clusterNormal: ThemeRole;     // slot 16
readonly clusterSelected: ThemeRole;   // slot 17 (focused item)
readonly clusterShortcut: ThemeRole;   // slot 18 (hotkey accent)
readonly clusterDisabled: ThemeRole;   // slot 31
readonly inputNormal: ThemeRole;       // slot 19 (unfocused field)
readonly inputSelected: ThemeRole;     // slot 20 (focused field)
readonly inputArrows: ThemeRole;       // slot 21 (◄/► scroll arrows)
```
- **AC→role name map (PA-5).** RD-06 AC-3/AC-9 (and earlier prose) use TV's role names `buttonNormal`,
  `buttonSelected`, `labelNormal`; these are **not** new symbols — they map to the existing/added roles:
  `buttonNormal`→existing `button`, `buttonSelected`→existing `buttonFocused`, `labelNormal`→`label`. The
  ST-02/ST-05 oracles assert the actual role names (`button`/`buttonFocused`/`label` + the new roles),
  not the AC aliases.
- ScrollBar (4–5) + ListViewer (26–29) roles → RD-11; History (22–25) → RD-07 (not added here).
- The hotkey-accent roles (`labelShortcut`/`buttonShortcut`/`clusterShortcut`) supply the `~hotkey~` color;
  where TV uses a distinct shortcut slot, the role's `hotkey?` field carries it on the base role.

### Error handling
| Case | Strategy | Ref |
|------|----------|-----|
| a byte mis-decoded vs source | the spec oracle asserts each role `==` the source decode; CI fails until corrected | PA-5 |
| `encode()` of a new role throws | covered by the per-role encode spec (no throw) | AC-9 |

## C. The `controls/` subsystem skeleton (PA-4)
- `packages/ui/src/controls/index.ts` — the barrel; explicit named re-exports added to `src/index.ts`.
- Files: `text.ts`, `label.ts`, `button.ts`, `input.ts`, `cluster.ts`, `check-group.ts`, `radio-group.ts`;
  validators in `controls/validators/{types,filter,range,lookup,index}.ts`. Each ≤ 500 lines.
- Convention: ESM/NodeNext `.js` specifiers, JSDoc on every exported symbol, zero runtime deps.

## Integration Points
- `ev.emit` is consumed by `Button` (03-03) and any future command-emitting control.
- The theme roles are consumed by every control's `draw()` via `ctx.color(role)`/`ctx.role(role)`.
- **`~hotkey~` parsing + Alt-hotkey matching (reuse, PF-005).** `Label`/`Button`/`Cluster` need tilde
  parsing/accenting and `Alt-<hotkey>` key matching. Reuse the existing `parseTilde`/`tildeSegments`
  from `menu/builders.ts` (re-exported via `menu/index.js`) — there is direct precedent:
  `status/statusline.ts` already imports `parseTilde` from `../menu/index.js`. For the `Alt-<hotkey>`
  key→char match, reuse the existing matcher (`status/`'s `matchesChord` / the `menubar` Alt-hotkey
  logic) or extract a small shared helper; do **not** re-shape `menu/`. This creates a documented
  `controls/`→`menu/` import edge (the neutral-shared-util relocation is a later option, not RD-06 scope).

## Testing Requirements
- Spec: the `ev.emit` envelope carries the command to the registry (a focused stub control emits `'ok'` ⇒ a command spy sees it). The new theme roles deep-equal their `app.h` source decode + `encode()` no-throw.
- Impl: `ev.emit` is `undefined` on a bare envelope (optional-chain safe); roles present in `defaultTheme`.
- Impl (PF-009): a view's `focusSignal()` ticks when the focus manager flips its focus (a bound effect re-runs); an **unobserved** view keeps `focusTick === undefined` (the `?.set()` poke is a no-op — zero cost).
