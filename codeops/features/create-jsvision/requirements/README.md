# create-jsvision — Requirements Documents

> **Project**: create-jsvision — a published create-app scaffolder for JSVision (GH #169)
> **Status**: Draft
> **Created**: 2026-07-22
> **Architecture**: Node ≥ 22, ESM-only, zero runtime dependencies, published unscoped to npm
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0

---

## Overview

Installing packages is not the reader's goal — a *running application* is. This feature ships a
published scaffolder so the documented first step becomes one command:

```sh
npm create jsvision my-app     #  or:  yarn create jsvision my-app
                               #       pnpm create jsvision my-app
```

It is a **promotion of existing code**, not a greenfield build. A working generator already lives in
the Claude Code plugin: a pure, fs-free `buildAppFiles(name, archetype)` returning a
`Map<relPath, contents>`, four auto-discovered archetypes, path-traversal rejection, a
refuse-to-overwrite wrapper, and a spec/impl test pair. What it cannot do is produce a project that
works **outside** this monorepo — it writes `packages/<slug>/`, scopes the name to `@jsvision/`, and
extends a tsconfig two directories up.

The work therefore splits along one seam: teach the pure core a second output mode, then wrap it in a
publishable CLI — without regressing the plugin skill that depends on the first mode, and without
touching the immutable spec oracles that pin it.

---

## Domain Glossary

| Term | Definition |
| --- | --- |
| **Archetype** | A starter variant (`basic`, `form`, `grid`, `dashboard`) that overlays its own `src/main.ts` on the shared skeleton. Auto-discovered from a directory, so adding one is a pure content change. |
| **Mode** | Which output shape is produced: `monorepo` (the existing `packages/<slug>/` package) or `standalone` (a self-contained project). |
| **Slug** | The package-safe name (`[a-z0-9-]`) derived from the app name or the target directory's basename. |
| **Target directory** | Where files are written. Distinct from the slug — `.` and `./apps/x` are valid targets. |
| **Confinement** | The invariant that no write lands outside the resolved target directory, enforced by resolve-and-prefix checking rather than by name rejection. |
| **Lockstep** | The shared version line across published packages, driven by root `package.json#version`. |

---

## Document Index

| #        | Document                                                            | Description                                                        | Depends On               |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------ |
| **AR**   | [Ambiguity Register](00-ambiguity-register.md)                       | Zero-Ambiguity Gate decisions (audit trail) — 23 items, all resolved | —                        |
| **RD-01** | [Dual-mode generation](RD-01-dual-mode-generation.md)               | Teach the pure core a `standalone` output mode                     | —                        |
| **RD-02** | [CLI package](RD-02-cli-package.md)                                 | The published `create-jsvision` executable                         | RD-01                    |
| **RD-03** | [Single source of truth](RD-03-single-source-of-truth.md)           | One canonical template set; the plugin's copy generated and guarded | RD-01                    |
| **RD-04** | [Generated project](RD-04-generated-project.md)                     | What lands on disk, and why it must match the docs                 | RD-01                    |
| **RD-05** | [Verification](RD-05-verification.md)                               | Oracles, the linked e2e, and the fix for the AC hole               | RD-01, RD-02, RD-04      |
| **RD-06** | [Release & distribution](RD-06-release-and-distribution.md)         | Lockstep, provenance, and the unscoped npm name                    | RD-02                    |
| **RD-07** | [Documentation](RD-07-documentation.md)                             | Correcting the docs that currently say this does not exist         | RD-02, RD-04             |
| **RD-08** | [Non-functional](RD-08-non-functional.md)                           | Zero-dep, determinism, portability, failure behaviour, security    | all                      |

---

## Dependency Graph

```
RD-01 (dual-mode core)
 ├── RD-02 (CLI) ──┬── RD-06 (release)
 │                 └── RD-07 (docs) ← RD-04
 ├── RD-03 (single source of truth)
 └── RD-04 (generated project) ──── RD-05 (verification) ← RD-02
                                          │
RD-08 (non-functional) ───────────────────┘  applies across all
```

No cycles. RD-01 is the only true prerequisite; RD-03 can proceed in parallel with RD-02.

---

## Suggested Implementation Order

| Phase | Documents | Description |
| --- | --- | --- |
| **A: Foundation** | RD-01 → RD-03 | Add the mode seam, then relocate to the canonical home with the plugin copy generated. Both are behaviour-preserving for the existing skill. |
| **B: The product** | RD-04 → RD-02 | Decide what lands on disk, then build the CLI that puts it there. |
| **C: Proof** | RD-05 | The oracles, including the adversarial security tests. |
| **D: Ship** | RD-06 → RD-07 | Release wiring and the documentation correction. |

RD-08 is not a phase — its criteria are satisfied across A–D and checked at the end.

> ~~**Do first, before any code:** reserve the unscoped npm name `create-jsvision`~~ — **done
> 2026-07-23.** A `0.0.1` placeholder holds the name (owner `blendjs`); it writes nothing and exits
> non-zero. RD-06 criterion 1 is satisfied and no prerequisite now blocks implementation.

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Output modes | Two; standalone opt-in, monorepo default | ST-2/ST-3 pin the monorepo shape as immutable oracles |
| Template ownership | Canonical in the npm package; plugin copy generated | Two copies are forced by packaging; make the second guarded |
| Versioning | Join lockstep | `create-jsvision@X` scaffolding `ui@^X` is a feature |
| Emitted dependency | `^<tool version>` | Deterministic and offline-testable |
| Interaction | Flags + `readline` fallback | Zero-dep; a TUI wizard would need the SDK it installs |
| Target directory | Any path including `.` | The dominant create-app idiom; confinement replaces name-rejection |
| E2E target | Local build linked, plus a unit assertion on the pin | Avoids testing published code and a release-ordering deadlock |
| Overwrite policy | Per-file refusal, no `--force` | Allows `.` into a live repo while never clobbering |

---

## Open Follow-ups (deliberately out of scope)

| Item | Why deferred |
| --- | --- |
| Post-publish smoke test against the real npm registry | Genuinely valuable; needs a scheduled job and a published version to test. Named here so it is not silently dropped. |
| Browser archetype | Blocked while `@jsvision/web` is internal and unpublished. |

---

## How to Use These Documents

1. Pick a requirements document (start with RD-01).
2. Run the `make-plan` skill against it.
3. `make-plan` uses the RD as input to create an implementation plan.
4. Run `exec-plan` for the feature.
5. Implement iteratively, spec tests first.
