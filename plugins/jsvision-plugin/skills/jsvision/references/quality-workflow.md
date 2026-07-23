# Quality and verification workflow

## Fast loop

1. Typecheck the affected package.
2. Run focused state/widget tests.
3. Render the main screen headlessly.
4. Inspect ASCII output at intended dimensions.

Use repository-native commands. Render normal, minimum, narrow, empty/loading/error, dialog, and focused/selected states. Rendering proves geometry, not interaction.

Verify keyboard startup, traversal, accelerators, menus, commands, cancellation, modal close, grid/list navigation, editing, and shutdown. For async work verify pending, success, failure, cancellation, stale suppression, and repeated invocation.

For theme work, ASCII output is insufficient. Assert composed cell `fg`, `bg`, and `attrs` for key
roles and test initial selection, runtime switching, live preview, Cancel rollback, Apply commit,
shadow cells, and every supported generated source color. Use `contrastRatio` for functional role
pairs and render focused/selected/disabled states at the supported color depths.

When examples name public exports, compile them against the installed package barrels. Check package
export maps and declarations when a skill reference and the installed version disagree; never repair
an example with a deep import.

Run `jsvision-doctor` when available. Otherwise check missing `measure()`, binding before mount, content rectangles, missing `.js` specifiers, unowned resources, unresolved modals, direct ANSI, and deep imports.

Report what was built, commands passed, states rendered, and behavior still unverified.
