# Component: Chrome Contributions

> **Document**: 03-03-chrome-contributions.md
> **Parent**: [Index](00-index.md)
> **Covers**: R-3 · AR-3, AR-4, AR-5, AR-21

How a screen's per-screen menu/status reaches the shared bars. The mechanism (the `ChromeHost` seam,
the `MenuBar.setItems`/`StatusLine` swap) lives in [03-01](03-01-application-shell-chromehost.md); this
doc owns the **contribution model** and the `withBase` helper.

## Model (AR-3, AR-4)

- A route's `build(ctx)` returns `{ view, status?, menu? }`. `status` is `View[]` (status items /
  spacers); `menu` is `MenuItem[]` (top-level menu nodes).
- On activation the router calls `chromeHost.setStatus(bundle.status ?? null)` and
  `chromeHost.setMenu(bundle.menu ?? null)`.
- **Replace-when-present, base fallback:** a present contribution fully defines that bar; `null`
  restores the app base (whatever `createApplication({ statusLine, menuBar })` was given). The router
  core carries **no** ordering/merge rules.

```
app base status:  [ ~Alt-X~ Quit | spacer | ~F1~ Help ]

screen 'detail' status = [ ~Esc~ Back, ~E~dit ]
  → bar shows ONLY those (replace)

screen 'home' (no status)
  → bar shows the app base (fallback)
```

## `withBase` helper (AR-4)

For the DRY "global affordances + per-screen hints" case, a user-land compose helper — **not** router
core behavior:

```ts
/** Compose a status contribution from a fresh base list plus per-screen extras.
 *  @example status: withBase(app.statusBase(), [ statusItem('~E~dit', 'detail.edit') ])
 */
function withBase(base: View[], extra: View[]): View[] { return [...base, ...extra]; }
```

> **Single-parent safety (PF-003).** A `View` has exactly one parent (`Group.add` sets
> `child.parent = this`, `group.ts:89`; `view.ts:144`). The live base status bar owns its item
> instances, so composing with **those** instances would re-parent them and corrupt the fallback bar.
> Therefore **`app.statusBase` is a factory** — `statusBase(): View[]` builds **fresh** status-item
> Views on each call — and `withBase` spreads those fresh items. A screen calls `app.statusBase()`,
> never a shared live list.

- `app.statusBase(): View[]` (factory, fresh items per call) is exposed on the `Application`;
  `app.menuBase(): MenuItem[]` may return the shared data directly (menu items are plain data, not
  Views — no single-parent hazard).
- Because `withBase` is plain composition, a screen opts into base+extra explicitly; screens that omit
  it get pure replace-or-fallback.

## Intra-screen dynamism (AR-5)

The contribution set is **static per activation**. Things that change while a screen is active are
expressed without re-swapping the set:

- **Greying** — toggle command enablement (`loop.enableCommand`), now reactive (AR-11), so a status
  item greys/ungreys live. Example: the wizard's "Next".
- **Live labels** — a `statusItem(() => …)` getter re-measures and repaints on signal change
  (`status-item.ts:73-78`). Example: `Step 2/4`.

Re-driving the whole set reactively is explicitly deferred (AR-5).

## Interaction notes

- **Warm screens (AR §A×B):** the frame caches its `bundle.status`/`menu`, so re-showing a warm
  screen re-applies the identical item `View`s — whose live labels/enablement are still bound to the
  (still-alive) screen's signals.
- **Router-only apps (AR §E×base):** the app base must not reference window commands (tile/cascade) —
  they are unregistered when the body is not a Desktop (AR-10). The demos model a router-appropriate
  base (quit/help only).
