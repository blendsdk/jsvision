---
name: jsvision-plugin-sync
description: Re-sync stale jsvision plugin content (drifted recipe snippets, undocumented @jsvision/ui widgets) after the SDK changes. Maintainer command for this repo — invoke when the plugin integrity gate reports drift.
disable-model-invocation: true
allowed-tools: 'Bash Read Edit'
---

# Sync the jsvision plugin to the SDK

Bring the plugin's taught content back in line with the SDK when the integrity gate
(`node scripts/check-plugin.mjs`, part of `yarn verify`) reports drift. Three kinds of drift are
fixable, two mechanically: a **drifted recipe snippet** and a **stale generated API reference**
(`references/api/*`, regenerated from the `@jsvision/*` source types) — both refreshed by
`yarn plugin:sync --fix`, no AI — and an **undocumented widget** (a catalog bullet you draft
in-session from the widget's own docs).

> **Maintainer command.** This operates on _this_ repository — it runs the repo-root
> `scripts/plugin-sync.mjs` and reads `packages/ui`. It is manual-only (`disable-model-invocation`),
> so it never auto-fires in a consumer's project. Everything it changes is left **unstaged for you
> to review**; it never commits.

## What to do

1. **Detect** the drift as machine-readable JSON:

   ```bash
   node scripts/plugin-sync.mjs --detect
   ```

   Each finding is `{ "kind": "snippet-drift", "module": "..." }` or
   `{ "kind": "undocumented-widget", "name": "..." }`. If the output is `[]`, there is nothing to
   sync — stop.

2. **Fix the mechanical drift deterministically** (always safe to run — it copies each source
   module's marked region into its recipe page and regenerates the whole `references/api/` reference
   from the `@jsvision/*` source types, no AI):

   ```bash
   yarn plugin:sync --fix
   ```

3. **Draft a catalog bullet for each `undocumented-widget`.** For a widget named `<Name>`, print the
   grounding prompt (the widget's real JSDoc lead sentence + `@example`, assembled by the shared
   request builder):

   ```bash
   node -e "import('./scripts/plugin-sync-request.mjs').then(m => process.stdout.write(m.buildCatalogEntryRequest(process.argv[1]).user))" <Name>
   ```

   Then write **one** catalog bullet grounded strictly in that text — invent no behavior. Match the
   existing style exactly:

   ```
   - **<Name>** — one sentence describing what it is; a short usage hint.
   ```

   Add it to `tools/claude-plugin/skills/jsvision/references/component-catalog.md` under the
   `## New — needs categorization` heading (create that heading at the end of the file if it is not
   there yet). The reviewer re-files it into the right section — section placement is human editorial
   judgment, not something to guess here.

4. **Verify and hand off for review:**

   ```bash
   yarn verify
   ```

   When `check-plugin: PASS`, show the developer the `git diff` and the drafted bullets so they can
   read the prose for accuracy and re-file it. **Never commit** — the human approves and commits.

## Notes

- The AI only drafts the one-sentence catalog bullet; the deterministic detector and the snippet fix
  never call a model. The barrel-coverage gate then confirms the bullet exists, and you confirm it is
  accurate.
- For a fully automated, key-based path (an Anthropic API call instead of in-session drafting), see
  `yarn plugin:sync` and `tools/claude-plugin/README.md` → "Enabling automated sync".
