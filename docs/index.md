---
techdocs: true
---

# JSVision — Technical Architecture

> **Project**: JSVision
> **Type**: TypeScript library and SDK monorepo
> **Tech Stack**: Node.js 22+, ESM TypeScript, Yarn workspaces, Turborepo, VitePress
> **Last Updated**: 2026-08-04

## System purpose

JSVision is an SDK for building reactive terminal user interfaces with classic desktop and window
semantics. Public packages separate terminal rendering, UI controls, forms, localization, specialist
components, web hosting, and examples so applications can depend only on the surfaces they use.

The `@jsvision/kanban` foundation provides application-owned contracts, revisioned eager and
windowed data sources, bounded card presentation, and normalized workflow-column/swimlane policy.
Canonical scene geometry, responsive board interaction, dialogs, published locale subpaths, and
showcase documentation remain staged work. The architecture recorded here preserves bounded data
access, modern pointer interaction, theming, localization, and host authority as those layers arrive.

## Architecture at a glance

```mermaid
graph TB
    App[Application state and policy] --> Kanban[@jsvision/kanban foundation]
    Kanban --> UI[@jsvision/ui]
    Kanban --> I18n[@jsvision/i18n]
    UI --> Core[@jsvision/core]
    Docs[Docs site and live labs] --> Kanban
    Examples[Kitchen sink and showcase] --> Kanban
```

## Key components

| Component            | Status              | Purpose                                                             | Documentation                                    |
| -------------------- | ------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| JSVision core and UI | Implemented         | Rendering, reactivity, layout, windows, input, and controls         | [System overview](/architecture/system-overview) |
| `@jsvision/kanban`   | Phase B in progress | Read sources, presentation, workflow structure, board, and viewport | [Kanban architecture](/architecture/kanban)      |
| Application adapter  | Consumer-owned      | Records, persistence, authorization, mutation, and saved views      | [Integrations](/reference/integrations)          |
| Docs and examples    | Planned for Kanban  | Teaching page, live labs, kitchen sink, and flagship showcase       | [Development workflow](/guides/development)      |

## Technology decisions

The [Architecture Decision Record log](/decisions/) preserves the accepted Kanban design intent.
Implementation must not silently replace those decisions with accidental code behavior.

## Getting started

Use the [Getting Started guide](/guides/getting-started) for the repository workflow and the current
status of the Kanban package.
