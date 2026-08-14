# Card Editors: Phase D

> **Document**: 03-03-card-editors.md
> **Parent**: [Index](00-index.md)

## Overview

One generic editor protocol supports application records, the optional `StandardCard`, and complete
custom replacement. Editing is modal or application-inspector-owned; cards remain read-only
presentation surfaces (AR-D05–D07).

## Generic schema protocol

The Zod-free public core defines stable field/section IDs; text, multiline, number, boolean, date,
single-choice, multi-choice, and custom kinds; typed get/set/format/parse; visibility/read-only rules;
sync/async validators; control factories; and section/tab/collapse metadata. All callbacks receive
bounded context and a live `AbortSignal`; exceptions become field/form diagnostics without exposing
raw values or errors.

```ts
export interface KanbanCardEditorAdapter<TCard, TDraft> {
  readonly schema: KanbanCardEditorSchema<TCard, TDraft>;
  create(card: TCard | undefined, context: KanbanEditorContext): TDraft;
  snapshot(draft: TDraft): KanbanSemanticValue;
  proposal(result: KanbanEditorResult<TDraft>): KanbanCardCreateProposal | KanbanCardUpdateProposal;
}
```

The standard adapter is isolated from generic types and uses `@jsvision/forms` with a `zod:^4` peer.
It supports configured title, status, description, type, priority, assignees, labels, dates, estimate,
ordered checklist groups/items, and application fields. Only configured fields render.

The editor binding requires an application-owned async record resolver. Given a `CardKey`, it returns
a detached authoritative record snapshot plus base revision or typed not-loaded/not-found/deleted
outcome, accepts `AbortSignal`, and exposes revision/deletion publication subscription. Opening never
infers record ownership from viewport residency or presentation adapters.

## Editor session lifecycle

`KanbanEditorSession` owns a detached draft, base card/source revision, dirty/touched/submitting/stale
state, per-field validation generations, cancellation, feedback, focus identity, and disposal. One
identity-keyed coordinator prevents simultaneous package/custom editors for the same card. External
revision/deletion marks a dirty session stale. Apply is blocked until Reload, Cancel, or an explicit
application merge/overwrite result; no silent overwrite occurs (AR-D06).

Each value change aborts the previous field validation generation. Submission focuses/reveals the first
invalid field, validates synchronously and asynchronously, keeps the dialog sealed/draft intact while
pending, constructs one proposal, and routes it through board authority. Rejection maps bounded field
and form errors and retains values/focus. Resubmit obtains a fresh operation ID; requests carry the full
draft, exact changed field IDs, and base revision. Acceptance remains pending until matching publication;
contradictory publication marks stale. Confirmed Reload resolves the latest record and rebases revision/
dirty state. Checklist identities survive reorder, rejection, and publication.
Late validation/dispatch after cancellation, replacement, or disposal is inert.

## Dialogs and inspector

Export create/view/edit dialog invokers that accept a modal host, i18n/theme getters, schema/adapter,
current revision access, dispatcher or result-only mode, and optional custom full replacement. Dialog
content uses responsive DSL composition, one-cell inset, a growing scroller, progressive sections,
measured actions, and focus IDs preserved across reflow. At most one secondary dense group starts open.
Dirty close/destructive actions use package-localized confirmation.

An optional modeless inspector contract is application-controlled and shares the same session; the
package does not manage its window or allow a second editor for the same identity.

## Security and failure handling

- Snapshot and sanitize every field value before proposal construction; custom semantic payloads stay
  bounded and opaque.
- Choice/control IDs select registered factories only; no host path, callback, or executable data is
  accepted from serialized state.
- Sensitive fields never enter observations/events; validation failures carry IDs/codes and safe labels.
- Unknown fields, malformed drafts, callback throws, stale results, and missing cards fail closed while
  preserving the last valid draft where safe (AR-D13).

## Target modules

`src/editor/types.ts`, `schema.ts`, `registry.ts`, `session.ts`, `coordinator.ts`,
`standard-schema.ts`, `standard-adapter.ts`, `controls.ts`, `dialog.ts`, `confirmation.ts`,
and board action integration. Generic modules must not import Zod types.

## Testing requirements

ST-DE-01…DE-27 cover configured fields, all kinds, custom controls, invalid schema graphs/bounds,
draft isolation, cancellation, first-error focus, exact proposal contents, fresh-operation resubmit,
pending/rejection, stale/deletion behavior, exclusivity, close confirmation, responsive reflow/focus,
result-only mode, custom replacement, inspector sharing, read-only/view mode, checklist identity,
throwing-control cleanup, hostile values, and authoritative publication.
