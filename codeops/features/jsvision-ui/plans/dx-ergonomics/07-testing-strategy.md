# Testing Strategy: DX Ergonomics Pass

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
| --------- | ------ |
| Command sink / caps resolution (core logic) | 90% |
| Modal helpers (glue over Dialog) | 80% |
| Barrel re-exports / demo (config/glue) | 60% |

- Test names state behavior: `should [expected] when [condition]`.
- All new tests are headless (fake `{loop, desktop}` / injected caps) — no TTY.
- Follow the project split: `*.spec.test.ts` (immutable oracle, written first) vs `*.impl.test.ts`.

## 🚨 Specification Test Cases (MANDATORY)

> Derived from `01-requirements.md`, the `03-XX` specs, and the Ambiguity Register. Immutable oracle:
> if the implementation disagrees, the implementation is wrong. In-code traceability comments quote
> behavior in plain language — never an ST-/AR- id or a `codeops/` path.

### Proposal 2 — caps 'auto' & re-exports

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-1 | `createApplication({ input, output })` with no `caps` | App builds; the loop/render-root receive a concrete `CapabilityProfile` equal to `resolveCapabilities().profile` (no error, no `'auto'` string downstream) | R1 / AR-3 |
| ST-2 | `createApplication({ caps: 'auto', … })` | Identical result to ST-1 | R1 / AR-3 |
| ST-3 | `createApplication({ caps: explicitProfile, … })` | The explicit profile is used verbatim — deep-equal to what was passed, no resolution | R2 / AR-3 |
| ST-4 | `import { resolveCapabilities, resolveCapabilitiesAsync, createKeymap, Attr } from '@jsvision/ui'` | `resolveCapabilities`/`resolveCapabilitiesAsync`/`createKeymap` are defined functions; `Attr` is a defined value object (`typeof Attr === 'object'`, `Attr.bold` is a number) — guards the value re-export, since `Attr` is a runtime `const`, not a type | R3 / AR-4 |
| ST-5 | A `.ts` file that type-imports `CapabilityProfile`, `Style`, `Keymap` from `@jsvision/ui` | Typechecks (types are re-exported) | R3 / AR-4 |

### Proposal 3 — onCommand

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-6 | `loop.onCommand('x', fn)`; then `loop.emitCommand('x')` | `fn` is called exactly once | R4 / AR-5 |
| ST-7 | Two handlers `a`,`b` for `'x'`; emit `'x'` | Both `a` and `b` are called | R5 / AR-5 |
| ST-8 | `const off = loop.onCommand('x', fn); off(); emitCommand('x')` | `fn` is NOT called | R4 / AR-7 |
| ST-9 | `app.onCommand` path: register on the app, emit the command | The app-forwarded handler fires (same as loop) | R6 / AR-7 |
| ST-10 | After a handled `onCommand('x')`, a sibling view that also matches `'x'` | Does NOT receive the command (event marked handled) | R5 / AR-6 |
| ST-11 | `run()` an app; emit `Commands.quit` | `run()` resolves (quit still ends the app via the generalized sink) | R7 / AR-8 |
| ST-12 | Emit `quit` while a modal `Dialog` is open (no veto) | The modal closes and `run()` resolves — the cascade is preserved | R7 / AR-8 |
| ST-20 | `run()` an app; emit `Commands.quit` with a numeric arg (e.g. `emitCommand(Commands.quit, 3)`) | `run()` resolves the passed exit code (`3`) — the numeric exit-code path is preserved through the generalized quit registration (guards against a hardcoded `0`) | R7 / AR-8 |

### Proposal 4 — modal helpers

| #    | Input / Scenario | Expected Output / Behavior | Source |
|------|------------------|----------------------------|--------|
| ST-13 | `messageBox(host, { title:'T', text:'hi' })`; user activates OK | Resolves `'ok'` | R8 / AR-12 |
| ST-14 | `messageBox(host, { title:'T', text:'hi', buttons:'okCancel' })`; user cancels | Resolves `'cancel'` | R8 / AR-12 |
| ST-15 | `confirm(host, 'Sure?')`; user chooses Yes | Resolves `true` | R9 / AR-12 |
| ST-16 | `confirm(host, 'Sure?')`; user chooses No (or Esc/close) | Resolves `false` | R9 / AR-12 |
| ST-17 | `inputBox(host, { title:'T', label:'N', value: signal('abc') })`; user activates OK | Resolves `'abc'` | R10 / AR-12 |
| ST-18 | `inputBox(...)`; user cancels | Resolves `null` | R10 / AR-12 |
| ST-19 | `infoBox` and `confirmBox` (editor) after refactor | Same returns as before: `infoBox`→`void` on OK; `confirmBox`→`'yes'\|'no'\|'cancel'` | R12 / AR-10 |

> **⚠️ AUTHORING RULE:** expectations derive from the spec above, not from imagined implementation.
> ST-13…ST-18 drive the modal by synthesizing the command/key the user would produce (emit
> `Commands.ok`/`cancel`/`yes`/`no` or dispatch Esc against the mounted dialog), then await the helper's promise.

## Test Categories

### Specification Tests (from ST-cases)

| Test File | ST Cases | Component |
| --------- | -------- | --------- |
| `packages/ui/test/app-caps.spec.test.ts` | ST-1, ST-2, ST-3 | P2 caps |
| `packages/ui/test/ui-reexports.spec.test.ts` | ST-4, ST-5 | P2 barrel |
| `packages/ui/test/event.oncommand.spec.test.ts` | ST-6…ST-10 | P3 loop |
| `packages/ui/test/app-oncommand.spec.test.ts` | ST-9, ST-11, ST-12, ST-20 | P3 app/quit |
| `packages/ui/test/message-box.spec.test.ts` | ST-13…ST-18 | P4 helpers |
| `packages/ui/test/editor-dialogs.spec.test.ts` (or extend existing) | ST-19 | P4 editor delegate |

### Implementation Tests

| Test File | Description | Priority |
| --------- | ----------- | -------- |
| `event.oncommand.impl.test.ts` | each handler is isolated in its own try/catch — a throwing handler neither skips its siblings nor un-consumes the command; double-unsubscribe; self-unsubscribe mid-fire; multi-handler all-fire | High |
| `message-box.impl.test.ts` | sizing edges, `inputBox` validator veto keeps box open + refocuses, `messageBox` OK-only Esc/close-box resolves `'cancel'` (the `Dialog` always resolves the modal to cancel on Esc/close — the box does NOT stay open) | High |
| `app-caps.impl.test.ts` | `'auto'` never leaks past `createApplication` (loop sees a real profile object) | Med |

### End-to-End Tests

| Scenario | Steps | Expected Result |
| -------- | ----- | --------------- |
| Flagship demo adopts all three | Update `tvision-demo`; run its e2e (if present) / smoke import | Compiles, imports only `@jsvision/ui`, About opens via `messageBox` |

## Test Data

### Fixtures Needed
- A headless `{ loop, desktop }` built from `createApplication({ input: fakeTTY, output: fakeTTY })`,
  reused across P3/P4 specs (mirrors existing app-shell test setup).

### Mock Requirements
- None beyond the existing fake TTY streams; use the real loop/desktop/Dialog (real objects over mocks).

## Verification Checklist
- [ ] All ST-1…ST-20 defined with concrete input/output (above)
- [ ] Every ST traces to a requirement + AR
- [ ] Spec tests written BEFORE implementation, verified RED
- [ ] All spec tests PASS after implementation (green)
- [ ] Impl tests cover edges/internals
- [ ] No regression in existing app-shell / editor / event suites
- [ ] `check-jsdoc.mjs` green (new exports have `@example`)
- [ ] `yarn lint` + touched-package `typecheck` + `yarn verify` green
