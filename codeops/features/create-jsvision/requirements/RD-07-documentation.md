# RD-07: Documentation updates

> **Document**: RD-07-documentation.md
> **Status**: Draft
> **Created**: 2026-07-22
> **Project**: create-jsvision (GH #169)
> **Depends On**: RD-02, RD-04
> **CodeOps Artifact Schema**: 1 · **Migrated From Claude CodeOps Skills Version**: 3.12.0
> **Complexity**: S

---

## Feature Overview

Documentation is part of shipping this feature, not a follow-up. The Install & packages guide
currently tells readers that the one-liner **does not exist yet** and points them at this very issue:

> "A `npm create jsvision` one-liner that generates a runnable starter for you is planned — follow
> issue #169. Until it lands, the steps above are the supported path."

Shipping the scaffolder without editing that leaves the published documentation stating something
false. The same page also describes `/jsvision-new-app` as generating "into a JSVision monorepo
checkout rather than a standalone project" — accurate today, wrong once RD-01 lands.

---

## Functional Requirements

### Must Have

- [ ] The Install & packages guide leads its "Start a new project" section with the
      `npm create jsvision` one-liner, in a `::: code-group` covering npm / yarn / pnpm.
- [ ] The "planned — follow issue #169" tip is removed.
- [ ] The manual from-scratch path is **kept**, below the one-liner, for readers who want it.
- [ ] The description of the `/jsvision-new-app` skill is corrected.
- [ ] The tsconfig published on that page and the tsconfig the scaffolder emits are identical
      (including the `include` widening noted in RD-04).
- [ ] The docs 20-check gate passes, including no dead internal links.
- [ ] The plugin skill's own documentation reflects the relocated generator.

### Should Have

- [ ] The archetype list (`--template`) is documented with each archetype's one-line description.

### Won't Have (Out of Scope)

- A browser-deployment section — `@jsvision/web` remains unpublished, and the page already states
  that status accurately.
- Marketing copy on the landing page.

---

## Technical Requirements

### Pages affected

| Page | Change |
| --- | --- |
| `packages/docs-site/guide/install-and-packages.md` | One-liner promoted; #169 tip removed; skill description corrected; tsconfig kept in sync |
| `packages/docs-site/guide/index.md` | Verify its install section still reads correctly beside the new one-liner |
| `tools/claude-plugin/skills/jsvision-new-app/SKILL.md` | Reflect the relocated generator |

### Guard note

The docs gate strips `#fragment` from links before validating them, so a wrong anchor is **not**
caught automatically. Any anchor introduced or retargeted here must be checked against the actual
heading by hand.

---

## Integration Points

### With RD-02 / RD-04

The documented commands and the documented tsconfig must match what the CLI actually accepts and
emits. These are the same artifact described in two places, and they are expected to drift unless
tied together.

### With RD-05 (verification)

The docs-site snippet-drift guard already scans every teaching page for banned idioms; new snippets
inherit that guard automatically.

---

## Scope Decisions

| Decision      | Options Considered              | Chosen           | Rationale                                                               | AR Ref |
| ------------- | ------------------------------- | ---------------- | ------------------------------------------------------------------------- | ------ |
| Docs update   | In scope · follow-up issue      | In scope          | Shipping without it leaves published docs asserting something false      | AR #20 |
| tsconfig      | Match the scaffolder · diverge  | Match             | One artifact, two locations — divergence is a documentation defect       | AR #11 |

---

## Security Considerations

- **Data sensitivity**: none — public documentation.
- **Input validation**: N/A.
- **Authentication & authorization**: N/A.
- **Injection risks**: documentation snippets are teaching material and are consumed by AI agents as
  well as humans. A snippet showing an unsafe idiom propagates. Any command shown must be the safe
  form — in particular, no example may suggest bypassing the overwrite refusal or disabling the
  confinement check.
- **Encryption needs**: none.
- **Rate limiting**: N/A.
- **Infrastructure**: the docs site ships a strict per-build meta-CSP; new content must not introduce
  inline scripts that would violate it.

---

## Acceptance Criteria

1. [ ] `packages/docs-site/guide/install-and-packages.md` contains `npm create jsvision` inside a
       `::: code-group` block with npm, yarn, and pnpm variants.
2. [ ] The string "follow [issue #169]" (and any equivalent "is planned" phrasing about the
       scaffolder) no longer appears anywhere under `packages/docs-site/`.
3. [ ] The page no longer describes `/jsvision-new-app` as generating only into a monorepo checkout.
4. [ ] The manual from-scratch instructions remain present on the page.
5. [ ] The `compilerOptions` JSON block on that page is deep-equal to the `compilerOptions` the
       scaffolder emits — asserted by a test, not by review.
6. [ ] `node packages/docs-site/scripts/check-docs-build.mjs` reports 20/20.
7. [ ] Every internal link introduced or changed resolves, and every anchor introduced or changed
       matches an actual heading on the target page (checked explicitly, since the gate strips
       fragments).
8. [ ] Security requirements verified: no documented command bypasses the overwrite refusal or the
       write-confinement check.
