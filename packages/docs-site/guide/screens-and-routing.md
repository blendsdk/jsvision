---
title: Screens & routing
description: Build typed full-screen routes with parameters, history, shared chrome, deliberate screen state, focus restoration, and cleanup.
---

# Screens & routing

## Who is this course for?

This course is for developers building a wizard, settings application, drill-down browser, or
dashboard that shows one full-screen workspace at a time. You should already know how to host custom
content in [the application shell](../guide/application-shell) and how retained views, eligibility,
and restoration work from [Views & focus](../guide/views-and-focus).

By the end you can build a typed route table, explain every history transition, choose where screen
state lives, restore focus after a round trip, diagnose failed navigation, and verify that resources
are released exactly once. The motivating problem is a record browser: Home opens a parameterized
Detail screen, Settings replaces the current step, and Back returns users to the right state and
keyboard position.

The beginner boundary is constructing routes and navigating a stack. The intermediate boundary is
shared chrome, reactive location, state ownership, and focus restoration. Advanced work covers
codecs, host-owned deep links, build failure isolation, modal interaction, diagnostics, and
production cleanup.

## What is the routing mental model?

A `Router` is a custom application body and a stack of **frames**. Each frame records a route name,
its typed parameters, retention policy, built screen, screen chrome, and saved focus evidence. Only
the top frame is visible.

```text
application shell
├─ shared menu bar      ← active ScreenBundle may replace it
├─ Router body
│  ├─ Home frame        hidden only when kept alive
│  └─ Detail { id: 42 } visible top frame
└─ shared status line   ← active ScreenBundle may replace it
```

The route table describes how to build screens. The stack describes the user's navigation history.
The screen root owns screen-local views and resources. The application owns state that must outlive
all screens. These are separate decisions: a route name is not a global store, and a hidden retained
screen is still mounted and still owns resources.

Use a Router when one primary task fills the body. Use a
[Desktop](/components/application/desktop) when users arrange independent overlapping windows.
`createApplication({ content: router })` has no `desktop` and therefore no automatic Tile, Cascade,
or other window-manager behavior.

## How do I build the first useful router?

Declare parameter types once, return one screen root per route, and pass the Router as the
application's custom content:

```ts
import { Group, Text, createApplication, createRouter } from '@jsvision/ui';

type Routes = {
  home: void;
  detail: { id: number };
};

const router = createRouter<Routes>({
  initial: { name: 'home' },
  routes: {
    home: { build: () => ({ view: new Text('Records') }) },
    detail: {
      build: (ctx) => ({ view: new Text(`Record ${ctx.params.id}`) }),
    },
  },
});

const app = createApplication({ content: router });
router.push('detail', { id: 42 });
```

`RouteContext` carries `ctx.params` to the builder. TypeScript rejects an unknown route, a missing
parameter object, or an `id` of the wrong type. Runtime data still needs validation at the host or
service boundary; compile-time types do not make decoded URLs or files trustworthy.

## Laboratory: typed routes, history, and shared chrome

<PlayExample id="guides/routing-stack" title="Typed routing stack laboratory" blurb="Push a parameterized Detail screen, replace it with Settings, go Back, and Reset while route state and shared chrome report each distinct history operation." />

Try Alt+N, Alt+P, Alt+B, and Alt+R. Then click the same four controls. Observe that Replace preserves
the frame below it, Reset removes that history, and Back at Home reports the root policy instead of
inventing a destination.

## How do stack operations model navigation intent?

Choose the operation from the history meaning, not from which screen you want to paint:

| Operation                | Stack effect                             | Typical intent                                      |
| ------------------------ | ---------------------------------------- | --------------------------------------------------- |
| `push(name, params?)`    | Adds a new top frame                     | Open a detail, child task, or next wizard step      |
| `back()`                 | Pops the top and activates the previous  | Return through user-visible navigation history      |
| `replace(name, params?)` | Changes the top; depth stays unchanged   | Redirect or substitute the current transient step   |
| `reset(name, params?)`   | Disposes all frames and creates one root | Authentication/workspace change invalidates history |

At the root, `back()` returns `false` and changes nothing:

```ts
import type { Router } from '@jsvision/ui';

declare const router: Router<{ home: void }>;

if (!router.back()) {
  // The application chooses its root policy: stay, ask to quit, or delegate to its host.
}
```

Do not turn `false` into an implicit process exit. A native app, embedded browser surface, and nested
workflow can have different root policies. Make that policy visible and test it.

`replace` is not “push then back”: the discarded top screen is gone. `reset` is stronger still; it
also releases kept-alive frames below the top.

## How do parameters and location state stay typed?

Parameters belong to the frame that was entered with them. Prefer small identifiers and modes over
large mutable domain objects:

```ts
import type { Router } from '@jsvision/ui';

type Routes = {
  records: { query: string };
  record: { id: number; mode: 'view' | 'edit' };
};

declare const router: Router<Routes>;
router.push('record', { id: 42, mode: 'view' });
```

`location()` and `canGoBack()` are reactive accessors. Read them in a binding, computed, or effect
when another region needs a projection:

```ts
import { createRoot, effect } from '@jsvision/ui';
import type { Router } from '@jsvision/ui';

declare const router: Router<{ home: void; detail: { id: number } }>;
const disposeNavigationProjection = createRoot((dispose) => {
  effect(() => {
    console.log(router.location().name, router.canGoBack());
  });
  return dispose;
});
```

The location is the current route and params, not a serializable snapshot of all screen state.
Dispose long-lived effects with their real owner; an application-wide navigation projection should
not be owned by a short-lived screen. Call `disposeNavigationProjection()` when that application
projection ends.

## How does each screen compose with shared chrome?

A route builder returns a `ScreenBundle`: the full-screen `view` plus optional `menu` and `status`
items. A present contribution replaces that shared bar while the screen is active. Omitting it
restores the application's base bar.

```ts
import { Group, statusItem, withBase } from '@jsvision/ui';
import type { Route } from '@jsvision/ui';

declare const baseStatus: ReturnType<typeof statusItem>[];

const detailRoute: Route<{ id: number }> = {
  build: ({ params }) => ({
    view: new Group(),
    status: withBase(baseStatus, [
      statusItem(`Record ${params.id}`),
      statusItem('~Esc~ Back', 'record.back', 'Escape'),
    ]),
  }),
};
```

In a complete application, obtain fresh base status items from `app.statusBase()` rather than
re-parenting live views. Use `withBase(app.statusBase(), extras)` for global plus screen commands.
Menus are plain data and can be composed from `app.menuBase()`. Keep one command vocabulary across
menu, status, buttons, and keymaps.

Chrome is cached with the frame and reapplied whenever a warm or rebuilt screen activates. Screen
commands should be registered by a mounted screen owner; otherwise a command from an old screen may
remain active after the visible route changes.

## Laboratory: screen state, focus, and cleanup

<PlayExample id="guides/routing-lifecycle" title="Routing lifecycle laboratory" blurb="Compare dispose-on-leave with keep-alive while build counts, local state, restored focus, and exact cleanup reveal the ownership tradeoff." />

Use Alt+M to mutate the real screen-local value, then Alt+T for a round trip. Toggle the policy with
Alt+P, mutate again, and repeat. The lab reports the observed screen generation and identity,
whether the value reset or survived, which field regained focus, and when cleanup ran.

## When should a screen be rebuilt or kept alive?

The default is disposal on navigation away. Its mounted scope ends, `onCleanup` runs, and Back
rebuilds a fresh instance. This is the safest everyday policy because invisible screens stop doing
work:

```ts
import { Group } from '@jsvision/ui';
import type { Route } from '@jsvision/ui';

declare function subscribeToRecords(refresh: () => void): () => void;

const records: Route<void> = {
  build: () => {
    const screen = new Group();
    screen.onMount(() => {
      const unsubscribe = subscribeToRecords(() => screen.invalidate());
      screen.onCleanup(unsubscribe);
    });
    return { view: screen };
  },
};
```

This acquisition/cleanup pattern also applies to a timer, subscription, async controller, or host
resource. A default screen should reconstruct local state from route parameters or an
application-owned store when it returns.

Set `keepAlive: true` only when preserving the exact mounted instance is worth retaining its memory
and resources:

```ts
import { Group } from '@jsvision/ui';
import type { Route } from '@jsvision/ui';

declare function buildExpensiveRecordsScreen(): Group;

const records: Route<void> = {
  keepAlive: true,
  build: () => ({ view: buildExpensiveRecordsScreen() }),
};
```

A route's `keepAlive` policy is opt-in and defaults to `false`; when enabled, the inactive screen
stays mounted but hidden.

A kept-alive screen is mounted but hidden. Its widget values, scroll position, and exact view
identity survive; so can subscriptions and pending work. Pause work explicitly when visibility
matters, or keep that work above the screen. `replace`, `reset`, removal, and application disposal
still release retained screens.

Use this ownership boundary:

Application state lives above the Router; route-state is owned by its screen and ends with that
screen's cleanup or disposal.

| State lifetime         | Owner                                      |
| ---------------------- | ------------------------------------------ |
| Application state      | Service/store above the Router             |
| Route parameters       | Current history frame                      |
| Screen state           | Screen root; rebuilt or retained by policy |
| Ephemeral widget state | The individual input/list/editor           |

Putting long-lived state inside a disposable screen loses it on Back. Keeping every screen alive to
avoid that mistake trades a clear state model for unbounded retained work.

## How does focus return after navigation?

When the application hosts the Router, it attempts focus evidence in this order:

1. A warm keep-alive frame restores the exact mounted view.
2. A rebuilt frame with `focusKey` searches for the same stable key.
3. Otherwise the saved structural index-path targets the same-position view.
4. If no exact, keyed, or structural target resolves, the first focusable leaf is the final floor.

This is an attempt order, not eligibility fallthrough. A `focusKey` match or structural-path match
can resolve to a hidden, disabled, passive, or otherwise ineligible view. The Router hands that
target to `focusView()` and returns; `focusView()` makes the request a no-op, and the Router does not
continue to the next tier. Event-loop focus healing may already have selected a usable leaf while
the rebuilt tree mounted, but applications must not describe that as Router fallback.

Use `focusKey` when a rebuilt screen can reshape or reorder fields:

```ts
import { Group, Input, signal } from '@jsvision/ui';
import type { Route, View } from '@jsvision/ui';

const keys = new WeakMap<View, string>();

const form: Route<void> = {
  focusKey: (view) => keys.get(view) ?? 'screen',
  build: () => {
    const email = new Input({ value: signal('') });
    keys.set(email, 'email');
    const screen = new Group();
    screen.add(email);
    return { view: screen };
  },
};
```

Keys are screen-cooperative identities, not user data. Make them stable and unique inside the
screen, and return them only for controls intended to remain eligible after rebuild. A resolved
hidden or disabled target makes the focus request a no-op; the Router does not try the structural or
first-focusable tiers afterward. If eligibility can change, explicitly focus a known usable target
as part of that screen transition. Draw a visible focus cue and expose textual focus evidence in
tests rather than relying on colour alone.

Navigation while a modal is open needs deliberate workflow design. Prefer completing or cancelling
the modal before replacing its owning screen. If a host tears down the saved target, focusing that
unmounted view safely does nothing, but the application still needs a sensible active-screen
fallback.

## How do routing and application architecture integrate?

Routing coordinates earlier concepts:

- The application shell gives the Router its body, chrome host, focus host, and lifecycle.
- Layout lets each active screen fill the body and adapt to compact terminal cells.
- Reactive state projects `location()` and `canGoBack()` without storing a second history.
- Commands express navigation intent from menus, status items, buttons, and keys.
- Async work belongs to the screen only when leaving that screen should cancel it.
- I18n rebuilds or binds labels without changing the typed route vocabulary.

Keep navigation decisions outside `draw()`. A screen action may validate a form or await a
confirmation, then call `push`, `replace`, or `reset`. Builders should be deterministic and cheap;
put data-loading state inside the built screen or an injected service.

## What advanced and host-specific behavior matters?

### Route codecs are building blocks

Optional `serialize` and `parse` functions define a parameter codec:

```ts
import { Text } from '@jsvision/ui';
import type { Route } from '@jsvision/ui';

const recordRoute: Route<{ id: number }> = {
  build: ({ params }) => ({ view: new Text(`Record ${params.id}`) }),
  serialize: ({ id }) => `id=${id}`,
  parse: (value) => {
    const raw = new URLSearchParams(value).get('id');
    if (raw === null || !/^[1-9]\d{0,5}$/.test(raw)) {
      throw new Error('invalid record route');
    }
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id > 100_000) {
      throw new Error('invalid record route');
    }
    return { id };
  },
};

const encoded = recordRoute.serialize?.({ id: 42 });
const decoded = encoded === undefined ? undefined : recordRoute.parse?.(encoded);
```

The Router does **not** automatically synchronize browser history, parse a URL, or restore a deep
link. The application or host owns that integration. Validate decoded route names and parameters
with an allowlist, reject missing/non-finite/out-of-range identifiers, then call a typed navigation
operation. Never treat TypeScript types as runtime validation.

### Build failures preserve the current screen

If a route builder throws, navigation is aborted, the current screen and stack remain unchanged,
and the configured logger receives the route name plus `String(error)`. “Screen-safe” means the
default logger avoids corrupting the terminal display; it does **not** mean its metadata is redacted
or bounded. Show a recoverable message without discarding the working screen.

Supply a sanitizing adapter when route names or thrown values can contain sensitive data:

```ts
import { createLogger } from '@jsvision/core';
import type { Logger } from '@jsvision/core';

const sink = createLogger({ sink: 'ring', size: 100 });
const allowedRoutes = new Set(['home', 'detail', 'settings']);

const safeRouterLogger: Logger = {
  ...sink,
  error(component, message, fields) {
    const candidate = fields?.route;
    const route = typeof candidate === 'string' && allowedRoutes.has(candidate) ? candidate : 'unknown';
    sink.error(component, message, { code: 'ROUTE_BUILD_FAILED', route });
  },
};
```

Pass `safeRouterLogger` as `RouterOptions.logger`. The adapter deliberately drops the raw `error`
field and emits a stable failure code plus an allowlisted route. A record ID, search string, or
restored host payload can contain private data. Do not render an exception directly as terminal
text or forward the raw fields to a production sink.

### Scaling history and retained work

The Router does not impose a business-specific maximum stack depth. Avoid loops that push the same
screen indefinitely. Use `replace` for redirects and `reset` when prior frames are no longer valid.
Retain only measured, bounded screens; disposal is the default for a reason.

Screen layout must handle the body after menu/status rows are removed. Test 80×24, a constrained
width, maximize, restore, wide glyphs, monochrome, keyboard-only paths, and visible focus. A hidden
keep-alive screen consumes no layout cells, but its memory and work still exist.

## How do I diagnose routing failures?

| Symptom                                 | Cause                                                                | Correction                                                      | Evidence                                           |
| --------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------- |
| The wrong screen appears after Back     | `push` was used for a redirect or `replace` for history              | Choose the operation from the intended stack transition         | Route/depth trace matches the expected frame order |
| Back does nothing                       | The Router is already at its root                                    | Handle the `false` result with an explicit root policy          | `canGoBack()` is false and location is unchanged   |
| Detail receives the wrong record        | Host data was not parsed and validated into params                   | Allowlist the route and validate decoded parameter shape        | Builder and `location()` receive the same typed ID |
| Shared chrome shows the previous screen | Live items were re-parented or a stale owner remains                 | Compose fresh base items and bind commands to screen cleanup    | Active bar contains only current/base commands     |
| Screen state unexpectedly resets        | The default disposable screen owned durable state                    | Move durable state above the Router or opt into keep-alive      | Build count and store identity reveal the owner    |
| Hidden screen keeps doing work          | `keepAlive` retained its subscription or timer                       | Pause it or use disposal and reconstruct on return              | Callback count stops after navigation/cleanup      |
| Focus returns to the wrong field        | Structure changed without a stable `focusKey`                        | Provide a stable key that resolves only to the intended control | Focus readout names the rebuilt intended field     |
| Focus stays on the event-loop floor     | A key/path resolved to an ineligible target; the request was a no-op | Explicitly focus a known eligible screen target                 | Focused target is mounted, visible, and enabled    |
| Navigation silently stays put           | The target route builder threw                                       | Inspect sanitized diagnostics and fix/recover the builder       | Location is unchanged and one error is logged      |
| Content or instructions are clipped     | Screen geometry assumed the full terminal viewport                   | Let the Router own outer size and make inner layout responsive  | Compact, resize, maximize, and restore stay usable |

## What are the best practices?

- Model every route and parameter in one `Routes` type; scattered string routing loses compiler
  coverage.
- Choose `push`, `replace`, and `reset` from history semantics; painting the desired screen is not
  enough.
- Keep domain and application state above screens; otherwise the default cleanup policy erases it.
- Prefer disposal. Use keep-alive only for a measured state/latency benefit because hidden mounted
  screens retain resources.
- Acquire timers, subscriptions, async controllers, and commands on mount and release them with the
  same screen owner.
- Supply `focusKey` when rebuilt layouts can change, and ensure every returned match is eligible.
- Compose fresh shared chrome and one command vocabulary so visual routes cannot outlive their
  screen.
- Treat codecs as host-integration primitives, validate runtime input, and redact diagnostics.
- Test root Back, failed builders, repeated navigation, focus eligibility, exact cleanup, compact
  geometry, keyboard and mouse actions, monochrome cues, and application disposal.

## What should I practice next?

Use these exercises as small, independently verifiable experiments:

1. Add an Edit route with `{ id: number }`. Push it from Detail, replace it with a saved
   confirmation screen, then explain the resulting Back path.
2. Run the lifecycle laboratory in disposable mode and keep-alive mode. Predict build, cleanup,
   local-value, and focused-field evidence before each round trip.
3. Give a rebuilt form a stable `focusKey`, reorder its controls, and verify that focus returns to
   the intended field rather than the old index.
4. Write a route codec, feed it an unknown route, a missing ID, `NaN`, and a valid ID, then prove the
   host rejects invalid values before navigation.
5. Make a route builder fail. Verify that location, screen pixels, focus, and history remain usable
   while the sanitized diagnostic reveals one failure without sensitive values.

Related courses and owning references:

- [The application shell](../guide/application-shell) owns body selection and application
  lifecycle.
- [Views & focus](../guide/views-and-focus) owns retained-tree eligibility and general focus APIs.
- [Events, commands & keymaps](/guide/events-commands-and-keymaps) owns dispatch and command
  precedence.
- [Async work](/guide/async-work) owns cancellation and stale-result workflows.
- [Router component](/components/application/router) provides the concise component configuration
  and live API showcase.
- [`createRouter`](/api/ui/functions/createRouter) and [`Router`](/api/ui/interfaces/Router) provide
  generated signatures.
