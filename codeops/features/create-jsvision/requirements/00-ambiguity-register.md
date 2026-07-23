# Ambiguity Register: create-jsvision (GH #169)

> **Status**: ✅ GATE PASSED — all 25 items resolved
> **Last Updated**: 2026-07-23
> **Resolution**: Bulk acceptance occurred in two rounds: the original 23 recommendations were
> accepted on 2026-07-22, and the symlink-confinement and failure-cleanup recommendations were
> explicitly accepted on 2026-07-23. Each row spells out the accepted behavior.
> **Source**: GitHub issue #169 (labels: enhancement, needs-decision, epic, priority: high, effort: L)

Discovery was grounded in the real code rather than the issue body. Three of the issue's five
"open decisions" turned out to be partly constrained by existing oracles and seams — see the
Resolution Notes.

| #   | Category    | Ambiguity / Gap                                                | User Decision (accepted recommendation)                                                                                                  | Status     |
| --- | ----------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | Scope       | One output mode or two?                                         | Two modes. Standalone is an **opt-in** parameter; in-monorepo remains the **default**.                                                    | ✅ Resolved |
| 2   | Technical   | Where do templates live (plugin + npm package both need them)?  | Canonical copy in `packages/create-jsvision/`; the plugin's copy is **generated** by `plugin:sync --fix` and guarded by `check-plugin`.   | ✅ Resolved |
| 3   | Technical   | Lockstep or independent versioning?                             | **Join the lockstep set** (`sync-package-versions`, root `package.json` as source of truth).                                              | ✅ Resolved |
| 4   | Technical   | What `@jsvision/ui` range does a standalone manifest pin?       | **`^<create-jsvision version>`** — caret on the tool's own lockstep version.                                                              | ✅ Resolved |
| 5   | UX          | Flags-only or interactive?                                      | **Flags**, plus a `node:readline` prompt **only** when the name is omitted **and** stdin is a TTY. No TUI wizard.                         | ✅ Resolved |
| 6   | Security    | Directory targets — allow `.` and `./path`?                     | **Accept any target directory** including `.`; derive the slug from `basename()`; keep `slugify` unchanged for the slug; confine writes.  | ✅ Resolved |
| 7   | Behavioral  | Non-TTY / CI behaviour                                          | **Never prompt** when stdin is not a TTY: print usage to stderr and `exit 2`.                                                             | ✅ Resolved |
| 8   | Behavioral  | Auto-run the package-manager install?                           | **No by default**; `--install` opt-in, detecting the PM from `npm_config_user_agent`.                                                     | ✅ Resolved |
| 9   | Behavioral  | `git init` the generated project?                               | **No**, and no flag.                                                                                                                     | ✅ Resolved |
| 10  | Scope       | Archetype set                                                   | **Keep all four** (`basic`, `form`, `grid`, `dashboard`). **No browser archetype** while `@jsvision/web` is unpublished.                  | ✅ Resolved |
| 11  | Integration | Generated tsconfig vs. the docs install page                    | **Byte-match** the tsconfig taught on `/guide/install-and-packages`; drop `extends ../../tsconfig.base.json`.                             | ✅ Resolved |
| 12  | Scope       | Ship vitest config + smoke test in the standalone starter?      | **Yes, include both.**                                                                                                                   | ✅ Resolved |
| 13  | UX          | README in the generated project?                                | **Yes** — what it is, how to run, how to test, the TTY caveat, a docs link.                                                               | ✅ Resolved |
| 14  | UX          | `.gitignore` in the generated project?                          | **Yes** — `node_modules/`, `dist/`.                                                                                                      | ✅ Resolved |
| 15  | Data        | `license` field in a user's manifest                            | **Omit the field entirely.**                                                                                                             | ✅ Resolved |
| 16  | Naming      | Standalone package name + `private` flag                        | **Bare slug** (`my-app`, unscoped) with **`"private": true`**.                                                                            | ✅ Resolved |
| 17  | Technical   | E2E: published SDK or local build?                              | **Link the local build**; no npm install in CI. **Plus** a unit assertion that the emitted range equals `^<version>` exactly.             | ✅ Resolved |
| 18  | Non-func    | E2E matrix cells                                                | **Linux only**, matching the existing POSIX-only e2e policy.                                                                             | ✅ Resolved |
| 19  | Integration | Release wiring for an unscoped public package                   | **Same lockstep publish.** Requires `bin`, non-private, `repository` (for provenance). **Reserve the npm name before building.**          | ✅ Resolved |
| 20  | Integration | Update the #145 install page + `/jsvision-new-app` skill text   | **In scope for this feature**, not a follow-up.                                                                                          | ✅ Resolved |
| 21  | Non-func    | Windows support                                                 | **Scaffold layer CI-verified on Windows**; e2e stays Linux-only.                                                                          | ✅ Resolved |
| 22  | Technical   | Existing spec oracle                                            | **Untouched.** In-monorepo mode stays the default so ST-2/ST-3 remain green without edits.                                                | ✅ Resolved |
| 23  | Edge case   | Target directory exists / is non-empty (surfaced in authoring)  | **Per-file refusal**: never overwrite any file the scaffolder would write; create directories as needed. No `--force`.                    | ✅ Resolved |
| 24  | Security    | Can existing symlinks redirect a generated file outside the target? | Resolve the target root itself canonically, but **reject every existing symlink in a descendant path used by a generated file**. No generated write may traverse such a symlink. | ✅ Resolved |
| 25  | Behavioral  | What survives a scaffold-write or optional install failure? | On a scaffold-write failure, remove only files and directories created by that attempt and preserve all pre-existing content. If `--install` fails after scaffolding completes, retain the complete scaffold, exit non-zero, and print the manual install command. | ✅ Resolved |

## Resolution Notes

**AR-1 / AR-22 — the existing spec oracle already constrained this.**
`packages/examples/test/new-jsvision-app.spec.test.ts` is an immutable oracle pinning the current
output shape:

- ST-2 (`:39-51`) asserts the emitted keys are `packages/todo/package.json`, `…/tsconfig.json`,
  `…/vitest.config.ts`, `…/src/main.ts`, `…/test/todo.smoke.test.ts`.
- ST-3 (`:55-62`) asserts `pkg.name === '@jsvision/todo'`, **`pkg.private === true`**, and
  `pkg.dependencies['@jsvision/ui'] === uiDependency()`.

Standalone output inverts the scope and the path root. Under the project's spec-first rule ("if a
spec test fails after implementation, fix the code, not the test"), standalone therefore had to be
**additive**. Note `private: true` is retained in *both* modes (AR-16), so ST-3's `private`
assertion is not in tension with standalone at all.

**AR-2 — two copies are unavoidable; only their provenance was in question.**
`tools/claude-plugin/` is a self-contained distributable (own `.claude-plugin/plugin.json`, version
0.1.0, outside the lockstep set), and a published npm package ships only its own directory — so
neither consumer can read the other's templates at runtime. The repo already solves this class of
problem: `yarn plugin:sync --fix` regenerates plugin content deterministically and `check-plugin`
fails `yarn verify` on drift. That mechanism caught a stale API snapshot during this same session.

**AR-4 — the seam was purpose-built.** `new-jsvision-app.mjs:133-135` returns `'*'` (the yarn
workspace form) with the JSDoc: *"This is the single publish-sensitive line… A future publish flips
this one helper to a version range."* The decision was which range, not whether a seam exists.

**AR-6 — the traversal guard moves, it does not disappear.** `slugify` (`:109-111`) currently throws
on any name containing `/`, `\`, or `..`, and ST-5 (`:76-80`) locks that in for
`['../evil', 'a/b', '/abs', '']`. Those inputs remain rejected **as slugs**. What changes is that a
*target directory* is now a separate, first-class argument, and safety is enforced by the
resolve-and-prefix confinement already implemented at `:222-225` — "never write outside the resolved
target" is a stronger invariant than "reject names that look like paths".

**AR-24 — lexical prefix checks are necessary but not sufficient.** An existing descendant symlink
can redirect a lexically-contained path outside the canonical target. The standalone writer therefore
resolves the target root but refuses any existing symlink in a generated file's descendant path.

**AR-25 — generation and installation are separate transactions.** A failed write rolls back only
artifacts created by that attempt. Installation starts only after a complete scaffold exists; an
installation failure keeps that useful scaffold and reports the exact command the user can retry.

**AR-17 — this closes a real hole in the issue's stated acceptance criteria.** "scaffold → install →
`tsc --noEmit` → headless smoke run" against a published range would validate the *published* SDK
rather than the working tree: a PR breaking `@jsvision/ui` would still pass, and a PR raising the pin
to an unreleased version would fail for the wrong reason (a release-ordering deadlock). Splitting it
— local build for the behavioural e2e, a deterministic unit assertion for pin correctness — covers
both halves with no network.

**AR-10 — verified, not assumed.** All four archetypes import from `@jsvision/ui` alone (checked
across `templates/archetypes/{dashboard,form,grid}/main.ts.tmpl`), so a standalone manifest needs
exactly one runtime dependency. In-monorepo this was masked: yarn workspace hoisting would have
resolved an undeclared `@jsvision/datagrid` anyway. Standalone it would have broken at install time.

**Prerequisite already shipped (not re-litigated):** PR #171 set `engines.node >= 22` throughout and
added ST-7/ST-8 — a TypeScript compiler-API typecheck and a `jsvision-doctor` cleanliness check for
every rendered archetype.
