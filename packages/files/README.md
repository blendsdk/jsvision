# @jsvision/files

The classic file-system dialog family — `FileDialog`, `ChDirDialog`, and the
`FileList` / `DirList` / `FileInput` / `FileInfoPane` leaf components — built on
`@jsvision/ui`. Everything disk-touching goes through an injectable `FileSystem`
seam (default `node:fs`), so the whole family runs headless against an in-memory
filesystem in tests.

Private until its first release.
