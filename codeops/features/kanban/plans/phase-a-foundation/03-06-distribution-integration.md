# Technical specification: distribution and integration

> **Document**: 03-06-distribution-integration.md
> **Parent**: [Index](00-index.md)
> **Decision sources**: PAR-15–PAR-18, PAR-24
> **CodeOps Artifact Schema**: 1

## Package verification

Phase A adds three separate distribution proofs:

1. **Production dependency scan** parses production imports and confirms every external runtime import
   is declared while testing-only modules cannot enter production entry graphs.
2. **Native dependency scan** runs the repository checker and rejects native runtime dependencies.
3. **Packed consumer fixture** installs/links the generated tarball in an isolated temporary consumer
   and proves ESM runtime import, NodeNext types, exact export-map success/failure, testing entry,
   locale entries and no monorepo-only resolution. RD-10 adds the `zod: ^4` peer contract.

The packed test must not install dependencies implicitly beyond the workflow's explicit fixture setup
and must validate every resolved path. Temporary artifacts stay outside publish files.

## Documentation footprint

Included now:

- `packages/kanban/README.md`, `CHANGELOG.md`, license, and complete public JSDoc;
- one focused Kanban architecture reference under the opted-in technical docs, covering ownership,
  component topology, session/cursor lifecycle, projection bounds, and Phase A boundary;
- generated API inclusion for the main/testing/locale surfaces where the existing generator supports
  auxiliary entries;
- package install/inventory updates; and
- canonical JSVision skill/API reference and source-impact mapping, followed by generated plugin sync.

Deferred to Phase F:

- the docs-site component teaching page based on `component-page-template1`;
- `template1` live examples and their registry/specification tests;
- the separate Kanban kitchen sink and Reddit-ready showcase; and
- learner course/sidebar/component catalog entries that require an actual page.

Do not add a dead `API_MAP`/component-page backlink or placeholder page merely to satisfy inventory.
Generated API pages may exist independently and are linked when the real teaching page arrives.

## i18n registration

Add `{ "name": "kanban", "symbolPrefix": "kanban" }` to the official locale export registry. Run the
existing locale generator/check and literal/review checks. Add one current approved digest-bound
review record per non-English catalog, with disclosed review method, reviewer, and date. The change is
atomic: no registered catalog is left without review evidence.

Authored catalogs live under `src/i18n/{catalog,locales}.ts`; generated `src/locales/*.ts` files remain
thin wrapper entry points and are never hand-edited.

Catalog review is scoped to the Phase A vocabulary. Later catalog changes invalidate the digest and
must renew whole-catalog approval. No provisional exemption, alternative registry, or relaxed checker
is introduced.

## API and plugin integration

Add Kanban to the docs API package list and locale auxiliary package generation. Extend the canonical
API generator's explicit package/category mapping so `tools/jsvision-skill/references/api/kanban.md`
is generated from the public declarations. Update canonical skill routing/overview only where a
consumer needs to discover the new package.

Add Kanban source/docs/API paths to `tools/jsvision-plugin-impact.json`. After implementation:

1. run the impact report and inspect every mapped canonical reference;
2. update canonical sources under `tools/jsvision-skill/`, never the distributed plugin copy;
3. run `yarn plugin:update`;
4. inspect and include generated API, recipes/snapshots, and assembled plugin output; and
5. run `yarn plugin:check`.

## Repository inventories

Update only explicit inventories whose assertions become false when the package exists:

- supported install/package lists;
- docs API package/locale lists;
- i18n official package list and reviews;
- plugin API category/source-impact maps; and
- any workspace package expectations discovered by the focused red specifications.

Do not add Kanban to the controlled wall-clock performance registry in Phase A. Deterministic
read/range/allocation bounds are normative now; the warmed timing evidence and runner registration are
owned by Phase E.

## Verification sequence

The implementation closure sequence is:

1. Kanban package build and typecheck;
2. Kanban immutable specification, implementation/property, and E2E suites;
3. dependency, native, packed-consumer, and public-JSDoc checks;
4. affected docs API/typecheck/tests/build checks;
5. locale generation/check, literal checks, and translation-review check;
6. `yarn verify:local`;
7. source-impact review and `yarn plugin:update`;
8. `yarn plugin:check`; and
9. final focused rerun after generated changes.

The full root `yarn verify` is not a routine local task; CI remains authoritative unless the user asks
for it explicitly.

## Release truthfulness

Phase A may describe the package as a publishable foundation and read-only responsive board. It must
not advertise production-complete drag/drop, editing, workflow policy, complete accessibility/theme
hardening, kitchen sink, or showcase. RD-04/RD-05 and RD-13 through RD-15 remain incomplete in the
roadmap even after this plan executes.
