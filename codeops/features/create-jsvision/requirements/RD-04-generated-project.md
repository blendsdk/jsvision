# RD-04: The generated standalone project

> **Document**: RD-04-generated-project.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0
> **Complexity**: S

---

## Feature Overview

What lands on disk. This is the highest-stakes surface in the feature: the generated project is the
first JSVision code a new user ever opens, and every file in it teaches something. A stale idiom here
propagates into every app built from it.

The governing constraint is that it must **agree with the documentation**. The published Install &
packages guide teaches a specific tsconfig and a specific set of caveats; a scaffolder that emits
something different makes the docs wrong on file number one.

---

## Functional Requirements

### Must Have

- [ ] `package.json` — bare slug name (no `@jsvision/` scope), `"private": true`, `"type": "module"`,
      `"engines": { "node": ">=22" }`, no `license` field, one runtime dependency
      (`@jsvision/ui` at `^<version>`), dev dependencies for `typescript`, `tsx`, `vitest`,
      `@types/node`, and `start` / `typecheck` / `test` scripts.
- [ ] `tsconfig.json` — self-contained, **no `extends`**, byte-matching what the Install & packages
      guide teaches.
- [ ] `src/main.ts` — the archetype's starter, byte-identical to the monorepo mode's `src/main.ts`.
- [ ] `test/<slug>.smoke.test.ts` — the headless smoke test.
- [ ] `vitest.config.ts` — the unit/e2e project split.
- [ ] `README.md` — what it is, how to run, how to test, the TTY caveat, a link to the docs site.
- [ ] `.gitignore` — at minimum `node_modules/` and `dist/`.

### Should Have

- [ ] The README names the archetype the project was scaffolded from.

### Won't Have (Out of Scope)

- A `license` field — the user's choice, not ours to presume (AR #15).
- Linter or formatter config — opinionated, and not needed to run.
- A lockfile — produced by the user's package manager.
- CI workflow files.

---

## Technical Requirements

### The tsconfig, verbatim from the docs

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"]
}
```

`include` must be widened to cover `test` as well, since the project ships tests (AR #12). That
widening is the one permitted deviation from the published snippet, and the docs page should be
updated to match rather than the two being allowed to differ (see RD-07).

`module` and `moduleResolution` must **both** be `NodeNext`. JSVision publishes ESM behind an
`exports` map and older resolvers cannot read it — this is the documented root cause of "cannot find
module `@jsvision/ui`" when the package is plainly installed.

### Why `private: true` on a user's own app

It prevents an accidental `npm publish` of a scaffolded app. It also means the absent `license` field
produces no tooling warning, since npm only warns about licence metadata for publishable packages.

### Dev dependency versions

The generated manifest pins ranges for `typescript`, `tsx`, `vitest`, and `@types/node`. These drift
as the ecosystem moves; keeping them current is an ongoing maintenance obligation, and the
typecheck oracle (RD-05) is what surfaces the drift.

---

## Integration Points

### With RD-01 (dual-mode generation)

These contents are what standalone mode emits.

### With RD-05 (verification)

Every file here is asserted: the manifest by unit test, `src/main.ts` by the existing compiler-API
typecheck (ST-7) and doctor check (ST-8), and the whole project by the linked e2e.

### With RD-07 (documentation)

The tsconfig is shared with the Install & packages guide and the two must not diverge.

---

## Scope Decisions

| Decision            | Options Considered                  | Chosen                            | Rationale                                                                     | AR Ref |
| ------------------- | ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------- | ------ |
| tsconfig            | Match the docs · diverge            | Match the docs                     | Otherwise docs and tool contradict each other on the first file a user opens    | AR #11 |
| Tests in starter    | Include · omit · opt-in flag        | Include                            | "Testable without a terminal" is a marketed claim — ship the proof              | AR #12 |
| README              | Include · omit                      | Include                            | First file opened in an editor                                                  | AR #13 |
| `.gitignore`        | Include · omit                      | Include                            | Without it the first `git add .` commits `node_modules`                         | AR #14 |
| `license`           | Omit · MIT · UNLICENSED             | Omit                               | Hardcoding a licence into someone else's app is presumptuous; moot when private | AR #15 |
| Name + private      | Bare slug + private · scoped · public | Bare slug, `private: true`       | Drops the scope; private prevents accidental publish                            | AR #16 |

---

## Security Considerations

- **Data sensitivity**: none — no secrets are written into any generated file.
- **Input validation**: the only interpolated value is the slug, already constrained to `[a-z0-9-]`
  by `slugify`, so it cannot break out of a JSON string or a TypeScript identifier position.
- **Authentication & authorization**: N/A.
- **Injection risks**: the slug is interpolated into `package.json` (JSON string), `src/main.ts`
  (string literal), and a test filename. The `[a-z0-9-]` constraint makes JSON/JS string escaping and
  path construction safe by construction. **No template may interpolate any value not derived from
  the slug.**
- **Encryption needs**: none.
- **Rate limiting**: N/A.
- **Infrastructure**: the generated `.gitignore` must exclude `node_modules/`, which reduces the
  chance of a user committing dependency trees — a common accidental-disclosure vector.

---

## Acceptance Criteria

1. [ ] The generated `package.json` parses as JSON and has `name` matching `/^[a-z0-9-]+$/`,
       `private === true`, `type === 'module'`, `engines.node === '>=22'`, and **no** `license` key.
2. [ ] `Object.keys(pkg.dependencies)` is exactly `['@jsvision/ui']`.
3. [ ] The generated `tsconfig.json` contains no `extends` key, and its `compilerOptions.module` and
       `compilerOptions.moduleResolution` are both exactly `"NodeNext"`.
4. [ ] The generated `tsconfig.json`'s `compilerOptions` object is deep-equal to the object published
       in the Install & packages guide, and its `include` covers both `src` and `test`.
5. [ ] `src/main.ts` is byte-identical to the same archetype's `src/main.ts` in monorepo mode.
6. [ ] The generated project contains a `README.md` of at least 5 lines that includes the string
       `isTTY` or the phrase "interactive terminal", and a link to the documentation site.
7. [ ] The generated `.gitignore` contains lines `node_modules/` and `dist/`.
8. [ ] `test/<slug>.smoke.test.ts` exists and its filename slug matches `package.json`'s `name`.
9. [ ] For all four archetypes, the emitted file **set** is identical — only `src/main.ts` differs.
10. [ ] Security requirements verified: criterion 1 confirms no secrets or unexpected fields;
        criterion 7 confirms `node_modules/` is git-ignored; slug constraint verified by RD-01
        criterion 7.
