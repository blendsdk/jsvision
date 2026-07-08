# onCommand Handler API (Proposal 3)

> **Document**: 03-02-oncommand.md
> **Parent**: [Index](00-index.md)

## Overview

A first-class way to handle a named command without hand-rolling an invisible view. Generalize the
framework's internal `QuitCommandSink` into one public mechanism exposed as `loop.onCommand` and
`app.onCommand`, and re-express quit as one registration through it.

## Architecture

### Current Architecture
`QuitCommandSink` (`application.ts:82-102`) is a `preProcess`, `visible:false` `View` hard-wired to
`Commands.quit`: on that command it calls its callback and sets `ev.handled = true`. Any other app
command has no handler seam — consumers subclass `View` themselves (the demo's `CommandSink`).

### Proposed Changes
Replace the single-purpose sink with a general **command sink** owned by the event loop: a
`preProcess`, `visible:false` `View` holding `Map<string, Set<() => void>>`. On a routed command
event whose name has handlers, it fires **every** handler and marks the event handled. `onCommand`
registers a handler and returns an unsubscribe fn. Quit is registered internally through the same
call; `createApplication` registers its quit handler instead of adding a bespoke sink.

Because the sink is loop-owned and the loop mounts the root, the sink must be part of the mounted
tree. **Placement (a): the loop creates and owns the sink and mounts it as part of `mount()`.** This
is the chosen design — the loop already owns the dispatch scope and receives `quitCommand` at
construction (`createEventLoop({ …, quitCommand: Commands.quit })`, `application.ts:217`), so it is
the natural owner of both the command sink and the built-in quit registration. It needs no new public
accessor: the sink is mounted internally and `EventLoop.onCommand` writes into the loop-held sink's
map directly.

> The rejected alternative was "(b)": `createApplication` adds the loop's private sink `View` to the
> root column and writes into its map. That mirrors today's `QuitCommandSink` wiring, but the sink is
> a `private readonly` member of `EventLoopImpl` and the `EventLoop` interface exposes only
> `onCommand` — so (b) would require a new public seam (an accessor or `mountInto(root)` hook) just to
> hand the private sink to the app. (a) keeps the sink fully internal and avoids widening the public
> surface, so it is preferred.

## Implementation Details

### New Types/Interfaces

```ts
// event/types.ts — extend the EventLoop interface (AR-7)
export interface EventLoop {
  // …existing members
  /**
   * Register a handler for a named command. Every handler registered for a command runs when that
   * command is emitted, and a handled command stops there. Returns a function that unregisters this
   * handler.
   */
  onCommand(command: string, handler: () => void): () => void;
}
```

```ts
// app/application.ts — forward on the Application interface (AR-7)
export interface Application {
  // …existing `readonly desktop`, `readonly loop`, `run()`
  /**
   * Register an app-wide handler for a named command; returns a function that unregisters it. Every
   * handler registered for a command runs when that command is emitted, and a handled command stops
   * there. Forwards to `loop.onCommand`.
   */
  onCommand(command: string, handler: () => void): () => void;
}
```

### New Functions/Methods

```ts
// event/event-loop.ts — the general command sink (AR-5/6/9)
class CommandSink extends View {
  // Handlers are stored as `(arg?) => void` so the built-in quit registration can read the command
  // event's numeric exit-code `arg`. The PUBLIC `register` wraps a zero-arg `() => void` and ignores
  // the arg, so the public `onCommand` contract never widens.
  private readonly handlers = new Map<string, Set<(arg?: unknown) => void>>();
  constructor() { super(); this.preProcess = true; this.state.visible = false; }
  draw(): void { /* never paints */ }

  private addHandler(command: string, handler: (arg?: unknown) => void): () => void {
    let set = this.handlers.get(command);
    if (set === undefined) { set = new Set(); this.handlers.set(command, set); }
    set.add(handler);
    return () => { set!.delete(handler); if (set!.size === 0) this.handlers.delete(command); };
  }

  // Public: the exposed onCommand contract — a zero-arg handler.
  register(command: string, handler: () => void): () => void {
    return this.addHandler(command, () => handler());
  }

  // Internal only (NOT on the EventLoop interface): a handler that receives the command event's `arg`.
  // Used solely by the framework's built-in quit registration to read its numeric exit code.
  registerInternal(command: string, handler: (arg?: unknown) => void): () => void {
    return this.addHandler(command, handler);
  }

  override onEvent(ev: DispatchEvent): void {
    const inner = ev.event;
    if (inner.type !== 'command') return;
    const set = this.handlers.get(inner.command);
    if (set === undefined || set.size === 0) return;
    // Snapshot so a handler may unsubscribe itself mid-fire. Each handler is isolated in its own
    // try/catch so one throwing handler neither skips its siblings nor leaves the command unconsumed
    // (log via the loop's logger and continue). The command is consumed regardless.
    for (const fn of [...set]) {
      try { fn(inner.arg); } catch (err) { /* logger.error(...); continue */ }
    }
    ev.handled = true;
  }
}

// EventLoopImpl owns and mounts the sink (placement (a)):
//   private readonly commandSink = new CommandSink();
// mount() adds `this.commandSink` to the mounted tree; onCommand writes into it:
onCommand(command: string, handler: () => void): () => void {
  return this.commandSink.register(command, handler);
}
```

```ts
// Built-in quit — registered internally by the loop through the SAME sink, reading the numeric
// exit-code arg. The public onCommand stays `() => void`; only this internal path sees the arg.
// createApplication supplies the resolver (the existing `quitState` cell); the loop already knows
// `quitCommand`, so it owns the registration:
this.commandSink.registerInternal(this.quitCommand, (arg) =>
  quitResolve(typeof arg === 'number' ? arg : 0),
);

// application.ts — Application.onCommand forwards to the loop (AR-7):
return { desktop, loop, onCommand: (c, fn) => loop.onCommand(c, fn), run: () => runApplication({…}) };
```

> **Exit-code handling (resolved).** Today `QuitCommandSink` reads `inner.arg` as the exit code
> (`application.ts:96-97`), and `run(): Promise<number>` returns it (`run.ts:56`). The public
> `onCommand` handler stays `() => void` — the exit-code plumbing is an internal concern of exactly
> one built-in command and must not surface on every consumer's handler. The exit code is preserved
> through the sink's **internal** `registerInternal` path (above), which the loop uses for its own
> quit registration; the public API never widens. **ST-20** (`07-testing-strategy.md`) guards this:
> it emits `quit` with a numeric arg and asserts `run()` resolves that code — without it, a
> hardcoded `0` would silently drop the documented non-zero exit-code feature with nothing red.

### Integration Points
- The sink runs in `preProcess`, inside the loop's scope root, so a command emitted anywhere routes
  through it first (AR-9) — **except while a modal owns the dispatch scope.** When a modal `Dialog` is
  open, `scopeRoot()` becomes the modal subtree (`event-loop.ts:331`) and the root-mounted sink is not
  swept, so a general `app.onCommand('x', fn)` handler does **not** fire while a modal is open. This
  matches today's behavior (it is not a regression): quit still works during a modal only because the
  loop special-cases it via the quit cascade (`event-loop.ts:204-211`); general handlers have no such
  path. Document this modal-open limitation so a consumer isn't surprised.
- Terminating dialog commands (`ok`/`cancel`/`yes`/`no`) are unaffected — nobody registers
  `onCommand` handlers for them, and the `Dialog`'s own `postProcess` still handles them.

## Code Examples

```ts
const off = app.onCommand('about', () => messageBox(app, { title: 'About', text: '…' }));
// later: off();  // stop handling 'about'
```

## Error Handling

| Error Case | Handling Strategy | AR |
| ---------- | ----------------- | -- |
| Command with no handler | Sink ignores it; it routes on to views as before | AR-5 |
| Handler throws | Each handler runs in its OWN try/catch (log-and-continue) so one throwing handler neither skips its siblings nor un-consumes the command; the loop's `deliver` try/catch is only the outer crash guard | AR-6 |
| Unsubscribe called twice | Idempotent (`Set.delete` no-op) | AR-7 |
| Handler unsubscribes itself during its own fire | Iterate a snapshot (`[...set]`) so the live set may mutate | AR-5 |

> **Traceability:** design per AR-5 (multiplicity), AR-6 (consume + error isolation), AR-7 (surface + unsubscribe), AR-8 (generalize quit), AR-9 (preProcess phase).

## Testing Requirements
- Spec: ST-6…ST-12 + ST-20 (quit with a numeric exit-code arg resolves that code) (`07-testing-strategy.md`).
- Impl: per-handler try/catch isolation (a throwing handler doesn't skip siblings or un-consume the
  command), double-unsubscribe, self-unsubscribe-during-fire, multi-handler order.
