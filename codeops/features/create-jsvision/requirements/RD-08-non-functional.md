# RD-08: Non-functional requirements

> **Document**: RD-08-non-functional.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-01, RD-02, RD-03, RD-04, RD-05, RD-06
> **CodeOps Skills Version**: 3.12.0
> **Complexity**: S

---

## Feature Overview

The cross-cutting properties every other RD must satisfy. These are the requirements most often left
implicit and then discovered as defects: dependency posture, determinism, portability, failure
behaviour, and the security invariants that hold regardless of which RD introduced the code.

---

## Functional Requirements

### Must Have — dependency posture

- [ ] **Zero runtime dependencies.** The CLI uses Node built-ins only (`node:fs`, `node:path`,
      `node:url`, `node:readline`, `node:child_process`).
- [ ] Zero native dependencies; `yarn check:deps` passes.
- [ ] The tool does **not** depend on `@jsvision/ui` — it installs it, and must not need it to run.

### Must Have — portability

- [ ] Node 22 and 24 supported; `engines.node` is `>=22`.
- [ ] ESM only, consistent with the rest of the repo.
- [ ] Works on Linux, macOS, and Windows for the scaffold path.
- [ ] Path handling uses `node:path`; emitted map keys are compared separator-normalised.

### Must Have — determinism & offline

- [ ] Identical inputs produce byte-identical output.
- [ ] No network access on any path except an explicit `--install`.
- [ ] No reliance on ambient state beyond the target directory and `npm_config_user_agent`.

### Must Have — failure behaviour

- [ ] Every failure mode produces a message naming **what** failed and **what to do**, on stderr,
      with a non-zero exit code.
- [ ] A failure never leaves a partially-scaffolded directory: conflicts are detected before the
      first write.
- [ ] No stack trace is printed for an expected error (bad name, conflict, unknown archetype).

### Should Have — performance

- [ ] Scaffolding without `--install` completes in under 1 second on a warm filesystem. This is a
      file-copy operation; anything slower indicates accidental work.

### Won't Have (Out of Scope)

- Telemetry, analytics, update checks, or any outbound network call the user did not request.
- Auto-update of the tool itself.
- Internationalisation of CLI output.

---

## Technical Requirements

### Why zero-dependency matters here specifically

The repo's whole posture is zero runtime dependencies, enforced by `check:deps`. A create-app is also
the one package users run via `npx` **before** they have decided to trust the project — a heavy or
transitively-vulnerable dependency tree is a poor first impression and a real supply-chain surface.
`node:readline` is what makes the flags-plus-prompt design possible without a prompt library.

### Accessibility of CLI output

Output must not rely on colour alone to convey meaning, and must remain readable when stdout is not a
TTY (piped or redirected). This matters because the tool is frequently run inside other tooling.

---

## Integration Points

Applies to every other RD in this set. RD-05 is where most of these become executable assertions.

---

## Scope Decisions

| Decision           | Options Considered            | Chosen                | Rationale                                                                  | AR Ref |
| ------------------ | ----------------------------- | --------------------- | ---------------------------------------------------------------------------- | ------ |
| Windows support    | First-class · best-effort     | First-class scaffold layer | Emitted paths are map keys — a known separator-bug class in this repo    | AR #21 |
| E2E matrix         | Linux only · all cells        | Linux only             | Matches the existing POSIX-only e2e policy                                  | AR #18 |
| Network posture    | Install by default · opt-in   | Opt-in `--install`     | Keeps the default path offline and deterministic                            | AR #8  |

---

## Security Considerations

> These invariants hold across every RD in this set. They are restated here as the single place a
> reviewer can check them.

- **Data sensitivity**: the tool reads no credentials and writes none. It must never read
  `~/.npmrc`, environment secrets, or any credential store.
- **Input validation**: two inputs — the app name (slug), validated by `slugify` against
  `[a-z0-9-]` with explicit rejection of `/`, `\`, `..`, and empty; and the target directory,
  resolved and used as a confinement root.
- **Authentication & authorization**: none required and none requested. The tool runs with the
  invoking user's privileges and crosses no privilege boundary — it can only write where the user
  could already write.
- **Injection risks** — the three that actually apply:
  1. **Path traversal** — mitigated by resolve-and-prefix confinement on every write, verified by an
     adversarial test (RD-05).
  2. **Command injection** — only `--install` spawns a process; it must use an allowlisted binary
     name (`npm`/`yarn`/`pnpm`), an argument array, and `shell: false`. The user agent string is
     matched against the allowlist, never passed through.
  3. **Destructive overwrite** — mitigated by per-file refusal before any write.
- **Encryption needs**: none — no data at rest or in transit.
- **Rate limiting**: N/A — no network service is exposed or consumed by default.
- **Infrastructure**: publishing secrets remain in GitHub Actions secrets (RD-06); no secret is
  written into a template, a generated project, or the published tarball.
- **Security testing**: mandatory and non-negotiable — the adversarial traversal test, the
  file-conflict test, and the `--install` argument-array test are all required by RD-05, not optional.

---

## Acceptance Criteria

1. [ ] `packages/create-jsvision/package.json` has an empty or absent `dependencies` object.
2. [ ] A test asserts the CLI's import graph reaches no module outside `node:` built-ins and the
       package's own files.
3. [ ] `yarn check:deps` passes.
4. [ ] The scaffold path succeeds on Linux, macOS, and Windows CI cells.
5. [ ] Running the scaffolder twice into two different empty directories with the same arguments
       produces byte-identical file contents (modulo the slug).
6. [ ] With network access blocked, scaffolding without `--install` succeeds.
7. [ ] Each expected error (unsafe name, unknown archetype, file conflict, missing target on a
       non-TTY) prints a single-line message to stderr containing no stack trace, and exits with the
       code specified in RD-02.
8. [ ] After any failed scaffold attempt, the target directory contains no file the scaffolder
       created.
9. [ ] Scaffolding without `--install` completes in under 1 second on a warm filesystem.
10. [ ] CLI output is fully comprehensible with colour stripped and when stdout is not a TTY.
11. [ ] Security requirements verified: the traversal, conflict, and `--install` argument-array tests
        from RD-05 all pass, and no test or code path reads a credential store.
