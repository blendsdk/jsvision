# Component: Validation & Error Surfacing

> Implements RD-02. Register: AR-02, AR-03, AR-04, AR-05, AR-10, AR-11, AR-20, AR-24.

## 1. The single validation computed (`validation.ts`, AR-02/AR-03)

One memoized `computed` runs the whole-object parse; every derived accessor reads it, so `safeParse`
runs at most once per raw change no matter how many readers there are.

```ts
import { computed } from '@jsvision/ui';
import type { z } from 'zod';

// built inside buildForm(), after the value signals exist:
const result = computed(() => schema.safeParse(rawValues()));
// rawValues() reads every field's value signal → `result` depends on all of them → it recomputes
// on any raw change (AR-03 eager). computed() is memoized (02-current-state) and owned by the
// createRoot scope (PA-1).
```

Sync only: a schema whose `safeParse` were async is out of scope (async slice) — `safeParse` (not
`safeParseAsync`) is used, so an async refinement would surface as a Zod error, not a Promise.

## 2. Derived accessors

All read `result()` (subscribing the caller) and are pure:

- **`isValid()` (AR-03)** → `result().success`. Independent of `touched`. Live pre-touch, so an
  all-empty required form reads `false` from the start.
- **`values()` (AR-06/AR-10)** → `result().success ? result().data : null`. `data` is the coerced
  `z.output<S>` (e.g. a `z.coerce.number()` field is a `number` here). Never throws.
- **`errors()` (AR-11)** → path-less issues: `result().success ? [] : result().error.issues.filter(i => i.path.length === 0)`.
- **`field.error()` (AR-04/AR-20)** → the **first** issue for that field:
  `result().success ? null : result().error.issues.find(i => i.path[0] === field.name) ?? null`.
  Returns the `ZodIssue` verbatim (passthrough; callers read `.message`).

## 3. Cross-field & message semantics (AR-11/AR-24)

- Cross-field rules are the schema author's `.refine`/`.superRefine`. An issue carrying
  `path: ['port']` is routed to `field('port').error()` by §2's `path[0]` match; a path-less issue
  (`path: []`) is routed to `form.errors()`. The store adds no cross-field machinery of its own.
- Message text is whatever the schema produced (`z.string().min(1, 'Required')`). The engine never
  substitutes or localizes copy — `issue.message` is surfaced as-is (AR-24).

## 4. The coercion contract (AR-10) — documented, enforced by Zod

A non-string field edited as a string **must** use `z.coerce.*` (or a transform). Consequence
observed through the API:
- raw `'42'` on a `z.coerce.number()` field → `isValid()` true, `values().that === 42`.
- raw `'x'` → `result().success === false` → `field.error()` non-null, `values() === null`.
This is stated in the `createForm` JSDoc gotchas and covered by ST-15.

## 5. Touched — the store's half (AR-05)

`touched` is a per-field `signal(false)` owned by the store (03-01 §5). This plan provides:
- `field.touched()` reads the signal.
- `submit()` marks **all** touched (03-01 §6).
The **first-blur wiring** (`bindField` reading `View.focusSignal()`) is **RD-03**, a separate plan;
here the touched signals simply exist and are settable. `error()` is never gated by `touched` — the
app composes `touched() && error()` (AR-03).

## Acceptance (maps to ST-11…ST-17)

- [ ] One `safeParse` recompute per raw change drives `error`/`errors`/`isValid`/`values` (ST-11).
- [ ] `field.error()` = first `ZodIssue` by `path[0]`, else `null`, live pre-touch (ST-12).
- [ ] Path-less `.refine` issue → `form.errors()`, not any field (ST-13); `path:['x']` → `field('x')` (ST-14).
- [ ] `z.coerce.number()` coercion + failure behavior (ST-15).
- [ ] Messages surfaced verbatim from the schema (ST-16).
- [ ] `submit()` sets all touched signals; `error()` ungated by touched (ST-17).
