# 03-02 — Shared catalog-entry request builder + the `jsvision-plugin-sync` skill

> The one step that needs AI (FR-3): drafting a `component-catalog.md` bullet for an undocumented
> widget from its JSDoc. A single **pure request builder** grounds both invocation paths (AR-7); the
> skill is the local, key-free path (AR-4, FR-3a).

## The pure request builder (AR-7, AR-14)

A pure module `scripts/plugin-sync-request.mjs` that turns an `undocumented-widget` finding into a
model request, grounded strictly in the widget's own docs (no invented behavior — AR-14):

```js
/**
 * Build the catalog-entry drafting request for one undocumented widget.
 * @param {string} name  the exported class name (from detectDrift)
 * @returns {{ system: string, user: string, target: { file: string, afterHeading: string } }}
 */
export function buildCatalogEntryRequest(name) {
  const { lead, example } = readWidgetDoc(name); // JSDoc lead sentence + @example from the ui barrel
  return {
    system:
      'You draft ONE markdown bullet for a TUI component catalog. Ground every word in the provided ' +
      'JSDoc and example. Do not invent behavior. Match the existing bullet style: ' +
      '"- **Name** — one sentence; a short usage hint.".',
    user: `Widget: ${name}\nJSDoc: ${lead}\nExample:\n${example}\n\nReturn only the bullet line.`,
    target: { file: CATALOG, afterHeading: NEEDS_CATEGORISATION }, // deterministic holding area
  };
}
```

- `readWidgetDoc(name)` runs over the **same** TypeScript `Program` as `extractUiClassExports`, but
  **adds** doc extraction: it follows the export alias to the class declaration (`getAliasedSymbol`)
  and reads the lead sentence via `getDocumentationComment(checker)` + the `@example` via
  `getJsDocTags(checker)`. This is a genuinely new code path, not just a call into the name extractor.
  The `@example` is guaranteed present — `check:docs` fails `yarn verify` on any public export missing
  one — so the grounding data always exists. (AR-7)
- The request is **data**; neither the skill nor the script embeds prompt text of its own — they both
  call `buildCatalogEntryRequest`, so the drafting spec has one home and one test (ST-5).
- **Section placement is human editorial judgment**, not derivable from code: nothing maps a widget to
  a catalog section, and the barrel-coverage gate only checks the bullet *exists somewhere*. So the
  draft lands deterministically under a fixed `## New — needs categorization` heading
  (`NEEDS_CATEGORISATION`), and the reviewer re-files it into its real section during the human review
  step (AR-13). `applyCatalogEntry(mdText, bullet, heading)` is a pure splice inserting the bullet
  under `heading` (creating the heading at the end of the file if absent) — the write side, shared
  with 03-03 and asserted by ST-7.

## The `jsvision-plugin-sync` Claude Code skill (FR-3a, AR-4)

A **manual** skill (`disable-model-invocation: true`) under
`tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md`. It is a **maintainer-facing** tool that
operates on *this* repo (it invokes repo-root `scripts/plugin-sync.mjs` and reads `packages/ui`), and
it co-locates inside the distributed plugin like `jsvision-new-app` — an accepted trade-off while the
plugin is pre-release; being manual-only, it never auto-fires in a consumer's project. It carries no
code of its own; it drives the developer's in-session model through the shared machinery:

SKILL.md instructs the agent to:
1. Run `node scripts/plugin-sync.mjs --detect` (a read-only JSON dump of `detectDrift()`).
2. For each `snippet-drift`: run `yarn plugin:sync --fix` (deterministic).
3. For each `undocumented-widget`: read the request from `buildCatalogEntryRequest(name)`, draft the
   single grounded bullet **in-session** (no API key — the dev's Claude does the drafting), and apply
   it with `applyCatalogEntry` (or edit `component-catalog.md` directly).
4. Run `yarn verify`; if `check-plugin` is now green, present the diff for the developer to review and
   commit. **Never commit automatically** (AR-13).

The skill is registered in `plugin.json`/marketplace like `jsvision-new-app`, and passes
`claude plugin validate` (ST-8). Add `--detect` (JSON) mode to `plugin-sync.mjs` for step 1.

## Governance (AR-13, AR-14)

The drafted bullet is grounded in the widget's real JSDoc and immediately checked by the
barrel-coverage gate (it must exist) and by the human (it must be accurate). The skill's contract is
detect → draft-from-doc → verify → **human review** — approving is reading the drafted prose, not
rubber-stamping.

## Files

- **New** `scripts/plugin-sync-request.mjs` — `buildCatalogEntryRequest`, `readWidgetDoc`,
  `applyCatalogEntry` (all pure/read-only except the caller's write).
- **New** `tools/claude-plugin/skills/jsvision-plugin-sync/SKILL.md` — the manual skill.
- **Edit** `tools/claude-plugin/.claude-plugin/plugin.json` / marketplace — register the skill (if the
  manifest enumerates skills; otherwise directory presence suffices — match PL-01's `jsvision-new-app`).
- **Edit** `scripts/plugin-sync.mjs` — add `--detect` JSON mode.
