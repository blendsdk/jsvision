# Requirements: Kanban Phase B Core Board

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)
> **Sources**:
> [RD-04](../../requirements/RD-04-cards-presentation.md),
> [RD-05](../../requirements/RD-05-columns-swimlanes-workflow.md), and
> [RD-06](../../requirements/RD-06-focus-navigation-selection.md) — the OWNING requirement documents

## Scope of this plan (delta view)

### In this plan

- RD-04: every card/presentation criterion that can execute without a package editor dialog, including
  the durable editor-action intent required by AC 9 (PAR-B08/PAR-B11).
- RD-05: every core structure/workflow/presentation criterion, including a pure temporary-hover hook
  for AC 13 while RD-07 retains actual drag production (PAR-B01/PAR-B27).
- RD-06: focus, navigation, selection, click, activation, context targeting, bounded acquisition, and
  public state/transition APIs; layered cancellation is implemented as a durable transient hook while
  RD-07/RD-12 retain actual drag/menu producers. Programmatic Primary-equivalent transitions and the
  currently deliverable Ctrl gestures ship, while macOS Command transport/normalization remains an open
  RD-12 prerequisite and cannot close the affected RD-06 criteria (PAR-B01/PAR-B18).
- Phase-owned i18n, theme, security, scale, public API, package documentation, architecture, and plugin
  parity required to ship those behaviors (PAR-B16–24).

### Deferred / out of this plan

- RD-07 pointer capture, drag threshold, ghost, insertion targets, live reflow, edge autoscroll, and
  drag-to-expanded-swimlane integration.
- RD-08 mutation requests, placement/rank proposals, pending commit/reject recovery, and undo lifecycle.
- RD-09 search/filter/saved-view UI and durable view persistence, beyond reacting correctly to the
  already-public semantic query.
- RD-10 Forms/Zod schemas, editor dialogs, modeless inspector, drafts, validation, and publication
  conflict UI.
- RD-11 board-configuration APIs/dialogs and confirmations.
- RD-12 complete command/keymap/menu/event/history surface; its later routers adapt to Phase B semantic
  intents rather than replacing them.
- RD-13/14 final locale/theme/accessibility/performance matrices and RD-15 teaching labs, kitchen sink,
  showcase, and release completion.

## Plan-local slice specifications

### SPEC-B-ACTION-HOOK — durable activation without later UI

Enter, double-click, context targeting, descriptor actions, and checklist activation publish one
bounded immutable semantic interaction intent through the optional application handler. The handler
receives identities and a selection snapshot, not application card payload. No dialog, command object,
menu, or mutation is manufactured in Phase B (PAR-B08/PAR-B11).

### SPEC-B-HOVER-HOOK — collapsed swimlane preview contract

A pure transient controller can begin, cancel, and expire a bounded hover lease for one visible
collapsed swimlane. Expiry exposes temporary expansion without changing saved/application state;
leaving or cancellation restores collapse. Phase B has no pointer-drag producer for this hook
(PAR-B01/PAR-B27).

### SPEC-B-TRANSIENT-CANCEL — layered cancellation contract

The interaction controller accepts at most one current transient cancel owner with an explicit
priority. Escape invokes it once before selection clearing. Phase B proves the hook and selection
layer; RD-07 and RD-12 later register real drag/menu owners (PAR-B01/PAR-B18).

### SPEC-B-HEIGHT-INDEX — bounded variable-height geometry

Per-cell sparse height runs retain exact measurements only for bounded resident/anchor entries and use
policy estimates for unloaded spans. Measurement correction preserves the stable visible anchor and
does not allocate by logical card count (PAR-B26).

## Plan-local decisions

| Decision | Chosen | AR Ref |
|---|---|---|
| Later integration wording | Implement durable hooks and leave owning integration criteria open | PAR-B01/PAR-B25 |
| Stateful public model | Stable board facade over one default or mount-factory controller | PAR-B06/PAR-B29 |
| Presentation normalization | Preset or custom input resolves to one immutable bounded budget | PAR-B09 |
| Custom swimlane extension | Validate geometry, roles, text, regions/actions, and invocation count | PAR-B28 |

## Plan-local acceptance criteria

1. [ ] Every in-scope RD-04–06 criterion maps to at least one immutable specification test.
2. [ ] Cross-phase hooks satisfy SPEC-B-ACTION-HOOK, SPEC-B-HOVER-HOOK, and
   SPEC-B-TRANSIENT-CANCEL without advertising the deferred producer/integration as complete.
3. [ ] SPEC-B-HEIGHT-INDEX keeps projection, reveal, navigation, and anchors correct for variable
   heights without logical-length allocation.
4. [ ] Roadmap and traceability advance only criteria proven by the Phase B execution evidence.
5. [ ] The focused package, docs, i18n, plugin, packed-consumer, and changed-file gates in PAR-B24 pass.
