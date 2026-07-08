# Requirements: DX Ergonomics Pass

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Source of truth**: [`DX-ASSESSMENT.md`](../../../../../DX-ASSESSMENT.md) Proposals 2–4 (standalone plan, no RD per AR-1)

## Feature Overview

Three additive, backward-compatible ergonomics improvements to `@jsvision/ui`, targeting the
friction a developer meets on day one, first interaction, and first dialog. None changes rendered
output; all preserve every existing call site.

## Functional Requirements

### Must Have

**Proposal 2 — zero-config onboarding**
- [ ] R1. `ApplicationOptions.caps` becomes optional: `caps?: CapabilityProfile | 'auto'`. When
  absent or `'auto'`, `createApplication` resolves it once via `resolveCapabilities().profile` and
  threads the concrete profile to the event loop and `run()`. (AR-3)
- [ ] R2. An explicit `CapabilityProfile` is honored unchanged — no existing call site breaks.
- [ ] R3. `@jsvision/ui`'s barrel re-exports seven `@jsvision/core` symbols: `resolveCapabilities`,
  `resolveCapabilitiesAsync`, `CapabilityProfile`, `Attr`, `Style`, `createKeymap`, `Keymap`. (AR-4)

**Proposal 3 — first-class command handling**
- [ ] R4. `EventLoop.onCommand(name: string, fn: () => void): () => void` registers a handler for a
  named command and returns an unsubscribe function. (AR-7)
- [ ] R5. Multiple handlers may register for the same command; **all** fire when it is emitted, and a
  fired handler marks the event handled (`ev.handled = true`). (AR-5, AR-6)
- [ ] R6. `Application.onCommand` forwards to `loop.onCommand` with the same contract. (AR-7)
- [ ] R7. The existing quit behavior is re-expressed as an internal `onCommand('quit', …)`
  registration through the same mechanism — one command sink, running in the pre-process phase.
  Quit (including the open-modal cascade) is unchanged. (AR-8, AR-9)

**Proposal 4 — async modal helpers**
- [ ] R8. `messageBox(host, { title, text, buttons? })` shows a modal over `Dialog` and resolves to
  `'ok' | 'cancel'`; `buttons` is `'ok'` (default) or `'okCancel'`; `title` is required. (AR-12)
- [ ] R9. `confirm(host, text)` shows a Yes/No modal and resolves to `boolean` (`true` on Yes;
  `false` on No, Esc, or close); default title `'Confirm'`. (AR-12)
- [ ] R10. `inputBox(host, { title, label, value, validator? })` shows a single-field modal and
  resolves to `string | null` (the entered value on OK; `null` on cancel), honoring an optional
  validator via the existing `valid()` gate. (AR-12)
- [ ] R11. The helpers take the minimal `{ loop, desktop }` host seam (the existing
  `EditorDialogHost` shape); an `Application` satisfies it directly. (AR-11)
- [ ] R12. The editor family's `infoBox` and `confirmBox` are refactored to delegate to the new
  general helpers (no behavior change; DRY). `confirmBox`'s Yes/No/**Cancel** three-button contract
  is retained (it is not the same as `confirm`). (AR-10)

### Should Have
- [ ] R13. The `tvision-demo` flagship is updated to use all three proposals — no `caps` prologue,
  `app.onCommand('about', …)`, and `messageBox` for the About box — as the live proof. (AR-13)

### Won't Have (Out of Scope)
- Declarative/JSX composition, functional component factory, `messageBox` for arbitrary custom
  content (Proposals 1, 5–8 in the report).
- `caps: 'auto'` on `createEventLoop`/`createRenderRoot` (AR-3 — Application only).
- Replacing `confirmBox`'s three-button contract with the two-button `confirm` (AR-10 — they coexist).
- Kitchen-sink stories for the modal helpers (AR-13 — non-visual, exempt).

## Technical Requirements

### Performance
- No new per-frame work. Caps resolution happens once at `createApplication`. Modal helpers reuse
  the existing single-frame-per-tick modal path.

### Compatibility
- ESM-only, zero runtime deps, NodeNext `.js` specifiers (project conventions).
- Additive public API only: one option widened from required to optional, new exports, new methods,
  new functions. No signature of an existing export changes incompatibly.

### Security
- No new input-parsing surface. `inputBox` text flows through the existing `Input` + validator +
  `sanitize` path; `messageBox`/`confirm` text is drawn through the existing `Text`/`sanitize` path.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR |
| -------- | ------------------ | ------ | --------- | -- |
| Plan structure | one plan / RD-first / three plans | one standalone `dx-ergonomics` | matches the request; cohesive DX pass | AR-1 |
| `caps: 'auto'` scope | Application only / all three | Application only | `createApplication` owns the primitives; avoids repeating resolution | AR-3 |
| Re-export set | 6 / 6+async / discover | 6 + `resolveCapabilitiesAsync` | covers live-query terminals too | AR-4 |
| `onCommand` multiplicity/consume | many/one · consume/bubble | many, consume | app-level fallback handlers; matches quit sink | AR-5/6 |
| Quit path | generalize / alongside | generalize (preProcess) | one mechanism; spec test guards quit | AR-8/9 |
| P4 vs editor helpers | generalize / new / promote | generalize; editor delegates | DRY without a public rename | AR-10 |
| Host seam | Application / {loop,desktop} / union | {loop,desktop} | headless-testable; Application satisfies it | AR-11 |
| `confirm` shape | Yes/No / OK/Cancel | Yes/No boolean | reads naturally as a question | AR-12 |

> **Traceability:** every scope decision references its Ambiguity Register entry (`00-ambiguity-register.md`).

## Acceptance Criteria

1. [ ] All specification tests (ST-1…ST-20, `07-testing-strategy.md`) pass.
2. [ ] `createApplication({ menuBar })` starts with no `caps`; an explicit profile still works.
3. [ ] The seven core symbols import from `@jsvision/ui`.
4. [ ] `app.onCommand('x', fn)` fires `fn` on command `x`, unsubscribe stops it, quit still ends `run()`.
5. [ ] `messageBox`/`confirm`/`inputBox` resolve to the specified values; editor `infoBox`/`confirmBox` unchanged in behavior.
6. [ ] `tvision-demo` compiles and runs with the new APIs and imports only `@jsvision/ui`.
7. [ ] `check-jsdoc.mjs` passes (every new public export has an `@example`, no banned IDs).
8. [ ] `yarn lint` + touched-package `typecheck` + `yarn verify` all green.
