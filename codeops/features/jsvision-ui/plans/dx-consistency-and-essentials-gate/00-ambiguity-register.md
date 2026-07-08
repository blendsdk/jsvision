# Zero-Ambiguity Register — dx-consistency-and-essentials-gate

> **Status**: ✅ GATE PASSED — all items resolved with the user's explicit decisions (2026-07-08)
> **Feature**: jsvision-ui · **Source**: `DX-ASSESSMENT.md` (Proposals 6 + 7), no RD
> **Execution note**: AR-6 was added during execution (2026-07-08) — a runtime discovery that supersedes plan task 2.3.

Every semantically-weighted decision below was surfaced to the user and resolved before any other
plan document was written. Cosmetic/zero-impact items are exempt per the shared gate.

## Register

| # | Category | Ambiguity / gap | Resolution (user decision) | Status |
|---|----------|-----------------|----------------------------|--------|
| 1 | Scope / compatibility | `@jsvision/ui` is private-until-first-release. The assessment advises keeping deprecated overloads/aliases "for one minor version" — written as if the API were already public. Keep them or hard-replace? | **Hard-replace (pre-release).** No external consumers, so change the constructors/callbacks outright and update every internal call site (source, demos, kitchen-sink, tests). **No** deprecated overloads/aliases — shipping them would violate the "no dead code" standard. | ✅ Resolved |
| 2 | Behavior / naming | `onChange`/`onCommit` are **not** synonyms: framework-wide `onChange` fires on value-commit (`Calendar` etc.), while `ColorSwatch`/`ColorPicker` uniquely add `onCommit` for the discrete commit gesture **and** keep `onChange` for live change. How far to unify? | **Principled taxonomy.** `onChange` = committed value framework-wide: rename `ColorSwatch`/`ColorPicker` `onCommit` → `onChange`, and the existing live `onChange` → `onInput` (matching the live-typing convention). `ColorPicker`'s popup-close wiring follows the rename. | ✅ Resolved |
| 3 | Behavior / edge case | P7 wires the essentials gate into `run()`, but `run()` is driven headlessly by tests (`FakeRuntimeAdapter`/`FakeInput`/`CaptureStream`) and CI demos, which present no real TTY — a hard gate would throw there. | **Opt-out flag, default on.** Add `requireTty?: boolean` (default `true`) to `ApplicationOptions` (threaded to `RunContext`), mirroring the existing zero-config `warnAmbiguousWidth`/`adaptAmbiguousWidth` seams. `assertEssentials` runs before `host.start()` and throws `EssentialsNotMetError` on a non-TTY; headless callers pass `requireTty: false`. | ✅ Resolved |
| 4 | Scope | Which constructors get normalized to options objects? | **`RadioGroup` + `CheckGroup` only** — the true outliers that ship *no* options type (`MultiCheckGroup` already takes one). `Button(text, opts)` stays as-is (the assessment calls its positional+options mix "defensible"; it is not an outlier). Source-defined by `DX-ASSESSMENT.md` Proposal 6. | ✅ Resolved |
| 5 | Testing | The hard-replace (AR-1) removes the old positional constructors and the `onCommit` field, which existing **spec tests** call (`controls.cluster.spec`, `controls.focus.spec`, `controls.hardening.spec`, `color-swatch.spec`). Editing a spec test is normally forbidden. | **Update the spec-test call sites** to the new signatures — a direct, user-approved API change (AR-1/AR-2), not a mismatch being hidden. Only the constructor invocation / callback field name changes; **every behavioral assertion is preserved verbatim**. This is the sanctioned "the contract itself changed" exception, scoped to call-site syntax. | ✅ Resolved |
| 6 (runtime) | Testing / plan-vs-reality | Plan task 2.3 says the `run()`-driving app-shell suites must set `requireTty: false` "else the default gate throws under fakes". At execution time the doubles were found to hard-code `isTTY = true` (`CaptureStream`/`FakeInput` in `app-shell.fixtures.ts`), so `detectTty` returns `true` and the default gate **passes** for them. | **Skip task 2.3 as a verified no-op** (user decision, 2026-07-08). Adding `requireTty: false` would be redundant, currently-inert config (violates "no dead code"). The gate is proven non-breaking: all four suites (`app-shell.lifecycle/integration/adapt`, `app-oncommand`) stay green with the gate in place and no opt-out. The gate spec's ST-7 non-TTY double sets `isTTY = false` explicitly. | ✅ Resolved |

## Notes

**AR-2 taxonomy detail.** After the rename `ColorSwatch` exposes: `onInput?(c)` (fired on every live
value change — arrow/click/drag) and `onChange?(c)` (fired on the discrete commit — Enter/Space/mouse-up).
`select()` fires both (live change + commit); the internal `setLive` fires only `onInput`; the internal
`close` fires only `onChange`. `ColorPicker` forwards the same split and closes its popup on the swatch's
`onChange`.

**AR-3 mechanism detail.** In `packages/ui/src/app/run.ts`, before `await host.start()`:
`if (ctx.requireTty ?? true) assertEssentials(ctx.caps, { isTTY: detectTty({ input: ctx.input, output: ctx.output }) });`
— both symbols already exist on the `@jsvision/core` public entry point (`assertEssentials`, `detectTty`).
`detectTty` reads the **injected** streams, so it is honest under test doubles.
