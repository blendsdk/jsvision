# Plan: Live-Example System

> **Implements**: docs-website/RD-03
> **Feature**: docs-website · **Phase**: A (MVP)
> **CodeOps Skills Version**: 3.3.2
> **Status**: Plan Created 📋 — ready for `exec_plan live-example-system`

The system that makes every code sample on the JSVision docs site **runnable live in the browser**:
the example-module contract, a hand-authored registry, a Play button → modal xterm dialog (via
`@jsvision/web`'s `mountApp`), a reusable **DemoShell** (two chrome modes), the accessibility +
no-keyboard fallbacks, and a two-tier headless test harness that gates in `yarn verify`.

## Documents

| Doc | What it covers |
|-----|----------------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — AR-1…AR-21 (✅ all resolved). |
| [01-requirements.md](01-requirements.md) | Requirements + scope (source: RD-03). |
| [02-current-state.md](02-current-state.md) | What exists today (docs-site, `@jsvision/web`, DemoShell building blocks). |
| [03-01-example-contract-and-registry.md](03-01-example-contract-and-registry.md) | `defineExample` contract, registry, parity + snippet-drift. |
| [03-02-demoshell.md](03-02-demoshell.md) | DemoShell (minimal + full), site-meta, theme/depth/About. |
| [03-03-play-component.md](03-03-play-component.md) | PlayController + client-only Vue Play component, lifecycle, error panel, close/focus, deep-link, reset/size. |
| [03-04-accessibility-and-fallback.md](03-04-accessibility-and-fallback.md) | DOM source+prose, ARIA, touch detection, fallback slot. |
| [03-05-seed-examples.md](03-05-seed-examples.md) | The 8 seed examples (categories, shell mode, what each proves). |
| [03-06-testing-and-ci-integration.md](03-06-testing-and-ci-integration.md) | vitest project, two-tier harness, turbo wiring, typecheck tsconfig, CSP-compat, CLAUDE.md note. |
| [07-testing-strategy.md](07-testing-strategy.md) | Specification test cases ST-1…ST-N ↔ AC / AR. |
| [99-execution-plan.md](99-execution-plan.md) | Phases 0–6, task checklist, spec-first ordering. |

## Key decisions (see the register for the full trail)

- **Home & gate (AR-1/2/3):** examples in docs-site; a vitest `test` project + scoped `typecheck` join `yarn verify`; a **two-tier** harness — cheap headless render-root paint-smoke for all (`app.loop.renderRoot.buffer()`), `@xterm/headless` leak-smoke for one.
- **DemoShell (AR-7/17):** one module, `minimal` vs `full` chrome; About reachable everywhere.
- **Play (AR-10/11/15):** plain-TS `PlayController` (testable), client-only (SSR-safe + code-split), × / backdrop close with Escape → TUI, in-dialog error panel, one-dialog cap.
- **Anti-drift (AR-5/6):** hand-authored registry + parity test; whole-file `<<<` embeds make the light drift check provably correct.
- **Seed set (AR-20):** 8 examples, phased — 2 prove the mechanism, 6 add breadth.

## Verify

`yarn verify` (AR-21).
