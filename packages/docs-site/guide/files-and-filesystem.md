---
title: Files & the FileSystem seam
description: Use the FileSystem seam for host-neutral file workflows across Node, browser-virtual, and custom application storage.
---

# Files & the FileSystem seam

File interfaces become reusable when the view asks for capabilities instead of importing a disk
implementation. JSVision's file dialogs, lists, trees, and editor all receive the same synchronous
`FileSystem` contract. The host decides whether that contract reaches Node disk, a browser-only
virtual tree, or storage governed by application policy.

## Who is this course for?

This course is for developers building open, save, browse, and directory-selection workflows. It
assumes you are already comfortable with [Dialogs & modality](/guide/dialogs-and-modality) and the
ownership model in [Async work](/guide/async-work). You do not need prior filesystem abstraction
experience.

By the end you will be able to **build** one workflow over multiple adapters, **explain** where
selection ends and authorization begins, **diagnose** path and access failures, and **verify**
bounded virtual, denied, cancelled, and cleaned-up paths. The motivating problem is a project
viewer that runs unchanged as a Node application, a browser demonstration, and an embedded tool
with its own access policy.

The beginner boundary is opening a file through the standard helper. Intermediate work includes
scans, content operations, cancellation, and adapter choice. Advanced work includes custom policy
adapters, stale-result protection, symlink and platform semantics, safe diagnostics, and lifecycle
ownership.

## What is the FileSystem mental model?

Think of the seam as a synchronous capability object:

```text
file UI or application workflow
             |
             v
   injected FileSystem contract
      /          |           \
 Node disk   browser tree   application policy
```

`FileSystem` has 14 methods plus the readonly `sep` property. The path side contains `resolve`,
`isAbsolute`, `join`, `dirname`, and `basename`; host discovery provides `homedir` and `roots`;
directory metadata uses `readDir`, `stat`, and `lstat`; content changes use `readFile`,
`writeFile`, `rename`, and `unlink`.

Every method is synchronous. A `readDir` or `readFile` therefore cannot yield while a view is
rendering, but a slow implementation can block input and paint. Use this seam for local, cached, or
bounded data. Put genuinely asynchronous remote acquisition outside it, publish a ready snapshot,
then let the UI read that snapshot synchronously.

Dependency injection makes the workflow, not the adapter, the owner of UI behavior. The same
`FileList`, `FileDialog`, or application service remains unchanged when the host injects another
`FileSystem`.

Dependency injection gives `FileSystem` to the same UI workflow without changing that workflow.

## How do I build the first host-neutral file workflow?

The smallest normal workflow is `openFile()`. Passing `fs` makes authority explicit; omitting it in
a Node application selects `nodeFileSystem`.

```ts
import { openFile, nodeFileSystem } from '@jsvision/files';

const selected = await openFile(app, {
  fs: nodeFileSystem,
  directory: projectRoot,
  wildcard: '*.ts',
});

if (selected !== null) openDocument(selected);
```

The helper resolves to an absolute path on OK and `null` on Cancel or Escape. That path is a
selection, not proof that the target exists, is readable, or is authorized for the next operation.

## Laboratory: one workflow across filesystem seams

<PlayExample id="guides/filesystem-seams"
  title="One workflow across FileSystem seams"
  blurb="Scan, read, and write a browser-virtual project, switch the unchanged workflow to an application-defined adapter, then compare explicit denial with a missing-file failure."
/>

Start with Alt+S, Alt+R, and Alt+W. The laboratory performs real synchronous operations against a
bounded in-memory browser tree. Press Alt+A and scan again: the same workflow now uses an
application-defined adapter with a confined root. Alt+D followed by Alt+R produces a visible,
bounded denial. Alt+M produces a distinct missing-file failure without overwriting the last
successful content. Every action also has a focus-visible button and mouse route.

The Node route is named but deliberately not executed inside the browser laboratory. It requires an
explicitly authorized native host; the example never reaches visitor files, disk, or network.

## How do I choose a Node, browser, or application adapter?

Choose at the composition root, where host authority is known:

| Environment                    | Adapter                          | Storage and authority                                                           |
| ------------------------------ | -------------------------------- | ------------------------------------------------------------------------------- |
| Node application               | `nodeFileSystem`                 | Default adapter over real host disk using `node:fs`, `node:path`, and `node:os` |
| Browser or headless demo       | `createBrowserFileSystem()`      | In-memory POSIX tree; no `node:fs`, real disk, or network                       |
| Embedded or policy-driven host | Application-defined `FileSystem` | Only operations and paths allowed by the host's policy                          |

```ts
import { nodeFileSystem } from '@jsvision/files';
import { createBrowserFileSystem } from '@jsvision/web';

const filesystem =
  runtime === 'node'
    ? nodeFileSystem
    : createBrowserFileSystem({
        tree: { '/workspace': { 'readme.txt': 'hello' } },
        home: '/workspace',
      });
```

`nodeFileSystem` is the Node default and reaches the real host filesystem. Never select it merely
because a path looks local. `createBrowserFileSystem` stores files in memory, uses pure POSIX path
operations, and never imports `node:fs` or touches real disk. An application-defined `FileSystem`
can add authorization, auditing, caching, or a bounded domain model, provided it preserves the
synchronous contract.

```ts
import type { FileSystem } from '@jsvision/files';

function confineFileSystem(base: FileSystem, root: string): FileSystem {
  const allow = (path: string) => authorizeInside(base, root, path);
  return {
    ...base,
    readDir: (path) => base.readDir(allow(path)),
    stat: (path) => base.stat(allow(path)),
    lstat: (path) => base.lstat(allow(path)),
    readFile: (path) => base.readFile(allow(path)),
    writeFile: (path, text) => base.writeFile(allow(path), text),
    rename: (from, to) => base.rename(allow(from), allow(to)),
    unlink: (path) => base.unlink(allow(path)),
  } satisfies FileSystem;
}
```

The custom adapter owns policy. The dialog or confirmation does not grant filesystem authority; it
only records a user interaction.

## How do path, scan, and wildcard rules work?

Always use path methods from the injected adapter in their intended roles: `resolve()` canonicalizes,
`isAbsolute()` checks the form, `join()` combines segments, `dirname()` finds the parent, and
`basename()` extracts the final segment. That preserves POSIX versus Windows separators and
prevents one adapter's assumptions leaking into another.

```ts
import type { FileSystem } from '@jsvision/files';

function sibling(fs: FileSystem, current: string, name: string): string {
  const parent = fs.dirname(fs.resolve(current));
  const candidate = fs.join(parent, name);
  return fs.isAbsolute(candidate) ? candidate : fs.resolve(candidate);
}

const label = fs.basename(sibling(fs, currentPath, 'notes.txt'));
```

`resolve()` performs adapter-specific normalization. In the browser virtual adapter, `..` is
normalized lexically and clamps at `/`. That is not authorization: `/workspace/../../etc/passwd`
normalizes to `/etc/passwd`, so an application policy must check the canonical result before every
sensitive operation.

Use `scanDirectory()` for the sorted model shown by file listings:

```ts
import { scanDirectory } from '@jsvision/files';

const entries = scanDirectory(fs, '/workspace', {
  wildcard: '*.ts',
  showHidden: false,
  filter: (entry) => entry.size < 1_000_000,
});
```

The result places files first, directories after them, and the synthesized `..` entry last.
Wildcards apply to files only; directories always remain navigable. `showHidden` defaults to
`false`, excluding dotfiles or entries the adapter marks hidden.

`wildcardMatch()` is case-sensitive. Its `*.*` pattern is treated like `*`, so it also matches
extensionless files:

```ts
import { wildcardMatch } from '@jsvision/files';

wildcardMatch('*.ts', 'main.ts'); // true
wildcardMatch('*.TS', 'main.ts'); // false
wildcardMatch('*.*', 'README'); // true
```

Node adapters can expose symlinks. `stat()` follows the target, while `lstat()` describes the
symlink itself; a directory entry may retain `kind: 'symlink'` and mark a broken target. The browser
virtual adapter models only files and directories, so `stat()` and `lstat()` agree there. Do not
infer equivalent symlink support across adapters.

## How do dialogs own selection and cancellation?

`openFile()` and `changeDir()` mount their dialog, await the modal result, and remove the window in
`finally`. The helper is the cleanup owner. Both return `string | null`: OK returns an absolute file
or directory path, while Cancel and Escape return `null`.

```ts
import { openFile } from '@jsvision/files';

const path = await openFile(app, { fs, directory: fs.homedir() });
if (path === null) {
  status.set('Cancelled; model unchanged');
} else {
  status.set(`Selected ${fs.basename(path)}`);
}
```

```ts
import { changeDir } from '@jsvision/files';

const next = await changeDir(app, { fs, directory: currentDirectory });
if (next !== null) currentDirectory = next;
```

Cancel and Escape cause no read or write and leave application state unchanged unless your preview
logic mutated it earlier. Keep selection separate from commit.

Open mode intentionally does not require the typed target to exist or be readable because the same
dialog supports new save paths. After `openFile()` returns, validate with `readFile()` and handle a
missing or denied target. The [File Dialog component](/components/files/file-dialog) owns picker
configuration and widget behavior; the
[Change Directory Dialog component](/components/files/chdir-dialog) owns its specialized controls.

In other words, `openFile()` does not prove the target exists or is readable; call `readFile()` at
the commit boundary.

## How do I read and write text safely?

`readFile()` returns UTF-8 text and throws for a missing, unreadable, or non-file path. Treat that
failure as a state, not as proof that the user cancelled:

```ts
import type { FileSystem } from '@jsvision/files';

function readText(fs: FileSystem, path: string): string | null {
  try {
    return fs.readFile(path);
  } catch {
    return null;
  }
}
```

`writeFile()` synchronously creates or replaces UTF-8 text when the parent directory exists.
Failures throw. Preserve the edited content until the write succeeds so retry does not destroy the
user's work.

```ts
import type { FileSystem } from '@jsvision/files';

function saveText(fs: FileSystem, path: string, text: string): boolean {
  try {
    fs.writeFile(path, text);
    return true;
  } catch {
    return false;
  }
}
```

`rename()` moves a file and `unlink()` deletes one. Put confirmation and recovery policy in the
application before these mutations. A `FileSystem` method reports mechanics; it cannot decide
whether replacing or deleting content is acceptable.

## Where do authorization and trust boundaries live?

Authorization belongs in the host or application-defined adapter. Canonicalize with that adapter's
`resolve()`, then apply an allowlist to the canonical path. Re-check each operation rather than
trusting an earlier dialog selection. Permission denied is a normal expected result with visible
feedback, not an exceptional application crash.

```ts
import type { FileSystem } from '@jsvision/files';

function requireProjectPath(fs: FileSystem, root: string, input: string): string {
  const base = fs.resolve(root);
  const path = fs.resolve(input);
  if (path !== base && !path.startsWith(`${base}${fs.sep}`)) {
    throw new Error('Access denied');
  }
  return path;
}
```

Filenames, paths, adapter errors, and file content can contain terminal control characters.
Components sanitize names at their draw boundary, but application-owned status and diagnostics
need the same treatment:

```ts
import { sanitize } from '@jsvision/core';

function safeDiagnostic(filename: string, cause: unknown): string {
  const message = cause instanceof Error ? cause.message : 'File operation failed';
  return sanitize(`${filename}: ${message}`).slice(0, 120);
}
```

Bound or truncate every path and diagnostic before display. Redact secrets, full home paths, tokens,
and sensitive content first; `sanitize()` removes unsafe terminal controls but does not make secret
data suitable to reveal.

Browser examples must not receive implicit visitor filesystem authority. Use bounded virtual data,
or an explicit host adapter whose authorization result can be denied or cancelled honestly.

## How do lifecycle, failure, and retry work?

The standard openers pair modal acquisition and cleanup internally. A custom workflow must pair its
own adapter resources—watchers, handles, cache subscriptions, or host grants—with application-defined
`dispose()` or cleanup owned at the same lifecycle boundary. The base `FileSystem` interface does
not promise a disposal method.

Retry is a fresh re-read or re-scan. Preserve the current selection and edited content, clear the
old diagnostic, then ask the adapter again. Do not pretend a retry succeeded by redisplaying cached
rows.

Async work outside the synchronous seam can finish out of order. Give each scan request a
generation and ignore a stale or superseded result before publishing it:

```ts
let latestGeneration = 0;

async function refresh(): Promise<void> {
  const generation = ++latestGeneration;
  const snapshot = await fileService.loadSnapshot();
  if (generation !== latestGeneration) return;
  cachedFileSystem.replace(snapshot);
}
```

At reduced geometry or a small viewport, preserve the current path, focused list row, status, and
Cancel action. Wrap bounded instructions and clip only the listing workspace. Verify resize,
maximize, and restore with keyboard navigation: Tab reaches actions, arrow keys move the list, and
Enter activates the focused file.

Use non-colour text labels for adapter, denied, cancelled, and error states. Keep separators and
tree cues usable with monochrome and ASCII fallback; never rely on colour or a Unicode branch glyph
as the only distinction.

The file family composes the `dialog`, `fileInfo`, `listNormal`, `listFocused`, `listSelected`,
`inputNormal`, and `button` theme roles. Preserve their contrast and visible focus. The File Dialog,
`FileList`, and `FileEditor` component pages own exact widget options and specialist details; this
course owns cross-host workflow and trust boundaries.

## How do I diagnose filesystem failures?

| Symptom                                   | Cause                                                                             | Correction                                                                 | Distinguishing evidence                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Empty list or no entries                  | Wildcard, hidden-file rule, permission failure, or `readDir` error                | Show the active filter and adapter status; retry a fresh scan              | `readDir` failed, or raw entries exist but the scan filter removed them |
| File not found / `ENOENT` after selection | Selected path did not need to exist, or it changed before `readFile`              | Re-read on commit and preserve the selection for correction                | Dialog returned a path, then content access failed                      |
| Wrong or unexpected path                  | Host separator or absolute-path assumptions bypassed `resolve`                    | Use `resolve`, `join`, and `isAbsolute` from the injected adapter          | Canonical path differs between POSIX and Node platform rules            |
| Frozen or unresponsive UI                 | Synchronous `readDir` or another adapter method is large or slow                  | Move remote/large acquisition outside the seam and publish a bounded cache | Input resumes only after the synchronous adapter returns                |
| Host or visitor file was accessed         | `nodeFileSystem` or another privileged adapter was selected without authorization | Choose a virtual adapter or require explicit host authorization            | Adapter identity shows native disk instead of bounded storage           |
| Unsafe escape/control output appears      | Raw filename, diagnostic, or content bypassed `sanitize`                          | Redact, sanitize, and bound application-owned output                       | Captured frame contains control bytes or an unbounded host message      |
| Denied retry loses edits                  | Failure path reset working state                                                  | Keep selection/content, clear only the error, and make a fresh attempt     | Adapter was not called again or edited text reverted                    |
| Symlink behaves differently               | Adapter capabilities were assumed equivalent                                      | Inspect `stat` and `lstat`, then branch on documented support              | Node reports link/target distinction while virtual storage does not     |

## What are the best practices?

- Inject `FileSystem` at the composition root. Importing native disk inside a view prevents browser,
  test, and policy-controlled reuse.
- Treat paths returned by dialogs as selections, not authorization or readability proofs. Otherwise
  a valid UI result becomes an unsafe capability escalation.
- Use the adapter's path methods and authorize the canonical result. String-prefix checks on raw
  input are vulnerable to `..`, separators, and platform differences.
- Keep synchronous adapters bounded and fast. A remote call hidden behind `readDir()` freezes event
  dispatch rather than becoming asynchronous.
- Preserve content and selection across denied, missing, and retry states. Destructive resets make
  recovery harder and can hide whether a fresh operation ran.
- Pair resource acquisition and cleanup in the owning application lifecycle. The seam itself cannot
  release resources it does not define.
- Sanitize, redact, and bound display text. Terminal safety, confidentiality, and usable geometry
  are separate obligations.
- Test the same workflow with virtual success, explicit denial, cancellation, missing paths, and
  cleanup. One happy Node path does not prove host neutrality.

## What should I practice next?

1. Build one file viewer over `createBrowserFileSystem()`, then inject `nodeFileSystem` from an
   explicitly authorized Node entry point without changing the viewer.
2. Add a custom adapter that denies canonical paths outside `/workspace`. Exercise `..`, a missing
   file, a permitted file, and a bounded diagnostic.
3. Apply `*.ts`, hidden-file, and application predicates to `scanDirectory()`. Explain why
   directories remain reachable and why `..` sorts last.
4. Cancel both `openFile()` and `changeDir()` and verify no read, write, rename, or unlink occurred.
5. Resize a file workflow and verify focus, keyboard activation, non-colour status, and cleanup.

Continue with [Running in the browser](/guide/running-in-the-browser) for browser host integration.
Review [Dialogs & modality](/guide/dialogs-and-modality) for custom modal ownership and
[Async work](/guide/async-work) for snapshot acquisition and stale-result control.

Related API:

- [`FileSystem`](/api/files/interfaces/FileSystem)
- [`openFile`](/api/files/functions/openFile)
- [`changeDir`](/api/files/functions/changeDir)
- [`scanDirectory`](/api/files/functions/scanDirectory)
