# Forms with `@jsvision/forms`

Use Forms for validation, dirty/submission state, reset, and reusable bindings. It is a headless store; widgets remain in `@jsvision/ui`.

1. Define a Zod schema and infer its type.
2. Call `createForm` with initial values and schema.
3. Create editor widgets.
4. Bind with `bindField`, `bindRadio`, or `bindCheck` after mount.
5. Render field/form status from reactive accessors.
6. Route Save through `form.submit`; keep cancellation separate.

Consult installed declarations for exact signatures because the bundled legacy API pages predate Forms. Keep one value source, validate the whole object for cross-field rules, preserve input after failures, suppress repeated unsafe submission, focus the first invalid field when practical, and ignore stale async validation.

Use `formDialog` for conventional modal editing; use a screen for multi-section or long-running workflows. Test validity, changes, cross-field errors, submit success/failure, reset, dirty state, async races, focus order, and constrained widths.
