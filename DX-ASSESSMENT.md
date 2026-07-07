# Developer Experience (DX) Assessment — `@jsvision/ui`

> An outside evangelist's non-sugarcoated audit of the public API surface, judged through the
> eyes of a 2026 TypeScript/Node developer who also knows Python, Go, and Rust — someone whose
> instincts were formed by React/Ink, SolidJS, Textual, ratatui, and Bubbletea.
>
> **Scope:** `@jsvision/ui` (the app-developer-facing framework), with `@jsvision/core` covered
> where it leaks into the UI developer's path. Evidence is cited as `file:line`.
> **Method:** four parallel deep reads of composition, widget authoring/reactivity, API
> consistency/types/docs, and events/commands/errors — cross-checked against the real flagship
> example (`packages/examples/tvision-demo/`).
>
> **A note on Turbo Vision fidelity:** the "decode, don't design" mandate is scoped to
> *drawing/geometry/color* (per `CLAUDE.md`). Nothing in this report asks you to change a rendered
> glyph. Every recommendation is about the *developer-facing API*, which your own charter says may
> freely extend TV (reactive binding, async modality already do).

---

## TL;DR — the headline verdict

**Overall: 6.0 / 10 — a B-minus. A Ferrari engine bolted to a 1990s manual gearbox, shipped with
a maintainer's lab notebook where the owner's manual should be.**

The engineering *underneath* is genuinely excellent — a faithful Solid-style reactive core, a
correct modern ESM package, clean generics with zero `any` in public signatures, a fail-fast
keymap, a best-in-class screen-safe logger, and promise-based modality. On raw capability this beats
every TS TUI framework on the market, Ink included.

But the **developer-facing surface has not caught up to the engine.** A modern developer *will* fight
this framework — not on capability, but on ergonomics: everything is imperative `new X()` + `.add()`
+ mutate-`.layout`, there is no declarative authoring, the polished conveniences are missing or
bypassed, the two-package split leaks capability plumbing into "hello world," and — the single
cheapest, highest-impact problem — the public JSDoc is written for the framework's *maintainers*, not
its *users*. **The good news: almost every deduction is a thin-layer or documentation fix, not an
architectural one.** The bones are right. This is a polish problem, and polish is cheap relative to
what's already built.

---

## Scorecard

| # | Dimension | Rating | One-line justification |
|---|-----------|:-----:|------------------------|
| 1 | Reactive primitives | **9/10** | Idiomatic Solid clone: callable signals, lazy memoized `computed`, owner-scoped leak-free disposal, keyed `For`. |
| 2 | Type ergonomics | **9/10** | Clean `<T>` generics, `Omit`-based specialization, **zero `any` in public signatures**, strict + decl maps. |
| 3 | Packaging / modern ESM | **9/10** | `"type":"module"`, `sideEffects:false`, `exports` map, zero runtime deps, tree-shakeable. |
| 4 | Keyboard / keymap | **8/10** | `createKeymap` with **build-time validation** and clear errors; docked for global-only scope + lives in `core`. |
| 5 | App lifecycle / `run()` | **8/10** | `run(): Promise<number>` owns raw mode, alt-screen, and guaranteed restore on every exit path. |
| 6 | Modality & dialogs | **6.5/10** | `Dialog` (auto-center + `valid()` gate) + promise `execView` are great; raw path is heavy, no `messageBox`. |
| 7 | API consistency & naming | **6.5/10** | Strong dominant convention; 3 outlier constructors + `onChange`/`onCommit` synonym split. |
| 8 | Error handling & debuggability | **6.5/10** | Excellent facilities (screen-safe logger, typed errors) but **under-wired** into the UI path. |
| 9 | Event & command model | **6/10** | Overloaded envelope; **no first-class `onCommand`** — you hand-roll an invisible sink view. |
| 10 | Getting started / time-to-first-app | **6/10** | `run()` is a one-liner, but `caps` is a required, hand-built, two-package prerequisite. |
| 11 | Layout ergonomics | **6/10** | Content layout is flexbox-grade; **window placement is raw pixel math**. |
| 12 | Custom widget authoring | **6/10** | One abstract method, clipped paint facade — but type-invisible footguns and no declarative option. |
| 13 | Reactive↔imperative seam | **5/10** | Two mental models; the boundary is enforced by **prose, not types**. |
| 14 | Composition model | **5/10** | Fully imperative `new`/`.add()`/mutate; **no declarative/JSX/render-function path at all**. |
| 15 | **Discoverability / docs (for consumers)** | **3/10** | **2094 internal traceability codes** in consumer hover text; **not one `@example`** anywhere. |

**Unweighted mean ≈ 6.7; experience-weighted ≈ 6.0** — because the dimensions a developer hits *first
and most often* (composition, the reactive seam, and docs) are the weakest, while the 9-tier
strengths (packaging, types, reactive internals) are things they benefit from silently without ever
"feeling" the DX.

---

## What is genuinely excellent (no strawmen — credit where due)

These are real, and a competing framework would envy them:

- **The reactive core is a clean, idiomatic Solid.js clone.** Callable signal accessors with
  `.set`/`.update`/`.peek` (`packages/ui/src/reactive/signal.ts:52-56`), lazy memoized `computed`
  with diamond short-circuit (`reactive/computed.ts:58-68`), and **owner-scoped, leak-free-by-
  construction disposal** with a dev-warning when you create a computation with no owner
  (`reactive/owner.ts:36-39`). Keyed `For` reuses node instances on reorder and hands each item a
  reactive `index()` (`reactive/for.ts:43-127`). If you know Solid, you already know this.
- **Two-way data binding is the best single feature.** `const name = signal(''); new Input({ value: name })`
  and the `Input` writes back through the same signal (`packages/examples/controls-demo/main.ts:78,83`;
  contract at `packages/ui/src/controls/input.ts:51-58`). This is Solid's model and it beats Ink's
  prop-drilling outright.
- **`run()` is a genuine one-liner lifecycle.** It owns raw mode, alt-screen, signals, and
  **guaranteed terminal restore in a `finally`** (`packages/ui/src/app/run.ts:62-138,132-133`) — a
  crash won't leave a wrecked terminal.
- **`createKeymap` validates at build time.** A bad chord throws with the offender quoted:
  `Invalid key binding 'ctrl+foo': unknown key 'foo'` (`packages/core/src/engine/input/keymap.ts:58-71`).
  This is exactly the fail-fast DX modern devs expect.
- **The screen-safe logger solves a real TUI problem properly.** It refuses to corrupt the screen by
  comparing device identity (`{dev,ino}`), not fd numbers, since stdout/stderr share one tty
  interactively (`packages/core/src/engine/safety/logger.ts:159-178`), degrading file→stderr→in-memory
  ring. Disabled by default; env-gated. This is the correct answer to "how do I debug when the app
  owns the screen."
- **Modality is promise-based and ahead of Ink.** `await execView<string>(dlg)` resolves to the
  terminating command (`packages/ui/src/event/event-loop.ts:237-253`), and `Dialog` auto-centers,
  self-closes on Esc/close-box, and has a `valid()` close-gate that vetoes OK and refocuses the first
  invalid field (`packages/ui/src/dialog/dialog.ts:82-92,126-142,180-190`).
- **The type + packaging story is modern and clean.** Generic `DataGrid<T>`/`ListView<T>`/`ComboBox<T>`,
  `ListBox = ListView<string>` via `Omit` (`packages/ui/src/list/list-box.ts:14-17`), **no `any` in any
  public signature** (repo-wide scan: the only `any` hits are inside comments), `sideEffects:false` +
  `exports` map + zero runtime deps (`packages/ui/package.json`).

**The central tension:** every one of those strengths lives *below the waterline*. The developer
experiences them passively. What they experience *actively* — composing a screen, authoring a widget,
reading a doc-comment — is the weak half. That inversion is why the felt DX is lower than the
engineering quality.

---

## Findings by theme

### A. The imperative-only wall — there is no declarative authoring path (composition 5/10, authoring 6/10)

Everything is built by hand: `new X()`, then `parent.add(child)`, then mutate `.layout`. There is no
JSX, no `children: [...]` constructor arg, no `compose()` generator, no render function returning a
tree. A form is a hand-written loop that news each control and assigns each child's `.layout.size`
(`packages/examples/controls-demo/main.ts:82-109`). A custom widget is *always* a `View` subclass with
a hand-painted `draw()` — the base class documents subclassing as "*the* escape hatch"
(`packages/ui/src/view/view.ts:6,120-121`), and there is no `jsx`/`jsxImportSource` anywhere in the
package.

This is the biggest gap versus every modern peer: React/Ink and Solid are declarative JSX; Textual
uses `compose()` yielding widgets; even Bubbletea has a functional `View() string`. Here, structure is
procedural. It works, and the retained-tree-is-not-signals decision is defensible for performance —
but it front-loads verbosity and conceptual load onto the developer.

### B. The two-mental-model seam, enforced by prose not types (seam 5/10)

A developer must hold **two disjoint models simultaneously**:

- **Reactive world:** signals/computed/effect, auto-tracked, auto-repaint via `View.bind(read, apply)`
  which wraps an `effect` that calls `this.invalidate()` (`packages/ui/src/view/view.ts:183-195`).
- **Imperative retained-tree world:** `bounds`, `state.visible/disabled/focused`, `Group.children` are
  **plain mutable fields**. Mutating them does *nothing* until you manually call
  `invalidate()`/`invalidateLayout()`.

The framework itself documents the trap: `syncOverlayVisible` explains that `overlay.children` and
`state.visible` are "**neither is a reactive source**, so an effect reading them would subscribe to
nothing" — so you flip the flag and call `invalidate()` by hand
(`packages/ui/src/app/application.ts:129-148`). Nothing in the type system stops a developer from
setting `state.visible = false` and expecting a repaint. The knowledge lives in comments.

**Type-invisible footguns in the same family:**
- `measure()` is *optional*, and an `auto` leaf with no `measure` **silently collapses to `{0,0}`** —
  the widget renders nothing. The example file warns about it in prose and every content widget must
  hand-write `override measure(a){ return a; }` (`packages/examples/tvision-demo/widgets.ts:5-6,47-49,87-89,143-145`).
  The compiler will not catch the omission (`packages/ui/src/view/view.ts:51`).
- `bind()`/`onCleanup()` throw if called before mount — the enforced idiom is "call inside `onMount()`",
  another ordering rule you learn by hitting it (`view.ts:184-185,256-257`).

### C. The missing convenience layer (getting-started 6/10, modality 6.5/10, commands 6/10)

The primitives exist; the *one-liners a developer reaches for daily* do not:

- **No `caps: 'auto'` default.** `caps` is `REQUIRED` on `ApplicationOptions`, `EventLoopOptions`, and
  `RenderRootOptions` (`packages/ui/src/app/application.ts:28`), and the *only* source is
  `@jsvision/core`'s `resolveCapabilities`, called with a manual override block before you can even
  construct the app (`packages/examples/tvision-demo/main.ts:125-130`). "Zero-config" is claimed but
  the front door demands capability plumbing.
- **No first-class app-command handler.** To catch an app command the shell doesn't handle, you build
  an *invisible post-process `View`*: the demo's `CommandSink` sets `postProcess=true`,
  `state.visible=false`, empty `draw()`, and maps `command → handler` in `onEvent`
  (`packages/examples/tvision-demo/widgets.ts:222-246`). The framework uses the identical trick
  internally as `QuitCommandSink` (`packages/ui/src/app/application.ts:88-108`). A workaround the
  framework hides from itself should be a public API (`loop.onCommand(name, fn)`).
- **No `messageBox()`/`confirm()`/`inputBox()`.** The nice `Dialog` class exists but the flagship demo
  bypasses it for the *raw* path: manual size-clamp, **manual centering math**
  (`Math.floor((dw-width)/2)`), a manual close callback that calls `endModal` + `desktop.remove` +
  emits a refresh, plus a `CommandSink` to open it — ~7 steps for one About box
  (`packages/examples/tvision-demo/main.ts:141-163`). That the *showcase* demonstrates the heavy path
  is a tell that the ergonomic path is under-surfaced.
- **Window placement is raw pixel math.** `help.layout.rect = { x:1, y:1, width:30, height:14 }` and
  `help.number = 1` by hand (`main.ts:166-187`). `desktop.tile()`/`cascade()` help *after* placement,
  but initial placement is absolute cells.
- **`execView` hangs silently if the view isn't mounted first** — an ordering footgun the `Dialog`
  doc warns about but the type doesn't enforce (`packages/ui/src/dialog/dialog.ts:19-21`;
  `event-loop.ts:237-239`).

### D. The two-package leak (getting-started 6/10)

A UI developer cannot stay inside `@jsvision/ui`. "Hello world" forces imports from *two* packages and
comprehension of capability resolution and the render primitives before drawing a single widget:
`resolveCapabilities` + `CapabilityProfile` (mandatory), `Attr` + `Style` (any custom `draw()`),
`createKeymap` + `Keymap` (any key binding) — all `@jsvision/core` only
(`packages/examples/tvision-demo/widgets.ts:17-18`; `packages/core/src/engine/index.ts:37`). Notably
`@jsvision/ui` does **not** re-export these, so the split is a tax, not a convenience.

### E. Docs written for maintainers, not users — the single biggest cheap fix (docs 3/10)

The doc comments are technically superb and completely mis-aimed. A regex for the internal code
families (`RD-`, `PA-`, `AR-`, `PF-`, `HR-`, `GATE-`, `AC-`, `ST-`, `ADR-`) returns **2094 occurrences
across `packages/ui/src/`**, and they land straight in the consumer's IntelliSense hover text:

- `ButtonOptions.command`: *"Command emitted via `ev.emit` on activation **(PA-1)**."* (`packages/ui/src/controls/button.ts:25`)
- `ListViewOptions.onSelect`: *"…`index` is DISPLAY order, `item` the `T` **(PF-003)**."* (`packages/ui/src/list/list-view.ts:35`)
- The `Button` class-level JSDoc — the first thing a hover shows — is ~13 lines of C++ port
  archaeology: *"Faithful to `TButton::drawState` (`tbutton.cpp:102-165`) … `cShadow = getColor(8)` =
  `cpButton[8]=0x0F` → cpGrayDialog slot 15 …"* (`packages/ui/src/controls/button.ts:1-14`). None of it
  helps someone deciding how to use a button.
- **There is not a single `@example` on any public component.** For a widget toolkit, a one-line usage
  example per widget is the highest-value doc a consumer can have, and it's absent everywhere.

The raw material for excellent docs is *already written* — the ComboBox two-mode doc and the
ProgressBar variable-width caveat are genuinely helpful *once you filter the codes out*. This is a
mechanical audience-separation problem, not a writing problem.

### F. API-shape inconsistencies (consistency 6.5/10)

The dominant convention — one `XxxOptions` object with a consistently-named `value: Signal<...>` — is
strong and holds across 9+ components. Three breaks tax muscle memory:

- **`RadioGroup(labels, value)` and `CheckGroup(labels, value)` are positional and ship no options
  type** (`packages/ui/src/controls/radio-group.ts:23`, `check-group.ts:21`) — while their sibling
  `MultiCheckGroup` in the same folder takes an options object *and* exports `MultiCheckGroupOptions`.
  Three "parallel" controls, three shapes.
- **`Button(text, opts)`** mixes positional + options (`packages/ui/src/controls/button.ts:60`) —
  defensible, but adds a third constructor shape.
- **`onChange` vs `onCommit` for identical semantics:** `Calendar` fires `onChange` on a day-commit
  (`packages/ui/src/date/calendar.ts:117`); `ColorSwatch` fires `onCommit` for the analogous
  release/Enter commit (`packages/ui/src/color/color-swatch.ts:80`). Same concept, two names.
- Minor: `readonly` on option fields is applied inconsistently across `.d.ts` (DataGrid/TabView/
  ProgressBar mark it; Button/ListView/Calendar don't).

### G. Under-wired safety (errors 6.5/10)

The best error facilities are never reached from the path a UI dev uses. `EssentialsNotMetError` +
`assertEssentials` produce an actionable message (*"Terminal does not meet the SDK essentials:
interactive TTY (raw-mode keyboard input)."*, `packages/core/src/engine/safety/errors.ts:37-40`) but
**no call to them exists in `packages/ui/src`** — on a non-TTY the host just skips raw mode and the app
silently has no keyboard; the demo hand-rolls its own `isTTY` check
(`packages/examples/tvision-demo/main.ts:113-119`). And the logger is silent unless `JSVISION_DEBUG=1`,
so an `onEvent` that throws every frame fails quietly by default.

---

## Prioritized recommendations

Ranked by **(impact on felt DX) ÷ (effort)** — highest leverage first. None changes a rendered glyph.

| # | Recommendation | Impact | Effort | Fixes |
|---|----------------|:------:|:------:|-------|
| 1 | **Public/internal doc split** — strip traceability codes from consumer JSDoc; add one `@example` per widget | ★★★★★ | Low–Med | E |
| 2 | **`caps: 'auto'` default + re-export core essentials from `ui`** | ★★★★★ | Low | C, D |
| 3 | **`loop.onCommand(name, fn)` / `app.onCommand()`** — kill the invisible-sink pattern | ★★★★ | Low | C |
| 4 | **`messageBox()` / `confirm()` / `inputBox()` async helpers** | ★★★★ | Low–Med | C |
| 5 | **Functional component factory** (`view({ measure, draw, setup })`) so trivial widgets skip subclassing; default `measure` to fill | ★★★★ | Med | A, B |
| 6 | **Normalize the 3 outlier constructors + unify `onChange`/`onCommit`** | ★★★ | Low | F |
| 7 | **Wire the essentials gate into `run()`** so non-TTY throws the nice error | ★★★ | Low | G |
| 8 | **Children-in-options / a `group()` builder** for declarative-ish composition | ★★★ | Med | A |

### Proposal 1 — Split consumer docs from maintainer traceability (highest leverage, cheapest)

The codes are valuable *internally* — keep them, but not in the sentence a consumer reads. Move
traceability to an `@internal`-tagged block (stripped from published `.d.ts` by `stripInternal`) and
lead every public symbol with a consumer sentence + an `@example`.

```ts
// BEFORE — packages/ui/src/controls/button.ts:1-14, :25
/**
 * Faithful to `TButton::drawState` (`tbutton.cpp:102-165`). `cShadow = getColor(8)` =
 * `cpButton[8]=0x0F` → cpGrayDialog slot 15 → `cpAppColor[0x2E]=0x70`. The hardware caret
 * is deferred (DEF-19). ...
 */
export interface ButtonOptions {
  /** Command emitted via `ev.emit` on activation (PA-1). */
  command?: string;
}

// AFTER
/**
 * A focusable command button. Press Space/Enter (or click) to activate; a `default` button
 * also fires on Enter when nothing in the focus chain consumes it.
 *
 * @example
 * const save = new Button('~S~ave', { command: 'save', default: true });
 * form.add(save);
 */
export interface ButtonOptions {
  /** Command name emitted when the button is activated. */
  command?: string;
  // ...
  /** @internal Faithful to TButton::drawState (tbutton.cpp:102-165); shadow getColor(8)=0x70. */
}
```

Enable `"stripInternal": true` in `tsconfig.base.json` so `@internal` blocks vanish from shipped
types. This alone moves the docs dimension from 3 to ~7.

### Proposal 2 — `caps: 'auto'` and re-export the core essentials (kills the two-package tax)

```ts
// BEFORE — the mandatory prologue every app repeats
import { resolveCapabilities } from '@jsvision/core';
import { createApplication } from '@jsvision/ui';
const caps = resolveCapabilities({
  override: { mouse: { sgr: true, drag: true, wheel: true }, unicode: { utf8: true } },
}).profile;
const app = createApplication({ caps, menuBar, statusLine });

// AFTER — caps defaults to 'auto' (resolveCapabilities().profile) inside createApplication
import { createApplication } from '@jsvision/ui';
const app = createApplication({ menuBar, statusLine });   // caps auto-detected
// power users still pass caps or an override when they need to force depth/mouse
```

Make `ApplicationOptions.caps?: CapabilityProfile | 'auto'` (default `'auto'`), and **re-export**
`resolveCapabilities`, `CapabilityProfile`, `Attr`, `Style`, and `createKeymap` from
`@jsvision/ui`'s entry point so a UI developer imports from one package. The two-package split then
becomes an advanced choice, not a first-touch requirement.

### Proposal 3 — First-class command handling (retire the invisible sink)

```ts
// BEFORE — packages/examples/tvision-demo/widgets.ts:222-246 + main.ts:163
class CommandSink extends View {           // an invisible post-process view...
  override postProcess = true;
  constructor(private handlers: Record<string, () => void>) { super(); this.state.visible = false; }
  override draw() {}
  override onEvent(ev: DispatchEvent) {
    const e = ev.event;
    if (e.type === 'command' && this.handlers[e.command]) { this.handlers[e.command](); ev.handled = true; }
  }
}
app.desktop.add(new CommandSink({ about: openAbout }));

// AFTER — a registration API on the loop/app (the framework already does this internally for quit)
app.onCommand('about', openAbout);         // returns an unsubscribe fn
```

Internally this is the same `QuitCommandSink` mechanism (`application.ts:88-108`) generalized and
surfaced. It removes the need for a consumer to understand `View` subclassing, phase flags,
`state.visible=false`, and the `handled` protocol just to answer a menu item.

### Proposal 4 — Async modal helpers over the existing `Dialog`

The `Dialog` class already auto-centers and self-closes; wrap the common cases so nobody hand-writes
centering math or teardown again:

```ts
// BEFORE — main.ts:141-163: ~7 steps (clamp size, center math, endModal+remove+refresh, add, execView, + a CommandSink to open)

// AFTER — one await, no math, no manual remove
await messageBox(app, { title: 'About', text: 'jsvision — Turbo Vision, reimagined' });
const ok = await confirm(app, 'Discard unsaved changes?');            // -> boolean
const name = await inputBox(app, { title: 'Rename', label: 'New name', value: signal('') }); // -> string | null
```

Signatures (thin wrappers, no new rendering):

```ts
export function messageBox(app: Application, o: { title: string; text: string; buttons?: 'ok' | 'okCancel' }): Promise<'ok' | 'cancel'>;
export function confirm(app: Application, text: string): Promise<boolean>;
export function inputBox(app: Application, o: { title: string; label: string; value: Signal<string>; validator?: Validator }): Promise<string | null>;
```

### Proposal 5 — A functional component factory (opt-out of subclassing) + safe `measure` default

Subclassing stays for complex widgets, but the 80% case (a `draw` + maybe a `setup`) shouldn't require
a class, and forgetting `measure` should never silently render nothing.

```ts
// BEFORE — packages/examples/tvision-demo/widgets.ts:38-60: a full class, plus a mandatory
// `override measure(a){ return a; }` or the view collapses to {0,0}.
class HelpView extends View {
  constructor(private lines: readonly string[]) { super(); }
  override measure(a: Size2D) { return a; }         // forget this -> invisible widget
  override draw(ctx: DrawContext) { /* ... */ }
}

// AFTER — a factory; measure defaults to "fill available", overridable
const helpView = (lines: readonly string[]) => view({
  draw: (ctx) => { ctx.fill(' ', ctx.color()); lines.forEach((l, i) => ctx.text(0, i, l, ctx.color())); },
  // measure omitted -> defaults to `available` (fill), not {0,0}
});
```

Independently, **change the `auto`-leaf default so a missing `measure` fills its slot** (or emits a
dev-warning through the logger) instead of collapsing to `{0,0}` — turn a silent footgun into a safe
default.

### Proposal 6 — Normalize the outlier constructors and the callback vocabulary

```ts
// BEFORE
new RadioGroup(['Low', 'High'], level);          // positional, no options type
new CheckGroup(['Bold', 'Italic'], flags);       // positional, no options type
// Calendar fires onChange; ColorSwatch fires onCommit for the same "committed" concept

// AFTER — options object + exported type, matching every other control
new RadioGroup({ labels: ['Low', 'High'], value: level });     // + export RadioGroupOptions
new CheckGroup({ labels: ['Bold', 'Italic'], value: flags });  // + export CheckGroupOptions
// pick ONE name (recommend onChange for value-commit, onSelect for activation) framework-wide
```

Keep the positional forms as deprecated overloads for one minor version to avoid a hard break.

### Proposal 7 — Wire the essentials gate into `run()`

`run()` should call the gate that already exists so a non-TTY start throws the *actionable* error
instead of silently yielding a keyboardless app:

```ts
// AFTER — inside runApplication(), before host.start()
assertEssentials(hostFacts);   // throws EssentialsNotMetError with "interactive TTY (raw-mode ...)"
```

This makes the codebase's best error message reachable from the path a UI developer actually runs, and
lets them delete their hand-rolled `isTTY` checks.

---

## Would a modern developer *fight* this framework?

**Honest answer: yes, but at the surface, not the core — and the fights are winnable cheaply.**

- **Day one:** they fight the `caps` prologue and the two-package import, then squint at IntelliSense
  full of `PA-1`/`tbutton.cpp` and wonder what a button *does*. (Proposals 1–2 erase this.)
- **First screen:** they fight the absence of declarative composition — everything is `new` + `.add()`
  + pixel rects — and the `measure()→{0,0}` trap. (Proposals 5, 8 soften this.)
- **First dialog / first menu action:** they fight the raw modal ceremony and discover the invisible-
  sink pattern for commands. (Proposals 3–4 erase this.)
- **Once past those:** they get a genuinely modern reactive model, two-way binding, a promise-based
  modal system, and a huge, faithful widget catalog — and they largely *stop* fighting.

The framework is **not** fighting them on business logic or capability; it's fighting them on
onboarding friction and missing sugar. That's the best kind of problem to have, because it means the
expensive part (the engine, the reactivity, the widget fidelity) is done right and the remaining work
is a thin, cheap ergonomics-and-docs layer.

**Path to an 8.5:** Proposals 1–4 alone (all Low/Low–Med effort, zero architectural change, zero
glyph change) would lift docs 3→7, getting-started 6→8, commands 6→8, and modality 6.5→8 — moving the
overall from **6.0 to roughly 8.0** without touching the engine. Proposals 5–8 close most of the
rest. This is a framework that is one focused DX pass away from being genuinely delightful.
