# RD-05: Verification strategy

> **Document**: RD-05-verification.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-01, RD-02, RD-04
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0
> **Complexity**: L

---

## Feature Overview

The generated project is the artifact every new user runs first, so "it renders a string containing
`createApplication`" is not evidence that it works. This RD defines what must actually be proven, and
resolves a real hole in the original issue's acceptance criteria.

The issue asked for "scaffold → install → `tsc --noEmit` → headless smoke run". Taken literally
against a published dependency range, that test would validate the **published** SDK rather than the
working tree: a pull request that breaks `@jsvision/ui` would still pass it, and a pull request that
raises the pin to an unreleased version would fail it for a reason unrelated to its own change — a
release-ordering deadlock. The strategy below splits that into two checks that together cover both
halves, with no network dependency.

---

## Functional Requirements

### Must Have

- [ ] The existing oracles ST-1 … ST-8 continue to pass with **only** their import path changed.
- [ ] New spec tests cover standalone mode's file set, manifest shape, and refusal behaviour.
- [ ] An end-to-end test scaffolds into a temporary directory, links the **locally built**
      `@jsvision/ui`, type-checks the result, and runs the headless smoke test.
- [ ] A deterministic unit assertion proves the emitted `@jsvision/ui` range equals `^<version>`
      exactly — covering pin correctness without network.
- [ ] Every archetype is covered by the typecheck oracle in **both** modes.
- [ ] The e2e runs on Linux only; scaffold-layer tests run on the full matrix including Windows.
- [ ] CI demonstrably executes the `create-jsvision` scaffold-layer tests in all six Node 22/24 ×
      Linux/macOS/Windows cells; it is not enough for the package merely to typecheck there.
- [ ] Command-resolution smoke coverage verifies argument forwarding for npm, Yarn 1, and pnpm create
      invocations without contacting the registry.
- [ ] No test in the always-on suite performs a network request.

### Should Have

- [ ] The e2e asserts the smoke test's own assertion actually ran, not merely that vitest exited 0.

### Won't Have (Out of Scope)

- Installing from the npm registry in CI (AR #17) — see the rationale above.
- A post-publish smoke test against the real registry. Genuinely valuable, genuinely out of scope
  here; tracked as a follow-up rather than silently dropped.

---

## Technical Requirements

### The two-part substitute for "install from npm"

| Concern | Covered by | Why not the other way |
| ------- | ---------- | --------------------- |
| Does the generated project actually compile and run against the SDK? | E2E with the local build linked | Testing published code would not test this PR |
| Is the pinned range correct and well-formed? | Unit assertion on the emitted string | A network install proves the range resolves *today*, non-deterministically |

### Windows

Emitted paths are **map keys**, and path separators differ. This is the same class of defect that
required normalising separators in the docs-site snippet-drift guard. Scaffold-layer assertions must
therefore compare normalised paths and must run on the Windows matrix cell.

### Existing oracle inventory (must stay green, unmodified)

| ID | Asserts |
| --- | --- |
| ST-1 | `slugify` lowercases and dashes |
| ST-2 | monorepo file-set keys |
| ST-3 | manifest is private/ESM/uses `uiDependency()` |
| ST-4 | `main.ts` contains TTY guard, app creation, window, run |
| ST-5 | unsafe names throw and produce nothing |
| ST-6 | a generated app is structurally valid and paints headlessly |
| ST-7 | every archetype's `main.ts` typechecks (TS compiler API) |
| ST-8 | every archetype's `main.ts` is jsvision-doctor clean |

---

## Integration Points

### With RD-01 / RD-02 / RD-04

This RD asserts their acceptance criteria; it introduces no product behaviour of its own.

### With RD-06 (release)

The release workflow runs `yarn verify`, so everything here gates publication.

---

## Scope Decisions

| Decision       | Options Considered                                  | Chosen                                     | Rationale                                                                 | AR Ref |
| -------------- | --------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- | ------ |
| E2E target     | Link local build · install published · both         | Link local + unit assertion on the pin      | Splits the two concerns; neither needs network; no release-ordering deadlock | AR #17 |
| E2E matrix     | Linux only · all six cells · none                   | Linux only                                  | Matches the existing POSIX-only e2e policy                                   | AR #18 |
| Windows        | First-class CI-verified · best-effort               | Scaffold layer CI-verified; e2e stays Linux | Emitted paths are map keys — a known separator-bug class                     | AR #21 |
| Spec oracle    | Untouched · re-derive                               | Untouched                                   | Standalone is additive, so no oracle needs re-deriving                       | AR #22 |

---

## Security Considerations

- **Data sensitivity**: tests write only to a temporary directory and must remove it afterwards.
- **Input validation**: the suite must include **negative** cases — unsafe names, traversal attempts,
  and file-conflict refusals — not only happy paths.
- **Authentication & authorization**: no test may require a credential. A guard that only runs when a
  token is present is not a guard.
- **Injection risks**: the traversal-confinement property (RD-02) requires an explicit adversarial
  test, not merely the absence of a failure in normal use.
- **Encryption needs**: none.
- **Rate limiting**: N/A.
- **Infrastructure**: no network in the always-on suite, so CI cannot fail because a registry is slow
  or unreachable.

---

## Acceptance Criteria

1. [ ] ST-1 … ST-8 pass with only their import path changed; a diff of those test files shows no
       change to any assertion, expected value, or test name.
2. [ ] A spec test asserts the standalone file-set keys contain no `packages/` segment, comparing
       separator-normalised paths.
3. [ ] A spec test asserts the emitted `dependencies['@jsvision/ui']` equals the string `'^' + version`
       where `version` is read from `create-jsvision`'s own `package.json` — failing if the two drift.
4. [ ] An e2e test scaffolds into an OS temp directory, links the locally built `@jsvision/ui`, runs
       a TypeScript type check that reports **zero** diagnostics, and runs the generated smoke test to
       a passing result.
5. [ ] The e2e removes its temporary directory on both success and failure.
6. [ ] An adversarial test asserts that a target directory crafted to escape confinement produces a
       thrown error and **zero** files written anywhere outside the target.
7. [ ] An adversarial test places a symlink in an emitted file's descendant path and asserts the CLI
       rejects it before writing, while a symlink used only to reach the target root is accepted.
8. [ ] A fault-injection test fails a filesystem operation after at least one successful write and
       proves created artifacts are rolled back without changing pre-existing entries.
9. [ ] A child-process test makes the opt-in install command fail and proves the complete scaffold is
       retained, exit status is non-zero, and the retry command is printed.
10. [ ] A test asserts that scaffolding into a directory already containing one of the emitted
       filenames writes nothing and exits non-zero.
11. [ ] The full suite passes with no network interface available (or with network access blocked).
12. [ ] CI evidence shows scaffold-layer tests executed, rather than only typechecked, in every
        Linux/macOS/Windows × Node 22/24 matrix cell; the generated-project e2e is explicitly skipped
        outside Linux.
13. [ ] Local, registry-free smoke tests prove npm, Yarn 1, and pnpm forward the target and
        `--template` arguments to the `create-jsvision` bin unchanged.
14. [ ] `yarn verify` is green with the feature merged, including `check:deps` and `check-plugin`.
15. [ ] Security requirements verified: criteria 6–9 cover traversal, symlink redirection, rollback,
        and install failure; criterion 10 covers destructive overwrite; criterion 11 covers the
        no-network requirement; and RD-02's
        `--install` criterion (allowlisted binary, argument array, `shell: false`) covers command
        injection.
