---
techdocs: true
---

# JSVision — Technical Architecture

> **Project**: JSVision
> **Type**: TypeScript library and SDK monorepo
> **Tech Stack**: Node.js 22+, ESM TypeScript, Yarn workspaces, Turborepo, VitePress
> **Last Updated**: 2026-08-10

## System purpose

JSVision is an SDK for building reactive terminal user interfaces with classic desktop and window
semantics. Public packages separate terminal rendering, UI controls, forms, localization, specialist
components, web hosting, and examples so applications can depend only on the surfaces they use.

The `@jsvision/kanban` core board provides application-owned contracts, revisioned eager and windowed
data sources, bounded configurable cards, workflow-column/swimlane policy, sparse canonical scene
geometry, focus and selection, mounted keyboard/pointer interaction, semantic application intents,
and ten locale subpaths with additive Phase B overlays. Drag/drop, commands, packaged editors, component teaching labs,
kitchen sink, and showcase documentation remain staged work.

## Architecture at a glance

```mermaid
graph TB
    App[Application state and policy] --> Kanban[@jsvision/kanban core board]
    Kanban --> UI[@jsvision/ui]
    Kanban --> I18n[@jsvision/i18n]
    UI --> Core[@jsvision/core]
    Docs[Docs site and live labs] --> Kanban
    Examples[Kitchen sink and showcase] --> Kanban
```

## Key components

| Component            | Status                | Purpose                                                            | Documentation                                    |
| -------------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| JSVision core and UI | Implemented           | Rendering, reactivity, layout, windows, input, and controls        | [System overview](/architecture/system-overview) |
| `@jsvision/kanban`   | Phase B core complete | Sources, cards, structure, scene, interaction, board, and viewport | [Kanban architecture](/architecture/kanban)      |
| Application adapter  | Consumer-owned        | Records, persistence, authorization, mutation, and saved views     | [Integrations](/reference/integrations)          |
| Docs and examples    | Planned for Kanban    | Teaching page, live labs, kitchen sink, and flagship showcase      | [Development workflow](/guides/development)      |

## Technology decisions

The [Architecture Decision Record log](/decisions/) preserves the accepted Kanban design intent.
Implementation must not silently replace those decisions with accidental code behavior.

## Getting started

Use the [Getting Started guide](/guides/getting-started) for the repository workflow and the current
status of the Kanban package.
