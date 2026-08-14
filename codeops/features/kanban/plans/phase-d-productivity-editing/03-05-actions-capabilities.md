# Actions and Capabilities: Phase D

> **Document**: 03-05-actions-capabilities.md
> **Parent**: [Index](00-index.md)

## Overview

Stable action definitions allow keyboard, menu, status, context menu, palette, pointer, docs, tests,
and programmatic callers to invoke one eligibility/handler path. Application authorization remains in
the dispatcher (AR-D09).

## Action registry

`KanbanActionDefinition` contains a stable ID, category, label/help message IDs, applicability target,
capability key, optional default bindings, and handler. Package IDs use a reserved namespace;
application IDs are validated namespaced extensions. The registry rejects duplicate IDs and unsafe or
unbounded definitions, snapshots entries, and isolates handler exceptions.

The package inventory covers navigation/selection/open/edit/create/move/grab/drop; card actions;
column/swimlane configuration; search/filter/sort/view; help/retry; undo/redo. Destructive and board
configuration actions are exported but unbound by default.

## Keymap

The public builder composes RD-12 defaults with application overrides, normalizes semantic `Primary`,
and rejects exact collisions, supported prefix ambiguity, reserved host routes, and package/application
conflicts. An override must name the exact replaced action/chord. A successful replacement updates
routing/help/menu labels atomically without reconstructing the board.

The default table is owned by RD-12: arrows, Home/End, PageUp/PageDown, Primary+Home/End,
Enter, Space, Shift+navigation, Primary+A, Primary+F, Insert, Alt+M, Esc, Shift+F10, F1,
Primary+Z, and Primary+Y. Browser/macOS resolves Primary to Command when observable; native terminals
and other hosts use Ctrl.

Before Kanban routing, Core adds source-compatible semantic Primary/Meta normalization and keymap
grammar. Web adds a pre-xterm DOM keyboard/pointer adapter with terminal-cell coordinate conversion,
pointer capture, capability fallback, and one-event deduplication against matching SGR delivery. This
prerequisite is specification-first and preserves existing Ctrl/Alt/Shift event literals (AR-D20).

## Capabilities and read-only

```ts
export type KanbanActionCapability =
  | { readonly state: 'allowed' }
  | { readonly state: 'disabled'; readonly reasonCode: string; readonly label?: string }
  | { readonly state: 'hidden' };

export type KanbanCapabilityProvider =
  (context: KanbanActionCapabilityContext) => KanbanActionCapability;
```

Context carries action/target IDs, revisions, selection summary, and source/view state; it does not
carry whole records unless an explicit application adapter owns that internal read. Calls are pure,
synchronous, bounded, and failure-isolated to disabled-with-safe-error. The read-only preset removes
mutation hit targets, drag starts, editor submit, configuration, and history mutation while retaining
navigation, selection, search/filter/view apply, viewing, help, and permitted app actions. It is a UX
policy, never authorization.

## Routing and feedback

One board action router snapshots logical target/selection/capability once, returns
`handled | disabled | hidden | unavailable | pending`, and emits localized feedback parameters.
View actions call the RD-09 controller; mutations build proposals and call board authority; dialogs
invoke public functions; interaction actions call the stable facade. Pointer affordances use action IDs
instead of private mutation helpers.

Synchronous invocation of the same action from its own handler rejects before mutation with a typed
reentrant outcome. Different-action nesting is configurable with default depth 16 and hard maximum 64;
the next invocation above the configured depth returns typed `action-depth-exceeded` before capability/
mutation/event work. Each accepted nested route snapshots capability once and cannot duplicate a request.

## Target modules

`packages/core/src/engine/input/`, `packages/web/src/` host adapters and fixtures;
`src/command/types.ts`, `actions.ts`, `registry.ts`, `keymap.ts`, `capability.ts`, `router.ts`,
`defaults.ts`, `help.ts`, and small viewport/board action adapters.

## Testing requirements

ST-DA-01…DA-13 cover complete inventory, origin parity, conflicts/override, reactive help, disabled/
hidden/error capability, read-only hit targets, raw authorization bypass evidence, keyboard reachability,
Primary host fixtures, custom actions, reentrancy, feedback, and disposal.
