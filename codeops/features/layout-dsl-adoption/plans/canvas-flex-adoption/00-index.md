# canvas-flex-adoption

> **Implements**: layout-dsl-adoption/GH-110 + layout-dsl-adoption/GH-111
> **CodeOps Skills Version**: 3.10.0
> **Governed by**: [RD-01](../../requirements/RD-01-deliberate-divergence-policy.md) FR-6 · verification [RD-02](../../requirements/RD-02-non-functional-and-verification.md)

Adopt the layout DSL in the didactic canvases — the `@jsvision/examples` app-shell demos and the
`@jsvision/theme-designer` panels. **32 conversions across 9 files**, plus 3 preserved sites.

## Documents

| Doc | Contents |
|-----|----------|
| [00-ambiguity-register](00-ambiguity-register.md) | The 12 decisions taken before authoring · ✅ gate passed |
| [01-requirements](01-requirements.md) | FR-1…FR-5, NFR-1…NFR-6, AC-1…AC-9, the residue allowlist |
| [02-current-state](02-current-state.md) | Verified site tables, property-drop exposure, why existing coverage does not count |
| [03-01-example-demos](03-01-example-demos.md) | Target code for the 6 example files |
| [03-02-theme-designer](03-02-theme-designer.md) | Target code for the 3 designer files + the ordering constraint |
| [07-testing-strategy](07-testing-strategy.md) | ST-C1…C9, the shared `solveTree` helper, the zero-edit contract |
| [99-execution-plan](99-execution-plan.md) | 4 phases, 31 tasks |

## Why these two issues share one plan

RD-01 FR-6 names `@jsvision/examples`, `@jsvision/docs-site` and `theme-designer` panels in a single
sentence — they are one requirement, not two. Both are behaviour-preserving in intent, both have the
same coverage (none that touches composition), and both need the same witness harness. Building it
once is strictly cheaper than twice (AR-1).

## What makes this plan different from its siblings

**The property-drop risk is four times denser.** 13 of 35 sites carry a property beyond `size` —
37%, against 8% in `widget-flex-adoption`. And the extras here are `padding` and `gap` on app-shell
roots, not just `direction`. A bare tagger at any of them silently changes the rendering.

**There is no existing oracle.** Every harness over these 9 files is a stdout-content smoke test: the
designer walkthrough asserts `exit 0` plus a `+---+` frame and the word `Contrast`; the demo e2e
tests assert rendered substrings. None references `bounds`, `.layout`, `rect` or `children[`, and
`preview-panel.ts` has no test file at all. A panel flowing sideways would pass every one of them.

So the witnesses are not a supplement here — they are the safety net, and Phase 1 is the larger half
of the work.

**The blast radius is dev-only by construction.** Both packages are `private: true` and nothing in
the monorepo depends on them, so no consumer can observe any of these layouts. That is what justifies
a lighter review posture than the sibling plans got.

## The ordering constraint

Each designer panel's `direction:'col'` currently arrives from `app.ts`, not from its own builder.
The builders must be converted **before** `app.ts` drops it — otherwise both panels flow horizontally
and nothing in the suite notices. Phase 2 enforces this, and ST-C9 is green before either step.

## Out of scope

- **`view-demo/main.ts`** and **`layout.story.ts`** (9 sites) — they exist to teach the *raw*
  View/Group spine and the *raw* cell-native flex engine. Converting them changes what the lesson
  teaches, which is a product decision rather than a refactor (AR-2). #110 stays open for them.
- **The `at` shadow** in `kitchen-sink/story.ts` — signature-compatible with the DSL's `at` but
  clobbers where that one merges, so swapping them is a behaviour change at every story call site.
  Belongs to the shadow-cleanup issue (AR-8).
