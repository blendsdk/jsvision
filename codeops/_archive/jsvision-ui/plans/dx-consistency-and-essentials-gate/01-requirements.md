# Requirements — DX consistency & essentials gate

> **Source**: [`DX-ASSESSMENT.md`](../../../../../DX-ASSESSMENT.md) Proposals 6 + 7 (no RD).
> All decisions trace to [00-ambiguity-register.md](00-ambiguity-register.md).

## Goal

Close two of the assessment's remaining "path to 8.5" items with additive, low-risk polish:
API-shape consistency (P6) and a wired-in essentials gate (P7). Zero architectural change, zero
glyph change.

## Functional requirements

### P6 — API-shape consistency

- **FR-1** `RadioGroup` is constructed with an options object: `new RadioGroup({ labels, value })`.
  The positional `(labels, value)` form is **removed** (AR-1).
- **FR-2** `CheckGroup` is constructed with an options object: `new CheckGroup({ labels, value })`.
  The positional form is **removed** (AR-1).
- **FR-3** `RadioGroupOptions` and `CheckGroupOptions` are exported from `@jsvision/ui`, following the
  `readonly …; readonly value` pattern of the existing `MultiCheckGroupOptions` (whose list key is
  `items`). Radio/CheckGroup keep the domain key `labels` (matching their current constructor
  parameter): `{ readonly labels; readonly value }`. The `items`/`labels` divergence from
  `MultiCheckGroup` is accepted (AR-4 keeps `MultiCheckGroup` out of scope).
- **FR-4** `ColorSwatch`'s commit callback is renamed `onCommit` → `onChange`; its live-change
  callback is renamed `onChange` → `onInput` (AR-2). `onInput` fires on every live value change
  (arrow/click/drag); `onChange` fires only on the discrete commit (Enter/Space/mouse-up).
- **FR-5** `ColorPicker` exposes the same split: `ColorPickerOptions` gains `onInput?` (live) and its
  existing `onChange?` changes meaning from live to **commit**. The hosted swatch forwards
  `onInput: this.onInput` (live) and `onChange: (c) => { this.onChange?.(c); commit(); }` — the
  discrete commit fires the picker's `onChange` and then closes the popup. No `onCommit` symbol
  remains anywhere in the public API, and the picker's `onChange` option is never left unwired.

### P7 — Essentials gate

- **FR-6** `ApplicationOptions` gains `requireTty?: boolean` (default `true`), threaded to
  `RunContext.requireTty` (AR-3).
- **FR-7** When `requireTty` is true (the default), `run()` calls `assertEssentials(caps, { isTTY:
  detectTty({ input, output }) })` **before** `host.start()`. `detectTty` reports a usable terminal
  whenever both ends are a TTY *or* the POSIX `/dev/tty` bind succeeds (so piping output while a
  controlling terminal exists does **not** fail). The gate therefore throws `EssentialsNotMetError`
  ("Terminal does not meet the SDK essentials: interactive TTY …") on a launch with **no interactive
  terminal at all** — e.g. a cron/CI job, a container with no tty, or stdin *and* stdout redirected
  with no `/dev/tty` — rather than merely on piped output.
- **FR-8** When `requireTty` is `false`, the gate is skipped and `run()` starts as before (the path
  headless tests and CI demos take).

## Non-functional / constraints

- **NFR-1** Additive to `@jsvision/core` surface = **zero** (both `assertEssentials` and `detectTty`
  are already on the public entry point; `EssentialsNotMetError` too).
- **NFR-2** Every public/exported symbol changed or added carries user-facing JSDoc with an
  `@example`; `check:docs` stays green (no banned refs, no missing `@example`).
- **NFR-3** Behavioral assertions in existing spec tests are preserved verbatim; only call-site
  syntax changes where the removed API is invoked (AR-5).

## In scope

- `RadioGroup`/`CheckGroup` constructor normalization + option-type exports.
- `ColorSwatch`/`ColorPicker` callback rename (`onCommit`→`onChange`, live `onChange`→`onInput`).
- `requireTty` option + `assertEssentials` wiring in `run()`.
- Updating every internal call site: `@jsvision/ui` source (`editor/dialogs.ts`), `@jsvision/examples`
  (controls-demo, controls-live, kitchen-sink stories), and all affected tests.

## Out of scope

- Normalizing `Button(text, opts)` or any other constructor (AR-4 — not an outlier).
- Renaming `onSelect` (list activation) or any callback other than the color `onCommit`/live-`onChange`
  pair (AR-2 scope).
- A deprecation/alias layer of any kind (AR-1 — hard-replace).
- Wiring the essentials gate's degradation notices into a logger (the assessment asks only for the
  non-TTY throw; degradation logging stays a later nicety).
- Proposals 5 and 8 (functional component factory, declarative composition) — separate future work.

## Success criteria (definition of done)

- ST-1…ST-9 (see [07-testing-strategy.md](07-testing-strategy.md)) green.
- `yarn verify` + `yarn lint` + `yarn workspace @jsvision/ui typecheck` all clean.
- No `onCommit` and no positional `RadioGroup`/`CheckGroup` call remains in the repo.
- The `controls`/`color` kitchen-sink stories and the `controls-*` demos still build and render.
