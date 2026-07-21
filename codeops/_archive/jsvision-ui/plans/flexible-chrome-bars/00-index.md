# Flexible Chrome Bars — Implementation Plan

> **Feature**: jsvision-ui / flexible-chrome-bars · **Implements**: — (net-new app-shell enhancement, no RD)
> **CodeOps Skills Version**: 3.3.2
> **Status**: Plan created — ready for `exec_plan`.

## What this plan delivers

Refactor the `@jsvision/ui` app-shell chrome bars onto a shared, **layout-engine-driven** geometry,
and turn the **StatusLine** into a general child-view container so a caller can place any fitting
1-row widget (a progress bar, a live clock, a right-aligned segment) on the status row — and give the
**MenuBar** the same right-align + spacer capability for its titles.

Concretely, after this plan:

```ts
const value = signal(0.6);
const clock = signal('12:34:56');

statusLine([
  statusItem('~Alt-X~ Exit', Commands.quit, 'Alt+X'),
  spacer(),                                  // fill — pushes the rest to the right edge
  new ProgressBar({ value }),                // an embedded passive widget
  statusItem(() => clock()),                 // a live, command-less label (repaints on tick)
]);

menuBar([
  subMenu('~F~ile', […]),
  menuSpacer(),                              // pushes Help to the right edge
  subMenu('~H~elp', […]),                    // popup still opens under its moved column
]);
```

## Document map

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — every decision (AR-1…AR-20). ✅ GATE PASSED |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria |
| [02-current-state.md](02-current-state.md) | Current StatusLine/MenuBar/app-shell code + the immutable oracles |
| [03-01-bar-layout-foundation.md](03-01-bar-layout-foundation.md) | The shared 1-D flex packing adopted by both bars |
| [03-02-status-line.md](03-02-status-line.md) | StatusLine → general child-view container (StatusItemView, new API) |
| [03-03-menu-bar.md](03-03-menu-bar.md) | MenuBar flexible-title layout + `menuSpacer()` + controller anchoring |
| [03-04-app-integration.md](03-04-app-integration.md) | App-shell wiring, playground demo, kitchen-sink story, tsconfig fix |
| [07-testing-strategy.md](07-testing-strategy.md) | New spec oracles (ST-01…ST-10) + preserved-oracle regression list |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, spec-first ordering — the single source of progress truth |

## Key decisions (see the register for the full set)

- **Menu bar = layout only** (AR-1): right-align/spacer for titles; embedded menu-bar widgets deferred.
- **Status API = everything is a View** (AR-2): `statusItem()` returns a `StatusItemView`; `statusLine()` takes `View[]`.
- **Dynamic text** (AR-3): accessor text on `statusItem` **and** embeddable reactive views.
- **StatusLine owns interaction** (AR-4): a `Group` of presentational item views; press/drag/release + accelerators handled by StatusLine.
- **Default geometry is byte-identical** (AR-7): flex engages only when a spacer is present — every existing oracle stays green.
- **Backward compatible** (AR-10): the retained `StatusItem` type aliases the view and exposes `.command`, so the immutable packaging oracle passes unchanged.

## Verify

`yarn verify` (AR-17).
