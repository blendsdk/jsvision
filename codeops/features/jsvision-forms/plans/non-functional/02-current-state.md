# Current State: Non-Functional (RD-04)

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

`@jsvision/forms` shipped RD-01/02/03 and is a real, building workspace package. The reconciliation
below is grounded in a 2026-07-15 recon of the actual tree.

- **Package & deps (FR-4.1) — DONE.** `packages/forms/package.json` declares `dependencies:
  { "@jsvision/ui": "0.2.0" }`, `peerDependencies: { "zod": "^4" }`, `devDependencies: { …, "zod":
  "^4.4.3" }`, ESM (`"type": "module"`), single `exports` barrel. `yarn workspace @jsvision/forms
  check:deps` → `OK — no native runtime dependencies`.
- **Barrel surface (FR-4.2) — DONE (untested).** `packages/forms/src/index.ts` exports exactly
  `createForm`, `bindField`, `bindRadio`, `bindCheck`, `FormFieldError`, and the types `Form`,
  `Field`, `CreateFormOptions`. No internal helper leaks. No test currently locks this surface.
- **Docs (FR-4.7) — DONE.** `yarn workspace @jsvision/forms check:docs` → `8 files · 0 banned refs ·
  0 missing @example`.
- **Tests (FR-4.5) — partial.** `packages/forms/test/` holds `store.{spec,impl}`,
  `validation.{spec,impl}`, `adapters.{spec,impl}`, `bind-field.{spec,impl}`, `security.impl`,
  `fixtures.ts`. Coverage is broad but has **not** been audited criterion-by-criterion against the
  RD-01/02/03 acceptance lists.
- **Security (FR-4.3) — partial.** `security.impl.test.ts` pins the store contract: a control-byte
  value round-trips byte-for-byte as opaque data. Its own doc-comment states "the store never
  renders" — so the **render-path** assertion FR-4.3's AC calls for is not present.
- **Kitchen-sink story (FR-4.6) — MISSING.** `packages/examples/kitchen-sink/stories/` has 41
  stories; **none** is a forms story. `stories/index.ts` has no forms entry. `packages/examples/
  package.json` depends on neither `zod` nor `@jsvision/forms`.

### Relevant Files

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `packages/examples/kitchen-sink/stories/forms.story.ts` | The `forms/*` showcase story | **Create** |
| `packages/examples/kitchen-sink/stories/index.ts` | Story registry | Register `formsStory` |
| `packages/examples/package.json` | Examples deps | Add `zod` + `@jsvision/forms` |
| `packages/examples/test/kitchen-sink.smoke.spec.test.ts` | Showcase smoke gate | Add a per-story ST for `forms/form` |
| `packages/forms/test/security.spec.test.ts` | Render-path security oracle | **Create** |
| `packages/forms/test/surface.impl.test.ts` | Barrel-surface lock | **Create** |
| `packages/forms/test/*.spec.test.ts` | Existing spec oracles | Add cases **only** for genuinely-uncovered ACs |

### Code Analysis

- **Story contract** (`packages/examples/kitchen-sink/story.ts`): a `Story` is `{ id, category,
  title, blurb, rd?, build(ctx) }`; `build(ctx)` returns a `Group` of absolutely-positioned children
  via `at(view, x, y, w, h)` within `ctx.width × ctx.height`. The smoke test mounts each story with
  a real `RenderRoot` and asserts the buffer is non-empty. Reference stories: `input.story.ts`
  (`new Input({ value })` + `Label`), `radiogroup.story.ts` (`bindRadio` target shape),
  `checkgroup.story.ts` (`bindCheck` target shape), `button.story.ts` (`onClick`), `switch.story.ts`.
- **Binding APIs** (from RD-03, all shipped): `new Input({ value: field.value })` and `new Switch({
  value: field.value })` bind directly; `bindRadio(field, options): Signal<number>` feeds
  `RadioGroup`; `bindCheck(field, options): Signal<boolean[]>` feeds `CheckGroup`; `bindField(field,
  view)` wires touched-on-first-blur for any view.
- **Render harness** (from `kitchen-sink.smoke.spec.test.ts`): `@jsvision/ui` exports
  `createRoot`, `createRenderRoot`; a mounted view's buffer is read via `rr.buffer().rows()`, each
  cell exposing `.char`. This is the exact harness the render-path security test reuses.

## Gaps Identified

### Gap 1: No kitchen-sink story (FR-4.6) — NON-NEGOTIABLE
**Current:** no `forms/*` story exists; examples can't import forms/zod.
**Required:** a live multi-field form story, registered, passing the headless smoke test.
**Fix:** create `forms.story.ts` (see `03-01`), register it, add the two deps.

### Gap 2: Render-path sanitization is unproven (FR-4.3)
**Current:** only the store round-trip is tested; nothing renders a control-byte value.
**Required:** a passing test proving a control-byte value cannot escape sanitization on render.
**Fix:** add `security.spec.test.ts` (see `03-02 §Render-path security`).

### Gap 3: No per-AC spec-coverage traceability (FR-4.5)
**Current:** broad suites, but no proof every RD-01/02/03 AC has a spec test.
**Required:** each AC maps to a passing spec test; genuine gaps filled.
**Fix:** the audit in `07` + `03-02 §Coverage audit`.

### Gap 4: Barrel surface unlocked (FR-4.2)
**Current:** the surface is correct but nothing guards against accidental additions.
**Fix:** `surface.impl.test.ts` asserting exact runtime keys (see `03-02 §Surface lock`).

## Dependencies

### Internal
- `@jsvision/ui` (`Input`/`Switch`/`RadioGroup`/`CheckGroup`/`Button`/`Label`/`createRenderRoot`) — built.
- `@jsvision/forms` public barrel — shipped.

### External
- `zod` (`^4`) — a pure-JS peer dep of forms; must also be a dep of `packages/examples` for the story.

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Adding `@jsvision/forms` to examples introduces a build-order/workspace cycle | Low | Med | examples already imports `@jsvision/ui` by name; forms is a leaf consumer of ui — no cycle. Run `yarn install` + `yarn build` early (Phase 1 task). |
| `z.coerce.number()` on empty `''` coerces to `0`, passing/failing `.gte(1)` unexpectedly | Low | Low | Intended: `''` → `0` fails `.gte(1,'Port ≥ 1')`, so an empty port is invalid — exactly the demo's teaching point. Pinned by the story smoke + a validation note. |
| Render-path test asserts on the wrong buffer cell shape | Low | Med | Reuse the exact `rr.buffer().rows()` / `cell.char` access the smoke test already uses (grounded in `kitchen-sink.smoke.spec.test.ts`). |
| The audit surfaces a real uncovered AC late | Med | Low | The audit is an explicit early task (Phase 3) with its own fill-the-gap sub-tasks; spec-first ordering applies to any new case. |
