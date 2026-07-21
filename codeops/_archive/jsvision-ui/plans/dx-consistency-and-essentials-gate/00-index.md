# Plan: DX consistency & essentials gate

> **Type**: Feature plan (no RD) · **Feature**: jsvision-ui · **CodeOps Skills Version**: 3.3.2
> **Source**: [`DX-ASSESSMENT.md`](../../../../../DX-ASSESSMENT.md) — Proposals 6 + 7
> **Status**: Plan Created 📋 · **Progress**: 0/? (see `99-execution-plan.md`)

## What this delivers

Two additive, backward-incompatible-but-pre-release DX polish items from the outside-evangelist
audit, closing the API-consistency (dimension F, 6.5/10) and under-wired-safety (dimension G, 6.5/10)
gaps. Neither changes a rendered glyph.

- **P6 — API-shape consistency.** Normalize the two outlier controls (`RadioGroup`, `CheckGroup`) to
  the framework's dominant options-object constructor (+ exported `RadioGroupOptions`/
  `CheckGroupOptions`), and unify the value-callback vocabulary so `onChange` means "committed value"
  framework-wide (`ColorSwatch`/`ColorPicker` `onCommit` → `onChange`; their live callback →
  `onInput`).
- **P7 — Essentials gate in `run()`.** Call the existing `assertEssentials` gate before the host
  starts, so a launch with no interactive terminal at all (a cron/CI job, a container with no tty,
  or stdin+stdout both redirected with no `/dev/tty`) throws the actionable `EssentialsNotMetError`
  instead of silently yielding a keyboard-less app. Piped output backed by a controlling terminal
  still runs (the host binds `/dev/tty`). Gated by a new `requireTty` option (default on) so headless
  callers opt out.

## Documents

| Doc | Purpose |
|-----|---------|
| [00-ambiguity-register.md](00-ambiguity-register.md) | Zero-Ambiguity Gate — 5 items, all resolved (✅ GATE PASSED) |
| [01-requirements.md](01-requirements.md) | Scope, in/out, success criteria |
| [02-current-state.md](02-current-state.md) | The exact current shapes + full blast radius |
| [03-01-callback-and-constructor-normalization.md](03-01-callback-and-constructor-normalization.md) | P6 spec |
| [03-02-essentials-gate.md](03-02-essentials-gate.md) | P7 spec |
| [07-testing-strategy.md](07-testing-strategy.md) | ST-1…ST-9 spec oracles + verification |
| [99-execution-plan.md](99-execution-plan.md) | Phases, tasks, progress |

## Key decisions (see the register)

1. **Hard-replace** — no deprecated overloads/aliases (pre-release, no external consumers).
2. **Principled callback taxonomy** — `onChange` = committed; live change → `onInput`.
3. **`requireTty` opt-out** (default `true`) — mirrors the existing zero-config host seams.
4. Constructor normalization scope = **`RadioGroup` + `CheckGroup` only**.
5. Existing spec-test **call sites** update to the new signatures (assertions unchanged) — the
   sanctioned "the contract itself changed" exception.

## Verify

`yarn verify` (turbo typecheck + build + test + lint) · `yarn lint` · `yarn workspace @jsvision/ui typecheck`
(the last two cover the CI gaps `verify` alone leaves).
