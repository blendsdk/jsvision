# Story Harness: Foundation

> **Document**: 03-06-story-harness.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 §"Test + story harness" · AC-9 · AR #2 (plan)
> **Files** (all under `packages/datagrid/test/`): `kitchen-sink/story.ts`, `kitchen-sink/stories/index.ts`, `kitchen-sink/stories/foundation.story.ts`, `kitchen-sink.smoke.spec.test.ts`

## Overview

An **in-package** kitchen-sink harness (AR #2, plan): a `Story` contract + a `STORIES` registry + a headless
smoke test, all under the package's `test/` tree. It gives RD-02+ a one-file-per-story extension point without
adding a `@jsvision/datagrid` dependency to `@jsvision/examples` now. It is test infrastructure — never on the
public barrel, so `check:docs` does not require an `@example`.

## Architecture

### Current Architecture

The showcase `Story` contract (`packages/examples/kitchen-sink/story.ts`) + `STORIES` registry
(`.../stories/index.ts`) + smoke test (`packages/examples/test/kitchen-sink.smoke.spec.test.ts`) live in
`@jsvision/examples`. The datagrid package does not exist yet, and adding a datagrid story there would require
examples → datagrid.

### Proposed Changes

Port a minimal `Story` contract into `packages/datagrid/test/kitchen-sink/`, register one placeholder
`foundation` story rendering the read-only `EditableDataGrid<T>`, and add a smoke test that mounts every
registered story headlessly and asserts a non-empty paint + registry hygiene — mirroring the examples smoke
oracle.

## Implementation Details

### The `Story` contract (`test/kitchen-sink/story.ts`)

A trimmed copy of the examples contract: `Story { id, category, title, blurb, rd?, build(ctx): Group }` with a
`StoryContext { caps, width, height }` and the `at(view, x, y, w, h)` placement helper. Kept datagrid-local so
RD-02+ stories follow the same one-file pattern. (The eventual merge into the shared `@jsvision/examples`
showcase — the project's non-negotiable showcase gate — is a documented later follow-up, out of RD-01 scope.)

### The registry (`test/kitchen-sink/stories/index.ts`)

`export const STORIES: readonly Story[] = [ foundationStory ];` — explicit aggregation (the examples idiom).
RD-02+ append one import + one array entry per new story.

### The placeholder story (`test/kitchen-sink/stories/foundation.story.ts`)

```ts
export const foundationStory: Story = {
  id: 'datagrid/foundation',
  category: 'DataGrid',
  title: 'Foundation (read-only)',
  blurb: 'value/format/parse columns rendered read-only over an in-memory source.',
  build(ctx) {
    // a small EditableDataGrid<Person> over fromRows(...), placed with `at(...)`.
  },
};
```

- Renders the read-only `EditableDataGrid<T>` (03-05) with a couple of `column(...)` columns and a
  `fromRows` source — a real paint, so the smoke test's non-empty assertion is meaningful.

### The smoke test (`test/kitchen-sink.smoke.spec.test.ts`)

Mirrors the examples oracle: `resolveCapabilities(...).profile` for caps; for each story, `createRoot`, build
+ `at(...)`, `createRenderRoot`, `mount`, assert `paintedCells(rr.buffer().rows()) > 0`; assert the registry is
non-empty, every story has `id`/`category`/`title`/`blurb`, and ids are unique. This file matches
`*.spec.test.ts`, so it runs in the `unit` project.

## Integration Points

- Depends on the read-only container (03-05) + `column`/`fromRows` (03-03/03-04) to have something to
  render.
- RD-02+ add stories here; when datagrid ships user-facing visual components, a story is promoted into the
  shared `@jsvision/examples` kitchen-sink (follow-up).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| A story throws on `build`/`mount` | The smoke test fails (`expect(...).not.toThrow()`) — the story is fixed | AC-9 |
| A story paints nothing | `paintedCells > 0` fails | AC-9 |
| Duplicate story id | The uniqueness assertion fails | AC-9 |
| Harness modules mistaken for tests | They are not `*.{spec,impl}.test.ts`, so vitest ignores them; `tsconfig.typecheck.json` still typechecks them | AR #2/#5 (plan) |

> **Traceability:** the in-package harness home = AR #2 (plan); AC-9 owns the smoke-test criteria.

## Testing Requirements

- Spec: the smoke test itself is the ST-12 realization (registry non-empty + metadata + unique ids + every
  story paints headlessly).
- Impl: none beyond the smoke test in RD-01 (the harness is minimal).
