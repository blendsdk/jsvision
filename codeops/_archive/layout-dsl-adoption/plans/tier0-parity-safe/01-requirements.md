# 01 — Requirements & Scope

> **Source**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md) (Tier-0 slice) ·
> [RD-02](../../requirements/RD-02-non-functional-and-verification.md) (verification)
> **CodeOps Skills Version**: 3.9.0

## Objective

Adopt the hardened layout DSL at the parity-safe sites RD-01 assigns to **Tier 0**, changing zero
rendered geometry and editing zero spec oracles, and land the RD-01 FR-7 CLAUDE.md carve-out. This is
the MVP proof-of-direction for the flex-elimination epic.

## In scope

| # | Deliverable | Target | RD trace |
|---|-------------|--------|----------|
| R-1 | Base `Dialog` self-placement via `center()` / `at()` | `packages/ui/src/dialog/dialog.ts:99-109` | RD-01 Tier-0 row; FR-5 (drop hand-set rect); AR-6 |
| R-2 | `formDialog` body via `cover(body)` | `packages/forms/src/form-dialog.ts:227` | RD-01 Tier-0 row; FR-5 |
| R-3 | Menu outside-click catcher via `cover()`; drop manual resize re-anchor | `packages/ui/src/menu/controller.ts:230,286` | RD-01 Tier-0 row; FR-5; PA-8 |
| R-4 | Dropdown popup catcher via `cover()` | `packages/ui/src/dropdown/popup.ts:250` | RD-01 Tier-0 row; FR-5 |
| R-5 | Walkthrough / demo-shell canvases via `cover()` / `center()` | `packages/examples/**` (enumerated set, §02) | RD-01 Tier-0 row; FR-6; PA-5 |
| R-6 | CLAUDE.md "Turbo Vision fidelity" carve-out naming the non-faithful dialog set | `CLAUDE.md` | RD-01 FR-7 / AC-1; PA-2 |

## Out of scope (explicit)

- **App overlay `cover()`** — `application.ts:335` + the `:435` `onResize` re-anchor stay
  `position:'absolute'` in this plan. Converting them breaks the `position === 'absolute'` locator in
  `app-shell.menu.spec.test.ts:58-59` (spec) + the rect assertions in `app-shell.lifecycle.impl`.
  Deferred to #115 with an RD-02 recorded spec re-derivation. (PA-1)
- **All Tier-2 dialog-body rebuilds** — `messageBox`/`confirm`/`inputBox`, editor
  `findDialog`/`replaceDialog`/`confirmBox`, `errorBox`, `FileDialog`, `ChDirDialog`, and the
  `formDialog` **button-row** placement; plus deleting `grow-dialog.ts`/`grow.ts`. These change
  geometry and re-derive oracles → #115 / #120.
- **The maximal ~470-site Tier-3 pass** — inner-widget `at()` sites, story canvases, docs-site
  examples → #110 / #112.
- **The FR-3 per-dialog traversal-order spec tests** — those attach to the Tier-2 dialog-family
  rebuilds (where child add-order actually changes); Tier 0 rebuilds no dialog body, so no add-order
  changes and none is needed here.
- Any change to keyboard/mouse semantics, validation, theming, or return values (behavior invariant,
  RD-01 FR-2).

## Key decisions (from the gate)

- **Parity-safe only** — no geometry change; existing oracles pass unedited (PA-7, RD-02 NFR-1).
- **Defer the one coupled site** (app overlay) to keep the slice zero-spec-oracle-cost (PA-1).
- **Preserve `padding:1`** on the base `Dialog` through the `center()`/`at()` swap (PA-6).
- **Bounded demo set** — the enumerated walkthrough/shell sites only, not the full ~470 (PA-5).
- **Carve-out lands now** (PA-2).

## Definition of done

1. R-1…R-6 implemented.
2. Every witness/behavioral/security oracle listed in `07-testing-strategy.md` passes **unedited**.
3. The two gap-filling characterization tests (base-Dialog shape; menu-catcher dismiss-after-resize)
   are added and green.
4. No `*.spec.test.ts` is edited anywhere in this plan.
5. `grep` confirms the CLAUDE.md carve-out exists and names exactly the FR-1 set.
6. `yarn verify` green on each PR; `yarn lint:fix` run before each PR-bound push.

## Verify command

`yarn verify` (= `yarn lint` → `turbo run typecheck build test check:docs`). Per package where
useful during the inner loop: `yarn workspace @jsvision/ui test`, `... @jsvision/forms test`,
`... @jsvision/examples test`. Reminder: the examples tests import the **built** `@jsvision/ui` dist —
rebuild `ui` before running the examples test loop.
