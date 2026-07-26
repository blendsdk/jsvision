# Testing strategy: Code Editor internationalization

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing overview

Tests use real `I18n`, Code Editor controller/document/view, render buffers, built package entry
points, and existing generator/check scripts. Fixture catalogs use unmistakable safe labels so
translation boundaries are observable without making immutable tests depend on unapproved
non-English prose.

### Coverage goals

| Code type | Target |
|---|---|
| Catalog/projector logic | 90% |
| Service and tooling integration | 80% |
| UI composition | 60% |

## 🚨 Specification test cases

> These cases are immutable behavior oracles derived from `01-requirements.md`, the three
> component specifications, and the resolved ambiguity register. Implementation must change when
> an oracle fails.

### Catalog, injection, and package isolation

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-1 | Construct two standalone `CodeEditor` instances without `i18n` | Both render historical English, expose distinct English service objects, and share no catalog overlay/diagnostic state | FR-1; 03-01 §Public integration |
| ST-2 | Supply one fixture `I18n` to `CodeEditorWindow` | `window.i18n` and `window.editor.i18n` are the exact supplied object | FR-1; AR-4 |
| ST-3 | Omit window title with fixture translations; then supply an explicit caller title | Default title equals the translated key; explicit title remains byte-for-byte caller text | FR-3, FR-5; 03-01 §Public integration |
| ST-4 | Render status for language `typescript`, line `12`, visual column `34` with fixture labels/number formatting | Language ID remains `typescript`; labels and displayed numbers use the service; numeric `status` remains `{ line: 12, column: 34 }` | FR-3, FR-5; AR-7 |
| ST-5 | Layer an application catalog after an official/fixture Code Editor catalog | Application value wins for an editor-owned key; a missing key uses canonical English and emits only existing bounded diagnostics | FR-1, FR-3; AR-6 |
| ST-6 | Import every `@jsvision/code-editor/locales/<locale>` after build | Each subpath exports exactly one canonical schema-1 catalog for its requested official locale | FR-2; 03-01 §Catalog modules |
| ST-7 | Strictly validate every official catalog against English | Keys, message kinds, placeholders, terminal safety, and declared accelerator scopes match exactly | FR-2; AR-9, AR-10, AR-11 |
| ST-8 | Inspect main and `./node` entry graphs plus main exports | Main is browser-safe and exposes no eager catalog registry; Node adapter remains available only from `./node` | FR-2; AR-15 |

### Structured presentation and external-content ownership

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-9 | Navigate to an LSP diagnostic with severity `warning` and normalized external detail `HOST Ω detail` under a fixture catalog | Visible row uses the translated warning wrapper exactly once and retains `HOST Ω detail` unchanged | FR-3, FR-5, FR-6; 03-02 §Structured diagnostic projection |
| ST-10 | Present completion, hover, signature, symbol, navigation URI, and diagnostic detail containing safe caller markers | Every external marker remains unchanged; no marker is looked up or transformed as framework text | FR-5; AR-5 |
| ST-11 | Format unavailable/failure and retry/operation degradation notices with a supplied service | Stable reasons map to the two translated messages; `limit` returns `undefined`; legacy English `message` remains present | FR-3, FR-6; 03-02 §Degradation projection |
| ST-12 | Format a detected warning for code point `U+202E` | Wrapper translates, token remains exactly `U+202E`, source and offset remain unchanged, and legacy label remains `warning U+202E` | FR-3, FR-6; 03-02 §Invisible-character projection |
| ST-13 | Pass accessor-backed or malformed runtime objects to public projectors | Accessors are not invoked; output is safe/bounded or `undefined`; no terminal controls appear | FR-5, FR-6; AR-11 |

### Search, layout, and lifecycle

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-14 | Open find with empty query, then queries producing one and multiple matches | One localized row appears; match prose selects zero/one/other through the service and displayed counts use locale number formatting | FR-4; 03-02 §Match messages and numbers |
| ST-15 | Open replace and switch active field with Tab | Two localized rows appear; active field indication follows semantic state; query and replacement markers remain exact caller content | FR-4, FR-5; AR-2 |
| ST-16 | Toggle case sensitivity and execute next/previous/replace/replace-all/dismiss using existing APIs/keys | Presentation updates, while match results, wrapping, atomic replacement, one undo unit, command IDs, and dismissal semantics remain unchanged | FR-4; AR-7 |
| ST-17 | Render long application overrides, CJK labels, emoji, and combining marks in assistance/search/status | Bounds use display cells, no wide glyph is split, combining marks do not add false width, and no write exceeds the view | FR-7; 03-02 §Geometry |
| ST-18 | Render find/replace at zero, tiny, and ordinary widths | Output stays within bounds; required field content has priority; lower-priority state/hints disappear deterministically | FR-4, FR-7; 03-02 §Geometry |
| ST-19 | Open search and assistance in one editor, dispose it, then reconstruct with another locale | New editor has clean search/assistance/modal/pending state and uses only the new exact service | FR-10; 03-02 §Lifecycle isolation |

### Tooling, documentation, and plugin

| # | Input / scenario | Expected output / behavior | Source |
|---|---|---|---|
| ST-20 | Run locale generator/check with five configured packages and ten locales | It generates/verifies fifty explicit entry points and no count is hard-coded independently of configuration | FR-8; AR-9 |
| ST-21 | Run literal ownership extraction/check after Code Editor localization | Every candidate under the configured Code Editor source root is classified; stale/mismatched entries fail | FR-8; 03-03 §Validation and review tooling |
| ST-22 | Build and run translation review loading with Code Editor configured but no fabricated review entries | Tool expects forty-five non-English package catalogs and reports each missing/stale real approval accurately | FR-11; AR-12 |
| ST-23 | Run docs and canonical skill tests | Code Editor locale entry points, injection example, override precedence, and external-content boundary are present and imports compile | FR-9; 03-03 §Documentation |
| ST-24 | Run plugin update/check after mapped source/reference changes | Generated API/recipe/skill copy matches canonical sources and impact fingerprints | FR-9; 03-03 §Canonical skill and generated plugin |

## Test categories

### Specification tests

| Test file | ST cases |
|---|---|
| `packages/code-editor/test/i18n-catalog.spec.test.ts` | ST-1 through ST-8 |
| `packages/code-editor/src/ui/i18n-presentation.spec.test.ts` | ST-9 through ST-19 |
| `packages/i18n/test/locales.spec.test.ts` | ST-6, ST-7 |
| `packages/i18n/test/i18n-package-registration.spec.test.ts` | ST-20 through ST-22 |
| `packages/docs-site/test/i18n-docs.spec.test.ts` | ST-23 |
| `tools/jsvision-skill/test/i18n-plugin.spec.test.ts` | ST-23, ST-24 |

### Implementation tests

| Test file | Coverage |
|---|---|
| `packages/code-editor/test/i18n-catalog.impl.test.ts` | Catalog helpers, fallback isolation, invalid projector input |
| `packages/code-editor/src/ui/i18n-presentation.impl.test.ts` | Segment priority, clipping boundaries, invalid/tiny geometry |
| Existing search/LSP/degradation implementation suites | Regression coverage for unchanged semantics |
| Script implementation tests or focused process checks | Invalid config, duplicate packages, derived totals, drift |

### Integration and end-to-end

- Mount real localized `CodeEditorWindow` instances in an application render loop.
- Import built locale and Node subpaths.
- Run the existing Code Editor demo/test journeys under explicit fixture services.
- Compile docs examples and regenerate/check the canonical plugin.
- Run authoritative `yarn verify`.

## Test data

- Safe fixture catalog with visibly distinct labels and structured plurals.
- Caller/LSP markers containing CJK, emoji, combining marks, paths, URIs, and safe punctuation.
- Hostile accessor-backed objects and terminal-control strings at public runtime boundaries.
- Official locale configuration and built package exports.

No filesystem/network/process mocks are needed beyond existing package-build and script test
harnesses; real in-memory application/controller/document objects are preferred.

## Verification checklist

- [ ] ST-1 through ST-24 have concrete immutable tests.
- [ ] Each implementation phase records expected red before changing production code.
- [ ] Catalog/injection specifications pass green before implementation tests are added.
- [ ] Presentation specifications pass green without changing search/LSP/controller semantics.
- [ ] Tooling/docs/plugin specifications pass green from generated canonical sources.
- [ ] Package typecheck, test, and docs checks pass during focused iteration.
- [ ] `yarn plugin:update` and `yarn plugin:check` pass.
- [ ] `yarn verify` passes.
- [ ] External proficient-review and #185 harness status are reported honestly.
