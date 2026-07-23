# RD-03: Template single source of truth

> **Document**: RD-03-single-source-of-truth.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0
> **Complexity**: M

---

## Feature Overview

Two consumers need the same templates and generator, and **neither can reach the other at runtime**:

- `tools/claude-plugin/` is a self-contained Claude Code plugin with its own
  `.claude-plugin/plugin.json` (version 0.1.0, outside the lockstep set). It ships as that directory.
- `packages/create-jsvision/` publishes to npm, and npm ships only the package's own directory.

So two physical copies are unavoidable. The only real question is whether the second copy is
**generated and guarded** or maintained by hand. The repo already has deterministic sync and drift
infrastructure, but it does not currently copy or byte-compare scaffolder templates. This RD extends
that infrastructure rather than assuming template synchronization already exists.

---

## Functional Requirements

### Must Have

- [ ] The canonical generator and templates live in `packages/create-jsvision/`.
- [ ] The plugin's copy is **generated**, never hand-edited, by `yarn plugin:sync --fix`.
- [ ] `check-plugin` (already wired into `yarn verify`) fails when the plugin copy drifts from
      canonical.
- [ ] Regeneration is deterministic: running it twice with no source change produces no diff.
- [ ] The `/jsvision-new-app` skill continues to scaffold in-monorepo apps with unchanged behaviour.
- [ ] Adding an archetype remains a pure content change — drop in a directory, no generator edit.

### Should Have

- [ ] The generated plugin copy carries a header marking it generated and naming the sync command.

### Won't Have (Out of Scope)

- Publishing the plugin to npm — it is distributed as a Claude Code plugin and stays on its own
  version line.
- Changing the plugin's own version to join lockstep.

---

## Technical Requirements

### Direction of generation

Canonical → plugin. The npm package is the source because it is the artifact with the stricter
contract (a published API and a version), and because the plugin already has machinery for consuming
generated content.

### What the existing mechanism covers

`scripts/plugin-sync.mjs` currently supports deterministic snippet/API regeneration and an
AI-assisted catalog mode; `scripts/check-plugin.mjs` validates the plugin but treats its current
template directory as canonical. The feature must add a new deterministic canonical-to-plugin copy
operation to `--fix` and a byte-for-byte drift check to `check-plugin`. Template sync must never
depend on an API key or a model.

> Note: the drift memory for this repo records that `--detect` does **not** catch every drift class
> (it missed API-reference drift). Whatever check is added here must be verified to actually fail on a
> hand-edit of the plugin copy — see the acceptance criteria.

---

## Integration Points

### With RD-01 (dual-mode generation)

The relocated module must keep the mode seam intact; relocation is a move, not a redesign.

### With RD-05 (verification)

The existing spec/impl tests at `packages/examples/test/new-jsvision-app.{spec,impl}.test.ts` import
the module by path. Relocation changes that import path; the oracles' **assertions** stay untouched.

---

## Scope Decisions

| Decision            | Options Considered                                                              | Chosen                              | Rationale                                                                       | AR Ref |
| ------------------- | ------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- | ------ |
| Template location   | Canonical in package + sync · canonical in plugin + build copy · two hand copies | Canonical in package, plugin synced | Two copies are forced; make the second generated and guarded by existing machinery | AR #2  |

---

## Security Considerations

- **Data sensitivity**: none — templates are public source.
- **Input validation**: N/A; the sync operates on repo-controlled files, not user input.
- **Authentication & authorization**: N/A. `--fix` must not require `ANTHROPIC_API_KEY`; a
  credentialed path must never be on the critical path for a build-time guard.
- **Injection risks**: none — deterministic file copy, no interpolation of external input.
- **Encryption needs**: none.
- **Rate limiting**: N/A.
- **Infrastructure**: the sync must run offline so `yarn verify` never depends on network reachability.

---

## Acceptance Criteria

1. [ ] `yarn plugin:sync --fix` run twice consecutively with no source change leaves `git status`
       clean on the second run.
2. [ ] Hand-editing any byte of the plugin's generated template copy causes `yarn verify` to fail via
       `check-plugin`, and the failure message names the drifted file.
3. [ ] `yarn plugin:sync --fix` completes successfully with `ANTHROPIC_API_KEY` unset and with no
       network access.
4. [ ] After relocation, `/jsvision-new-app` scaffolds an in-monorepo app whose emitted file set and
       `package.json` are byte-identical to those produced before relocation.
5. [ ] The existing spec tests ST-1 through ST-8 pass with only their **import path** changed — no
       assertion, expected value, or test name is modified.
6. [ ] Adding a new directory under the canonical archetypes path with a `main.ts.tmpl` and
       `about.txt` makes that archetype appear in `--list` output with no change to any `.mjs` or
       `.ts` file.
7. [ ] Security requirements verified: criterion 3 covers the no-credential/offline requirement;
       criterion 2 covers tamper detection of the generated copy.
