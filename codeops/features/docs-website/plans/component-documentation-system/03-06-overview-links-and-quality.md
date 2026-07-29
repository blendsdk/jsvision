# Specification: Overview, Cross-links, and Content Quality

> **Requirements**: PR-1, PR-4, PR-7, PR-8
> **Decisions**: AR-10, AR-12, AR-13, AR-14, AR-15, AR-17

## Components Overview

Rewrite `/components/` as a catalog-backed learning map with:

1. a concise explanation of standard components vs specialist hubs;
2. a linked family matrix;
3. an application-composition tree:

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

4. “choose this when…” links for related pairs/families;
5. prominent Data Grid and Code Editor hub cards;
6. links to layout, reactivity, theming, accessibility, and API guides.

The rendered links are projected from or checked against catalog IDs, so adding a catalog row cannot
silently leave the overview incomplete.

## Cross-link Rules

| Relationship | Required explanation |
|---|---|
| View ↔ Group | Leaf/base customization vs child composition. |
| Desktop ↔ Router | Window-managed applications vs screen-stack applications. |
| Window ↔ Dialog | Modeless/movable surface vs modal task. |
| List View ↔ List Box | Generic item model/rendering vs string-list convenience. |
| Scroller ↔ Scroll Bar | Content viewport vs standalone scrollbar. |
| Calendar ↔ Date Picker | Always-visible month selection vs compact dropdown. |
| Color Swatch ↔ Color Picker | Palette grid vs compact popup/value entry. |
| Surface ↔ Surface View | Off-screen buffer vs visual viewport. |
| Editor/Memo/Edit Window ↔ Code Editor | General text editing vs language-aware code editing. |
| DataGrid ↔ EditableDataGrid | Read-only/simple table vs typed editable advanced grid. |
| File Dialog family | Ready-made modal vs composable file views/input/editor. |

Related sections must link to the decision boundary, not just provide a flat “See also” list.

## API-Link Consolidation

The component catalog is authoritative for which page documents a visual symbol.
`api-map.mjs` remains checked in because the existing generation pipeline consumes it directly, but
its rows must have exact parity with catalog component `apiSymbols`.

- `validate-api-map.mjs` derives its package allowlist from `src/api/packages.mjs`; its declaration
  and all duplicated `ApiLink` package unions include `code-editor`.
- One shared `component-target.mjs` parser validates a site-absolute `/components/` route plus an
  optional kebab-case fragment and returns `{ route, fragment, label, buildKey }`. `buildKey`
  follows the build checker's existing `pageKey()` semantics: ordinary pages resolve to
  `<route>.html`, while trailing-slash hub landings resolve to `<route>/index.html`.
- `api-map.mjs`, backlink injection, API-map tests, and `check-docs-build.mjs` use that parser.
  Filesystem/build lookup uses `buildKey`, never string-appends `.html` to a fragment-bearing source;
  the fragment is checked as a rendered heading and omitted from the human page label. Tests cover
  plain pages, directory landings, and both route forms with fragments.
- Catalog/API parity updates these consumers before any anchored Data Grid or Code Editor API row
  lands.

## Content Review Gate

Automated checks prove structure and links. A bounded manual review checklist proves teaching quality:

| Review | Pass condition |
|---|---|
| Source accuracy | Claims/defaults/keys/theme roles match the inspected public source/tests. |
| Learning flow | A new reader can construct the component before encountering advanced details. |
| Snippet focus | Each snippet teaches one concept and omits unrelated shell/plumbing. |
| Example objective | The checked-in behavior contract, title, blurb, instructions, states, exact action, and expected result support one explicit objective. |
| Decision boundaries | Related links explain when to choose each component. |
| Accessibility | The lesson exists in DOM prose/source and interactions remain keyboard-operable. |
| Performance honesty | No unmeasured speed claims; scale pages state source shape and constraints. |
| Security honesty | File/export/LSP/untrusted-text examples state and preserve their boundary. |

Each family/hub phase records this checklist in its execution notes before being marked complete.

## Removed Route Audit

The final repository scan excludes generated build output and dependencies, then requires zero
references to:

- `/components/table/data-grid`
- `/guide/code-editor`

Historical CodeOps artifacts are not rewritten solely to erase history; the executable docs source,
sidebar, catalog, API map, tests, and current guides must be clean.

## Verification

- Specification: ST-6, ST-7, ST-8, ST-29 through ST-32.
- Docs build/link gate verifies the rendered overview, specialist sidebars, anchors, and API backlinks.
- Final: `yarn verify`.
