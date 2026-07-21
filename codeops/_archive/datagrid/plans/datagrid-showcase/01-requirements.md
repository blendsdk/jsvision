# Requirements — DataGrid Showcase App

> **Source**: [RD-15](../../requirements/RD-15-showcase-app.md)
> **Parent**: [Index](00-index.md)

This plan implements RD-15 in full. The RD owns the functional requirements, the demo inventory, the
security posture, and the acceptance criteria — this document states only the plan's scope delta and
cites the RD rather than restating it.

## In Scope

- A runnable `packages/examples/datagrid-showcase/` app (`demo:datagrid`), dedicated shell, welcome
  catalog (RD §Must, AR #33/#35).
- The ~38 granular demos across six clusters + eight per-RD placeholder panels (RD §Demo Inventory,
  AR #34/#37).
- A bespoke in-memory spy `GridDataSource` for the two push-down demos (RD §Demo Inventory note,
  AR #5, PF-020).
- Two headless test tiers — a per-demo smoke oracle + a shell walkthrough (RD §Testing, AR #40).
- Package wiring: `@jsvision/examples` gains `@jsvision/datagrid`; `demo:datagrid` script; the app
  added to the examples typecheck include (AR #2).
- Reconcile `codeops/kitchen-sink-gate.md` to route datagrid stories here; retain the general
  kitchen-sink's read-only ui `DataGrid` story (AR #9, PF-022).

## Out of Scope

- Any demo of an unbuilt capability — RD-07…14 appear only as "coming soon" panels (RD §Won't Have,
  AR #34).
- Changing the datagrid package's own `test/kitchen-sink` smoke stories — they remain the isolated
  render guard (RD §Won't Have, AR #39).
- Extracting a shared showcase-shell or refactoring the general kitchen-sink (RD §Won't Have, AR #35).
- The datagrid-specific chrome (data-source-size toggle, theme switcher) and the web-xterm dogfood —
  RD Should-Haves, deferred to Phase B.

## Success Criteria

The RD's nine Acceptance Criteria (RD §Acceptance Criteria) are the definition of done; the testing
strategy (`07`) maps each to a concrete spec test or verify step. The plan is complete when all
acceptance criteria pass and full `yarn verify` is green.
