# Current state — DX consistency & essentials gate

All line references verified against live source at plan time.

## P6.a — outlier constructors

- `packages/ui/src/controls/radio-group.ts:33` — `constructor(labels: readonly string[], value: Signal<number>)`.
- `packages/ui/src/controls/check-group.ts:34` — `constructor(labels: readonly string[], value: Signal<boolean[]>)`.
- Neither exports an options type. The sibling `MultiCheckGroup` **does**:
  `packages/ui/src/controls/multi-check-group.ts:12` — `MultiCheckGroupOptions { readonly items; readonly states; readonly value }`.
- Barrel: `packages/ui/src/index.ts:91` exports `MultiCheckGroupOptions` but not `RadioGroupOptions`/`CheckGroupOptions` (they don't exist).

**Blast radius (positional `new RadioGroup(`/`new CheckGroup(`):**
- Source: `packages/ui/src/editor/dialogs.ts:66`, `:117` (Find/Replace dialogs).
- Examples: `controls-demo/main.ts:87,88`, `controls-live/form.ts:63,64`,
  `kitchen-sink/stories/checkgroup.story.ts:19`, `kitchen-sink/stories/radiogroup.story.ts:21`.
- Tests (impl): `accelerator-reveal.impl.test.ts:45,93,94`, `controls.cluster.impl.test.ts:37,46,54,62,73`,
  `controls.hardening.impl.test.ts:133`.
- Tests (**spec** — AR-5, assertions preserved): `controls.cluster.spec.test.ts:44,73`,
  `controls.focus.spec.test.ts:26,27`, `controls.hardening.spec.test.ts:64`.

## P6.b — color callbacks

`packages/ui/src/color/color-swatch.ts`:
- `:54` `onChange?: (c: Color) => void` — "Fired when `value` changes" (live).
- `:55` `onCommit?: (c: Color) => void` — "fired on Enter/Space or a mouse-up over a cell" (commit).
- `:135` `select()` fires both `onChange` + `onCommit`.
- `:154` `setLive(idx)` fires `onChange` only (live).
- `:158` `close()` fires `onCommit` only (commit).

`packages/ui/src/color/color-picker.ts:264` wires `onCommit: () => commit()` to close its popup;
JSDoc at `:133`,`:239` references the swatch's `onCommit`.

**Rename map (AR-2):** `onChange`(live) → `onInput`; `onCommit`(commit) → `onChange`.
- `setLive` → fire `onInput`; `close` → fire `onChange`; `select` → fire both (`onInput` + `onChange`).
- `ColorPicker` closes on the swatch's `onChange`.

**Blast radius (`onCommit`/`onChange` outside color source):**
- Tests (**spec** — AR-5): `color-swatch.spec.test.ts` — the `makeSwatch` helper's collectors at
  `:62` (`const commits`), `:68` (`onCommit: (c) => commits.push(c)`) and the assertion at `:155`
  (`h.commits.at(-1)` + its `'onCommit fired …'` message). The `onCommit` collector renames to
  `onChange` and the live `onChange` collector renames to `onInput`; the assertion *message* is
  cosmetic while the behavioral assertion is preserved (AR-5). ST-4 supersedes the `:68`-era
  assertion with the `onInput`/`onChange` split.
- `ColorPicker` (source): the picker forwards `onChange: this.onChange` (`color-picker.ts:263`) +
  `onCommit: () => commit()` (`:264`); the rename makes these `onInput: this.onInput` +
  `onChange: (c) => { this.onChange?.(c); commit(); }`, and `ColorPickerOptions` gains `onInput?`
  (see 03-01 §B). No example/demo consumes `ColorPicker`'s value callback (repo grep: none).

## P7 — `run()` and the essentials gate

`packages/ui/src/app/run.ts`:
- `RunContext` (`:33-50`) carries `loop`, `caps`, `runtime?`, `input?`, `output?`,
  `warnAmbiguousWidth?`, `adaptAmbiguousWidth?`, `quitState` — the existing zero-config flags
  default-on and are read at `:74`/`:77`. **`requireTty` is added here** (default true).
- `runApplication` (`:58`) creates the host (`:66`) and starts it at `:122` (`await host.start()`).
  The gate call goes **immediately before** `:122`.

`@jsvision/core` (already public — zero new core surface, NFR-1):
- `assertEssentials(caps, facts: { isTTY: boolean }, options?: { logger? })` —
  `packages/core/src/engine/safety/essentials.ts:139`; throws `EssentialsNotMetError` when `!isTTY`.
- `detectTty(options?: { input?, output? }): boolean` — `packages/core/src/engine/host/streams.ts:144`;
  reads the **injected** streams (honest under test doubles).
- Both re-exported at `packages/core/src/engine/index.ts:123`/`:87`; `EssentialsNotMetError` at `:125`.

**Threading:** `ApplicationOptions.requireTty?` → `createApplication` passes it into the `RunContext`
it assembles (alongside `caps`/`quitState`) → `run.ts` reads `ctx.requireTty ?? true`.

**Headless callers that must set `requireTty: false`** (else the default gate throws under fakes):
the `run()`-driving app-shell tests via their shared harness —
`app-shell.lifecycle.impl.test.ts` (`makeApp`/`base` helper), `app-shell.integration.impl.test.ts`,
`app-shell.adapt.spec.test.ts`, `app-oncommand.spec.test.ts`, and the `app-shell.fixtures.ts` doubles.
The interactive example demos (`controls-live`, `tvision-demo`, `tvedit-demo`, `amiga-clock`,
`kitchen-sink`) run against a real TTY and keep the default (they *want* the throw on a non-TTY).

## Verify command (confirmed)

Per the project `CLAUDE.md`: `yarn verify` = `turbo run typecheck build test` (now also runs lint).
The known gaps (`verify` skips per-package typecheck of tests / vitest doesn't type-check) are covered
by also running `yarn lint` and `yarn workspace @jsvision/ui typecheck` — the same trio dx-ergonomics used.
