# RD-01: Dual-mode file generation

> **Document**: RD-01-dual-mode-generation.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: —
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0
> **Complexity**: M

---

## Feature Overview

The existing scaffolder produces a package that only makes sense **inside this monorepo**: it writes
to `packages/<slug>/`, names the package `@jsvision/<slug>`, and its tsconfig extends
`../../tsconfig.base.json`. A user running `npm create jsvision my-app` in an empty directory needs
the opposite: a self-contained project in `./my-app/` that resolves `@jsvision/ui` from npm.

This RD adds a second **output mode** to the pure file-building core. It does not add a CLI (RD-02),
does not decide the standalone file contents (RD-04), and does not move any code (RD-03). It defines
only the seam: one pure function that can emit either shape.

---

## Functional Requirements

### Must Have

- [ ] `buildAppFiles(name, archetype)` keeps its current signature and current behaviour as the
      **default**, emitting the in-monorepo shape unchanged.
- [ ] A `mode` (or equivalent) option selects `'monorepo'` (default) or `'standalone'`.
- [ ] In `standalone` mode the returned map is keyed by paths **relative to the target project root**
      (`package.json`, `src/main.ts`, …), not `packages/<slug>/…`.
- [ ] The function stays **pure and fs-free** — no reads, no writes, deterministic for identical
      inputs. This is the property its unit tests rely on.
- [ ] Both modes emit the same *logical* file set; only paths and contents differ.
- [ ] The archetype overlay mechanism works identically in both modes.

### Should Have

- [ ] The mode parameter is a named option on an options object, so a third mode can be added later
      without another positional argument.

### Won't Have (Out of Scope)

- Writing to disk — RD-02 owns `writeApp`/CLI concerns.
- The standalone file *contents* — RD-04.
- Relocating the module — RD-03.
- A browser archetype — blocked while `@jsvision/web` is unpublished (AR #10).

---

## Technical Requirements

### The path seam

`SKELETON` (`new-jsvision-app.mjs:24-30`) hardcodes the output root in each entry's `out(slug)`:

```js
{ file: 'package.json.tmpl', out: (slug) => `packages/${slug}/package.json` }
```

The mode must parameterise this root. Monorepo keeps `packages/<slug>/`; standalone uses `''` (paths
relative to the project root). The smoke test's filename continues to carry the slug in both modes.

### The dependency seam

`uiDependency()` (`:133-135`) returns `'*'` today with the documented intent that "a future publish
flips this one helper to a version range". It becomes mode-aware: `'*'` for monorepo (yarn workspace
resolution), `^<version>` for standalone (AR #4). The version source is defined in RD-06.

### Template variables

Templates currently interpolate `__SLUG__` and `__UIDEP__`. Standalone needs at least the package
name to differ from `@jsvision/__SLUG__` (AR #16). Either a new variable or mode-specific templates —
the choice is an implementation detail provided the two modes share one archetype set.

---

## Integration Points

### With RD-02 (CLI package)

RD-02 calls this function in `standalone` mode and materialises the map at a caller-chosen target
directory.

### With RD-03 (single source of truth)

The module and its templates relocate; this RD's seam must survive that move unchanged.

### With RD-05 (verification)

ST-2/ST-3 continue to exercise the default (monorepo) mode. New standalone assertions are additive.

---

## Scope Decisions

| Decision                 | Options Considered                                          | Chosen                  | Rationale                                                                                     | AR Ref     |
| ------------------------ | ----------------------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- | ---------- |
| One mode or two          | Two/standalone-opt-in · two/standalone-default · one         | Two, standalone opt-in  | ST-2/ST-3 pin the monorepo shape; making standalone the default would re-derive immutable oracles for no gain | AR #1, #22 |
| `@jsvision/ui` specifier | `^<version>` · exact · `latest` at scaffold time             | `^<version>`            | Deterministic and offline-testable; `latest` makes the e2e oracle unreproducible               | AR #4      |
| Archetype set            | Keep four · subset · add browser                             | Keep all four           | All typecheck (ST-7), doctor-clean (ST-8), need only `@jsvision/ui`; browser blocked           | AR #10     |

> **Traceability:** every decision references `00-ambiguity-register.md`.

---

## Security Considerations

- **Data sensitivity**: none. No credentials, PII, or tokens are read or written.
- **Input validation**: the app name is the only input. `slugify` (`:102-122`) rejects non-strings,
  empty names, and names containing `/`, `\`, or `..` — unchanged by this RD (AR #6).
- **Authentication & authorization**: N/A — a local developer tool with no privilege boundary.
- **Injection risks**: template interpolation is `String.replaceAll` over a slug already constrained
  to `[a-z0-9-]`, so no shell, SQL, or HTML injection surface exists. **Path traversal is the live
  risk** and is handled here by keeping `slugify` strict; write-time confinement is RD-02's.
- **Encryption needs**: none — no data at rest or in transit.
- **Rate limiting**: N/A.
- **Infrastructure**: N/A at this layer.

---

## Acceptance Criteria

1. [ ] `buildAppFiles('todo')` with no mode argument returns a map whose key set is exactly
       `packages/todo/package.json`, `packages/todo/tsconfig.json`, `packages/todo/vitest.config.ts`,
       `packages/todo/src/main.ts`, `packages/todo/test/todo.smoke.test.ts` — i.e. ST-2 passes
       **without modification**.
2. [ ] `buildAppFiles('todo')` with no mode argument returns a `package.json` where `name` is
       `@jsvision/todo`, `private` is `true`, `type` is `module`, and `dependencies['@jsvision/ui']`
       equals `uiDependency()` for that mode — i.e. ST-3 passes **without modification**.
3. [ ] `buildAppFiles('todo', 'basic', { mode: 'standalone' })` returns a map whose keys contain no
       `packages/` segment and include exactly `package.json`, `tsconfig.json`, `vitest.config.ts`,
       `src/main.ts`, `test/todo.smoke.test.ts`, `README.md`, `.gitignore`.
4. [ ] In standalone mode `dependencies['@jsvision/ui']` matches `/^\^\d+\.\d+\.\d+$/` and equals
       `^` + the package's own version.
5. [ ] Calling `buildAppFiles` twice with identical arguments returns maps that are deeply equal
       (determinism), and neither call performs any filesystem access.
6. [ ] Each of the four archetypes (`basic`, `form`, `grid`, `dashboard`) produces a `src/main.ts` in
       **both** modes, and for a given archetype the two modes' `src/main.ts` are byte-identical.
7. [ ] `buildAppFiles('../evil')`, `('a/b')`, `('/abs')`, and `('')` each throw in both modes and
       produce no files — i.e. ST-5 passes unmodified and standalone is not a bypass.
8. [ ] An unknown archetype throws an error naming the available archetypes, in both modes.
9. [ ] Security requirements verified: unsafe-name rejection covered by criterion 7; no filesystem or
       network access at this layer covered by criterion 5.
