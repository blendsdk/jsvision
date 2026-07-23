# Current State: Navigation / Screen Router

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

All findings below were verified by reading source this session. They are the ground truth the plan
builds on; the "Seam to add" column is the exact additive change each requires.

## Substrate that works as-is (reuse, no change)

| Capability | Evidence | Used for |
|---|---|---|
| Body is a `fr:1` column child | `app/application.ts:213` (`desktop.layout = { size:{kind:'fr',weight:1} }`), added at `:233` | Router body slot (R-1) |
| `run()` is content-agnostic | `app/run.ts` wires only `loop`→host; no `Desktop` coupling | D6 needs no `run()` change |
| Per-screen mount/dispose | `reactive/show.ts:36` `Show`, `reactive/for.ts:50` `For`, `view/group.ts:119-135` `addDynamic`; `owner.ts` `createRoot`/`runWithOwner`/`onCleanup` | Keep-alive + dispose (R-5) |
| Focus save/restore LIFO | `event/modal.ts` (`savedFocus`, save-on-push/restore-on-pop) | Back-stack focus (R-6) |
| Shared overlay + `execView` dialogs | `app/application.ts:217-239, 256-262` — loop-level, body-agnostic | Dialogs work over a router body |
| StatusItem live labels | `status/status-item.ts:73-78` (`()=>string` re-binds on mount) | Reactive status labels (AR-5) |

## Substrate that needs an additive seam

| Finding | Evidence | Seam to add |
|---|---|---|
| `createApplication` hard-wires one `Desktop` | `app/application.ts:212` (`new Desktop()`), `:233` add, `:254` `attachLoop`, `:300` returns `app.desktop` | Generalize to `content?: View` default `Desktop`; gate window cmds + `app.desktop` on `content instanceof Desktop` (R-1, R-7 / AR-2, AR-10) |
| `StatusLine` is a `Group`; activation flows through the **line** seam, not per-item | `status/statusline.ts:161` (`seam.emitCommand`), `:100-104` `commandItems()` reads children live | Child-swap works for activation; only `isEnabled` wiring (`:92-97`) must re-run on swap — the `ChromeHost.setStatus` path (AR-21) |
| `MenuBar.draw` reads `items` live, but the controller is built **once** at attach | `menu/menubar.ts:43` (`items`), `:59-61` `attach` builds `createMenuController(this.items,…)`, `menu/controller.ts:148` closes over `tops` | Add `MenuBar.setItems(items)`: retain `overlay`+`seam`, close any open menu, rebuild the controller — the `ChromeHost.setMenu` path (AR-21) |
| **Greying is not reactive**: `enable(name,on)` only sets a `Map` override; no repaint | `event/commands.ts:57-63`; `status/status-item.ts:119` reads `isEnabled` at draw with no subscription | Registry bumps a **version signal** on `enable`/`disable`; `StatusLine`/`MenuBar` bind to it so any enablement change repaints (R-8 / AR-11) |
| `Application.desktop` is a non-optional `Desktop` | `app/application.ts:88` (`readonly desktop: Desktop`) | Widen to `Desktop \| undefined` (additive; no-content apps still get one) (AR-10) |

## New code (no existing counterpart)

- `packages/ui/src/router/` — a new subsystem barrel (AR-15): `createRouter`, the stack model, the
  route/bundle types, `location()`, `withBase`. EXPLICIT named re-exports in `src/index.ts`.
- `ChromeHost` seam type (AR-21) — lives where the router and `createApplication` can both see it
  (router types, implemented by the app).

## Reference-app substrate

- The **wizard** consumes `@jsvision/forms` (store + validation shipped on the `feat/forms` branch);
  the demo drives "Next" via reactive command enablement (R-8) against the form's `isValid()`.
- The **drill-down browser** uses `ListView` + `keepAlive: true` on the list route so scroll survives
  `back()`.

## Risk notes (retired in Phase 0)

- **Chrome-frame handle** — the router driving the app's bars is the one new wiring path; proven by the
  Phase 0 walking skeleton via the `ChromeHost` seam.
- **Focus-restore fidelity** — exact for warm screens; for disposed+recreated the Phase 0 spike
  measures index-path vs `focusKey` vs first-focusable and fixes the middle tier (AR-19 → ST-6b).
