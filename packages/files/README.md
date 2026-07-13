# @jsvision/files

The classic file-system dialog family for
[jsvision](https://github.com/blendsdk/jsvision) — `FileDialog`, `ChDirDialog`, and
the `FileList` / `DirList` / `FileInput` / `FileInfoPane` leaf components — built on
[`@jsvision/ui`](../ui). Everything disk-touching goes through an injectable
`FileSystem` seam (default `node:fs`), so the whole family runs headless in tests and
in the browser (via [`@jsvision/web`](../web)'s virtual filesystem).

> **Private until its first release**, under heavy development.

See the [documentation site](https://blendsdk.github.io/jsvision/) for the full
reference and [API docs](https://blendsdk.github.io/jsvision/api/).
