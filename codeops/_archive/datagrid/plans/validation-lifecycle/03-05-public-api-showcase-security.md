# Public API, Showcase & Security

> **Document**: 03-05-public-api-showcase-security.md
> **Parent**: [Index](00-index.md)

## Overview

The shipping surface: the barrel exports, the kitchen-sink story, the `datagrid-showcase`
validation-lifecycle cluster, and the security oracle. Owns AR-19 (security) and AR-21 (showcase).

## Public API (barrel, `src/index.ts`)

New exports:

- **Types:** `BeforeSave` (from `commit.ts`); `ErrorRegistry` (from `error-registry.ts`);
  `GridStatus` (from `grid-lifecycle.ts`); `RowValidation` = the `{ ok; message?; field? }` return of
  `validateRow` (named type, from `validation.ts`).
- **Functions:** `createErrorRegistry` (from `error-registry.ts`) — exported so a bespoke grid can own
  its own invalid-cell registry, mirroring `createDirtyRegistry` which is already public.
- **On `EditableDataGrid` / options:** the new options `validate` (per column, via `GridColumn`),
  `validateRow`, `beforeSave`, `status`, `emptyText` ship on the already-exported
  `EditableDataGridOptions` / `GridColumn`. No new top-level class.

Every new export carries a JSDoc `@example` (the `check-jsdoc` gate). The `column`/`EditableDataGrid`
doc comments gain the new fields' contracts. No banned CodeOps IDs in any `packages/*/src` file
(verify with a plain grep — the `check-jsdoc` scanner has a known coverage gap in `grid.ts`).

## Showcase (AR-21)

### Kitchen-sink story (RD-12 AC-7)

`packages/datagrid/test/kitchen-sink/stories/validation-lifecycle.story.ts` + one line in
`stories/index.ts`. A `build(ctx)` grid demonstrating: a column `validate` that **rejects an invalid
edit** (marked + message), a **row-gate veto** (`validateRow` blocking a row-leave with a refocus),
and a visible state echo. Passes `kitchen-sink.smoke.spec.test.ts` (mounts headlessly, unique id,
required metadata). `build(ctx)` has no loop, so the story notes lifecycle `status` as app-wired where
a loop is needed (mirroring how the RD-10 story noted `Tab` as app-wired).

### `datagrid-showcase` cluster (RD-15 living surface)

`packages/examples/datagrid-showcase/stories/validation-lifecycle/` — a shared builder + a small set
of one-per-capability demos:

1. Per-cell `validate` (reject + marker + message).
2. Per-row `validateRow` veto (block row-leave + refocus).
3. `beforeSave` veto (revert + reason) vs. `onCommit`.
4. Loading / empty / error lifecycle states with a working `retry()`.

Remove the RD-12 placeholder from `stories/placeholders.ts`; re-base the placeholder-count oracle and
add the `Validation & lifecycle` category in `stories/index.ts` +
`packages/examples/test/datagrid-showcase.smoke.spec.test.ts` (the RD-10 pattern, `99` Step 5.2.4).
The walkthrough tier (`datagrid-showcase.walkthrough.spec.test.ts`) drives every demo via
`app.loop.emitCommand` and must stay green.

## Security (AR-19, RD-12 AC-8)

The RD-12 security posture, asserted by a `.spec` oracle (`security.spec.test.ts` additions):

1. **Client validation is UX only.** Documented prominently in the `validate`/`validateRow`/`beforeSave`
   JSDoc: the authoritative gate is the caller's `onCommit`/source. The grid never treats client
   validation as sufficient for persistence.
2. **Sanitized messages.** A validation/veto/error message (or an echoed input value) containing a
   control byte (ESC, BEL, C0/C1) renders sanitized — asserted by drawing a grid whose `validate`
   returns a control-byte message and scanning the buffer for the raw bytes (the sanitize boundary at
   `draw-context.ts:108` handles it for free; the oracle proves it).
3. **No persistence bypass.** A `beforeSave`/`onCommit` veto reverts the record and calls no
   persistence; an invalid (`validate`-failed) value is never applied. Asserted with spy sinks.
4. **No `eval`/dynamic dispatch.** The new modules use no `eval`/`Function`; the package-wide no-eval
   scan (existing `security.spec`) stays green.

## Error Handling

| Case | Handling | AR |
| ---- | -------- | -- |
| A demo/story echoes malicious input | Sanitized at draw | AR-19 |
| Placeholder count drifts | The count oracle is re-based in the same commit as the cluster | AR-21 |
| Missing `@example` on a new export | `check-jsdoc` fails the build; every export gets one | CLAUDE.md |

## Testing Requirements

- Spec: the security oracle (ST-20…ST-22); the kitchen-sink smoke; the showcase smoke + walkthrough.
- Impl: barrel round-trip (every new symbol importable from `@jsvision/datagrid`); the showcase
  category/count oracles; `check-jsdoc` clean.
