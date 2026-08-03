# RD-12: Commands, Events, Capabilities, and History

> **Document**: RD-12-commands-events-capabilities.md
> **Status**: Complete
> **Created**: 2026-08-03
> **Project**: JSVision Kanban
> **Depends On**: RD-06, RD-08, RD-09, RD-11
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Stable public actions make Kanban usable through keyboard, menus, status lines, context menus, command
palettes, tests, and automation without duplicating behavior. A configurable conflict-validated keymap,
synchronous UI capabilities, read-only mode, normalized lifecycle events, and application-owned history
all route through the same focus/selection/request contracts.

---

## Functional Requirements

### Must Have — Complexity L

- [ ] Define stable public action/command IDs for navigation, selection, open/edit/create, move/grab/drop,
  card actions, column/swimlane actions, search/filter/view, help, retry, undo, and redo.
- [ ] Provide documented default keyboard bindings and a public configurable keymap builder that rejects
  conflicts unless the caller explicitly overrides the exact binding.
- [ ] Route keyboard, menu, status, context-menu, command-palette, pointer, docs, and programmatic action
  invocations through the same command eligibility/handler path.
- [ ] Expose a pure synchronous capability provider globally and per board/entity/action, returning
  allowed, disabled-with-reason, or explicitly hidden.
- [ ] Provide first-class read-only mode preserving navigation, selection, search, filters, saved-view
  apply, viewing, help, and permitted copy-by-application actions while removing mutation/drop targets.
- [ ] Emit normalized bounded events for focus, selection, view, command, request lifecycle, source state,
  errors, and degradation without sensitive card payloads.
- [ ] Integrate application undo/redo availability/tokens through commands and RD-08 fresh requests.
- [ ] Provide concise visible status/help/action feedback with keyboard and mouse discoverability.

### Should Have — Complexity M

- [ ] Expose an action registry that applications can extend through namespaced commands and menus.
- [ ] Support command enablement labels/reasons suitable for menu/status/palette presentation.
- [ ] Provide an opt-in bounded observation channel with counters/last-state snapshots for testing/support.

### Won't Have (Out of Scope)

- A global application command palette implementation, durable audit log, notification system, macro/
  automation engine, or security authorization model.
- Silent priority winner for key conflicts or mutation commands that bypass the dispatcher.

---

## Technical Requirements

### Action model and defaults — Complexity L

Actions have stable bounded string ID, category, message IDs for label/help, default key bindings,
applicability target, capability requirement, and one handler producing view changes or typed requests.
Package IDs occupy a reserved namespace; application IDs must be namespaced.

Default bindings are:

| Action | Default binding |
|---|---|
| Spatial/card navigation | Arrow keys |
| Current-cell first/last | Home / End |
| Viewport page navigation | PageUp / PageDown |
| Board first/last | Primary+Home / Primary+End |
| Open card / confirm keyboard drop | Enter |
| Toggle focused selection | Space |
| Extend cell-local range | Shift+navigation |
| Select loaded visible matching | Primary+A |
| Focus search | Primary+F |
| Create card at current placement | Insert |
| Start keyboard grab/move | Alt+M |
| Cancel transient / clear selection | Esc |
| Open context actions | Shift+F10 |
| Help | F1 |
| Request undo / redo | Primary+Z / Primary+Y |

Destructive and board-configuration commands are exported but unbound by default. Locale accelerators
are separate from these stable bindings. Host/app overrides pass through the same conflict/capability
validation and may replace unavailable Alt/function-key routes explicitly.

`Primary` is semantic rather than a literal terminal modifier: it resolves to Command on capable macOS
browser hosts and Ctrl on other browser hosts and native terminals. The normalized Core/Web input and
keymap seam preserves `metaKey` only on hosts that can observe it. Help always renders the resolved chord;
terminal documentation states the Ctrl fallback because terminal SGR input has no distinct Command bit.

### Keymap construction — Complexity M

The builder normalizes platform/terminal key routes and detects duplicate exact chords, prefix/chord
ambiguity where supported, reserved host routes, and application/package conflicts. Conflicts return a
structured error containing action IDs and chord, never silently choose priority. An explicit override
names the replaced action/chord. Runtime binding changes invalidate help/menu presentation atomically.

### Command routing — Complexity L

Every route resolves the current logical target/selection and capability once, then invokes the public
action handler. Pointer affordances call commands rather than private mutation helpers. Commands return
handled/disabled/hidden/unavailable/pending outcomes and visible feedback parameters. Mutation commands
construct RD-08 requests; view-only commands apply RD-09 pure state; no handler mutates source records.

### Capabilities and read-only — Complexity L

Capability context includes action, board/entity IDs, source/query/entity revisions, selection summary,
and view/source state without entire record payload unless the application adapter explicitly needs it.
Calls are synchronous, pure, bounded, and failure-isolated to disabled-with-error. Default presentation is
disabled with localized reason for discoverability; applications may explicitly return hidden.

Read-only is a package capability preset denying every mutation, drag/drop, editor submit, and structural
configuration action while keeping view/navigation/open/help. It removes hit targets/ghost starts, not
merely dispatcher calls. Applications still enforce security.

### Events and observations — Complexity M

Events use discriminated immutable snapshots with sequence/order, timestamp supplied by injected clock,
board ID, operation ID/revisions where relevant, stable entity IDs, state/code, and counts. Ordering:
command intent → request proposed/pending → dispatcher outcome → authoritative commit/supersede.
Focus/selection/view events occur after the state snapshot is observable. Subscriber exceptions are
isolated; disposal unsubscribes and late work cannot emit.

### History integration — Complexity M

Applications provide reactive undo/redo availability and command callbacks/request tokens. Status/menu
labels reflect availability. Invoking creates a normal current-revision request and lifecycle events.
Rejected/stale history shows feedback; the package neither stores card snapshots nor claims history was
applied before authoritative publication.

---

## Integration Points

- **RD-06** supplies focus/selection targets and navigation handlers.
- **RD-08** supplies mutation and history request lifecycles.
- **RD-09/RD-11** supply view/configuration actions.
- **RD-13** supplies localized labels/accelerators/theme feedback.
- **RD-14/RD-15** verify event privacy, parity, docs, and host key behavior.
- **Core/Web input prerequisite** adds a semantic Primary modifier to normalized key/mouse events and the
  keymap, preserving raw `metaKey` only where a browser host can observe it and resolving Ctrl elsewhere.
  Because xterm SGR cannot encode Command, the web host also requires one DOM pointer adapter before
  xterm encoding: it observes `metaKey`, maps browser coordinates/buttons to terminal cells, emits exactly
  one normalized pointer event, and suppresses/deduplicates the corresponding SGR delivery. Its capability
  and headless fixtures cover Command-click, Ctrl-click, capture, coordinate conversion, and duplicate
  prevention; hosts without that adapter expose the documented Ctrl fallback rather than claiming Command.

---

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| Keys | Hardcoded / actions+keymap | Actions+keymap | Host/app integration | AR #18, #29 |
| Conflicts | Silent priority / reject+override | Reject+explicit override | Predictable SDK | AR #29 |
| Capabilities | None / app sync | App sync UI eligibility | Discoverability/read-only | AR #31 |
| Events | Ad hoc / normalized | Normalized bounded | Automation/testing without data leakage | AR #18, #21, #22 |
| History | Component / application | Application | Data ownership | AR #18, #27 |
| Defaults | Deferred / concrete conservative | Documented key table | Testable cross-host baseline | AR #43 |

---

## Security Considerations

- Capabilities and hidden UI are not authorization; every mutation reaches application authorization.
- Key/event/application extension IDs and feedback parameters are validated/sanitized/bounded.
- Events/observations exclude card bodies, draft values, filter secrets, placement/undo tokens, stack
  traces, and arbitrary callback payloads.
- Subscriber/capability exceptions are isolated and redacted; recursion/reentrant command dispatch is
  bounded or rejected.
- No macro execution, shell shortcuts, clipboard access, network emission, or persistent audit storage is
  performed by this package.

---

## Acceptance Criteria

1. [ ] Every documented package action has a stable ID, label/help message IDs, applicability, capability
   requirement, handler outcome, and default binding or explicit unbound status.
2. [ ] Keyboard, menu, context menu, status, pointer, and programmatic invocation of Move Card reach the
   same eligibility and one dispatcher seam with equivalent proposal semantics.
3. [ ] Registering two actions on the same exact chord rejects with both IDs/chord; an explicit targeted
   override replaces only the named binding.
4. [ ] Changing bindings atomically updates command routing and visible help/menu labels without requiring
   component reconstruction.
5. [ ] Disabled capability shows a reason and emits zero request; hidden capability removes the action;
   capability exception becomes disabled-with-sanitized-error while other actions work.
6. [ ] Read-only mode preserves navigation, selection, search/filter/view apply, open/view, help, and
   status while producing zero mutation hit targets, drag starts, editor submits, or dispatcher calls.
7. [ ] Bypassing read-only UI by constructing a raw request still reaches application authorization,
   demonstrating read-only is not a security boundary.
8. [ ] Event ordering for a committed request is command → proposed → pending → accepted → authoritative
   committed with one operation ID and monotonically increasing sequence.
9. [ ] Rejection/cancellation/supersession emit the matching terminal lifecycle event and never emit
   committed without authoritative publication.
10. [ ] Focus/selection/view events observe the new public state when subscriber reads it, and preserve
    the distinction between numeric card key `1` and string card key `'1'`.
11. [ ] A throwing event subscriber is isolated, reported once through sanitized observation, and does
    not prevent later subscribers/state changes.
12. [ ] Event snapshots contain IDs, revisions, state/codes/counts but no card body, editor draft, filter
    secret, placement token, undo token, or raw thrown object.
13. [ ] Undo/redo availability reacts in menus/status; invocation creates a fresh request and rejected
    history leaves authoritative data unchanged.
14. [ ] Esc/help/grab/drop and every mutation action remain reachable by keyboard at 80×24 and narrow
    mode; mouse-only capability is absent.
15. [ ] Disposing the board removes all event subscriptions and late async settlement emits no event.
16. [ ] Namespaced custom action/request executes through the same capability/command/dispatcher/event
    lifecycle and an unnamespaced collision rejects.
17. [ ] On a capable macOS browser fixture, Primary routes Command for keyboard and pointer toggle actions;
    the DOM adapter maps Command-click to the correct terminal cell/button exactly once and suppresses its
    duplicate SGR event. Other browser and native-terminal fixtures route Ctrl, and visible help names the
    resolved chord.
