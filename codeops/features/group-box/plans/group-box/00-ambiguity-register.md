## Ambiguity Register: GroupBox

> **Status**: ✅ GATE PASSED — all 12 items resolved
> **Last Updated**: 2026-09-05 01:55

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| 1 | Scope ambiguities | Whether issue #205 is a lightweight maintenance task or a cohesive public feature, and which nested CodeOps feature owns it. | New `group-box` feature with an issue-driven full plan (recommended) / `_maintenance` task / reopen archived `jsvision-ui` | User confirmed the recommended bundle: create the active `group-box` feature and an issue-driven full plan; do not modify the archived feature or add a redundant RD. | ✅ Resolved |
| 2 | Feature gaps | Whether the plan implements only the runtime widget or the complete acceptance surface in issue #205. | Runtime-only / complete public API, tests, kitchen-sink story, docs, distribution, and changelogs (recommended) | User confirmed the complete issue scope. | ✅ Resolved |
| 3 | Technical unknowns | Where the component lives and whether caption alignment requires a public `DrawContext` expansion. | Dedicated `packages/ui/src/group-box/` module reusing existing helpers (recommended) / foundational `view/` placement / new umbrella `containers/` module / public drawing API change | User confirmed the dedicated module and no public `DrawContext` change. | ✅ Resolved |
| 4 | Behavioral gaps | Which portion of an overlong caption survives clipping, especially for end alignment. | Preserve the leading prefix without ellipsis for every alignment (recommended) / preserve an alignment-dependent suffix for end alignment | User confirmed leading-prefix clipping without ellipsis. | ✅ Resolved |
| 5 | Edge cases | How decoration behaves when the top-border interior cannot hold both caption and surrounding blanks. | Add both blanks only when both fit; otherwise give the display-cell-clipped caption the available interior (recommended) / clip the already-decorated string and risk hiding the caption | User confirmed the minimum-sufficient implementation bundle grounded in the issue's “where space permits” contract. | ✅ Resolved |
| 6 | Integration points | Whether the component page also needs the current docs-site standard live-example and registry contract. | Complete `component-page-template1` page plus registered `template1` app (required by the active docs contract) / prose page only | User confirmed the complete documentation integration. | ✅ Resolved |
| 7 | Integration points | Whether the supported Codex plugin surface and package changelogs are part of completion. | Update the canonical JSVision component catalog, regenerate the distributed plugin, and update UI/examples/docs changelogs (recommended) / omit those supported surfaces | User confirmed the plugin-skill and changelog updates. | ✅ Resolved |
| 8 | Non-functional gaps | Which verification commands define completion. | Focused UI/examples/docs checks, `yarn docs:build`, `yarn plugin:update`, `yarn plugin:check`, then `yarn verify:local` (recommended) / local changed-file gate only | User confirmed the complete verification sequence. CI remains responsible for full `yarn verify`. | ✅ Resolved |
| 9 | Complexity control | Whether preflight corrections may introduce global lifecycle/drawing changes or generalized support machinery. | Keep all runtime behavior component-local and use exact existing registry/tool mappings (recommended) / stop implementation | User approved all preflight corrections only if the overengineering rescan remains green. The rescan confirmed the component-local design and rejected global changes, new abstractions, and dependencies. | ✅ Resolved |
| 10 | Ordering (runtime) | The Phase 2 full examples suite includes the API-drift guard, which necessarily fails after the new UI export and before Phase 4 plugin synchronization. | Run the focused showcase and kitchen-sink suites in Phase 2 and the complete examples suite after Phase 4 synchronization (minimum-sufficient) / pull distribution generation ahead of its specification-first phase | Selected the minimum-sufficient phase-local correction. Vitest project exclusions do not remove an explicitly included workspace file, so the gate uses the project-approved smallest relevant tests. It changes no product scope or code and preserves the independent distribution red/green sequence. | ✅ Resolved |
| 11 | Test assumption (runtime) | The docs shell focuses its only eligible descendant when the dialog mounts, so the initial `none` focus fixture contradicted the existing application behavior. | Assert that the initial focus is the nested `Button`, then confirm traversal never lands on GroupBox (minimum-sufficient) / change shared focus behavior for this example | Selected the component-specific correction. The updated fixture strengthens the passive-focus proof and avoids any global focus or shell change. | ✅ Resolved |
| 12 | Ordering (runtime) | The Phase 3 docs unit suite includes the Codex-plugin integrity test, which necessarily reports the new UI export before Phase 4 writes and synchronizes the distribution artifacts. | Run all non-distribution docs tests and the docs build in Phase 3, then rerun the complete docs suite after Phase 4 synchronization (minimum-sufficient) / mutate distribution artifacts before their specification-first phase | Selected the minimum-sufficient phase-local correction. It changes no product scope, preserves the Phase 4 red gate, and leaves the complete docs suite in the final verification sequence. | ✅ Resolved |

### Resolution Notes

**AR-1:** The repository uses nested CodeOps layout. Issue #205 is a new public SDK capability with an explicit API and acceptance contract, so it receives an active issue-driven feature plan at `codeops/features/group-box/plans/group-box/`. The plan declares `group-box/GH-205` as its source identity.

**AR-2:** In scope are `GroupBox`, its public types and exports, immutable contract tests, implementation-only tests where useful, the kitchen-sink story, the standard component page and live example, catalogs and API links, the canonical JSVision skill copy, generated plugin synchronization, and relevant changelogs. The issue's non-goals remain out of scope.

**AR-3:** The smallest viable architecture is one dedicated UI module. It extends `Group`, calls the existing clipped drawing facade, imports existing cell-width helpers internally, and uses inherited renderer shadow composition. It adds no dependency, drawing API, generalized frame subsystem, or layout-engine change.

**AR-4:** Caption clipping always retains the leading display-cell prefix and adds no ellipsis. `titleAlignment` places the resulting decorated caption within the top-border interior; it does not change which textual edge is retained.

**AR-5:** Caption blanks are a pair: include one on both sides only when the complete caption plus both blanks fits. When it does not fit, spend the interior on the clipped caption so a narrow drawable frame does not show decoration while hiding available title cells. Omitted and empty titles leave the border uninterrupted.

**AR-6:** The current component documentation contract requires a cataloged standard page to own a registered `kind: 'app'` live example built with the shared `template1` shell. The kitchen-sink story remains a separate showcase artifact.

**AR-7:** `tools/jsvision-skill/` is canonical. Add `GroupBox` to its component catalog, run `yarn plugin:update`, and include the generated `plugins/jsvision-plugin/skills/jsvision/` changes. Update `packages/ui/CHANGELOG.md`, `packages/examples/CHANGELOG.md`, and `packages/docs-site/CHANGELOG.md`.

**AR-8:** Verification uses the smallest relevant package checks while iterating, then the repository-required local and plugin gates. The docs page also requires `yarn docs:build`. The full repository `yarn verify` is intentionally left to CI under project guidance.

**AR-9:** Preflight corrections preserve the minimum-sufficient design. Title normalization is one
component-local operation and reactive remount handling is one `GroupBox.mount()` override. Required
docs and plugin updates are exact inventory/category mappings. No global framework change, reusable
abstraction, dependency, or unrelated refactor is authorized.

**AR-10 (runtime):** Phase 2 verifies examples type safety plus the focused GroupBox and kitchen-sink
behavior. Phase 4 writes its API-category specification before changing the generator, synchronizes
generated artifacts, and then runs the complete examples suite. This avoids an early generated-
artifact mutation and preserves specification-first ordering.

**AR-11 (runtime):** A mounted docs dialog automatically focuses its first eligible descendant. The
GroupBox contract therefore starts with the nested `Button` focused and confirms Tab traversal stays
on that only focusable child. No example-specific or global focus override is introduced.

**AR-12 (runtime):** Phase 3 runs the docs unit suite without the distribution-only Codex-plugin
integrity test, plus the complete DOM suite and docs build. Phase 4 synchronizes the canonical skill
and generated plugin, then reruns the complete docs suite as part of final verification.

### Systematic Category Review

| Category | Result |
|---|---|
| Feature gaps | Resolved by AR-2. |
| Behavioral gaps | Resolved by the issue contract and AR-4/AR-5. |
| Scope ambiguities | Resolved by AR-1/AR-2. |
| Technical unknowns | Resolved by AR-3. |
| Edge cases | Resolved by the issue contract and AR-4/AR-5. |
| Integration points | Resolved by AR-6/AR-7. |
| Data & state | Title ownership and reactive lifetime are explicit in issue #205; no persistent data is introduced. |
| Security & compliance | Caption geometry and drawing use the same sanitized single-line value; no host, filesystem, network, authentication, or secret boundary is introduced. |
| Non-functional gaps | Resolved by AR-8; no new performance or availability subsystem applies. |
| UX & presentation | Alignment, clipping, decoration, roles, docs interaction, and passive behavior are explicit. |
| Stakeholder conflicts | No conflicting actors or permission models apply to this passive local widget. |
| Naming & terminology | `GroupBox`, its public types, module slug, page route, and registry ID are confirmed. |
