# Recipe: file & text tools

Read and edit text through an injected `FileSystem`, so the same code runs on a real disk, over a
temp dir, or fully in-memory in a browser/test. All I/O is confined to the FS you inject.

Key points:

- The default in-memory FS (`createBrowserFileSystem`) is node-free and never touches the real disk —
  ideal for headless tests and the browser. Pass `nodeFileSystem` for real files.
- Read through the seam (`fs.readFile(path)`) and bind the text to a `Memo`; save writes back through
  the same seam (`fs.writeFile`).
- `@jsvision/files` also provides full `FileDialog`/`ChDirDialog` widgets over the same `FileSystem`.

Full module: `packages/examples/recipes/file-tools.ts`.

```ts
/** Handles for the file-tools recipe. */
export interface FileViewer {
  /** The mountable root (a filename heading + the editor). */
  root: Group;
  /** The editor showing the file; read its text with `memo.getText()`. */
  memo: Memo;
  /** The two-way text of the file. */
  text: Signal<string>;
  /** The injected file system — every read/write goes through it, never the real disk. */
  fs: FileSystem;
  /** The path of the open file. */
  path: string;
  /** Persist the current text back to the (virtual) file system. */
  save(newText: string): void;
}

/**
 * Build a file viewer/editor over an injected {@link FileSystem}. Defaults to an in-memory
 * `createBrowserFileSystem` seeded with a sample file — fully headless, no disk access — so it runs
 * anywhere; pass a Node-backed `nodeFileSystem` (or a temp-dir FS) to edit real files instead.
 *
 * @param fs - the file system to read/write through (defaults to a seeded in-memory FS).
 * @returns The viewer handles (see {@link FileViewer}).
 * @example
 * const { root, memo, save } = buildFileViewer();
 * win.add(root);
 * save(memo.getText()); // write edits back through the injected FS
 */
export function buildFileViewer(fs?: FileSystem): FileViewer {
  const path = '/home/demo/notes.txt';
  const filesystem =
    fs ??
    createBrowserFileSystem({
      tree: { '/home/demo': { 'notes.txt': 'line one\nline two\nedit me and save' } },
      home: '/home/demo',
    });

  // Read the file THROUGH the seam and bind it to the editor.
  const text = signal(filesystem.readFile(path));
  const memo = new Memo({ value: text });

  const heading = new Text(() => `File: ${path}`);

  // A one-row filename heading above the editor, which grows to fill the rest — composed with the
  // layout DSL so the editor tracks the container height instead of a fixed rect.
  const root = col(fixed(heading, 1), grow(memo));

  const save = (newText: string): void => {
    text.set(newText);
    filesystem.writeFile(path, newText); // stays inside the injected FS — no real-disk write
  };

  return { root, memo, text, fs: filesystem, path, save };
}
```
