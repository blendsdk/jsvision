# Component: Package Scaffold + Store

> Implements RD-01 (store) + the RD-04 packaging subset the store needs. Register: AR-01, AR-06,
> AR-07, AR-12, AR-13, AR-14, AR-18, AR-19, AR-21; PA-1, PA-4, PA-5, PA-6.

## 1. Package scaffold (`packages/forms/`)

Mirror `@jsvision/files` (02-current-state §"Package scaffolding"):

- **`package.json`** — `"name": "@jsvision/forms"`, `"version": "0.2.0"` (lockstep-managed; matches
  every sibling), `"private": true` (private until release),
  `"type": "module"`, `"sideEffects": false`, `exports`→`dist/index.{js,d.ts}`, `engines.node ">=22"`,
  scripts `build`/`typecheck`/`test`/`test:e2e`/`check:deps`/`check:docs` (copied from the sibling —
  the unit `test` adds `--passWithNoTests` for the scaffold phase, dropped once spec tests land, since
  `vitest run --project unit` exits non-zero with no test files),
  `dependencies`: `@jsvision/ui` (workspace version); **`peerDependencies`: `{ "zod": "^4" }`**;
  `devDependencies`: `@types/node`, `vitest`, **`zod`** (for tests).
- **`tsconfig.json`** — extends `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`.
- **`vitest.config.ts`** — the two-project split (unit/e2e) copied from `@jsvision/ui`.
- **`README.md`**, **`CHANGELOG.md`**, **`LICENSE`** — minimal, matching siblings.
- No `turbo.json` change (workspace `packages/*` + global turbo tasks pick it up automatically).

Run `yarn install` after adding zod. `check:deps` must stay green (zod is pure JS).

## 2. Module layout (`packages/forms/src/`, PA-4)

| File | Contents |
|------|----------|
| `index.ts` | Barrel — public exports only (see §7). |
| `types.ts` | `Form`, `Field`, `CreateFormOptions` interfaces (+ any helper types). |
| `errors.ts` | `FormFieldError extends Error` (PA-6). |
| `create-form.ts` | The store: field enumeration, eager signals, `createRoot`, handles, value model, dirty/reset/submit. |
| `validation.ts` | The `safeParse` computed + `error`/`errors`/`isValid`/`values` (see 03-02). |

## 3. Public types (`types.ts`)

```ts
import type { Signal } from '@jsvision/ui';
import type { z } from 'zod';
import type { ZodIssue } from 'zod';

export interface Field<T> {
  readonly name: string;
  readonly value: Signal<T>;
  error(): ZodIssue | null;
  touched(): boolean;
  dirty(): boolean;
}

export interface Form<S extends z.ZodObject<any>, I> {
  field<K extends keyof I>(name: K): Field<I[K]>;
  values(): z.output<S> | null;
  rawValues(): I;
  errors(): ZodIssue[];
  isValid(): boolean;
  dirty(): boolean;
  submit(onValid: (values: z.output<S>) => void | Promise<void>): Promise<boolean>;
  reset(): void;
}

export interface CreateFormOptions<S extends z.ZodObject<any>, I extends Record<keyof z.output<S>, unknown>> {
  schema: S;
  initial: I;
}
```
`I` carries the **raw** editing types (from `initial`), keys constrained to the schema (AR-18).

## 4. `FormFieldError` (`errors.ts`, PA-6)

```ts
export class FormFieldError extends Error {
  constructor(public readonly field: string) {
    super(`Unknown form field "${field}"`);
    this.name = 'FormFieldError';
  }
}
```

## 5. Store construction (`create-form.ts`)

```ts
export function createForm<S extends z.ZodObject<any>, I extends Record<keyof z.output<S>, unknown>>(
  options: CreateFormOptions<S, I>,
): Form<S, I> {
  return createRoot(() => buildForm(options));   // PA-1: owned computeds, no warning, no dispose exposed
}
```

`buildForm` internals:

1. **Baseline snapshot (PA-6).** `const baseline = snapshot(options.initial)` — a shallow copy with
   array values copied, so `reset()`/`dirty()` compare against an immutable original.
2. **Field enumeration (PA-5).** `const names = Object.keys(options.initial)`. For each name, eagerly
   create `value = signal(options.initial[name])` and `touched = signal(false)`. Store them in maps
   keyed by name. No `schema.shape` access.
3. **Field handles (AR-21).** A `Map<string, Field>` memoizes one handle per name; `field(name)`
   returns the cached handle or **throws `FormFieldError`** if `name ∉ names` (AR-19). `field.value`
   returns the stored value signal (same reference — two-way, AR-01). `error()`/`touched()`/`dirty()`
   read the derivations (03-02) / the touched signal / the dirty check.
4. **`submitAttempted = signal(false)`** — the submit-attempted flag the requirements mandate reset
   clears (RD-01 FR-1.8 / AR-13). It is **internal and latent this slice**: `submit()` sets it,
   `reset()` clears it, and nothing reads it (it does not gate `error()`). Keep it minimal — **no
   public accessor** — until its consumer (reveal-after-submit gating, a deferred slice) exists. The
   code carries a short plain-language comment noting it is intentionally write-only for now (no plan/
   requirement IDs in shipped code).

## 6. Store behavior

- **`rawValues()` (AR-06)** → `Object.fromEntries(names.map(n => [n, valueOf(n)()]))` as `I` — live,
  always available. `field.value` reads subscribe the caller.
- **`dirty()` (AR-12)** — `field.dirty()` = `!eq(value(), baseline[name])`; `form.dirty()` = any field
  dirty. `eq` = `Object.is` for non-arrays, element-wise (`length` + `Object.is` per index) for arrays.
  Values are **replaced** (never mutated in place), so comparing to `baseline` is correct.
- **`reset()` (AR-13)** — in one `batch()`: set each `value` back to `baseline[name]`, set each
  `touched` to `false`, set `submitAttempted` to `false`.
- **`submit(onValid)` (AR-07)** —
  1. `batch(() => names.forEach(n => touchedOf(n).set(true)))` + `submitAttempted.set(true)` (mark all).
  2. If `!isValid()` → `return false` (resolved). `onValid` is **not** called.
  3. Else `const v = values()!; await onValid(v); return true`. A sync `onValid` resolves immediately.
  - Signature returns `Promise<boolean>` (PA / AR-07 forward-compat); `submitting()` not exposed.
- **`values()` / `isValid()` / `errors()`** — delegate to 03-02.

## 7. Public surface (`index.ts`)

```ts
export { createForm } from './create-form.js';
export { FormFieldError } from './errors.js';
export type { Form, Field, CreateFormOptions } from './types.js';
```
(`bindField`/`bindRadio`/`bindCheck` are RD-03 — not exported here.)

## 8. Docs (RD-04 FR-4.7)

`createForm`, `Form`, `Field`, `FormFieldError`, `CreateFormOptions` each get JSDoc with a purpose
sentence, params/returns, gotchas (e.g. the `z.coerce` constraint on the schema; `initial` is the raw
shape), and a copy-pasteable `@example`. No CodeOps/TV/C++ IDs in shipped code. `check:docs` passes.

## Acceptance (maps to ST-01…ST-10)

- [ ] Package builds/typechecks; `check:deps` green; core/ui stay zero-dep.
- [ ] `field.value` is the store-owned signal (writes flow to `rawValues()`); handles are stable (ST-01/02).
- [ ] `rawValues()` always current (ST-03); `dirty`/`reset` correct incl. arrays (ST-05/06).
- [ ] `submit` marks all touched, `false` on invalid without calling `onValid`, `true` after awaiting
      `onValid(coerced)` on valid (ST-08).
- [ ] `field('unknown' as never)` throws `FormFieldError` (ST-09).
- [ ] No dev warning on `createForm`; no `dispose` on the public surface (ST-10).
