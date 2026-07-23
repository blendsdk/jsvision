# App archetypes

Each subdirectory here is an **archetype** — a starting point `/jsvision-new-app` can scaffold from
with `--template <name>`. The scaffolder auto-discovers them, so adding one needs **no code change**.

```
/jsvision-new-app my-app --template grid
/jsvision-new-app --list          # show every archetype and its description
```

The default (no `--template`) is `basic` — the plain starter in `../app-skeleton/`.

## How an archetype works

Every generated app shares one base skeleton (`../app-skeleton/`): `package.json`, `tsconfig.json`,
`vitest.config.ts`, and a headless smoke test. An archetype **overlays** its own version of one or
more of those files on top of the base — in practice just `main.ts.tmpl`, the starter UI.

## Add a new archetype

1. Create a directory named for the archetype (the slug users pass to `--template`):
   `plugins/jsvision-plugin/templates/archetypes/<name>/`.
2. Add **`main.ts.tmpl`** — the starter source. It must export `buildApp(): Application` (so the
   shared smoke test can mount it headlessly) and auto-run only when executed directly. Use the tokens
   `__SLUG__` (the app's package slug) and `__UIDEP__` (the `@jsvision/ui` dependency specifier); the
   scaffolder substitutes them. Copy an existing archetype's `main.ts.tmpl` as a starting point.
3. Add **`about.txt`** — a one-line description shown by `--list`.
4. Keep it clean: compose the UI with the `col`/`row`/`stack` DSL (not absolute rects), follow the
   gotchas, and run `yarn doctor` on the generated app — a shipped archetype must be footgun-free.

That's it. The next `--list` shows it, and `--template <name>` scaffolds from it.
