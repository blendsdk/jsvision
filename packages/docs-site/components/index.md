---
title: Components
description: Choose the right JSVision visual surface, explore every component family, and open focused live examples.
---

# Components

JSVision components are terminal-native visual building blocks. Standard components cover focused
jobs such as input, selection, scrolling, and window chrome. The
[Data Grid](/components/data-grid/) and [Code Editor](/components/code-editor/) are larger
workspaces with their own guided learning paths and multiple live examples.

Start with the smallest component that owns the behavior you need, then compose it into an
application shell. Every component page explains public state, sizing, interaction, theming, and
the boundary between related choices.

## Specialist workspaces

> **[Data Grid →](/components/data-grid/)**
>
> Display or edit typed tabular data, then add sorting, filtering, validation, aggregation,
> master/detail views, data-at-scale strategies, and export.

> **[Code Editor →](/components/code-editor/)**
>
> Build a language-aware editing workspace with documents, syntax highlighting, folding,
> search, language intelligence, large-document tiers, themes, and host-safety boundaries.

## Component families

| Family                                                     | Choose it for                                                                     | Components                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Foundations](/components/foundations/view)                | Custom drawing and child composition                                              | [View](/components/foundations/view) · [Group](/components/foundations/group)                                                                                                                                                                                                                                                                                                                                                                               |
| [Application shell](/components/application/application)   | App lifecycle, desktops, screens, windows, menus, and status                      | [Application](/components/application/application) · [Desktop](/components/application/desktop) · [Router](/components/application/router) · [Window](/components/application/window) · [Menu Bar](/components/application/menu-bar) · [Status Line](/components/application/status-line)                                                                                                                                                                   |
| [Controls](/components/controls/button)                    | Commands, text/value entry, choices, toggles, and read-only messages              | [Button](/components/controls/button) · [Input](/components/controls/input) · [Text](/components/controls/text) · [Label](/components/controls/label) · [Check Group](/components/controls/check-group) · [Radio Group](/components/controls/radio-group) · [Multi-check Group](/components/controls/multi-check-group) · [Slider](/components/controls/slider) · [Switch](/components/controls/switch)                                                     |
| [Containers and navigation](/components/containers/dialog) | Modal tasks, lists, scrolling, trees, tabs, splits, and dropdown history          | [Dialog](/components/containers/dialog) · [List View](/components/containers/list-view) · [List Box](/components/containers/list-box) · [Scroller](/components/containers/scroller) · [Scroll Bar](/components/containers/scroll-bar) · [Tree](/components/containers/tree) · [Tabs](/components/containers/tabs) · [Split View](/components/containers/split-view) · [Combo Box](/components/dropdown/combo-box) · [History](/components/dropdown/history) |
| [Feedback](/components/feedback/progress-bar)              | Determinate progress and compact busy state                                       | [Progress Bar](/components/feedback/progress-bar) · [Spinner](/components/feedback/spinner)                                                                                                                                                                                                                                                                                                                                                                 |
| [Date](/components/date/calendar)                          | Always-visible or compact date selection                                          | [Calendar](/components/date/calendar) · [Date Picker](/components/date/date-picker)                                                                                                                                                                                                                                                                                                                                                                         |
| [Color](/components/color/color-swatch)                    | Palette browsing or compact popup color selection                                 | [Color Swatch](/components/color/color-swatch) · [Color Picker](/components/color/color-picker)                                                                                                                                                                                                                                                                                                                                                             |
| [Surface](/components/surface/surface)                     | Off-screen drawing buffers and visual viewports                                   | [Surface](/components/surface/surface) · [Surface View](/components/surface/surface-view)                                                                                                                                                                                                                                                                                                                                                                   |
| [Editing and output](/components/editor/editor)            | General text editing, memo fields, editor chrome, indicators, and terminal output | [Editor](/components/editor/editor) · [Memo](/components/editor/memo) · [Edit Window](/components/editor/edit-window) · [Indicator](/components/editor/indicator) · [Terminal](/components/terminal/terminal)                                                                                                                                                                                                                                               |
| [Forms](/components/controls/form-dialog)                  | Declarative modal data collection and validation                                  | [Form Dialog](/components/controls/form-dialog)                                                                                                                                                                                                                                                                                                                                                                                                             |
| [Files](/components/files/file-dialog)                     | Ready-made file tasks or composable file-system views                             | [File Dialog](/components/files/file-dialog) · [Change Directory Dialog](/components/files/chdir-dialog) · [File List](/components/files/file-list) · [Directory List](/components/files/dir-list) · [File Input](/components/files/file-input) · [File Info Pane](/components/files/file-info-pane) · [File Editor](/components/files/file-editor)                                                                                                         |

## How applications fit together

```text
Application
├─ Desktop
│  ├─ Window
│  └─ Dialog
└─ Router
   └─ Screen Group
      ├─ Containers
      └─ Controls
```

An `Application` owns the event loop and shared chrome. A `Desktop` manages overlapping windows;
a `Router` swaps full-screen groups. Inside either route, containers organize focusable controls
while leaf views draw content or accept input.

## Choose between related components

| Need                                 | Choose                                                                                                                 | Instead of                                                                        |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Draw one custom leaf                 | [View](/components/foundations/view)                                                                                   | [Group](/components/foundations/group) when you need child composition            |
| Manage movable windows               | [Desktop](/components/application/desktop)                                                                             | [Router](/components/application/router) for screen-stack navigation              |
| Keep a modeless movable surface open | [Window](/components/application/window)                                                                               | [Dialog](/components/containers/dialog) for one modal task                        |
| Render a generic item model          | [List View](/components/containers/list-view)                                                                          | [List Box](/components/containers/list-box) for string-list convenience           |
| Scroll content through a viewport    | [Scroller](/components/containers/scroller)                                                                            | [Scroll Bar](/components/containers/scroll-bar) for a standalone position control |
| Keep a month visible                 | [Calendar](/components/date/calendar)                                                                                  | [Date Picker](/components/date/date-picker) for compact dropdown selection        |
| Show a palette grid                  | [Color Swatch](/components/color/color-swatch)                                                                         | [Color Picker](/components/color/color-picker) for popup/value entry              |
| Draw into an off-screen buffer       | [Surface](/components/surface/surface)                                                                                 | [Surface View](/components/surface/surface-view) to display one                   |
| Edit ordinary text                   | [Editor](/components/editor/editor), [Memo](/components/editor/memo), or [Edit Window](/components/editor/edit-window) | [Code Editor](/components/code-editor/) for language-aware editing                |
| Display or navigate a simple table   | [DataGrid](/components/data-grid/#datagrid)                                                                            | [EditableDataGrid](/components/data-grid/#editable-data-grid) for typed editing   |
| Run a complete file task             | [File Dialog](/components/files/file-dialog)                                                                           | [Composable file views](/components/files/file-list) for a custom workflow        |

## Learn the shared systems

- [Layout](/guide/layout) — size and position components in terminal cells.
- [Reactive state](/guide/reactive-state) — bind signals without manual repaint plumbing.
- [Theming and colour depth](/guide/theming-and-colour-depth) — understand roles and terminal capabilities.
- [Keyboard and clipboard](/guide/keyboard-and-clipboard) — apply portable focus, navigation,
  selection, and clipboard practices.
- [API reference](/api/) — inspect complete exported types after learning the component contract.
