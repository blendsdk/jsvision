# Execution Plan: Kanban Visual Grouping Correction

> **Implements**: kanban/T-02
> **Status**: Complete
> **Created**: 2026-08-10
> **Last Updated**: 2026-08-10

## Objective

Make workflow lanes and cards visually legible as stable TUI regions without changing the public
card-renderer contract or obscuring semantic status styling.

## Scope boundaries

- Workflow lanes receive one-cell horizontal content padding and a compact three-row sticky header with
  a joined top border, one label row, and joined lower and continuous vertical separators.
- Each lane may independently use start or center header-label alignment through validated reactive
  structure policy.
- Cards receive package-owned outer frames: single while resting and double while focused.
- Focused cards cast a contained right/bottom shadow beneath adjacent card faces and inside lane
  geometry; the shadow is not part of the card action target.
- Focused card titles use bold text without replacing their semantic foreground or background.
- Every named density reserves one blank row between cards for shadow clearance and a clear insertion
  target; bounded custom presentation policies may explicitly choose zero gap.
- ASCII-only terminals retain visibly different resting and focused frame treatments.
- Renderer-owned text keeps its semantic foreground and attributes while inheriting the resolved
  card-surface background.
- Standard-card text reserves matching left marker and right trailing gutters so clipped text and its
  omission marker never touch the frame.
- Selection remains semantically separate from focus and does not acquire a double frame.

## Tasks

- [x] 1. Add public-board visual specifications for separators, frames, coherent backgrounds, and
      ASCII fallback.
- [x] 2. Reserve frame geometry outside renderer-owned content and translate action regions.
- [x] 3. Draw clipped frames and separators without changing custom renderer content coordinates.
- [x] 4. Update sparse-height, scroll, focus-anchor, and grouped-axis geometry for framed cards.
- [x] 5. Add padded lane geometry and contained focused-card shadows without obscuring adjacent
      cards or separators.
- [x] 6. Add the sticky header separator row, outer boundaries, Unicode junctions, ASCII fallbacks,
      and clipping-aware horizontal extent.
- [x] 7. Add bold focused titles and a standard one-row card gap to every named density while
      preserving bounded custom zero-gap policies.
- [x] 8. Keep headers compact without vertical blank rows and add validated per-lane start/center label
      alignment.
- [x] 9. Complete the header frame with terminal-safe joined top corners and column junctions.
- [x] 10. Add symmetric standard-card text gutters while preserving custom-renderer geometry authority.
- [x] 11. Verify unit, real-host E2E, and permanent kitchen-sink behavior.

## Verification

- `yarn workspace @jsvision/kanban typecheck`
- `yarn workspace @jsvision/kanban test` — 56 files, 494 tests
- `yarn workspace @jsvision/kanban test:e2e` — 4 files, 23 tests
- `yarn workspace @jsvision/examples typecheck`
- `yarn workspace @jsvision/examples vitest run test/kanban-showcase.smoke.spec.test.ts --maxWorkers=1`
