# Component specification: engine and catalog

## Public modules

`packages/i18n/src/index.ts` exports the documented browser-safe surface. Internal modules divide
responsibility as follows:

| Module | Responsibility |
|---|---|
| `types.ts` | Public catalog/message/service/source/diagnostic types |
| `errors.ts` | Stable `I18nError` codes and validation issue types |
| `locale.ts` | POSIX cleanup, BCP-47 canonicalization, catalog fallback chain |
| `messages.ts` | Placeholder tokenizer, message compiler, plural/select helpers |
| `validation.ts` | Schema, grammar, text-safety, completeness, accelerator validation |
| `catalog.ts` | Deep-copy catalog snapshots and ordered merge |
| `diagnostics.ts` | Deduplicated 100-record insertion-ordered store and guarded sink |
| `cache.ts` | Four independent 64-entry LRU formatter caches |
| `service.ts` | `createI18n`, lookup, formatting, comparison, `has`, atomic overlay |
| `source.ts` | `loadI18n` orchestration with required/optional sources |

No internal module imports a consuming JSVision package or a `node:*` module.

## Snapshot model

Publication builds an immutable snapshot:

```text
snapshot
└─ locales: Map<catalogLocale, readonly Layer[]>
   └─ layer.messages: Map<key, CompiledMessage>
```

Input objects, case maps, formatter option objects, and parameter maps are never retained.
`setCatalog` validates and compiles a replacement overlay into a new snapshot, then swaps the
service's one snapshot reference. Lookup captures that reference once. Failed publication cannot
mutate the active graph.

## Lookup algorithm

1. Validate the key and copy/validate permitted parameter primitives.
2. Walk requested region, requested language, configured fallback region/language, then `en`,
   deduplicating canonical catalog locales.
3. At each locale, walk layers newest to oldest.
4. Resolve the first message using that catalog locale for plural selection and numeric
   interpolation.
5. If no catalog message exists, evaluate the English `defaultMessage`; otherwise return the key.
6. Record recoverable missing translation/controller/parameter faults without message or value data.

Call-site defaults compile through the same safe message path and never become persistent layers.

## Message compilation

The compiler scans strings once into literal and placeholder tokens. `$${name}` is a literal
placeholder token and `${name}` is a substitution token. It rejects invalid placeholder names,
unsafe text, nested structured cases, unsupported plural categories, and non-own case members.

Plural control uses cached `Intl.PluralRules(locale, { type: 'cardinal' })`. Select cases match the
exact safe primitive string. Invalid controllers choose `other` and diagnose. Formatting a numeric
placeholder uses the message locale's cached default `Intl.NumberFormat`.

## Formatting API

Formatter option objects are copied through explicit allowlists and serialized in stable key order.
Invalid values throw `I18nError`; native object coercion is never invoked. Each cache evicts its
least-recently-used entry after 64 entries. `compare` compares NFC strings with an `Intl.Collator`;
framework search additionally applies locale casing before comparison.

## Validation and accelerators

Validation returns immutable, stably sorted issues. Strict completeness receives an English
reference catalog, placeholder manifest, and accelerator scope manifest. It compares key sets,
message kinds/placeholders, locale-valid plural categories, and one ASCII accelerator per required
label. Runtime application overrides with an invalid accelerator are rejected per key so the
framework's valid English default remains usable.

## Public error boundary

Construction, validation publication, formatter misuse, and loading fail with `I18nError`.
Recoverable translation misses use diagnostics. The optional diagnostic sink is called after record
insertion and is wrapped so it can neither break translation nor recurse into the store.
