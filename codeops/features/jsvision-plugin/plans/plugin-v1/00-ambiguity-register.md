## Ambiguity Register: jsvision-plugin (plugin-v1)

> **Status**: ✅ GATE PASSED — all 20 items resolved · ✅ Preflight PASSED (2026-07-11)
> **Last Updated**: 2026-07-11 12:51

Legend: AR-1…AR-6 + AR-13 were chosen explicitly by the user via decision prompts this session;
AR-7…AR-12 + AR-14…AR-17 were confirmed by explicit **bulk acceptance** ("Accept all") on
2026-07-11. AR-18…AR-19 were added post-gate (surface-during-authoring) and resolved by explicit
user decision on 2026-07-11 (the SDK-drift / self-update discussion). AR-20 was added during
`preflight` and applied with the user's explicit approval; the full PF-001…PF-007 findings are in
`00-preflight-report.md` (PF-002 refined AR-5's mechanism, PF-003 refined AR-18's scope).

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|----------|-----------------|-------------------|---------------|--------|
| 1 | Naming | Feature name (+ plan folder + plugin id) | jsvision-plugin / jsvision-devkit / jsvision-expert | **jsvision-plugin** | ✅ Resolved |
| 2 | Scope | Where the plugin is meant to be used | In-repo (now) / also external repos | **In-repo primary, publish-agnostic** | ✅ Resolved |
| 3 | Scope | Breadth of "expert jsvision developer" | Apps only / apps + framework-extension | **Apps + widget authoring** | ✅ Resolved |
| 4 | Scope | Recipe archetypes to ship | data-driven·forms·files·live (any subset) | **All four archetypes** | ✅ Resolved |
| 5 | Technical | Where the real, smoke-tested recipe code lives (anti-drift) | reuse packages/examples / self-contained in plugin / new package | **Reuse packages/examples; recipe .md quotes the real module** | ✅ Resolved |
| 6 | Scope | Dedicated jsvision-builder subagent in v1 | Defer / include now | **Defer to a later version** | ✅ Resolved |
| 7 | Scope | v1 component set | skill + references + scaffolder + templates (hooks/subagent later) | User accepted recommendation: that set; hooks + subagent out of v1 | ✅ Resolved |
| 8 | Technical | Scaffolder mechanism | prose-only skill / backed by a deterministic Node script | User accepted recommendation: **real Node script** (deterministic + testable), wrapped by a manual skill | ✅ Resolved |
| 9 | Naming | Skill names | — | User accepted recommendation: router skill `jsvision`; scaffolder skill `jsvision-new-app` | ✅ Resolved |
| 10 | Technical | How plugin structural checks run in verify | new turbo task / a root check script | User accepted recommendation: `scripts/check-plugin.mjs` invoked directly by the root `verify`; recipe smoke/e2e stay in packages/examples vitest | ✅ Resolved |
| 11 | Technical | Project verify command | — | User accepted recommendation: **`yarn verify`** (gains the check-plugin step) | ✅ Resolved |
| 12 | Technical | Reference-file set of the knowledge base | — | User accepted recommendation: app-lifecycle · reactivity · layout · component-catalog · gotchas · running-and-testing · theming · widget-authoring · recipes/ | ✅ Resolved |
| 13 | Scope | Plugin source location | tools/ / packages/ | **tools/claude-plugin/** | ✅ Resolved |
| 14 | UX/Behavioral | Skill invocation modes | — | User accepted recommendation: `jsvision` auto-invokes via `description`; `jsvision-new-app` is manual (`disable-model-invocation`) | ✅ Resolved |
| 15 | Integration | Publish-agnostic dependency seam | — | User accepted recommendation: isolate the ONE publish-sensitive line (how a scaffolded app declares its @jsvision/ui dep) inside the scaffolder | ✅ Resolved |
| 16 | Testing | Widget-authoring deliverable | — | User accepted recommendation: a real, paint-tested example custom widget in packages/examples + a widget-authoring.md reference | ✅ Resolved |
| 17 | Security | Scaffolder file-writing safety | — | User accepted recommendation: sanitize the app-name arg (lowercase slug; reject `/`, `..`, absolute); never write outside packages/<slug>/ | ✅ Resolved |
| 18 | Technical | How does the plugin stay current when the SDK adds/changes widgets? (drift detection scope in v1) | do nothing / prose-only / add a deterministic **barrel-coverage** gate | **v1 adds a barrel-coverage gate** to `check-plugin.mjs`: every `@jsvision/ui` export must appear in `component-catalog.md` and vice versa → a new/removed widget turns `yarn verify` red until documented (loud, not silent) | ✅ Resolved |
| 19 | Scope | Automated self-update of the plugin on SDK change (zero manual authoring) | in v1 / separate follow-on / never | **Separate follow-on plan `plugin-self-sync`** (not v1): deterministic detect → AI-generate the delta → `yarn verify` gate → **open a PR that a human approves** (auto-PR governance). AI never on the blocking verify path. | ✅ Resolved |
| 20 | Technical | `marketplace.json` schema/location (assumed from earlier research) | correct per live docs / skip the marketplace file | **Corrected per the live Claude Code docs (preflight PF-001):** `.claude-plugin/marketplace.json`; root `name`/`owner`/`plugins`; local `source` = string; git discriminator `source` not `type`; entry key `name` not `id`. Primary dev path `claude --plugin-dir`. | ✅ Resolved |

### Resolution Notes

**AR-1..AR-6, AR-13:** Chosen explicitly via this session's decision prompts. The plan lives at
`codeops/features/jsvision-plugin/plans/plugin-v1/`; plugin id/dir `jsvision-plugin` at
`tools/claude-plugin/`.

**AR-2:** "Publish-agnostic" means the knowledge (skill + references + recipes) is written against
the `@jsvision/ui` import surface, which does not change on publish; only the scaffolder's
dependency-declaration step is publish-sensitive (see AR-15). Consequence stated and accepted:
external-repo use is not fully supported in v1 because `@jsvision/ui`/`/web`/`/files` are
private/unpublished.

**AR-5:** Recipe apps become real modules under `packages/examples/` (existing vitest `unit`
smoke + `e2e` projects already cover that package). The plugin's `references/recipes/*.md` quote
those modules; a snippet-drift check keeps "shown code == running code". **Refined by preflight
PF-002:** the recipe `.md` **embeds a literal copied block** from the module (a skill file has no
build step, so the docs-site `<<<` transclusion does not apply); the check compares the embedded
block against the module's marked source region. Trade-off accepted: recipe code is not physically inside the plugin dir
(fine while used in-repo; would be bundled if the plugin later ships externally).

**AR-6:** Named deferral — the `jsvision-builder` subagent is **out of scope for v1**; revisit
after the skill+scaffolder+recipes ship and the user wants isolated/parallel app builds.

**AR-8:** A prose-only scaffolder (Claude follows markdown steps) is not deterministically
testable. Backing it with a pure Node generator script (zero deps, ESM) makes it a spec-testable
unit and guarantees identical output every run; the `jsvision-new-app` skill is a thin wrapper
that runs the script.

**AR-10:** A root-level `scripts/check-plugin.mjs` (manifest schema · SKILL/reference link-graph
integrity · recipe-.md↔module snippet-drift · scaffolder-output validity) is invoked directly by
the root `verify` script rather than through a turbo task — this sidesteps the known turbo-cache
staleness where a cached package task false-passes when a repo-root file it reads changes.

**AR-16:** The example custom widget demonstrates the escape hatch (subclass `View`, implement
`draw`/`measure`/`onEvent`) and the repo's authoring conventions (user-facing JSDoc with
`@example`; TV-fidelity discipline only when porting an existing TV component). It lives with the
recipes so the existing smoke harness paints it.

**AR-18 (Tier 0 — deterministic drift, in v1):** The component catalog is the one plugin surface
that can go stale silently (prose doesn't compile). The barrel-coverage check diffs the
`@jsvision/ui` **class value exports** (resolved via the TS checker; **refined by preflight PF-003** —
scoping to class exports avoids the brittleness of "every export", which would demand catalog entries
for types/functions/constants/core re-exports) against `component-catalog.md` — a class
exported-but-undocumented or documented-but-removed fails the gate. Reuses the proven in-repo pattern from the docs-site API
reference (`barrelExports == generated set`). This does not write docs; it makes a missing update
a red build. Recipes + scaffolder output are already covered by typecheck/smoke, so a *breaking*
SDK change is already loud; barrel-coverage closes the *additive* (new widget) gap.

**AR-19 (Tier 1 — AI self-update, follow-on `plugin-self-sync`):** The user's goal is zero manual
authoring. Architecture agreed: keep the **checker deterministic** (barrel diff / snippet hash /
compiler are exact + free), use AI **only to generate** the delta (a new catalog entry from the
widget's JSDoc + `@example`; a snippet re-sync; a capped agentic recipe repair), and **gate every
AI output behind `yarn verify`** — the AI is never on the blocking verify path. On green it opens a
**PR a human approves** (approving ≠ editing; catches semantically-wrong-but-passing prose); on
red-after-retries it opens an issue. Token cost stays low: AI runs only when a deterministic signal
fires and sees only the delta. This is scoped as its own plan (its own Zero-Ambiguity pass) — not
built in v1; v1's Tier-0 gate (AR-18) is its prerequisite substrate.

**AR-20 (marketplace schema — preflight PF-001):** the plan's original `marketplace.json` was copied
from earlier research and was wrong. Verified against the live Claude Code docs and corrected: the
file is `.claude-plugin/marketplace.json` at the repo root; required root fields `name`/`owner`/
`plugins`; a local plugin `source` is a plain string relative path resolved against the marketplace
root; a git source uses `{"source":"github",…}` (discriminator `source`, not `type`); plugin entries
key on `name`, not `id`. The primary dev/use path is `claude --plugin-dir tools/claude-plugin` (runs
in place); a marketplace install copies only the plugin dir to the cache (PF-006). The skill format
itself (`disable-model-invocation`, `argument-hint`, `allowed-tools`, `${CLAUDE_PLUGIN_ROOT}`,
`claude plugin validate`, `--plugin-dir`) was verified correct against the same docs.
