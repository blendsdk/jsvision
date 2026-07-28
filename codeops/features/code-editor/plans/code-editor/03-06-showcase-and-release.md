# Showcase and Release: Code Editor

> **Document**: 03-06-showcase-and-release.md
> **Parent**: [Index](00-index.md)

## Overview

Release evidence includes a dedicated exhaustive example, global story, public documentation,
ADRs, packaging checks, and plugin synchronization (AR-P19–AR-P23).

## Standalone showcase

`packages/examples/code-editor-demo/` imports only public package entry points. It provides
deterministic scenarios covering every RD-05 facet, live state/limits/theme inspection, all
languages, read-only and degraded modes, hostile/Unicode/large fixtures, host-effect approval, and
the embeddable/window surfaces.

An in-process contract-faithful session supplies capabilities, configurable latency, cancellation,
races, malformed responses, truncation, reconnect, and failures. It does not spawn production
servers or access files/databases (AR-P19, AR-P20).

## Release integration

- Add `demo:code-editor` and standalone E2E child-process coverage.
- Add one concise registered global kitchen-sink story.
- Document public contracts, safe extension points, bounds, degradation, themes, languages, LSP,
  runtime adapter, accessibility, and examples.
- Add ADRs for package/text/parser/LSP/theme decisions and recorded probe evidence.
- Update package workspaces, exports, licenses/readmes/changelogs, release configuration, and
  published-package smoke tests.
- Extend the JSVision plugin catalog/recipes and regenerate API references; run sync/check gates.

## Error handling

| Error case | Strategy | AR Ref |
|------------|----------|--------|
| Fixture/demo service failure | Visible deterministic degraded scenario; demo remains operable | AR-P19, AR-P20 |
| Public/example import drift | Compile and clean-process E2E fail the phase | AR-P21, AR-P23 |
| Plugin generated content drifts | Run repository sync workflow and deterministic plugin gate | AR-P21 |
| Branch synchronization changes paths | Reopen affected plan decision and update targets first | AR-P22 |

## Testing requirements

- Scenario registry completeness test against the RD-05 facet manifest.
- Standalone startup/render/input/shutdown E2E.
- Global kitchen-sink registration/smoke.
- Public package pack/import, documentation link/build, plugin sync/check, and full `yarn verify`.
