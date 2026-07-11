# 03-03 — The `yarn plugin:sync` API path + the disabled CI workflow

> The automatable path (FR-3b) + the CI-ready-but-disabled workflow (FR-5). The Anthropic call sits
> behind an injected client seam so tests never hit the network (AR-7, AR-10).

## The injected client seam (AR-7, AR-10)

`plugin-sync.mjs` gains an AI branch that, for each `undocumented-widget` finding, builds the request
(03-02) and calls a **client interface**, not the SDK directly:

```js
/** @typedef {{ draft(request: { system: string, user: string }): Promise<string> }} DraftClient */

/**
 * Draft + apply catalog entries for undocumented widgets.
 * @param {DriftFinding[]} findings
 * @param {DraftClient} client  injected — the real Anthropic client in prod, a fake in tests
 */
export async function fixUndocumentedWidgets(findings, client) {
  const done = [];
  for (const f of findings) {
    if (f.kind !== 'undocumented-widget') continue;
    const req = buildCatalogEntryRequest(f.name);
    const bullet = normalizeBullet(await client.draft(req)); // trim to one grounded bullet line
    writeFileSync(CATALOG, applyCatalogEntry(readFileSync(CATALOG, 'utf8'), bullet, req.target.afterHeading));
    done.push(f.name);
  }
  return done;
}
```

- **Real client** (`scripts/plugin-sync-anthropic.mjs`): a thin adapter wrapping `@anthropic-ai/sdk`
  (`new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`) that maps `{system,user}` → a
  `messages.create` call and returns the text. Constructed only in the guarded `main()` when the AI
  path runs — never imported by tests.
- **Fake client** (test): `{ draft: async () => '- **Ghost** — a test widget; `new Ghost()`.' }` →
  the spec asserts the entry is written and barrel-coverage passes, with zero network. (ST-6, ST-7)
- After drafting, `main()` runs (or instructs) `yarn verify`; on green it leaves the change unstaged
  (local) or the CI job opens a PR (below). No auto-commit (AR-13).

## `@anthropic-ai/sdk` dependency (AR-9)

Add `@anthropic-ai/sdk` to the **root** `devDependencies` (the tooling scope). It is pure-JS (no
native binaries) so `yarn check:deps` — which only fails on native runtime deps in the public/SDK
packages — is unaffected (ST-10). It never appears in any `packages/*/package.json`.

## The disabled CI workflow (FR-5, AR-8)

`.github/workflows/plugin-self-sync.yml`:

```yaml
name: plugin-self-sync (disabled — manual only)
on:
  workflow_dispatch: {}      # NEVER auto-fires; no push/schedule trigger in v1
jobs:
  draft:
    if: ${{ false }}         # hard-off until explicitly enabled (see README)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with: { node-version: 22, cache: yarn }
      - run: yarn install --frozen-lockfile
      - run: yarn plugin:sync --fix           # deterministic first (no key)
      # - run: yarn plugin:sync               # AI path — needs ANTHROPIC_API_KEY (not wired in v1)
      # - run: yarn verify
      # - uses: peter-evans/create-pull-request@v6   # opens a PR a human approves
```

- **References no secret** in v1 (the `ANTHROPIC_API_KEY` line is commented); `ci.yml`'s secret-free
  guarantee holds. The `if: ${{ false }}` + `workflow_dispatch`-only makes it inert even if triggered.
- A `tools/claude-plugin/README.md` section **"Enabling automated sync"** documents the exact steps:
  add the repo secret, uncomment the AI + verify + PR steps, choose a real trigger. (ST-9)

## Governance recap (AR-13)

Local script and CI both stop at a reviewable artifact — an unstaged diff or a PR. The model drafts;
`yarn verify` gates; a human approves. The AI is never on the blocking verify path and never commits.

## Files

- **Edit** `scripts/plugin-sync.mjs` — `fixUndocumentedWidgets(findings, client)` + `normalizeBullet`;
  wire the AI branch into `main()` behind the real adapter.
- **New** `scripts/plugin-sync-anthropic.mjs` — the real `DraftClient` adapter over `@anthropic-ai/sdk`.
- **New** `.github/workflows/plugin-self-sync.yml` — the disabled, secret-free workflow.
- **Edit** root `package.json` — add `@anthropic-ai/sdk` to `devDependencies`.
- **Edit** `tools/claude-plugin/README.md` — the "Enabling automated sync" section.
