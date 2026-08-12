---
techdocs: true
---

# JSVision — Technical Architecture

> **Project**: JSVision
> **Type**: TypeScript library and SDK monorepo
> **Tech Stack**: Node.js 22+, ESM TypeScript, Yarn workspaces, Turborepo, VitePress
> **Last Updated**: 2026-08-12

## System purpose

JSVision is an SDK for building reactive terminal user interfaces with classic desktop and window
semantics. Public packages separate terminal rendering, UI controls, forms, localization, specialist
components, web hosting, and examples so applications can depend only on the surfaces they use.

The `@jsvision/kanban` core board provides application-owned contracts, revisioned eager and windowed
data sources, bounded configurable cards, workflow-column/swimlane policy, sparse canonical scene
geometry, focus and selection, modern card and structural drag, semantic placement and eligibility,
one application-authoritative operation lifecycle, and ten locale subpaths with Phase B and Phase C
overlays. The shared UI event loop provides generation-bound pointer-capture leases. A real standalone
Kanban showcase exercises responsive drag, warnings, blocked/unavailable outcomes, bulk movement,
autoscroll, rejection, confirmation, and publication. Packaged editors, command registration,
saved-view codecs, and the consumer component course remain later phases.

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

| Component            | Status           | Purpose                                                                | Documentation                                    |
| -------------------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------ |
| JSVision core and UI | Implemented      | Rendering, reactivity, layout, windows, input, and controls            | [System overview](/architecture/system-overview) |
| `@jsvision/kanban`   | Phase C complete | Sources, cards, structure, interaction, requests, operations, and drag | [Kanban architecture](/architecture/kanban)      |
| Application adapter  | Consumer-owned   | Records, persistence, authorization, mutation, and saved views         | [Integrations](/reference/integrations)          |
| Examples             | Phase C showcase | Responsive standalone Kanban kitchen sink and host evidence            | [Development workflow](/guides/development)      |
| Consumer docs        | Later phase      | Component course and browser-hosted teaching labs                      | [Development workflow](/guides/development)      |

## Technology decisions

The [Architecture Decision Record log](/decisions/) preserves the accepted Kanban design intent.
Implementation must not silently replace those decisions with accidental code behavior.

## Getting started

Use the [Getting Started guide](/guides/getting-started) for the repository workflow and the current
status of the Kanban package.
