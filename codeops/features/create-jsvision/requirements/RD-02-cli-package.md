# RD-02: The `create-jsvision` CLI package

> **Document**: RD-02-cli-package.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0
> **Complexity**: M

---

## Feature Overview

The published entry point. `npm create jsvision my-app`, `yarn create jsvision my-app`, and
`pnpm create jsvision my-app` all resolve to the unscoped package `create-jsvision` and run its
`bin`. This RD defines that executable: argument parsing, the target-directory contract, how it
refuses to destroy existing work, and what it prints.

The name is unscoped deliberately — it is the only form where all three package managers accept the
same `create jsvision` phrasing. A scoped package would force `npm create @jsvision/app`, and yarn
1.x handles scoped creates poorly.

---

## Functional Requirements

### Must Have

- [ ] `packages/create-jsvision/` publishes with a `bin` entry named `create-jsvision`.
- [ ] The first positional argument is the **target directory**. `.` means the current directory.
- [ ] The package slug is derived from `basename(resolve(target))` and passed through `slugify`.
- [ ] `--template <name>` / `-t <name>` selects an archetype; `--list` prints them and exits 0.
- [ ] `--install` runs the detected package manager's install; **absent by default**.
- [ ] When no target is given **and** stdin is a TTY, prompt for one using `node:readline`.
- [ ] When no target is given and stdin is **not** a TTY, print usage to stderr and exit 2.
- [ ] The scaffolder **never overwrites an existing file**. If any file it would write already
      exists, it writes nothing and exits non-zero naming the conflict.
- [ ] Every write is confined to the resolved target directory.
- [ ] On success it prints the created files and the exact next steps to run.

### Should Have

- [ ] `--help` and `--version`.
- [ ] The printed next steps name the detected package manager (e.g. `pnpm run start`).

### Won't Have (Out of Scope)

- `git init` — decided against; scaffolding into an existing repo is a first-class use case (AR #9).
- A TUI wizard — would make the tool depend on the SDK it installs (AR #5).
- A `--force` overwrite flag — per-file refusal makes it unnecessary (AR #23).
- Telemetry or analytics of any kind.

---

## Technical Requirements

### Target directory vs. slug

These are now two different things, and conflating them is the main failure mode to avoid:

| Input                | Target directory      | Derived slug | Package name |
| -------------------- | --------------------- | ------------ | ------------ |
| `my-app`             | `./my-app`            | `my-app`     | `my-app`     |
| `.`                  | `.` (cwd)             | basename(cwd) | that slug   |
| `./apps/dashboard`   | `./apps/dashboard`    | `dashboard`  | `dashboard`  |
| `../sibling`         | `../sibling`          | `sibling`    | `sibling`    |

If `basename()` produces no usable slug characters, exit non-zero with a message naming the problem
rather than inventing a name.

### Write safety

`slugify` stays strict for the **slug** (AR #6) — it still rejects `/`, `\`, `..`, and empty. Safety
for the **target** comes from confinement, generalising the check already at
`new-jsvision-app.mjs:222-225`:

```js
const abs = resolve(join(targetRoot, rel));
if (abs !== targetRootResolved && !abs.startsWith(targetRootResolved + sep)) throw …
```

This is the stronger invariant: rather than guessing which names look dangerous, it proves no write
lands outside the directory the user named.

### Package-manager detection

`process.env.npm_config_user_agent` begins with `npm/`, `yarn/`, or `pnpm/`. Used for `--install` and
for the printed next steps. Unrecognised or absent → default to `npm` and say so.

### Exit codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 0    | Success, or `--list`/`--help` |
| 1    | Scaffolding failed (file conflict, unusable slug, write error) |
| 2    | Usage error (missing target on a non-TTY, unknown flag, `--template` without a value) |

Code 2 for usage matches the existing CLI (`new-jsvision-app.mjs:281-285`).

---

## Integration Points

### With RD-01 (dual-mode generation)

Calls `buildAppFiles(name, archetype, { mode: 'standalone' })` and materialises the returned map.

### With RD-03 (single source of truth)

Both this CLI and the plugin skill's CLI wrap the same pure core; only their modes and output roots
differ.

### With RD-06 (release)

The `bin`, `repository`, and non-private manifest fields are release prerequisites.

---

## Scope Decisions

| Decision            | Options Considered                                      | Chosen                                    | Rationale                                                                              | AR Ref |
| ------------------- | ------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| Interaction model   | Flags+readline · flags only · TUI wizard                | Flags + readline fallback                  | `node:readline` is built in; a TUI wizard would install the SDK before asking about it  | AR #5  |
| Directory targets   | Bare names only · any path incl. `.` · `.` only          | Any target directory                       | `npm create <tool> .` is the dominant idiom; confinement is a stronger guard than name-rejection | AR #6  |
| Non-TTY             | Prompt anyway · usage + exit 2                           | Usage + exit 2                             | Never hang waiting on stdin in CI                                                       | AR #7  |
| Auto-install        | Always · never · `--install` opt-in                      | `--install` opt-in                         | Keeps the tool offline and deterministic; install failures shouldn't read as scaffolder bugs | AR #8  |
| `git init`          | Yes · no · flag                                          | No, and no flag                            | Nested-repo footgun when scaffolding into an existing repo                              | AR #9  |
| Existing target     | Per-file refusal · refuse non-empty unless force · refuse any existing dir | Per-file refusal | Allows `.` into a dir holding `.git`/README while still never clobbering               | AR #23 |

---

## Security Considerations

- **Data sensitivity**: none — no credentials, tokens, or PII.
- **Input validation**: two inputs. The **slug** is validated by `slugify` (unchanged, strict). The
  **target directory** is resolved and then used as a confinement root; it is never interpolated into
  file contents.
- **Authentication & authorization**: N/A — runs with the invoking user's own privileges, crossing no
  privilege boundary. It can only write where the user could already write.
- **Injection risks**:
  - *Path traversal* — the live risk. Mitigated by resolve-and-prefix confinement on every write, so
    a crafted target cannot place files outside the resolved root.
  - *Command injection* — only `--install` spawns a process. It MUST use an argument array with no
    shell (`spawn(cmd, args, { shell: false })`) and MUST NOT interpolate user input into a command
    string. The package-manager name comes from a fixed allowlist (`npm`/`yarn`/`pnpm`), never from
    raw `npm_config_user_agent` text.
  - *Overwrite/destruction* — mitigated by per-file refusal before any write occurs.
- **Encryption needs**: none.
- **Rate limiting**: N/A.
- **Infrastructure**: no network access unless `--install` is passed.

---

## Acceptance Criteria

1. [ ] `npx create-jsvision my-app` in an empty directory creates `./my-app/` containing
       `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/main.ts`, `test/my-app.smoke.test.ts`,
       `README.md`, `.gitignore`, and exits 0.
2. [ ] The generated `package.json` has `name` exactly `my-app` (no `@jsvision/` scope) and
       `private: true`.
3. [ ] Run with `.` inside a directory named `dashboard`, it scaffolds into the current directory and
       the manifest `name` is `dashboard`.
4. [ ] Run with `.` inside a directory that already contains `package.json`, it writes **nothing**,
       exits non-zero, and the message names `package.json` as the conflict.
5. [ ] Run with `.` inside a directory containing only `.git/` and `src/`, it succeeds, leaves `.git/`
       untouched, and adds `src/main.ts` alongside any existing contents of `src/`.
6. [ ] Run with `.` inside a directory containing a `README.md`, it writes **nothing** and exits
       non-zero naming `README.md` — the scaffolder emits a README (RD-04) and never overwrites.
7. [ ] With no positional argument and stdin not a TTY, it writes usage to **stderr** and exits **2**,
       creating no files.
8. [ ] `--template grid` produces a `src/main.ts` byte-identical to the `grid` archetype's rendering;
       `--template nope` exits non-zero and the message lists `basic, dashboard, form, grid`.
9. [ ] `--list` prints all four archetype names with descriptions and exits 0.
10. [ ] Without `--install`, no network request is made and no `node_modules/` is created; the printed
       next steps include an install command.
11. [ ] With `--install` under `npm_config_user_agent` starting `pnpm/`, the spawned command is
        `pnpm` with `install` as an argument array element, invoked with `shell: false`.
12. [ ] A target whose resolved path would place any file outside the resolved target root causes a
        thrown error and zero writes.
13. [ ] Security requirements verified: criterion 11 covers path traversal, criterion 10 covers
        command injection (allowlisted binary, no shell), criteria 4–5 cover destructive overwrite.
