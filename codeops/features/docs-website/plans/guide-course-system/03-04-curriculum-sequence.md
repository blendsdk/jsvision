# Curriculum Sequence: Guide Course System

> **Document**: 03-04-curriculum-sequence.md
> **Parent**: [Index](00-index.md)

## Overview

The execution order follows the catalog prerequisite graph while keeping every Guide route an
independently verifiable teaching slice (AR-10). Catalog learning outcomes remain the authoritative
lesson-level requirements; this table defines delivery order, profile, and evidence target without
restating those outcomes.

## Route Sequence

| Phase | Course | Profile | Starting stage | Lab target | Depends on |
|---:|---|---|---|---:|---|
| 1 | Introduction | orientation | upgrade | 1 | — |
| 2 | Install & packages | orientation | upgrade | 0 + substitute | Introduction |
| 3 | Layout | course | complete pilot | 2 | Install & packages |
| 4 | Reactive state | course | complete pilot | 2 | Layout |
| 5 | Codex plugin | integration | upgrade | 0 + substitute | Install & packages |
| 6 | Views & focus | course | upgrade | 2 | Layout, Reactive state |
| 7 | Events, commands & keymaps | course | upgrade | 2 | Views & focus |
| 8 | Keyboard & clipboard | course | upgrade | 1 | Events, commands & keymaps |
| 9 | Text, Unicode & terminal cells | course | planned | 2 | Layout |
| 10 | Scrolling, lists & large content | course | planned | 2 | Layout, Views & focus |
| 11 | The application shell | course | upgrade | 2 | Events, commands & keymaps |
| 12 | Dialogs & modality | course | upgrade | 2 | Application shell, Views & focus |
| 13 | Async work, cancellation & progress | course | planned | 2 | Reactive state, Dialogs & modality |
| 14 | Forms | course | upgrade | 2 | Reactive state, Dialogs & modality, Async work |
| 15 | Files & the FileSystem seam | course | upgrade | 1 | Dialogs & modality, Async work |
| 16 | Internationalization | course | upgrade | 2 | Application shell, Text/Unicode/cells |
| 17 | Screens & routing | course | upgrade | 2 | Application shell, Views & focus |
| 18 | Theming & colour depth | course | upgrade | 2 | Application shell |
| 19 | Running in the browser | course | upgrade | 2 | Application shell, Files |
| 20 | Writing your own widget | course | upgrade | 2 | Layout, Reactive state, Views/focus, Events/commands |
| 21 | Testing headlessly | course | upgrade | 0 + substitute | Application shell, Events/commands |
| 22 | Application architecture & best practices | course | planned | 2 | Application shell, Reactive state, Screens/routing |
| 23 | Debugging | course | upgrade | 1 | Application shell, Testing headlessly |
| 24 | Crash safety & terminal restore | course | upgrade | 0 + substitute | Application shell, Debugging |
| 25 | Displaying untrusted text safely | course | upgrade | 1 | Text/Unicode/cells, Debugging |
| 26 | Accessibility & resilient interaction | course | planned | 2 | Views/focus, Keyboard/clipboard, Theming |
| 27 | Terminal capabilities & portability | course | planned | 2 | Theming, Crash safety |
| 28 | In production | course | upgrade | 0 + substitute | Crash safety, Untrusted text, Terminal capabilities |
| 29 | Build a complete application | course | planned | 2 | Architecture, Forms, Routing, Headless testing, Production |

## Cross-Curriculum Phases

| Phase | Scope | Required result |
|---:|---|---|
| 30 | Data Grid and Code Editor specialist boundary | Both hubs remain authoritative, appear in the curriculum, and receive/return correct Guide links without duplicate Guide routes |
| 31 | Curriculum integration | All stages, routes, prerequisites, examples, links, navigation, snippets, docs build, and repository verification agree |

## Phase Completion

A route phase completes only when its catalog outcomes have specification assertions, its page
satisfies the profile contract, its required labs or authentic substitutes exist, implementation
hardening passes, links resolve, and the entry is atomically promoted to `complete`. Pilot phases
may record a justified pre-existing-pass result, but they still perform the complete audit.

## Dependencies

```text
Introduction → Install → Layout → Reactive state
                         ├─ Views/focus → Events/commands → Application shell
                         ├─ Text/Unicode ────────────────┐
                         └─ Scrolling/large content     │
Application shell → Dialogs → Async → Forms/Files      │
Application shell → Routing/Theming/Browser/Testing    │
Core + application courses → Architecture/Operations ──┘
All Guide routes → Specialist boundary → Integration
```
