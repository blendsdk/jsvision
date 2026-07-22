# RD-06: Release & distribution

> **Document**: RD-06-release-and-distribution.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-02
> **CodeOps Skills Version**: 3.12.0
> **Complexity**: S

---

## Feature Overview

`create-jsvision` becomes the sixth published package. It differs from the existing five in one
important way: it is **unscoped**. `@jsvision/*` packages are covered by the organisation scope
already owned; `create-jsvision` is a separate name in the global npm namespace, and owning it is a
prerequisite rather than a consequence of building the feature.

Everything else follows the existing lockstep pipeline: one shared version, one release commit, npm
provenance via OIDC.

---

## Functional Requirements

### Must Have

- [x] The unscoped npm name `create-jsvision` is **reserved before implementation begins**.
      Done 2026-07-23 — placeholder `0.0.1` published under owner `blendjs`.
- [ ] The package joins the lockstep version set and `yarn sync-package-versions`.
- [ ] The manifest is **not** `private`, declares a `bin`, and carries a `repository` field
      (required for provenance).
- [ ] `engines.node` is `>=22`, consistent with the rest of the repo.
- [ ] `yarn check:deps` passes — zero native dependencies.
- [ ] The package publishes with provenance through the existing Release workflow.
- [ ] The published tarball contains the templates it needs at runtime.

### Should Have

- [ ] A dry-run release is performed before the first real publish.

### Won't Have (Out of Scope)

- Independent versioning (AR #3).
- Publishing the Claude Code plugin to npm — it stays on its own version line (RD-03).

---

## Technical Requirements

### Lockstep implications

Root `package.json#version` is the source of truth and `sync-package-versions` fans it out. Joining
lockstep means `create-jsvision@X.Y.Z` always scaffolds `@jsvision/ui@^X.Y.Z` — the version
correspondence is a documented feature, not a coincidence.

The cost, accepted: a template-only fix bumps every published package. This is already true of the
existing five, where a change in one bumps all.

### Packaging the templates

The generator reads templates from disk at module init. Whatever `files`/`exports` configuration the
package uses, the templates must be present in the published tarball — a package that scaffolds
correctly from a repo checkout but throws on a real install would pass every existing test.

### Release-workflow prerequisites already in place

The Release workflow gained a tag push and an automatic back-merge PR in a prior change, so the
version tag and the `develop` sync are no longer manual steps.

---

## Integration Points

### With RD-02 (CLI)

`bin`, `repository`, and non-private are asserted here but originate in RD-02's manifest.

### With RD-05 (verification)

`yarn verify` gates the release, so every oracle in RD-05 blocks a bad publish.

---

## Scope Decisions

| Decision      | Options Considered        | Chosen         | Rationale                                                                     | AR Ref |
| ------------- | ------------------------- | -------------- | ------------------------------------------------------------------------------- | ------ |
| Versioning    | Lockstep · independent    | Lockstep        | Same release cadence; version correspondence with the SDK is a feature         | AR #3  |
| Release wiring | Same publish · separate step | Same lockstep publish | No reason for a second release axis                                     | AR #19 |

---

## Security Considerations

- **Data sensitivity**: the npm token and OIDC identity are the sensitive material. Neither is
  introduced by this RD — the existing workflow already handles both.
- **Input validation**: N/A at release time.
- **Authentication & authorization**: publishing requires `NPM_TOKEN`; provenance requires the
  `id-token: write` permission. An unscoped package is a **separate ownership grant** from the
  `@jsvision` scope — confirm the publishing identity owns `create-jsvision` before the first
  release, or the publish fails at the last step of an otherwise successful run.
- **Injection risks**: none introduced.
- **Encryption needs**: transport security is npm's; provenance attestation is the integrity control.
- **Rate limiting**: N/A.
- **Infrastructure**: secrets stay in GitHub Actions secrets; no credential is ever written into a
  generated project or a template.

---

## Acceptance Criteria

1. [x] `npm view create-jsvision` resolves to a package owned by the publishing identity **before**
       implementation work starts. — Satisfied 2026-07-23. A `0.0.1` placeholder holds the name; it
       writes no files and exits non-zero. The first real release supersedes it via lockstep, so the
       version only ever moves forward. `npm create jsvision` and `yarn create jsvision` were both
       confirmed to resolve to it and execute its `bin`.
2. [ ] `packages/create-jsvision/package.json` has no `private` key (or `private: false`), a `bin`
       entry, and a `repository` object with a `url`.
3. [ ] `yarn sync-package-versions --check` passes with `create-jsvision` included, and its version
       equals the root `package.json` version.
4. [ ] `yarn check:deps` reports zero native dependencies for the new package.
5. [ ] `npm pack` on the package produces a tarball that, when extracted, contains every template
       file the generator reads at runtime.
6. [ ] Scaffolding from the **extracted tarball** (not the repo checkout) produces the same file set
       as scaffolding from source.
7. [ ] A dry-run of the Release workflow completes without publishing and reports `create-jsvision`
       among the packages it would publish.
8. [ ] The published package shows a provenance attestation on npm.
9. [ ] Security requirements verified: criterion 1 confirms the ownership grant, criterion 8 confirms
       provenance, and no generated artifact contains a credential.
