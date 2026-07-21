# RD-04: Non-Functional (packaging, security, testing, gates)

- **Priority:** Must
- **Depends on:** RD-01, RD-02, RD-03
- **Status:** Drafted

## Summary

The cross-cutting requirements that make `@jsvision/forms` a shippable, correct member of the
monorepo: packaging + dependency policy, security posture, performance, the spec-first test
strategy, the mandatory kitchen-sink story, documentation, and the repo gates.

## Functional / non-functional requirements

### FR-4.1 — Package & dependency policy *(AR-16, AR-02)*
- New workspace package `@jsvision/forms` under `packages/forms/`, **private until release** (like
  `@jsvision/ui`), ESM-only, `tsconfig` extending `tsconfig.base.json`, NodeNext `.js` import
  specifiers even for `.ts` sources.
- Dependencies: `@jsvision/ui` (imported by name). **`zod` is a required peer dependency**; forms
  imports zod. `zod` is added as a **devDependency** for tests, and to `packages/examples` for the
  story.
- `@jsvision/core` and `@jsvision/ui` remain zero-runtime-dependency; `yarn check:deps` stays green
  (zod is pure JS — the guard bans only native deps).
- Lockstep version via `@blendsdk/lockstep` (`yarn lockstep:version`); the per-package `VERSION`
  constants are re-synced by `yarn sync-package-versions`. (`@jsvision/forms` exports no `VERSION`
  constant, so it needs no `sync-package-versions` target — only a `version` field for lockstep.)

### FR-4.2 — Public API surface (single barrel) *(AR-16)*
`src/index.ts` exports exactly: `createForm`, `FormFieldError`, `bindField`, `bindRadio`,
`bindCheck`, and the types `Form`, `Field`, `CreateFormOptions` (+ any option/param types). No
internal helper is exported. Names are stable.

### FR-4.3 — Security posture *(AR-22)*
- Validation/sanitization of user input is performed by the app's Zod schema at the boundary; the
  engine surfaces results, it does not weaken them.
- The engine **never bypasses** the widgets' existing control-byte sanitization — text flows through
  `Input`, which writes via the sanitizing `ScreenBuffer.set`; the store stores only the string the
  widget produced.
- No `eval`/`Function`/dynamic code; no secrets or PII handling in the library; no network/filesystem
  access. The TUI context has no SQL/XSS/command/path-traversal surface in the engine itself.
- A security-focused test asserts that a control-byte-laden value round-tripping through a field does
  not escape sanitization when rendered.

### FR-4.4 — Performance *(AR-23)*
Eager whole-object `safeParse` on every raw change is the accepted model; for normal forms this is
sub-millisecond. **No debounce** this slice (async slice concern). No perf gate is imposed; the
`bench` harness is not extended for forms.

### FR-4.5 — Testing strategy (spec-first) *(repo standard)*
- Order: `*.spec.test.ts` oracles (from these RDs) → red → implement → green → `*.impl.test.ts`.
  A spec test is an immutable oracle; if it fails post-implementation, the code is wrong.
- Coverage across the store (value model, dirty/reset/isValid/submit, stable handles, unknown-key
  throw), validation (per-field + form-level errors, cross-field, coercion, live-vs-touched), and
  binding (direct bind, `bindField` touched edges, `bindRadio`/`bindCheck` both directions incl.
  the `-1`/empty edges).
- Tests import `@jsvision/ui` and `zod` by name against built dist, per monorepo convention.

### FR-4.6 — Kitchen-sink story (NON-NEGOTIABLE) *(repo gate)*
A `forms/*` story in `packages/examples/kitchen-sink/stories/` demonstrating a live multi-field form
(text + coerced number + switch + radio + checks), a visible bound-state echo (`valid`/`dirty`), live
validation, and a submit-gated button — registered in `stories/index.ts` and passing
`kitchen-sink.smoke.spec.test.ts` (mounts headlessly, paints, unique id, required metadata).

### FR-4.7 — Documentation *(repo standard)*
Every public export carries JSDoc with a purpose sentence, params/returns, gotchas, and a real,
copy-pasteable `@example`. No CodeOps/Turbo-Vision/C++ IDs or plan/requirement references in shipped
code or comments. `yarn check:docs` (`check-jsdoc.mjs`) passes.

### FR-4.8 — Green build & lint gate *(prime directive)*
`yarn verify` is green (lint → typecheck → build → test → check:docs). `yarn lint:fix` is run and
its changes committed before the PR-opening push, so CI is never the first place a fixable
lint/format error surfaces.

## Acceptance criteria

- [ ] `packages/forms` builds and typechecks; `yarn check:deps` passes; core/ui remain zero-dep.
- [ ] Importing anything not in the FR-4.2 list from the barrel fails (surface is exactly as specified).
- [ ] A control-byte-laden field value cannot escape sanitization on render (security test passes).
- [ ] Spec tests exist for every RD-01…03 acceptance criterion and pass; impl tests cover edges.
- [ ] The `forms/*` kitchen-sink story is registered and passes the headless smoke test.
- [ ] `yarn check:docs` passes; every public export has an `@example`; no banned references present.
- [ ] `yarn verify` is green on the branch.

## Out of scope
Publishing to npm; extending the bench harness; async-slice performance work (debounce).

## Traceability
AR-02, AR-16, AR-22, AR-23.
