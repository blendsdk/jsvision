# Current-State Analysis — form-store

Grounded reading of the code this plan builds on. Every claim cites a file/line verified during
planning.

## Reactive core (the store's substrate)

- **Barrel re-export.** `@jsvision/ui` re-exports the whole reactive core: `packages/ui/src/index.ts:42`
  `export * from './reactive/index.js'`. So forms imports `signal`, `computed`, `batch`, `untrack`,
  `createRoot` from `@jsvision/ui`.
- **`signal<T>()`** — a callable getter with `.set(v)` / `.update(fn)` / `.peek()`
  (`packages/ui/src/reactive/types.ts`, `Signal<T>`). No `.subscribe`; reactivity flows through
  `computed`/`effect`/`View.bind`.
- **`computed(fn)`** — **lazy + memoized** (`packages/ui/src/reactive/computed.ts`): body runs on first
  read, caches, recomputes on the next read after a dependency changes, and only notifies observers
  when the derived value actually changes. Perfect for the validation result feeding many readers.
- **⚠️ Owner requirement (drives PA-1).** `computed`/`effect` created **outside** an owner scope
  "still works but is never auto-disposed and emits a one-time dev warning"
  (`packages/ui/src/reactive/owner.ts:20-33`, `attachComputation` → `devWarn`). So an owner-less
  `createForm` would warn on every call.
- **`createRoot<T>(fn: (dispose) => T): T`** (`packages/ui/src/reactive/owner.ts`) — runs `fn` under a
  fresh child scope (parented to the ambient owner, or detached at module scope) and returns `fn`'s
  result. **PA-1 fix:** `createForm` builds its reactive graph inside `createRoot`, so the computeds
  are owned (no warning) and disposed with the ambient scope / GC'd at module scope. No public
  `dispose()` is exposed.
- **`batch(fn)`** — coalesces multiple writes into one propagation; used by `reset()` and
  `submit()`'s mark-all-touched.

## Zod

- **Not installed** anywhere (`grep "\"zod\"" package.json packages/*/package.json` → none;
  `node_modules/zod` absent). This plan adds `zod` as a **peer dependency** of `@jsvision/forms` and a
  **devDependency** for tests. `zod` is pure JS → `check:deps` (bans native only) stays green.
- Validation is `schema.safeParse(rawValues)` → `{ success: true, data }` | `{ success: false, error }`
  where `error.issues` is `ZodIssue[]` (each with `path`, `message`). Field names come from
  `Object.keys(initial)` — **no `schema.shape` access** (PA-5; keeps AR-2.6's no-introspection hold).

## Package scaffolding (mirror `@jsvision/files`)

- `@jsvision/files` is the closest template (`packages/files/package.json`): `"type": "module"`,
  `"sideEffects": false`, `exports` → `dist/index.{js,d.ts}`, scripts `build`/`typecheck`/`test`/
  `test:e2e`/`check:deps`/`check:docs`, deps `@jsvision/core` + `@jsvision/ui` (by version), devDeps
  `@types/node` + `vitest`. It ships `README.md`/`CHANGELOG.md`/`LICENSE`.
- `tsconfig.json` extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`
  (`packages/ui/tsconfig.json`).
- `vitest.config.ts` — the two-project split (`unit` = `*.{spec,impl}.test.ts`, `e2e` =
  `*.e2e.test.ts` single-fork with `--passWithNoTests`) (`packages/ui/vitest.config.ts`).
- Workspaces are `packages/*` (root `package.json`) → the new package is picked up automatically;
  turbo tasks `build`/`typecheck`/`test`/`check:deps`/`check:docs` fan out with no turbo.json edit
  needed (`turbo.json` defines them globally).

## Widget seams (for later RD-03, confirmed now to keep the store's value types honest)

`Input`=`Signal<string>`, `Switch`=`Signal<boolean>`, `RadioGroup`=`Signal<number>` (index),
`CheckGroup`=`Signal<boolean[]>`. `View.focusSignal(): Signal<void>` (`view.ts:136`) + `state.focused`
(`view.ts:67`) are public — the touched-wiring hooks RD-03 will use. **Not touched by this plan.**

## Implications for the plan

1. Use `createRoot` inside `createForm` (PA-1). Only computeds live in it — no effects (touched
   effects are RD-03, in the view scope). Nothing to dispose ⇒ no public `dispose()`.
2. Enumerate fields from `Object.keys(initial)`; create value + touched signals eagerly (PA-5).
3. One `computed` runs `safeParse(rawValues())`; `error`/`errors`/`isValid`/`values` derive from it.
4. Scaffold by copying the `@jsvision/files` package shape; add zod peer/dev; no turbo.json change.
