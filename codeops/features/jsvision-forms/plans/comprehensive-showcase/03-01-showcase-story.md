# 03-01 — Component: `forms-showcase.story.ts`

> **Implements**: jsvision-forms/RD-05 · satisfies AC-1…9 ([01](01-requirements.md))
> Code anchors verified in [02-current-state.md](02-current-state.md); grounding is not restated here.

One new file, `packages/examples/kitchen-sink/stories/forms-showcase.story.ts`, exporting
`formsShowcaseStory: Story` (`id: 'forms/showcase'`, `category: 'Forms'`, `title: 'Comprehensive
showcase'`, `rd: 'RD-05'`). Registered by one import + one array entry in `stories/index.ts`.

## Schema + form

Reuse the RD-04 server-connection shape and add one async-validated field so both validation modes
live in one form:

```ts
const schema = z.object({
  name: z.string().min(1, 'Required'),
  host: z.string().min(1, 'Required'),                 // async-validated for availability
  port: z.coerce.number().int().gte(1, 'Port ≥ 1').lte(65535, 'Port ≤ 65535'),
  tls: z.boolean(),
  mode: z.enum(['Dev', 'Staging', 'Prod']),
  features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
});
// initial carries RAW editing types (port edited as text; features annotated so bindCheck infers exactly)
const form = createForm({
  schema,
  initial: { name: '', host: '', port: '', tls: false, mode: 'Dev',
             features: [] as Array<'Logs' | 'Metrics' | 'Tracing'> },
  asyncValidators: {
    host: async (value, { signal }) => {            // AC-6a — simulated availability (copy sleep() idiom)
      await sleep(500, signal);
      return TAKEN.has(value.toLowerCase()) ? 'Already in use' : null;   // TAKEN = new Set(['db-primary','localhost'])
    },
  },
  asyncDebounceMs: 300,
});
```

Bind with the shipped seams (AC-2): `new Input({ value: field.value })` for text; `bindRadio(modeField,
[...])` / `bindCheck(featuresField, [...])`; `new Switch({ value: tlsField.value, ... })`;
`bindField(field, widget)` on every field for touched-on-first-blur.

## Layout — the `col`/`row` DSL frame (AC-2, AC-5)

Top-level: a `row` splitting **form (grow)** │ **inspector (fixed ~26)**, wrapped in a `col` under a
header row and above the action/hint rows. Place the DSL frame with the merge-absolute-rect trick
(`layout-dsl.story.ts:64-71`) at `{ x:1, y:0, width: Math.max(64, ctx.width-2)-? , height: ... }` —
compute from `ctx`. The frame reflows for free (AR-PL8).

### Field rows + the errors right/below toggle (AC-5, AR-PL5)

The toggle is a `RadioGroup({ labels: ['~r~ight', '~b~elow'], value: errPlace })` where `errPlace`
is a domain-value signal over `'right' | 'below'` (a plain `signal('right')` bound via the group's
`value`, or a small index↔domain lens). **Design decision — two error slots, no reactive
re-parenting** (rejected the "rebuild the DSL subtree in an effect" alternative as fragile with
focus/layout invalidation; rejected "two full duplicate forms" as heavier):

For each field, build **one** field row plus **two** error `Text` slots that share a single
touched-gated getter but self-blank by mode:

```ts
const errRight = (f) => new Text(() => (errPlace() === 'right' ? issueMsg(f) : ''));
const errBelow = (f) => new Text(() => (errPlace() === 'below' ? issueMsg(f) : ''));
// issueMsg(f) = f.touched() && f.error() ? f.error()!.message : ''
```

- **right** arrangement: `row({ gap: 1 }, fixed(label, 10), fixed(widget, 22), grow(errRight(f)))`.
- **below** arrangement: the same `row(label, widget)` with `errBelow(f)` placed on the next line.

Both slots exist in the static DSL tree; only the mode-matching one is ever non-empty, so the error
visibly moves right↔below when the toggle flips — a real DSL reflow with zero re-parenting. `host`
also shows a `checking…` / async-error line (reuse `forms/async` idiom) in its right/below slot area.

## State inspector panel (AC-3)

A `fixed`-width right column (a titled `Group` or a stack of `Text` rows) with one reactive `Text`
per line:

```ts
new Text(() => `isValid : ${form.isValid()}`)
new Text(() => `dirty   : ${form.dirty()}`)
new Text(() => `validating: ${form.validating()}`)
new Text(() => `loading : ${form.loading()}`)
new Text(() => `errors  : ${form.errors().length}`)
new Text(() => `values  : ${form.isValid() ? JSON.stringify(form.values()) : '— (invalid)'}`)
new Text(() => `raw     : ${JSON.stringify(form.rawValues())}`)
```

Long `raw`/`values` lines are clipped by the panel width — acceptable for a live inspector (the
narrow lines above carry the primary signals). A `'State inspector'` caption sits at its top.

## Amber advisory (AC-4, AR-PL4)

A single reactive `Text` styled amber, self-blanking unless the port is a valid privileged port:

```ts
const advisory = new Text(() => {
  const p = Number(portField.value());                 // raw is a string; Number('') = 0 → no advisory
  return Number.isInteger(p) && p >= 1 && p < 1024 ? '⚠ privileged port — needs elevated rights' : '';
}, { severity: 'warning' });
```

No engine change — this is app-level advisory text computed from the raw value (AR-PL7), the exact
pattern the roadmap mandated ("amber, no engine change").

## Actions row (AC-6, AC-7)

- **Submit** (`default: true`): `onClick: () => void form.submit((v) => outcome.set('✓ ' + JSON.stringify(v)))`
  — the gate reveals all errors on invalid, echoes coerced values on valid (AC-7).
- **Load defaults**: `disabled: () => form.loading()`; `onClick` runs `form.load(loadRecord)` where
  `loadRecord = async ({ signal }) => { await sleep(500, signal); return { name:'api', host:'db-primary',
  port:'443', tls:true, mode:'Prod', features:['Logs'] }; }` → `Loading…` via `form.loading()` →
  pristine rebase (AC-6b). (Loaded `host:'db-primary'` also demos the async "Already in use" verdict.)
- **Open as dialog…**: guarded by `ctx.execView === undefined` (headless degrade → set a hint into the
  outcome echo). Live: build the **no-op-desktop host shim verbatim** from `forms-dialog.story.ts:38-47`
  and `void formDialog(host, { schema: dialogSchema, initial, title:' Edit server ', width, height,
  body })` (AC-6c). Use a small 2-field dialog schema (`name`+`port`) so the modal fits; `.then` echoes
  the result.

## Headless degrade + always-painted hint (AC-8, AR-PL8)

An always-painted hint `Text` (never reactive-blank) below the frame carries the demonstration
literals so the 72×16 smoke oracle finds them even when the live advisory/dialog don't paint:

```
'Edit fields · errors reveal on blur · toggle Errors: right/below · port <1024 warns · Load defaults · Open as dialog…'
```

This guarantees ST-SS1's matches (`/showcase|inspector/`, `/right/`, `/below/`, `/privileged|<1024/`)
regardless of live state — mirroring `forms/async`'s `checking…` hint.

## Docs

Module JSDoc lead + a `build`-level `@example` (find the story in `STORIES`, call `build`), matching
the sibling stories. No process IDs in code comments (the `rd` field is data).

## Risks / notes

- **Canvas fit** (AR-PL8): on an 80-col terminal the shell hands ~54 cols. The `grow`/`fixed` split
  keeps the form usable; the inspector clips gracefully. The smoke canvas (72) is comfortable.
- **Two-slot toggle** is deliberately not a reactive re-parent — keep both slots in the static tree.
- **File size**: aim ≤ ~400 lines; if it drifts over, extract the field-row builder + the inspector
  builder into local helpers (no new file needed).
