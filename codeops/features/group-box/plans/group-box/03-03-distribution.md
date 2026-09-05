# Distribution: GroupBox

> **Document**: 03-03-distribution.md
> **Parent**: [Index](00-index.md)

## Overview

Complete the additive SDK surface by synchronizing public packaging, generated documentation,
agent-facing guidance, generated plugin output, and package changelogs (AR #7).

## Public Packaging and API Documentation

The local `group-box` barrel owns the class/type exports. The top-level UI entry point re-exports
them so both runtime construction and type-only imports work from `@jsvision/ui`. Exhaustive JSDoc
must allow TypeDoc to generate the class, options, and alignment-type pages without handwritten API
files.

The docs API map links the generated `GroupBox` class page to the component page. Generated API
artifacts remain owned by `yarn docs:build`; do not hand-edit them.

The plugin API generator classifies UI exports by their first source-path segment. Add the exact
`group-box: 'containers'` membership mapping and cover it through the existing API-reference
specification before updating the generator. Do not redesign category discovery.

## JSVision Skill and Plugin

Add `GroupBox` to `tools/jsvision-skill/references/component-catalog.md` with a concise selection
boundary against `Group`, `TabView`, `Window`, and `Dialog`, its passive behavior, caption/padding
defaults, role, and shadow-spacing caveat. Do not edit the distributed plugin copy directly.

Run `yarn plugin:update` after the canonical update. Review the resulting generated API/reference,
source-impact snapshot, and assembled plugin changes, then run `yarn plugin:check` (AR #7, AR #8).

## Changelogs

Add release-facing entries to:

- `packages/ui/CHANGELOG.md` for the new public component;
- `packages/examples/CHANGELOG.md` for the registered kitchen-sink story; and
- `packages/docs-site/CHANGELOG.md` for the component page and laboratory.

Add each entry beneath an explicit top-of-file `Unreleased` section, creating that heading when it is
absent. Do not invent or change package versions and do not append new work to an older released
version.

## Compatibility and Security

This is an additive export. No existing signature, theme role, layout behavior, capability mapping,
serialized format, or package dependency changes. All user-provided title text remains inside the
existing sanitizing and clipping draw boundary.

## Testing Requirements

Cover ST-3, ST-22 through ST-24, ST-29, and ST-35 through ST-37. Verification must include generated
docs, plugin category placement, canonical guidance, changelog entries, and plugin parity rather than
checking source files alone.
