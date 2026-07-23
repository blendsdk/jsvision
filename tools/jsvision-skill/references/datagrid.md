# Enterprise grids with `@jsvision/datagrid`

Use UI `DataGrid` for read-oriented tables. Use `EditableDataGrid` for typed columns, editing, validation, selection, sorting, filtering, frozen areas, virtualization, personalization, export, or master-detail.

1. Define stable row types and keys.
2. Build columns with `column`; choose width, alignment, format, parse, editing, and validation.
3. Adapt data with `fromRows`, `fromReactiveRows`, or a windowed source.
4. Wrap the grid with loading/error/empty state.
5. Wire controlled selection, sorting, filtering, commit, and validation.
6. Persist personalization only with schema versioning.

Consult installed declarations and the public barrel for exact signatures because bundled API pages predate this package. Distinguish parse, validation, and persistence failures. Preserve edits on failed commits. Bound dirty/error registries. Suppress stale window requests. Avoid per-cell effects and unstable row/column objects.

Test window boundaries, invalidation, selection persistence, frozen regions, empty results, partial failures, navigation, narrow widths, and unsaved edits. Do not rely on color alone for focus, selection, dirty, or invalid states.
