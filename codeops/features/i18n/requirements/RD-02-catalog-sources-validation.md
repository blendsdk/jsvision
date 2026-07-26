# RD-02: Catalog Sources and Validation

> **Document**: RD-02-catalog-sources-validation.md
> **Status**: Draft
> **Created**: 2026-07-25
> **Project**: jsvision (`@jsvision/i18n`)
> **Depends On**: RD-01
> **CodeOps Artifact Schema**: 1

---

## Feature Overview

Provide deterministic catalog composition, custom asynchronous sources, and a secure Node-only JSON
loader. This ports BlendSDK's source abstraction and ordered merge concept while replacing heuristic
format detection, unrooted globs, permissive coercion, and unchecked `JSON.parse` with one explicit
schema and a bounded validation boundary. *(AR #14–AR #18, AR #29)*

## Functional Requirements

### Must Have

- [ ] **FR-1 — Catalog utilities.** `defineCatalog()`, `validateCatalog()`,
      `validateCatalogs()`, and `mergeCatalogs()` accept only schema-1 locale-scoped catalogs.
      `mergeCatalogs()` preserves input order and returns validated copies; later input wins for the
      same locale/key. It never mutates caller objects. *(AR #14, AR #15, AR #17)*
- [ ] **FR-2 — Async source contract.** A `CatalogSource` has a stable `name`, optional
      `required` flag defaulting to `true`, and
      `load({ signal }): Promise<CatalogInput | readonly CatalogInput[]>`. *(AR #16, AR #18)*
- [ ] **FR-3 — Atomic load.** `loadI18n()` starts sources with one signal, awaits their results,
      diagnoses and skips failed optional sources, rejects a failed required source, validates and
      merges all successful results, and publishes no service until the complete snapshot is valid.
      An aborted load rejects with `ABORTED`. *(AR #4, AR #5, AR #16)*
- [ ] **FR-4 — Caller-owned timeout and network.** The package ships no HTTP source and creates no
      timeout. Callers compose `AbortSignal.timeout()`/`AbortSignal.any()` and implement remote
      authentication, authorization, TLS, retry, rate limiting, and cache policy. *(AR #16, AR #27)*
- [ ] **FR-5 — Node JSON source.** `jsonFileSource({ root, paths, required?, limits? })` is exported
      only by `@jsvision/i18n/node`. `root` is mandatory; every path is relative, uses no `..`, names
      a `.json` file, and resolves after symlinks to a regular file contained by the canonical root.
      *(AR #17, AR #22)*
- [ ] **FR-6 — Deterministic paths.** Literal paths load in declaration order. A path ending in
      `/*.json` expands only the immediate rooted directory, sorts canonical relative paths
      lexicographically, and rejects every other glob metacharacter or recursive pattern. A literal
      missing file is a source failure; an empty glob is a valid empty result. *(AR #16, AR #17)*
- [ ] **FR-7 — Strict JSON.** The loader accepts UTF-8 JSON objects matching the catalog schema,
      rejects BOM-invalid/ill-formed UTF-8, duplicate object members at every depth, trailing data,
      comments, non-finite values, unknown fields, and shape inference. It never converts invalid
      values with `String()`. *(AR #14, AR #17, AR #29)*
- [ ] **FR-8 — Resource bounds.** Default limits are 2 MiB per file before allocation/read,
      10,000 messages per catalog, 512 Unicode scalar values per key, and 65,536 UTF-8 bytes per
      individual message string. Callers may lower limits but may not raise the hard maxima.
      *(AR #17)*
- [ ] **FR-9 — Text safety.** Catalog strings and interpolated string parameters allow ordinary
      Unicode and LF line breaks. They reject lone surrogates, NUL, CR, TAB, ESC, DEL, all other C0
      controls, C1 controls including CSI, and bidi embedding/override/isolate controls. A rejected
      catalog is atomic; an unsafe runtime parameter remains unresolved and diagnoses. *(AR #5,
      AR #17)*
- [ ] **FR-10 — Strict completeness.** Validation can compare a locale catalog with a supplied
      English/reference catalog and accelerator manifest. Strict mode reports missing/extra keys,
      kind mismatches, placeholder-set mismatches, invalid plural categories for the catalog locale,
      missing `other`, malformed accelerators, and scoped collisions. *(AR #3, AR #10, AR #21)*
- [ ] **FR-11 — Accelerator classification.** Structural/security/schema/message errors always
      reject a catalog. Official catalogs always validate accelerators strictly. Application
      validation warns in normal mode and errors in strict mode; runtime package helpers ignore only
      the affected invalid label override and use the valid English default. *(AR #5, AR #10)*

### Should Have

- [ ] **FR-12 — Issue formatting.** A utility renders validation issues with source, locale, key,
      path, and stable code for CI without including message/parameter values. *(AR #18)*

### Won't Have (Out of Scope)

- Recursive globbing, YAML, TOML, JavaScript catalog modules loaded from disk, content files, or
  automatic format detection.
- Built-in network/database sources, retries, caching, polling, file watching, or hot reload.
- Automatic schema migration or best-effort parsing of unknown versions.

## Technical Requirements

### T-1 Source API

```typescript
export interface CatalogSource {
  readonly name: string;
  readonly required?: boolean;
  load(context: { readonly signal: AbortSignal }): Promise<CatalogInput | readonly CatalogInput[]>;
}

export function loadI18n(
  options: CreateI18nOptions & {
    readonly sources: readonly CatalogSource[];
    readonly signal?: AbortSignal;
  },
): Promise<I18n>;
```

When no signal is supplied, `loadI18n()` creates a private non-aborted controller so every source
receives the same concrete `AbortSignal`. *(AR #16)*

### T-2 Root containment sequence

For each Node path:

1. Validate the lexical relative-path grammar and `.json` suffix.
2. Resolve the declared root and obtain its canonical real path.
3. Resolve and canonicalize the candidate.
4. Verify the candidate is within `root + pathSeparator`, not merely string-prefixed.
5. Open without following a post-check replacement where the platform permits; verify regular-file
   metadata and byte size before reading.
6. Decode UTF-8 fatally, strict-parse, validate, and close on every path.

Tests must include sibling-prefix roots, `..`, absolute paths, nested symlink escape, file symlink
escape, directory input, FIFO/non-regular input where supported, and a file swapped during loading.
*(AR #17, AR #26)*

### T-3 Catalog ownership and collision rules

- Duplicate members within one JSON document are invalid.
- Duplicate keys within one normalized catalog are invalid.
- The same locale/key across declared catalog layers is valid and later wins.
- Application catalogs are ordered after framework catalogs.
- `setCatalog()` owns one runtime overlay per locale and replaces it rather than accumulating layers.

*(AR #15, AR #22)*

### T-4 Provenance

The new package documents that its initial source was ported and substantially adapted from
`@blendsdk/i18n` by TrueSoftware B.V., declared MIT in the supplied source. The JSVision package
includes the required MIT copyright/permission notice in its published files. No
`@blendsdk/stdlib` or other BlendSDK package is a dependency. *(AR #29)*

## Integration Points

- RD-01 owns catalog/message types, errors, diagnostics, and service construction.
- RD-03 consumes package locale catalogs through explicit subpath imports.
- RD-04 validates review manifests, packaging, security, docs, and release evidence.

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale | AR Ref |
|---|---|---|---|---|
| JSON formats | Heuristic single/multi locale / one schema | One schema | Removes ambiguity and unsafe coercion | AR #14, AR #17 |
| Paths | Arbitrary/glob / rooted bounded glob | Rooted bounded glob | Useful local loading with a testable security boundary | AR #17 |
| Optional source failure | Fail all / partial publication / skip before atomic publication | Skip optional, then publish once | Accepted resilience without partial state | AR #5, AR #16 |
| Network | Built in / custom source | Custom source | Caller owns transport and security policy | AR #16, AR #27 |

## Security Considerations

- **Data sensitivity:** Catalogs must not contain credentials, tokens, or personal data.
- **Input validation:** Strict JSON and catalog validation occur before publication.
- **Path traversal:** Lexical and canonical containment checks reject traversal and symlink escape.
- **Terminal injection:** Catalog and parameter controls/bidi characters are rejected.
- **Resource exhaustion:** Pre-read byte caps and catalog/message/key bounds are mandatory.
- **TOCTOU:** Open/stat/read ordering and platform-appropriate no-follow behavior minimize replacement risk.
- **Network/auth/encryption/rate limiting:** Out of package scope and explicitly caller-owned for custom sources.

## Acceptance Criteria

1. [ ] A valid rooted JSON catalog loads identically on Node 22 Linux, macOS, and Windows path semantics.
2. [ ] Tests reject absolute paths, `..`, sibling-prefix escape, directory/non-regular inputs, and
       symlinks escaping the canonical root before parsing any catalog.
3. [ ] A 2 MiB file is accepted and a 2 MiB + 1 byte file is rejected before JSON parsing; 10,001
       keys and a 65,537-byte message are rejected atomically.
4. [ ] Duplicate JSON members at top-level, `messages`, `cases`, and nested structured objects each
       produce a stable duplicate-member issue.
5. [ ] Required failure rejects `loadI18n`; optional failure produces one diagnostic and does not
       prevent valid sources from appearing in the resulting service; abort never publishes a service.
6. [ ] A diagnostic sink that throws does not alter source failure classification or translation state.
7. [ ] The published package contains MIT attribution and has no BlendSDK runtime dependency.
