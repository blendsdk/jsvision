---
techdocs: true
---

# JSVision — Technical Architecture

> **Project**: JSVision
> **Type**: TypeScript library and SDK monorepo
> **Tech Stack**: Node.js 22+, ESM TypeScript, Yarn workspaces, Turborepo, VitePress
> **Last Updated**: 2026-08-15

## System purpose

JSVision is an SDK for building reactive terminal user interfaces with classic desktop and window
semantics. Public packages separate terminal rendering, UI controls, forms, localization, specialist
components, web hosting, and examples so applications can depend only on the surfaces they use.

The `@jsvision/kanban` core board provides application-owned contracts, revisioned eager and windowed
data sources, bounded configurable cards, workflow-column/swimlane policy, sparse canonical scene
geometry, modern interaction, transactional view state, versioned saved views, responsive editors and
configuration dialogs, unified actions/keymaps, bounded events, and application-owned history
bindings. Ten locale subpaths include additive Phase B–D catalogs. The shared UI event loop provides
generation-bound pointer-capture leases. Standalone Kanban and GitHub-project showcases exercise the
responsive board and productivity surfaces. The consumer component course remains later work.

## Architecture at a glance

```mermaid
graph TB
    App[Application state and policy] --> Kanban[@jsvision/kanban core board]
    Kanban --> UI[@jsvision/ui]
    Kanban --> I18n[@jsvision/i18n]
    Kanban --> Forms[@jsvision/forms]
    UI --> Core[@jsvision/core]
    Docs[Docs site and live labs] --> Kanban
    Examples[Kitchen sink and showcase] --> Kanban
```

## Key components

| Component            | Status           | Purpose                                                                      | Documentation                                    |
| -------------------- | ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| JSVision core and UI | Implemented      | Rendering, reactivity, layout, windows, input, and controls                  | [System overview](/architecture/system-overview) |
| `@jsvision/kanban`   | Phase D complete | Board plus view, editing, configuration, action, event, and history surfaces | [Kanban architecture](/architecture/kanban)      |
| Application adapter  | Consumer-owned   | Records, persistence, authorization, mutation, saved views, and history      | [Integrations](/reference/integrations)          |
| Examples             | Phase D showcase | Responsive kitchen sink, host evidence, and GitHub-project application       | [Development workflow](/guides/development)      |
| Consumer docs        | Later phase      | Component course and browser-hosted teaching labs                            | [Development workflow](/guides/development)      |

## Technology decisions

The [Architecture Decision Record log](/decisions/) preserves the accepted Kanban design intent.
Implementation must not silently replace those decisions with accidental code behavior.

## Getting started

Use the [Getting Started guide](/guides/getting-started) for the repository workflow and the current
status of the Kanban package.
