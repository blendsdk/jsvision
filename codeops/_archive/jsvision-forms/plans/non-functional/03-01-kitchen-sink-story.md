# Kitchen-Sink Story: Non-Functional (RD-04)

> **Document**: 03-01-kitchen-sink-story.md
> **Parent**: [Index](00-index.md)

## Overview

The NON-NEGOTIABLE `forms/*` showcase story (RD-04 FR-4.6). One live, self-contained demo that
exercises **every** binding path the forms engine ships — direct text, coerced-number text, `Switch`,
`bindRadio`, `bindCheck` — with touched-gated error reveal, a `valid · dirty` bound-state echo, and a
submit-gated button. It follows the standard `Story` contract so it slots into the registry with one
file + one registry line, and passes the headless smoke test with no TTY.

## Architecture

### Current Architecture
No forms story exists (`02 §Gap 1`). The registry (`stories/index.ts`) aggregates `Story` objects
explicitly; the shell owns all chrome; a story only returns a `Group` of absolutely-positioned
children (`packages/examples/kitchen-sink/story.ts`).

### Proposed Changes
Add `packages/examples/kitchen-sink/stories/forms.story.ts` exporting `formsStory: Story`, register
it in `stories/index.ts`, and add `zod` + `@jsvision/forms` to `packages/examples/package.json`.

## Implementation Details

### Story metadata

| Field | Value |
| ----- | ----- |
| `id` | `forms/form` |
| `category` | `Forms` |
| `title` | `Form` |
| `rd` | `RD-04` |
| `blurb` | `createForm + Zod: live validation, touched-on-blur errors, a submit-gated button, a bound valid · dirty echo.` |

### Story spec (the form) *(AR-P5)*

Schema and initial (raw) values:

```ts
const schema = z.object({
  name: z.string().min(1, 'Required'),
  port: z.coerce.number().int().gte(1, 'Port ≥ 1').lte(65535, 'Port ≤ 65535'),
  tls: z.boolean(),
  mode: z.enum(['Dev', 'Staging', 'Prod']),
  features: z.array(z.enum(['Logs', 'Metrics', 'Tracing'])).min(1, 'Pick one'),
});
const form = createForm({
  schema,
  initial: { name: '', port: '', tls: false, mode: 'Dev', features: [] as Array<'Logs' | 'Metrics' | 'Tracing'> },
});
```

> **Empty-array initial — annotate the element type.** `features: []` is cast to
> `Array<'Logs' | 'Metrics' | 'Tracing'>` so `form.field('features')` types as
> `Field<Array<'Logs'|'Metrics'|'Tracing'>>` and `bindCheck`'s domain inference stays exact. A bare
> `[]` would infer a degenerate element type (`never[]`/`any[]`); the shipped `adapters.spec.test.ts`
> casts the same way. The string/boolean fields (`name`, `port`, `mode`, `tls`) need no cast.

Widget wiring (every path exercised):

| Field | Widget | Binding |
| ----- | ------ | ------- |
| `name` | `new Input({ value: form.field('name').value })` | direct (RD-03 FR-3.1) |
| `port` | `new Input({ value: form.field('port').value })` | direct; schema coerces the string |
| `tls` | `new Switch({ value: form.field('tls').value, label: 'TLS', onLabel: 'On', offLabel: 'Off' })` | direct (RD-03 FR-3.1) |
| `mode` | `new RadioGroup({ labels: ['~D~ev','~S~taging','~P~rod'], value: bindRadio(form.field('mode'), ['Dev','Staging','Prod']) })` | adapter (RD-03 FR-3.3) |
| `features` | `new CheckGroup({ labels: ['~L~ogs','~M~etrics','~T~racing'], value: bindCheck(form.field('features'), ['Logs','Metrics','Tracing']) })` | adapter (RD-03 FR-3.4) |

Each field's view is wired for touched-on-blur: `bindField(form.field(name), view)` for all five
(RD-03 FR-3.2). Labels use `new Label('~N~ame', nameInput)` (mirrors `input.story.ts`).

### Error reveal (touched-gated) *(RD-02 FR-2.4)*

Beside each field, a reactive `Text` renders the first issue **only after touch**:

```ts
new Text(() => {
  const f = form.field('name');
  return f.touched() && f.error() ? f.error()!.message : '';
});
```

This demonstrates the engine's composable reveal: `error()` is always live; the app gates on
`touched()`.

### Bound-state echo + submit *(AR-P4)*

```ts
const submitted = signal('');
const echo = new Text(() => `valid: ${form.isValid()}   dirty: ${form.dirty()}`);
const submitBtn = new Button('~S~ubmit', {
  default: true,
  onClick: () => { void form.submit((v) => submitted.set(JSON.stringify(v))); },
});
const result = new Text(() => (submitted() ? `✓ Submitted: ${submitted()}` : ''));
```

- The button is always enabled; `form.submit()` **is** the gate: on invalid it marks all fields
  touched (every error reveals) and resolves `false` without echoing (RD-01 FR-1.10); on valid it
  echoes the coerced `z.output` values.
- `void` discards the returned `Promise<boolean>` (the click handler is sync); this is the documented
  submit shape (RD-01 FR-1.10).

### Layout

Absolute placement within `ctx.width × ctx.height` (like the reference stories): a titled row per
field with its label, widget, and error text; then the `valid · dirty` echo; the `Submit` button;
and the result line. Widths clamp to `Math.max(…, ctx.width - 2)` per the `input.story.ts` idiom so
narrow canvases don't clip. Exact coordinates are an execution detail; the invariant is: nothing
clipped, all five widgets + echo + button + result visible and interactive.

### Integration Points
- Imports `createForm`, `bindField`, `bindRadio`, `bindCheck` from `@jsvision/forms` (by name) and
  `Input`, `Switch`, `RadioGroup`, `CheckGroup`, `Button`, `Label`, `Text`, `Group`, `signal` from
  `@jsvision/ui`; `z` from `zod`. `at` from `../story.js`.
- Registered by adding `import { formsStory } from './forms.story.js';` and placing `formsStory` in
  the `STORIES` array (new `Forms` category grouping) in `stories/index.ts`.

## Code Examples

See `00-index.md §Usage Example` for the condensed wiring; the full story assembles the table above
into one `build(ctx)` returning the `Group`.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| User submits while invalid | `form.submit()` marks all touched, reveals every error, resolves `false`, no echo — the visible gate | AR-P4 |
| `port` left empty (`''`) | `z.coerce.number()` → `0`, fails `.gte(1)` → `field('port').error().message === 'Port ≥ 1'`; touched-gated | AR-P5 |
| `features` none selected | `z.array(...).min(1,'Pick one')` fails → `field('features').error()` | AR-P5 |

> **Traceability:** decisions trace to the Ambiguity Register (AR-P4, AR-P5). Widget/binding
> behavior is owned by RD-03; validation/reveal by RD-02; submit by RD-01.

## Testing Requirements
- The story must pass the headless smoke test (unique id `forms/form`, required metadata, mounts +
  paints ≥1 non-blank cell). A dedicated ST pins it (`07` ST-N1).
- No new store/validation/binding behavior is introduced — the story consumes shipped APIs only.
