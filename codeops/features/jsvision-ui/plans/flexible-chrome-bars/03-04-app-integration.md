# 03-04 — App-Shell Integration, Demo & Kitchen-Sink

> Implements F-7 (integration), F-8, F-9. Decisions: AR-11, AR-14, AR-15. References 02 § "App shell".

## App-shell layout merge (AR-11)

`application.ts` sets each bar's layout to fixed 1 row by **replacing** `layout`
(application.ts:222, 227). Now that a bar carries an internal `direction:'row'` (StatusLine) it must be
**merged**, not replaced:

```ts
// before: opts.statusLine.layout = { size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } };
opts.statusLine.layout = { ...opts.statusLine.layout, size: { kind: 'fixed', cells: CHROME_ROW_HEIGHT } };
```

- Apply the same spread to the menu-bar assignment (application.ts:222) for symmetry/safety even though
  the menu bar keeps monolithic title drawing (no internal direction needed) — harmless and future-proof.
- Everything else in `application.ts` is unchanged: `root.add(bar)`, `bar.attach(seam)`, resize wiring.
  The app-shell lifecycle/desktop/window oracles are untouched.

## Standalone demo (AR-14 · preflight PF-001 decision B)

> Preflight found the plan's original `packages/examples/playground/main.ts` target exists only in the
> Ink repo, and `demo:playground` is already bound to `keyboard-mouse-playground`. Resolution (user
> decision B): create a **new** `packages/examples/chrome-bars-demo/` example (matching this repo's
> `*-demo/` convention) with its own `demo:chrome-bars` script.

`packages/examples/chrome-bars-demo/main.ts` — a new minimal app-shell demo showing the target layout:

```ts
const value = signal(0);           // progress 0..1
const clock = signal(now());       // HH:MM:SS

statusLine([
  statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
  spacer(),                        // fill
  new ProgressBar({ value }),      // width via fixed() if needed
  statusItem(() => clock()),       // live label, no command
]);

// a ~1s timer: bump `value` (wraps) + set `clock`, then emit a no-op command so the loop flushes
// one coalesced frame (the tvision-demo idiom); unref the timer.
```

- Use a TTY guard + `main().then(process.exit)` tail (the standard example shape). The menu bar can show
  a right-aligned `~F1~ Help` via `menuSpacer()` to demo the menu side too.
- **New script:** add `"demo:chrome-bars": "tsx chrome-bars-demo/main.ts"` to
  `packages/examples/package.json` (`demo:playground` is taken by `keyboard-mouse-playground`).
- **tsconfig fix (AR-14):** add `"chrome-bars-demo"` to the `include` array in
  `packages/examples/tsconfig.json` (currently `["capability-probe","resize-demo","keyboard-mouse-playground"]`)
  so the new file is type-checked. Confirm `yarn workspace @jsvision/examples typecheck` covers it.

## Kitchen-sink story (AR-15)

Per the kitchen-sink gate, add one story + its smoke coverage:

- `packages/examples/kitchen-sink/stories/status-bar.story.ts` — a `Story` (`id: 'app-shell/status-bar'`,
  category app-shell) whose `build(ctx)` returns a `Group` showing a status-bar-like row with
  `spacer()` right-align, an embedded `ProgressBar` (bound to a story-local signal that a hint says
  advances), and a live `Text`/command-less `statusItem` clock, plus a one-line blurb + interaction
  hint. Absolutely-positioned within `ctx.width × ctx.height`; the shell owns all chrome.
- Register it with one line in `packages/examples/kitchen-sink/stories/index.ts`.
- It must pass `test/kitchen-sink.smoke.spec.test.ts` (mounts headlessly, paints, unique id, metadata).

> Note: the smoke test renders a bare `Group` (no live `StatusLine` seam). If showing the true
> `StatusLine` is awkward headless, the story composes the same **views** (`StatusItemView`s + `spacer`
> + `ProgressBar`) in a `row()` to demonstrate the layout without needing the app seam — still a
> faithful showcase of the capability.

## Verify

`yarn verify` (AR-17). Because examples import the built `@jsvision/ui` dist, a full verify (turbo builds
`ui` before the examples/docs-site test+typecheck) is the authoritative gate; an isolated examples test
run needs a prior `yarn build`.
