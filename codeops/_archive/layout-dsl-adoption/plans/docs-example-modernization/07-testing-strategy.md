# Testing Strategy: docs-example-modernization

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

This plan is unusual: **its first phase builds the oracle for its second and third**. That shapes
everything below. The guard gets full spec-test treatment because it is new behaviour with a
contract; the 53-line example sweep gets no tests of its own because the guard *is* its test; the
docs-site retirement gets a small spec oracle plus a rendered before/after comparison.

| Code type | Target |
|---|---|
| The guard's contract (`checkExamples`) | Spec-tested over fixtures — ST-1…ST-8, ST-13, ST-14 |
| **The guard actually gating the repo** | **Spec-tested over the real roots — ST-12 (FR-1a)** |
| The guard's internals (fences, terminators, symbol keying) | Impl-tested |
| The 53 `@example` conversions | The guard + three acceptance greps (AC-2, AC-3, AC-5) |
| The 38 docs-site call sites (35 after FR-8) | ST-9…ST-11 + `yarn typecheck` + the 3.4.1 render diff |

> **ST-12 is not optional bookkeeping.** The fixture cases pin the *contract*; ST-12 is the only
> thing that makes the contract apply to `packages/*/src`. Without it the harness, the fixtures and
> the committed allowlist all exist and none of them gates anything — FR-1 and FR-2 ship inert, and
> Phase 2's declared oracle ("the guard *is* its test") does not exist.

### Coverage adjustment

Standard numeric coverage targets are **not** applied. The guard is one module with a table-shaped
contract, and that table is enumerated exhaustively as ST-cases — a percentage would measure less
than the case list does. The substitute bar: **all six** verdict rows in
[03-01](03-01-example-compile-guard.md) §"The allowlist contract" have a spec case (row 6 is ST-13 —
it had none in the original draft, despite this very sentence claiming otherwise), both key-collision
cases have one (ST-8, ST-14), the standing repo gate exists (ST-12), every touched docs-site file's
existing suite stays green and unedited, and every acceptance grep reaches its stated number.

## 🚨 Specification Test Cases (MANDATORY — NON-NEGOTIABLE)

> Derived from [03-01](03-01-example-compile-guard.md), [03-03](03-03-docs-site-shadow-retirement.md)
> and the Ambiguity Register — never from observed output. If one fails after implementation, the
> implementation is wrong.
>
> The in-code traceability comment for each test states the behaviour in plain language. It must
> never carry an `ST-`/`AR-` id or a planning path.

### The guard (`packages/docs-site/test/jsdoc-examples.spec.test.ts`)

ST-1…ST-8 and ST-13/ST-14 drive **`checkExamples(collectExamples([fixtureRoot]), injectedAllowlist)`**
over **fixtures** — not over the live repo, whose state changes under every task in phases 2 and 3.
Driving them through `collectExamples` is required, not incidental: fence stripping, terminator
un-escaping and symbol/ordinal keying all live there, so a hand-built `ExampleBlock[]` would make
ST-6 assert nothing (its body would already be stripped) and ST-14 never touch the key resolver.

**ST-12 is the exception and runs over the real roots** — that is its entire purpose.

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | A fixture source whose `@example` body compiles; empty allowlist | `unexpected` and `stale` are both empty; `checked` counts the block | 03-01 §contract row 1 |
| ST-2 | A fixture whose `@example` calls a function with the wrong arity; empty allowlist | One `unexpected` entry, keyed `<file>::<Symbol>`, carrying code `2554` | 03-01 §contract row 2, AR-2 |
| ST-3 | The same failing fixture, with an allowlist entry for that key recording code `2554` | `unexpected` is empty — the failure is grandfathered | 03-01 §contract row 3, AR-9 |
| ST-4 | An allowlist entry for a fixture whose block **compiles** | `stale` contains that key; the run is a failure. This is what makes "may only shrink" enforceable rather than aspirational | 03-01 §contract row 5, AR-11 |
| ST-5 | An allowlisted fixture that now fails with a **different** code set than recorded (allowlist records `[2304]` naming `dialog`; block yields `[2304]` naming `dialog` **and** `at`) | One `unexpected` entry — a new defect must not hide behind an old entry. **Use the same-code case, not a different-code case**: five of the six blocks the sweep edits are grandfathered on `TS2304` and a forgotten `at` import is also `TS2304`, so identical-code-different-identifier is the failure mode that actually threatens this plan | 03-01 §contract row 4, AR-9 |
| ST-6 | A fixture whose `@example` body is wrapped in a ` ```ts ` fence and is otherwise valid | `unexpected` is empty — the fence is stripped before compiling, not compiled as a template literal | 03-01 §Extraction, AR-12 |
| ST-7 | A fixture whose `@example` imports a sibling by relative specifier (`'./thing.js'`), where that sibling exists beside the source | `unexpected` is empty — the block resolved against the **source's** directory. After the run, no `.ts` file other than the fixtures remains in that directory | 03-01 §Compilation, AR-13 |
| ST-8 | One fixture file carrying **two** `@example` blocks on two different exported symbols, one compiling and one not, with an allowlist entry for **only** the failing one | `unexpected` is empty and `stale` is empty — entries address symbols independently, and allowlisting one does not mask or affect the other | 03-01 §Symbol resolution, AR-10 |
| **ST-12** | The harness run over the **real** roots (`packages/{core,ui,web,files,datagrid,forms}/src`) with the **committed** allowlist | `unexpected` is empty and `stale` is empty. **This is the build gate** — the case that makes FR-1/FR-2 apply to the repo rather than to fixtures. It is the only ST case that reads repo state, and it must fail the suite, not warn | FR-1a, 03-01 §Proposed changes, AR-2 |
| **ST-13** | An allowlist entry keyed to a fixture **file or symbol that does not exist** (e.g. `fixtures/gone.ts::Ghost`, and an entry naming a real fixture file with a symbol it does not declare) | Both keys appear in `stale`; the run is a failure. This is verdict row 6 — the path that fires after every rename or file move, and the one that lets an unattended list accrue dead weight | 03-01 §contract row 6, AR-11 |
| **ST-14** | One fixture file carrying **two** `@example` blocks on the **same** declaration (mirroring `packages/ui/src/controls/input.ts:47` and `:58`), one compiling and one not, with an allowlist entry for only the failing one — keyed `#2` | `unexpected` is empty and `stale` is empty. The two blocks are independent entries under the `#N` rule; allowlisting one must not grandfather the other, and fixing one must not orphan the other | 03-01 §Symbol resolution, AR-10 |

> **⚠️ AUTHORING RULE.** Expectations come from the contract table in 03-01, not from running the
> harness. **Every one of ST-1…ST-8 and ST-13/ST-14 is expected to be RED before the harness
> exists** — the module under test is new, so they fail to import. That is the red phase; it is not
> evidence of anything beyond "the harness is not written yet", so the red run must be captured
> *after* the fixtures exist, or it proves nothing.
>
> **ST-12 is deliberately excluded from the red run.** It depends on the committed allowlist, which
> task 1.3.1 generates two steps later, so it is authored at task 1.3.4 and is green on arrival.
> Writing it at 1.1.2 would make the red count ten rather than nine and leave 1.2.4's "GREEN"
> unreachable.
>
> ST-4 is the case most likely to be written wrong. It asserts that a *passing* block causes a
> *failing* run. Anyone reading the harness in isolation will assume "compiles ⇒ fine"; the whole
> ratchet depends on it not being so.
>
> Fixtures must be **tiny and self-contained** — a fixture that imports `@jsvision/ui` makes ST-1…ST-8
> depend on a built `dist/`, and a spec oracle for a contract should not be hostage to the build
> graph. Use local declarations and a sibling file for ST-7.

### The retired docs-site builder (`packages/docs-site/test/example-at.spec.test.ts`)

Filed separately from the guard's oracle on purpose: these pin `at()`'s behaviour, the guard's cases
pin a build-gate contract, and one file asserting both would make neither obvious to a later reader.
The name mirrors `packages/examples/test/story-at.spec.test.ts`, which #114 left behind for the same
reason on the showcase surface.

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-9 | Import `at` **from `@jsvision/ui`**; call `at(v, 1, 2, 3, 4)` on a fresh bare `Group` | `v.layout` equals `{ position: 'absolute', rect: { x: 1, y: 2, width: 3, height: 4 } }`, and the call returns the same `v` | 03-03 §Proposed Changes, AR-3 |
| ST-10 | A view already carrying `{ direction: 'col', padding: 1 }`; call `at(v, 0, 0, 10, 5)` | `direction` and `padding` are **preserved** alongside the new `position`/`rect`. This is the merge contract the seven shadows violated — it is the reason the swap is not a no-op | 03-03 §Delta A, AR-3 |
| ST-11 | A **mounted** view (a `ViewHost` double on `view.host` counting `markRelayout`); call `at(v, 0, 0, 4, 1)` | `markRelayout` is called exactly once. The shadows never requested a reflow, which was the silent-stale-layout footgun | 03-03 §Delta B, AR-3 |

> ST-9 must use a bare `Group`, whose base `layout` initializes to `{}` (`packages/ui/src/view/view.ts:73`)
> — a widget carrying default layout props would break the exact-equality assertion for reasons
> unrelated to `at()`. **Import `at` from `@jsvision/ui`, not "as `list-box.ts` does"**: this case is
> written at task 3.2.1, *before* 3.3.1, when `list-box.ts:45` still declares the replace-semantics
> **shadow** — copying its semantics into the oracle is exactly the mis-decode ST-10 exists to catch.
>
> The `ViewHost` double for ST-11 needs only `markRepaint()` and `markRelayout()`, assigned as an
> inline object literal to the public `view.host` field. Do **not** count scheduler frames instead:
> a frame counter cannot distinguish a reflow from a repaint, and telling them apart is the entire
> point of the case.
>
> ST-9 and ST-10 are **green before and after** the retirement — they pin the builder's contract,
> which already holds. They are here so that a future regression in `absolute.ts` surfaces from the
> docs-site's own surface too. ST-11 likewise. The retirement's own evidence is the audit table plus
> the unedited regression net, not a red-to-green transition.

## Test Categories

### Specification tests

| Test file | ST cases | Component |
|---|---|---|
| `packages/docs-site/test/jsdoc-examples.spec.test.ts` | ST-1…ST-8, ST-12, ST-13, ST-14 | The guard (03-01) |
| `packages/docs-site/test/example-at.spec.test.ts` | ST-9…ST-11 | The retired builder (03-03) |

### Implementation tests

| Test file | Description | Priority |
|---|---|---|
| `packages/docs-site/test/jsdoc-examples.impl.test.ts` | Fence variants (` ``` `, ` ```ts `, ` ```typescript `, none) applied package-agnostically; **comment-terminator un-escaping** (`*\/` → `*/`); the `(anonymous)` fallback and its `#N` ordinal; the `Class.member` qualifier; **de-duplication of a tag reachable from multiple nodes** | High |

The de-duplication case is the one that matters most. `ts.getJSDocTags` returns the same tag once
per binding node, so a naive walk mints two conflicting keys for one block and an `(anonymous)` key
whose recorded diagnostics shift between runs — a ratchet that fails randomly is worse than none.
Assert it against a fixture with an `export const` (three binding nodes, one tag) and require
exactly one `ExampleBlock` back.

There is no cleanup case, because under AR-16 there is nothing to clean up — the harness never
writes. AC-9 remains as the standing check that this stays true.

### Integration / regression tests (existing, unedited)

Verified against the code, because the original draft credited these suites with coverage they do
not have:

| Suite | What it **actually** guards |
|---|---|
| `paint-smoke.spec.test.ts` | Builds **every** registered example through the demo shell at 80×24 and asserts `paintedCells > 0` (`:43`) — genuine reach over all 7 converted files, but **liveness only** |
| `dialog-reopen.spec.test.ts` | 2 of the 7 examples, structurally |
| `a11y.spec.test.ts` | `PlayExample.vue` carries `aria-label`; each registry id has a `.md` page (`:34-47`). **Builds no example** |
| `no-keyboard.spec.test.ts` | Three pure functions over a `matchMedia` stub (`:13-31`). **Builds no example** |
| `deep-link.impl.test.ts` | A hard-coded `IDS` array (`:9`). **Imports no example** |
| `file-dialog.spec.test.ts` | Imports only `HOME`/`seedFs`, then builds its own `FileDialog` (`:14`). The example's `build()` — which holds the `at()` calls — is **never invoked** |
| `snippet-drift.spec.test.ts` | Markdown only; unaffected, must stay green |

**Contract:** none of these may appear in `git diff --name-only` at any point in this plan (AC-7). A
failure in one means the conversion is wrong.

### What the regression net can and cannot prove

`paint-smoke` asserts `paintedCells(...) > 0`, so it catches a crash or a blank screen across every
example — including the `list-box.ts` collapse that a missing `cover()` would cause — but **not** the
wrong-but-nonempty failure mode a replace→merge change produces. Four of the seven suites above
never build an example at all.

So the control hierarchy is: **(1) the §Delta A/B audit table in
[03-03](03-03-docs-site-shadow-retirement.md), run *before* any conversion; (2) the rendered
before/after comparison at task 3.4.1, which is the primary empirical control; (3) `paint-smoke` as
the liveness backstop.** The plan previously called the suites "the witness for FR-7/FR-8" — they are
not, and treating them as one would have left the padding-preservation hazard unguarded.

### End-to-end verification

| Scenario | Steps | Expected result |
|---|---|---|
| docs-site render parity | (1) `yarn build`; (2) mount each of the 7 examples headlessly at a fixed viewport and serialize to a scratch baseline; (3) apply the retirement; (4) `yarn build`; (5) re-serialize | Byte-identical for 6. `list-box.ts` changes **substantially** by design under FR-8 (`cover()` takes it from a pinned 40×12 box to the full viewport) — its diff is reviewed and recorded, not required to be empty |
| Guard writes nothing | Run the guard three ways — passing, with a fixture forced to fail, and killed mid-compile (SIGINT) — then `git status --short` plus a recursive search for `.jsdoc-example.*` under `packages/` | Nothing anywhere, in all three (AC-9). Under AR-16 this holds by construction; the case is the regression guard against a filesystem write being reintroduced, which is why the **interrupted** run is included and not just a failing one |

Baselines live in the session scratchpad, never in the repo. Both captures must be taken after a
build, because docs-site resolves `@jsvision/ui` from `dist/` and a stale dist silently invalidates
the comparison.

## Test Data

### Fixtures needed

`packages/docs-site/test/fixtures/jsdoc-examples/` — small `.ts` sources, one per ST-case shape: a
compiling example; a wrong-arity example; one that fails `TS2304` naming a single identifier, plus a
variant naming two (ST-5); a fenced example; a relative-import example plus the sibling it imports;
a two-symbol file (ST-8); a **same-symbol two-block** file (ST-14); and an `export const` with one
`@example`, for the de-duplication impl case. Committed; they are the spec oracle's input.

No fixture may import `@jsvision/*` (see the authoring rule above).

These fixtures contain deliberately non-compiling code. That is safe: `packages/docs-site/tsconfig.json`
includes only `examples/**/*.ts` and `src/**/*.ts`, so `test/` — fixtures included — is outside
`yarn typecheck`. It is also why the **harness module** lives in `src/api/` and not `test/`: the
harness *should* be typechecked, and in `test/` it would not be.

### Mock requirements

One two-method `ViewHost` double for ST-11 (`markRepaint`, `markRelayout`) as an inline object
literal assigned to the public `view.host` field. Everything else uses real objects — the real
compiler, real views, the real layout solver. The allowlist is *injected* rather than mocked:
`checkExamples` takes it as a parameter precisely so the spec cases can supply one. ST-12 is the one
case that reads the committed file instead.

## Verification Checklist

- [ ] ST-1…ST-14 defined with concrete input/output pairs ✅ (above)
- [ ] Every ST case traces to a 03-doc section or an AR entry ✅
- [ ] **All six** 03-01 verdict rows have a case (row 6 = ST-13)
- [ ] Fixtures exist before the red run is captured
- [ ] ST-1…ST-8 + ST-13/ST-14 verified RED before the harness is written (nine cases; **ST-12 is
      excluded** — it is authored at 1.3.4, after the allowlist exists)
- [ ] All fourteen green after
- [ ] **ST-12 exists and fails the suite when the repo has a non-allowlisted failure** — without
      this the guard is inert
- [ ] Impl tests cover fences, terminator un-escaping, the anonymous fallback + `#N`, the
      `Class.member` qualifier, and multi-node tag de-duplication
- [ ] Zero existing test files edited
- [ ] AC-2 grep reaches 0 (from 53) · AC-3 hits confined to `packages/ui/src/view/dsl/` · AC-4 reaches 0
- [ ] AC-6 checked explicitly: six of the nine layout blocks remain; the three arity defects and
      `application.ts::syncOverlayVisible` are gone; nothing new added
- [ ] The 03-03 audit table filled, every surfaced row ruled
- [ ] Rendered before/after recorded for all 7 docs-site examples
- [ ] `yarn verify` green
