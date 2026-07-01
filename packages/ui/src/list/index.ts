/**
 * `list/` barrel (RD-11) — the list-container subsystem.
 *
 * Public symbols land in Phase 3 and are re-exported through `@jsvision/ui`'s single entry point
 * (`src/index.ts`, explicit named re-exports per the AR-102 convention): `ListView<T>` +
 * `ListBox` (TV `tlstview.cpp`/`tlistbox.cpp`), over the internal `virtual`/`list-rows` helpers.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
export {};
