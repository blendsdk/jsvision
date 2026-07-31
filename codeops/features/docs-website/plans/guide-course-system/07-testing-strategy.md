# Testing Strategy: Guide Course System

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

Testing is specification-first for every route. Catalog outcomes and the `03-*` contracts define
expected behavior before course implementation. Specification files are immutable course oracles;
implementation files cover parser edges, fixture mechanics, responsive layout details, cleanup,
and other internal hardening.

### Coverage Goals

| Code type | Target |
|---|---:|
| Catalog validation and projection | 90% |
| Course contract and registry integration | 80% |
| Docs UI/example glue | 60% |

- Test names use `should [expected behavior] when [condition]`.
- Route phases run focused specs, implementation tests, typecheck, and docs checks.
- Phase 31 runs the documentation build and authoritative repository-wide `yarn verify`.

## 🚨 Specification Test Cases

> These cases come from RD-08's Guide requirements, the catalog outcomes, the confirmed ambiguity
> register, and `03-01` through `03-04`. Their expectations must not be weakened to match an
> implementation.

### Curriculum and navigation

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | Parse the committed curriculum | Exactly 31 stable entries: 29 Guide routes, Data Grid specialist, and Code Editor specialist; seven start Planned | RD-08 Guide Curriculum; 03-01 §Catalog Invariants |
| ST-2 | Parse an entry with an unknown prerequisite | Validation rejects it and identifies the invalid course | 03-01 §Error Handling |
| ST-3 | Parse a catalog whose prerequisite chain contains a cycle | Validation rejects the cycle and reports the involved path | 03-01 §Catalog Invariants |
| ST-4 | Project navigation from mixed Complete, Upgrade, and Planned entries | Complete/Upgrade real routes appear in catalog order; Planned entries do not | AR-7; 03-01 §Stage Transitions |
| ST-5 | Validate a Complete course whose example count is below target or whose ID is unregistered | Completion is rejected and the entry cannot remain Complete | 03-01 §Catalog Invariants; 03-03 §Error Handling |
| ST-6 | Render the learner-facing course map | Every catalog title and stage appears; real routes link; Planned entries have no dead link | AR-4, AR-7 |
| ST-7 | Inspect the repository Guide directive | It defines boundaries, learning contract, backbone, snippets, labs, failures, and completion gate | RD-08 Guide system; AR-1 |
| ST-8 | Resolve specialist entries | Routes are `/components/data-grid/` and `/components/code-editor/`; no duplicate `/guide/` pages exist | AR-3 |
| ST-9 | Promote a route after partial implementation | Promotion fails until route, outcome specs, required evidence, registry IDs, and focused verification are all present | 03-01 §Stage Transitions |

### Route courses

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-10 | Open Introduction as a new learner | It explains JSVision's application/runtime model, provides one live first-run result, and directs the learner to the right next course | `guides.json:introduction`; 03-02 |
| ST-11 | Follow Install & packages in a Node 22+ ESM project | It selects minimal packages by goal, shows valid public imports, diagnoses setup failures, and supplies verified non-live evidence | `guides.json:install-and-packages`; 03-02 §Authentic Substitutes |
| ST-12 | Audit Layout against the final contract | It still teaches cell geometry, flow sizing, overlays, and failure diagnosis; both labs pass compact/responsive evidence | `guides.json:layout`; 03-03 |
| ST-13 | Audit Reactive state against the final contract | It still teaches source/derived state, effects/batching/dynamic dependencies, and ownership cleanup; both labs pass lifecycle evidence | `guides.json:reactive-state`; 03-03 |
| ST-14 | Follow Codex plugin setup | It teaches supported installation/invocation, canonical-versus-generated sources, failure recovery, and verified host-side evidence | `guides.json:codex-plugin`; 03-02 §Authentic Substitutes |
| ST-15 | Complete Views & focus | The learner can explain view ownership/invalidation and build predictable tab, entry, restoration, and modal focus behavior in two labs | `guides.json:views-and-focus` |
| ST-16 | Complete Events, commands & keymaps | The learner can trace keyboard/mouse/paste/command flow and resolve command/keymap precedence in two labs | `guides.json:events-commands-and-keymaps` |
| ST-17 | Complete Keyboard & clipboard | The learner can use editing/selection chords and choose native/browser/custom clipboard authorization with one focused lab | `guides.json:keyboard-and-clipboard` |
| ST-18 | Complete Text, Unicode & terminal cells | The learner can reason about graphemes, wide/combining cells, wrapping/clipping, and ASCII-safe degradation in two labs | `guides.json:text-unicode-and-cells` |
| ST-19 | Complete Scrolling, lists & large content | The learner can choose the correct scrolling/list surface and coordinate viewport, focus, selection, bars, and bounded rendering in two labs | `guides.json:scrolling-lists-and-large-content` |
| ST-20 | Complete The application shell | The learner builds a menu/status/body/quit app, chooses Desktop or Router, and manages windows/lifecycle in two labs | `guides.json:application-shell` |
| ST-21 | Complete Dialogs & modality | The learner awaits modal results and implements validation, nested confirmation, cancellation, and focus-safe flows in two labs | `guides.json:dialogs-and-modality` |
| ST-22 | Complete Async work, cancellation & progress | The learner keeps input/rendering responsive and handles progress, cancellation, errors, cleanup, and stale results in two labs | `guides.json:async-work` |
| ST-23 | Complete Forms | The learner builds typed state, bindings, validation, submit/reset, and honest async states in two labs | `guides.json:forms` |
| ST-24 | Complete Files & the FileSystem seam | The learner uses host-neutral file workflows across Node, browser-virtual, and app-defined implementations in one lab | `guides.json:files-and-filesystem` |
| ST-25 | Complete Internationalization | The learner defines, validates, switches, and tests locales while keeping translated layouts usable in two labs | `guides.json:i18n` |
| ST-26 | Complete Screens & routing | The learner models screen state, navigation/history, focus restoration, and route-owned cleanup in two labs | `guides.json:screens-and-routing` |
| ST-27 | Complete Theming & colour depth | The learner selects themes and roles and designs legible behavior across color-depth/capability fallbacks in two labs | `guides.json:theming-and-colour-depth` |
| ST-28 | Complete Running in the browser | The learner mounts the same app through the browser host and handles key, resize, clipboard, and virtual-file boundaries in two labs | `guides.json:running-in-the-browser` |
| ST-29 | Complete Writing your own widget | The learner implements measure/layout/render/input, reactive invalidation, focus, theming, cleanup, and tests in two labs | `guides.json:writing-your-own-widget` |
| ST-30 | Complete Testing headlessly | The learner builds deterministic host/frame/input tests and distinguishes specification, implementation, and browser integration evidence using a real test artifact | `guides.json:testing-headlessly`; 03-02 §Authentic Substitutes |
| ST-31 | Complete Application architecture & best practices | The learner composes state, commands, services, screens, ownership, errors, and package boundaries in two labs | `guides.json:application-architecture` |
| ST-32 | Complete Debugging | The learner gathers bounded diagnostics and distinguishes layout, focus, event, reactive, and host failures with one lab | `guides.json:debugging` |
| ST-33 | Complete Crash safety & terminal restore | The learner explains terminal ownership and verifies normal, error, signal, and idempotent restoration using a real lifecycle artifact | `guides.json:crash-safety`; 03-02 §Authentic Substitutes |
| ST-34 | Complete Displaying untrusted text safely | The learner identifies escape injection and applies the documented sanitization/redaction boundary in one lab | `guides.json:untrusted-text` |
| ST-35 | Complete Accessibility & resilient interaction | The learner builds keyboard-reachable, visibly focused, non-color-dependent, reduced-geometry, monochrome, and ASCII-safe behavior in two labs | `guides.json:accessibility` |
| ST-36 | Complete Terminal capabilities & portability | The learner detects capabilities, chooses fallbacks, and explains portability limits without unsupported claims in two labs | `guides.json:terminal-capabilities` |
| ST-37 | Complete In production | The learner applies process supervision, restoration, logging/redaction, capability checks, performance evidence, and release readiness through authentic operational artifacts | `guides.json:in-production`; 03-02 §Authentic Substitutes |
| ST-38 | Complete Build a complete application | The learner assembles, tests, diagnoses, and production-checks one coherent application in two labs without duplicating prerequisite lessons | `guides.json:complete-application` |

### Specialist and integration behavior

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-39 | Follow Data Grid from the curriculum or related Guide lessons | Links resolve to its component hub; the Guide does not reproduce its specialist chapters | AR-3; 03-01 §Ownership Boundaries |
| ST-40 | Follow Code Editor from the curriculum or related Guide lessons | Links resolve to its component hub; the Guide does not reproduce its specialist chapters | AR-3; 03-01 §Ownership Boundaries |
| ST-41 | Traverse every prerequisite and next-step link | All links resolve and the learning path is acyclic | 03-01 §Catalog Invariants; 03-04 |
| ST-42 | Compare catalog stages, routes, curriculum map, sidebar, registry, and files | Every source agrees; all 29 Guide routes and two specialists are Complete | RD-08 acceptance criterion 1 |
| ST-43 | Inspect all completed Guide snippets | Public imports/symbols are valid and no snippet teaches an internal path or speculative behavior | 03-02 §Snippet Contract |
| ST-44 | Build every registered Guide lab at 80×24 and after maximize/restore | Each remains centered, Classic, keyboard usable, visibly responsive, and unclipped | 03-03 §Evidence Layers |
| ST-45 | Exercise labs involving async work, resources, unsafe text, or host seams | Cleanup, cancellation, sanitization, denial, and authorization match the owning public behavior | 03-03 §Security and Host Boundaries |
| ST-46 | Run the production VitePress documentation build | All Guide routes, links, snippets, and lazy lab imports build successfully | AR-9 |
| ST-47 | Run `yarn verify` from the repository root | The authoritative repository gate exits successfully with no new warning class | AR-9 |

## Test Categories

### Specification Tests

| Test file | ST cases | Purpose |
|---|---|---|
| `test/guide-catalog.spec.test.ts` | ST-1–ST-9, ST-39–ST-42 | Catalog, route, navigation, specialist, and coherence contract |
| `test/<course>-guide.spec.test.ts` | ST-10–ST-38, one file per Guide route | Page outcomes, snippets, examples/substitutes, and user-visible behavior |
| Existing Layout/Reactive specification files | ST-12–ST-13 | Re-audited pilot oracles |
| `test/guide-integration.spec.test.ts` | ST-41–ST-47 | Cross-course links, snippets, labs, docs build inputs, final contracts |

### Implementation Tests

| Test file | Description | Priority |
|---|---|---|
| `test/<course>-guide.impl.test.ts` | Route-specific fixture mechanics, responsive edges, cleanup, and errors | High |
| `test/guide-catalog.impl.test.ts` | Parser/type-guard boundaries, cycle paths, invalid shapes | High |
| `test/guide-integration.impl.test.ts` | Registry import, rendered-route, and bounded batch diagnostics | High |

### Integration Tests

| Test | Components | Description |
|---|---|---|
| Curriculum projection | Catalog + VitePress + Markdown | Real navigation exactly matches eligible catalog entries |
| Laboratory registry | Catalog + registry + demo app | Every declared lab imports and builds as an app |
| Snippet/public API parity | Markdown + public package barrels | Teaching snippets reference supported symbols |
| Specialist boundary | Guide + component hubs | Bidirectional links resolve without duplicate ownership |

### End-to-End Tests

| Scenario | Steps | Expected result |
|---|---|---|
| New learner path | Start at Introduction, follow prerequisites through Complete application | Every step resolves and states the next capability |
| Live course lesson | Open a Guide route, run its labs, resize/maximize/restore, use keyboard actions | Lesson remains usable and feedback matches prose |
| Production docs build | Generate API docs and build VitePress | All pages and lazy examples render without errors |

## Test Data

### Fixtures needed

- Standard 80×24 and expanded 120×40 viewports.
- Deterministic Unicode, wide-cell, list/tree, async, file, locale, capability, unsafe-text, and
  production-diagnostic fixtures.
- Browser virtual filesystem and explicitly denied/authorized host adapters.
- Monochrome, ASCII-safe, and reduced-geometry capability profiles.

### Mock requirements

Use real JSVision views, hosts, registry modules, and browser virtual seams. Mock only unavailable
external host capabilities such as an OS clipboard, signal delivery, local file picker, or network,
and make the boundary visible in the lesson.

## Verification Checklist

- [ ] All ST cases have route-level specification coverage.
- [ ] Every new specification is observed red before implementation, or a pilot's pre-existing pass
      is justified.
- [ ] Implementation changes make immutable specifications green.
- [ ] Route-specific implementation tests cover edge/error behavior.
- [ ] All Guide labs pass compact, responsive, interaction, accessibility, security, and cleanup
      checks relevant to their subject.
- [ ] Catalog/sidebar/map/route/registry/link integration passes.
- [ ] `yarn docs:build` passes.
- [ ] `yarn verify` passes.
