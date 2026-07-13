# 07 — Testing strategy

Spec-first: the ST oracles below are written before implementation and fail red until the code lands.
Expectations derive from the requirements (`01`) and specs (`03-01`/`03-02`), never from imagined
implementation behavior.

## Specification test cases

### P6 — constructors & option types (→ `controls.options.spec.test.ts`, new)

- **ST-1** `new RadioGroup({ labels: ['~L~', '~C~', '~R~'], value })` constructs; moving the selection
  updates `value()` to the chosen index (bind intact). Traces FR-1. AR-1/AR-4.
- **ST-2** `new CheckGroup({ labels: ['~A~', '~B~'], value })` constructs; toggling item 0 flips
  `value()[0]` (bind intact). Traces FR-2.
- **ST-3** `RadioGroupOptions` and `CheckGroupOptions` are importable from `@jsvision/ui` (value/type
  presence — a `.spec` type-import + usage). Traces FR-3.

### P6 — color callback taxonomy (→ extend `color-swatch.spec.test.ts`, `color-picker` coverage)

- **ST-4** `ColorSwatch` with `onInput`/`onChange`: an arrow-key nav fires **`onInput`** (not
  `onChange`); pressing Enter over a cell fires **`onChange`**. `select(c)` fires both. Traces FR-4.
  AR-2. *(This replaces the old `onCommit`-based assertion at `color-swatch.spec.test.ts:68`, AR-5 —
  same behavior, new field names.)*
- **ST-5** `ColorPicker` (observing the **picker's** `onInput`/`onChange` options): opening the popup,
  arrowing fires the picker's **`onInput`** and the popup stays open; pressing Enter fires the picker's
  **`onChange`** (once, committed value) and closes the popup. Asserts both `ColorPickerOptions`
  callbacks are wired (no dead `onChange`). Traces FR-5.
- **ST-6** **No `onCommit`** identifier exists in `packages/ui/src` (packaging/grep oracle); the
  barrel exports `RadioGroupOptions`/`CheckGroupOptions`. Traces FR-5/FR-3.

### P7 — essentials gate (→ `app-essentials-gate.spec.test.ts`, new)

- **ST-7** `createApplication({ caps })` (default `requireTty`) driven with a **non-TTY** double
  (`detectTty` → false) → `run()` rejects/throws `EssentialsNotMetError`, and its message contains
  `"interactive TTY"`. The host is **never started** (no terminal takeover on the failing path).
  Traces FR-7.
- **ST-8** `createApplication({ caps, requireTty: false })` with the same non-TTY double → `run()`
  does **not** throw the essentials error; it starts and later resolves the quit exit code normally.
  Traces FR-8.
- **ST-9** With a TTY-reporting double (`isTTY: true`) and default `requireTty` → `run()` does not
  throw; normal lifecycle. Traces FR-7 (positive path).

## Implementation tests (after green)

- **IT-1** All migrated positional/`onCommit` call sites compile and the affected demos/stories build
  (`kitchen-sink.smoke` still mounts the `controls/*` and `color/*` stories).
- **IT-2** `ColorSwatch` mouse-up over a cell fires `onChange` once (commit), and a drag across cells
  fires `onInput` per cell but `onChange` only on release — the live/commit split under the pointer.
- **IT-3** `assertEssentials` degradations (no mouse / mono / no altScreen) do **not** make a TTY run
  throw (only the missing-TTY essential is fatal) — guards that P7 didn't over-gate.
- **IT-4** `EssentialsNotMetError` thrown by ST-7 leaves `process`/streams untouched (no raw mode
  entered) — asserts the pre-`host.start()` ordering.

## Verification

Per task and at phase end:

```
yarn verify                              # turbo typecheck + build + test + lint
yarn lint                                # eslint + prettier (repo-wide)
yarn workspace @jsvision/ui typecheck    # covers the test-typecheck gap verify leaves
```

Green-bar definition of done: ST-1…ST-9 pass, IT-1…IT-4 pass, `check:docs` clean (no missing
`@example`, no banned refs), no `onCommit` / positional-group call anywhere in the repo.
