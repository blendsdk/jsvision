# Laboratories and Evidence: Guide Course System

> **Document**: 03-03-laboratories-and-evidence.md
> **Parent**: [Index](00-index.md)

## Overview

Live laboratories prove user-visible behavior that prose and snippets cannot. Every new lab is a
complete `demoApp(ctx, { themeMenu: true })` application using the shared `Template1Dialog`,
Classic theme, compact centered startup, responsive inset content, visible desktop margin,
keyboard-reachable actions, concise instructions, and visible feedback.

## Laboratory Contract

Each lab:

- has one explicit learning objective and a unique `guides/...` registry ID;
- is registered in `src/example-registry/guides.ts` as `kind: 'app'`;
- appears beside the lesson it proves with a concrete title and “what to try” blurb;
- uses deterministic bounded fixtures and no implicit visitor filesystem, clipboard, network, or
  other privileged host access;
- remains alive, centered, unclipped, and usable at 80×24;
- responds correctly through resize, maximize, restore, and reduced geometry;
- exposes all documented actions by keyboard and uses mouse interaction only when meaningful; and
- includes visible focus, non-color state cues, and relevant ASCII/monochrome degradation.

The shared `Template1Dialog` owns window behavior. Individual labs do not duplicate its resize,
maximize, restore, or minimum-size logic.

## Evidence Layers

| Layer | Evidence |
|---|---|
| Course outcome | Route-specific specification assertion derived from the catalog |
| Page/lab binding | `<PlayExample>` ID, title, and objective match catalog/registry metadata |
| Application shell | Real registry module builds a complete app |
| Compact state | Centered dialog, desktop margin, Classic surface, 80×24 no clipping |
| Interaction | Hotkeys/buttons change the exact visible state promised by the lesson |
| Responsive behavior | Principal content grows; labels/instructions preserve authored heights |
| Lifecycle | Timers, effects, async work, modal work, and host resources clean up |
| Security/accessibility | Authorized seams, sanitized text, visible focus, keyboard reachability |
| Integration | VitePress build imports and renders the registered module |

## Example Organization

- Course modules live under `packages/docs-site/examples/guides/`.
- Reusable teaching views or deterministic data live under
  `packages/docs-site/src/example-fixtures/<course-slug>/`.
- Registry descriptors remain in the bounded Guide family module.
- Route-specific specification and implementation coverage uses the shared lab harness where
  applicable.

Example IDs remain course-prefixed and stable once published. Close comparisons may share one lab;
different workflows, scales, or failure modes receive separate labs.

## Security and Host Boundaries

Browser labs use virtual or explicitly authorized seams. A filesystem, clipboard, network,
terminal capability, or local-file action must show denial/cancellation honestly and cannot imply
authority the browser runtime does not possess. Untrusted terminal text is sanitized at the
documented boundary. Diagnostics use deterministic nonsensitive fixtures.

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Lab target is zero without a catalog exception | Reject catalog completion | AR-4 |
| Registry ID is missing, duplicated, or wrong kind | Fail registry/course specification | AR-4 |
| Lab clips or hides instructions at 80×24 | Keep course at upgrade/planned and fix responsive content | AR-9 |
| Interaction works only by mouse | Add a usable keyboard path before completion | AR-5 |
| Lab requires unavailable host authority | Use a virtual seam, explicit authorization flow, or authentic substitute | AR-5 |
| Existing component demo only loosely matches the lesson | Build a focused Guide lab instead of reusing it | AR-1 |

## Testing Requirements

- Real application construction through the example registry.
- Compact centering, Classic surface, responsive maximize/restore, and unclipped content.
- Course-specific user actions and visible feedback.
- Keyboard reachability and relevant security/capability behavior.
- Cleanup/disposal assertions for owned work.
- Documentation build coverage for lazy module imports.
