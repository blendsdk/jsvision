# @jsvision/docs-site

The JSVision documentation & showcase website, built with [VitePress](https://vitepress.dev). This
package is **private and dev-only** — it is never published and never enters any shipped package's
dependency graph.

## Local development

From the monorepo root:

```bash
yarn docs:dev     # start the dev server (hot reload)
yarn docs:build   # production build → packages/docs-site/.vitepress/dist
```

Or from this package:

```bash
yarn dev          # vitepress dev
yarn vp:build     # vitepress build  (deliberately NOT named `build`)
yarn preview      # serve the built site locally
```

> The build script is named `vp:build`, not `build`, so `turbo run build` (and therefore
> `yarn verify`) skips this package entirely — the docs site is isolated from the shipped-package
> pipeline. It builds only via `yarn docs:build` and the docs CI workflow.

After a build, validate the output:

```bash
node packages/docs-site/scripts/check-docs-build.mjs
```

## Deployment

Deployment is automated by `.github/workflows/docs.yml` and serves from the **`gh-pages` branch**:

- **Production** — every push to `master` that touches the site publishes to the branch root, live at
  `https://blendsdk.github.io/jsvision/`.
- **PR previews** — every pull request publishes a live preview to `/pr-preview/pr-<N>/` and comments
  the URL; the preview is removed when the PR closes.

No stored secret is needed — the workflow uses the ephemeral `GITHUB_TOKEN`.

### One-time setup (required before the first deploy)

In the GitHub repository settings:

1. **Settings → Pages → Build and deployment → Source** = **Deploy from a branch**.
2. Branch = **`gh-pages`**, folder = **`/ (root)`**. Save.
3. Enable **Enforce HTTPS**.

The `gh-pages` branch is created automatically by the first successful `master` deploy. Until Pages is
enabled as above, the workflow still runs and pushes the branch, but the site will not be served.

> Fork PRs get a read-only `GITHUB_TOKEN`, so preview deploy/comment is skipped for forks —
> internal branches get previews. This is acceptable for this repository's flow.
