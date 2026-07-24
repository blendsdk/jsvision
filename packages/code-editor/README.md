# @jsvision/code-editor

A terminal-native source code editor for JSVision applications. It is a code editor window—not an
IDE—and is designed for responsive navigation and comprehension without browser or DOM
dependencies.

The package is being built probe-first. Its current architecture evidence covers:

- headless Node imports for the root, JavaScript, TypeScript, PostgreSQL, and Node entry points;
- public CodeMirror state primitives and public Lezer parser APIs;
- transport-neutral Language Server Protocol types;
- bounded edit-and-viewport latency and retained-memory measurements;
- interactive scheduling ahead of cancellable parser, diagnostic, and completion work; and
- the installed production dependency and license closure.

The root entry point owns stable editor contracts and plain text. Optional language adapters are
exposed through `@jsvision/code-editor/languages/javascript`,
`@jsvision/code-editor/languages/typescript`, and
`@jsvision/code-editor/languages/postgresql`. Node-only runtime integration is isolated under
`@jsvision/code-editor/node`.
