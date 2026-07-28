# Component specification: sources and security

## Async source orchestration

`loadI18n` creates or adopts one concrete `AbortSignal`, invokes every source in declaration order,
and awaits all initiated loads. Results retain source order regardless of completion order.
Required failure rejects before service publication; optional failure contributes one value-free
diagnostic to the eventually published service. Abortion always rejects with `ABORTED`.

The library does not create HTTP requests, retries, caches, credentials, or timeouts. The documented
custom-source recipe composes caller-owned `AbortSignal.timeout()`/`AbortSignal.any()`.

## Node-only boundary

`packages/i18n/src/node/index.ts` exports `jsonFileSource` and Node loader option types. Its imports
may use `node:fs/promises`, `node:path`, and `node:util`; no browser-safe source imports this module.
The package export map makes `./node` explicit.

## Strict parser

`strict-json.ts` implements a small recursive-descent JSON grammar over decoded text:

- object, array, string, number, boolean, and null tokens;
- duplicate member detection at every object depth before assignment;
- maximum nesting and scalar/token accounting;
- exact escape and surrogate-pair validation;
- JSON-number grammar with finite result;
- whitespace limited to JSON whitespace and no trailing token.

The parser returns null-prototype records and arrays. Catalog validation then rejects arrays, null,
unknown fields, and all shapes outside schema 1. The parser is internal and receives adversarial and
property-style tests.

## File containment

For every declared literal or expanded immediate glob:

1. reject absolute paths, backslashes on POSIX-neutral input, empty segments, `.`/`..`, unsupported
   glob characters, and non-`.json` suffixes;
2. resolve and canonicalize the mandatory root;
3. canonicalize the candidate and verify it is either below `root + separator` or rejected;
4. open the file, inspect the opened handle as a regular file, enforce size before read, and compare
   canonical/handle metadata where the platform supports it;
5. read the bounded bytes, decode with fatal UTF-8, strict-parse, validate, then close in `finally`.

Immediate `/*.json` expansion sorts canonical relative paths. Literal absence fails the source;
empty expansion yields no catalogs. Tests tolerate platform-specific race defenses only when the
platform cannot expose stronger handle metadata, but containment and regular-file rejection never
weaken.

## Resource and text limits

Hard maxima are enforced at the earliest boundary: 2 MiB/file, 10,000 messages/catalog, 512 Unicode
scalars/key, and 65,536 UTF-8 bytes/message string. Caller limits can only lower maxima.

Text validation permits LF and ordinary Unicode, while rejecting ill-formed surrogates, NUL, other
C0/C1 controls, DEL, ESC/CSI, and bidi embedding/override/isolate controls. Diagnostics and formatted
validation issues carry identifiers and structural locations only.

## Provenance

`THIRD_PARTY_NOTICES.md` is included in package files and contains the supplied BlendSDK MIT
copyright/permission notice plus a concise adaptation statement. The README and changelog link to
it. No BlendSDK runtime package appears in dependencies or generated output.
