# Testing Strategy — form-store

Specification-first: these ST oracles are written from RD-01/RD-02 (not from imagined
implementation), land as `packages/forms/test/*.spec.test.ts`, go **red**, then the implementation
makes them **green**; `*.impl.test.ts` adds internal edges afterward. A failing spec test post-impl
means the code is wrong.

Tests import `@jsvision/ui` and `zod` by name against built dist (monorepo convention). Suggested
files: `store.spec.test.ts` (ST-01…10), `validation.spec.test.ts` (ST-11…17), plus matching
`*.impl.test.ts`.

## Shared fixture

```ts
const Schema = z.object({
  name: z.string().min(1, 'Required'),
  port: z.coerce.number().int('Whole number').min(1, 'Min 1').max(65535),
  tls:  z.boolean(),
}).refine(v => !(v.tls && v.port === 23), { message: 'TLS not on 23', path: ['port'] });
const initial = { name: '', port: '8080', tls: true };
```

The `.min(1, 'Min 1')` message is a **custom author message** (not Zod's default) so ST-16 tests real
passthrough, not just "the engine didn't mangle Zod's default". (Under `zod@4` the default would be
`'Too small: expected number to be >=1'` — do not hard-code a Zod-3-style literal.)

### Additional fixtures — two oracles the shared fixture can't exercise

The shared fixture has no array field, and its `.refine` carries `path:['port']`, so:

```ts
// ST-05 — an array (check-group) field, to exercise element-wise dirty:
const ArraySchema  = z.object({ flags: z.array(z.boolean()) });
const arrayInitial = { flags: [true, false] };

// ST-13 — a PATH-LESS refine (object-level) that routes to form.errors():
const CrossSchema  = z.object({ a: z.string().min(1), b: z.string().min(1) })
  .refine(v => v.a === v.b, { message: 'a and b must match' }); // no `path` ⇒ form-level
const crossInitial = { a: '', b: '' };
```

Verified against real `zod@4`: a path-less refine fires even when a base field is invalid, so
`form.errors()` surfaces `'a and b must match'` while `field('a').error()` still reports its own issue.

## Specification test cases

| ST | Scenario | Input → Expected | Traces |
|----|----------|------------------|--------|
| ST-01 | Value model, two-way | `f.field('name').value.set('db')` → `f.rawValues().name === 'db'`; the returned signal is the store's (same ref on re-read) | AR-01 / RD-01 FR-1.4 |
| ST-02 | Stable handles | `f.field('name') === f.field('name')` | AR-21 / FR-1.5 |
| ST-03 | `rawValues()` always | before any validity, `f.rawValues()` deep-equals current raw `{name,port,tls}` | AR-06 / FR-1.6 |
| ST-04 | `values()` coerced/null | with `name:''` → `f.values() === null`; set `name:'db'` → `f.values()` deep-equals `{name:'db',port:8080,tls:true}` (`port` is a **number**) | AR-06/AR-10 / FR-1.6, RD-02 |
| ST-05 | Dirty incl. arrays | fresh form `f.field('name').dirty()===false` & `f.dirty()===false`; after `.set('x')` both `true`; a `boolean[]` field compares element-wise | AR-12 / FR-1.7 |
| ST-06 | Reset | dirty + touched a field, then `f.reset()` → values back to `initial`, `dirty()===false`, `touched()===false`, all in one propagation | AR-13 / FR-1.8 |
| ST-07 | `isValid()` pre-touch | fresh form (`name:''`) → `isValid()===false`; set `name:'db'` → `true`, without touching anything | AR-03 / FR-1.9 |
| ST-08 | Submit gate | invalid form: `await f.submit(spy)` → `false`, `spy` not called, every `touched()===true`. valid form: `await f.submit(spy)` → `true`, `spy` called once with coerced values (`port:8080` number) | AR-07 / FR-1.10 |
| ST-09 | Unknown key | `f.field('nope' as never)` throws `FormFieldError` naming the field | AR-19 / FR-1.11 |
| ST-10 | Owned, no dispose | creating a form emits **no** dev warning (spy on `console.warn`); the returned `Form` has no `dispose` property | PA-1 / FR-1.12 |
| ST-11 | Single eager validation | spy the schema's `safeParse` (wrap it); N reads of `error()`+`isValid()`+`values()` after one change ⇒ recompute count is 1 | AR-02/AR-03 / RD-02 FR-2.1 |
| ST-12 | Field error = first, live | `name:''` → `f.field('name').error()!.message === 'Required'` **before** any touch; `name:'db'` → `null` | AR-04 / FR-2.2/2.4 |
| ST-13 | Form-level (path-less) | a path-less `.refine` failure appears in `f.errors()` and in **no** field's `error()` | AR-11 / FR-2.3 |
| ST-14 | Field-routed refine | `tls:true, port:'23'` → `f.field('port').error()!.message === 'TLS not on 23'` | AR-11 / FR-2.8 |
| ST-15 | Coercion contract | `port:'42'` → `values().port === 42`; `port:'x'` → `field('port').error()` non-null & `values()===null` | AR-10 / FR-2.7 |
| ST-16 | Message passthrough | `port:'0'` → `field('port').error()!.message === 'Min 1'` (the author's custom message, surfaced verbatim) | AR-24 / FR-2.8 |
| ST-17 | Touched store-half | `submit()` sets every `field.touched()` true; `error()` returns the same value regardless of `touched()` state | AR-05 / FR-2.5 |

## Impl tests (`*.impl.test.ts`, internals & edges)

- Baseline immutability: mutating the `initial` object **after** `createForm` does not change
  `dirty()`/`reset()` behavior (defensive snapshot, PA-6).
- Array-valued field dirty edge: same elements different array reference ⇒ not dirty; different
  length ⇒ dirty.
- `submit` with an **async** `onValid` (returns a Promise) is awaited before `submit` resolves `true`.
- `submitAttempted` is internal and latent this slice (set by `submit()`, cleared by `reset()`, read
  by nothing yet), so there is **no** black-box assertion for it — it earns a test when its
  reveal-after-submit consumer lands. `reset()`'s observable effects (values + touched) are ST-06.
- `values()` non-aliasing: the coerced object is Zod's `data` (its own object), **not** the live
  `rawValues()` object — mutating it never touches the store's signals. (Two reads without a raw
  change return the same memoized `data` reference — assert non-aliasing with `rawValues`, not
  per-call freshness.)

## Non-functional checks (RD-04 subset in this plan)

- `yarn workspace @jsvision/forms check:deps` passes (zod pure JS).
- `yarn workspace @jsvision/forms check:docs` passes; every public export has an `@example`.
- Security (AR-22): a value containing control bytes stored via `field.value` is unchanged as data,
  and there is no code path that emits it unsanitized (the store never renders; documented + a unit
  assertion that the store performs no encoding/escaping of its own).

**Verify:** `yarn workspace @jsvision/forms test` per task; `yarn verify` at the phase gate.
