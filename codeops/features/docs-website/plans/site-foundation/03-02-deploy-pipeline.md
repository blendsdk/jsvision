# 03-02 · GitHub Pages Delivery Pipeline

> **Document**: 03-02-deploy-pipeline.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-01 Must-Haves 2, 3, 4 (production deploy + live PR previews)
> **CodeOps Skills Version**: 3.3.2

## Model (AR-1)

GitHub Pages serves from **one** source. To get live per-PR preview URLs, Pages serves from the
**`gh-pages` branch**: production is published to the branch root; each PR is published to
`/pr-preview/pr-N/` and removed on close. This is a single coherent branch-deploy model (not the
official Actions-artifact model, which allows only one environment).

**One-time manual prerequisite:** repo Settings → Pages → Source = "Deploy from a branch" →
`gh-pages` / root. HTTPS enforced. (Documented as a deploy checklist item; no secret required —
the workflow uses the ephemeral `GITHUB_TOKEN`.)

## New workflow: `.github/workflows/docs.yml`

Does **not** touch the existing `ci.yml`.

**Triggers**
- `push` to `master` on site inputs (`packages/docs-site/**`, `docs/**`, `.github/workflows/docs.yml`)
  → production deploy.
- `pull_request` (opened/synchronize/reopened/closed) on the same paths → preview deploy / cleanup.

**Permissions**: `contents: write` (to push the `gh-pages` branch), `pull-requests: write` (to comment
the preview URL). No stored secret; `GITHUB_TOKEN` only (ST — security).

**Concurrency**: `group: pages-${{ github.ref }}`, cancel superseded runs.

### Production job (on `master`)
1. `actions/checkout`.
2. `actions/setup-node` (Node 22) + yarn cache; `yarn install --frozen-lockfile`.
3. `yarn docs:build` → `packages/docs-site/.vitepress/dist`.
4. `peaceiris/actions-gh-pages@v4` (pinned): publish `dist` to the `gh-pages` branch **root**,
   `keep_files: true` so it does not delete existing `/pr-preview/*` dirs.

### PR preview job (on `pull_request`)
1–3. checkout / node / install / `yarn docs:build` (only when the event is not `closed`).
4. `rossjrw/pr-preview-action@v1` (pinned): deploy `dist` to `/pr-preview/pr-${{ number }}/` on the
   `gh-pages` branch and comment the live URL on the PR; on `closed`, remove that dir.

> Note: for a fork PR the `GITHUB_TOKEN` is read-only, so preview deploy/comment is skipped for
> forks (documented limitation — internal branches get previews). Acceptable for this repo's flow.

## Base-path correctness

Because production lives at `…/jsvision/` and previews at `…/jsvision/pr-preview/pr-N/`, `base` must
resolve correctly in both. `base:'/jsvision/'` is correct for production; the pr-preview-action serves
the built site under the preview subpath and VitePress's relative asset resolution handles the
nested path. Verified by opening a preview URL (deploy-phase acceptance, ST-2/ST-3 are the local
build-output proxies).

## Verification

- Local proxy (CI-testable now): ST-1/ST-2 assert `yarn docs:build` output + base prefixing.
- Live (manual, one-time after Pages is enabled): merge to `master` → site 200 at the Pages URL;
  open a PR → a preview URL is commented and serves the changed page. Recorded in the execution plan
  as an explicit acceptance step (not a unit test — a deploy is not unit-testable).
