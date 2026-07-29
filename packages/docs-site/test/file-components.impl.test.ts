/**
 * Implementation hardening for the Form Dialog and composable file laboratories.
 *
 * These checks cover path confinement, deterministic faults, empty/degraded states, modal
 * cancellation, exact save/backup behavior, fixture isolation, and complete disposal.
 */
import { ChDirDialog, FileDialog, FileEditor, FileList } from '@jsvision/files';
import { formDialog } from '@jsvision/forms';
import type { Form } from '@jsvision/forms';
import { createBrowserFileSystem } from '@jsvision/web';
import {
  Commands,
  createApplication,
  createEventLoop,
  createRoot,
  Dialog,
  Group,
  Input,
  at,
  signal,
} from '@jsvision/ui';
import type { Application, View } from '@jsvision/ui';
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { EXAMPLES } from '../examples/index.js';
import type { ExampleDefinition } from '../examples/_contract.js';
import { createDemoFileSystem, FILE_LAB_HOME } from '../src/fixtures/file-lab.js';
import { EXAMPLE_CAPS, buildLabExample, dispatchExampleAction, viewsIn } from './example-lab-harness.js';
import { FILE_EXAMPLE_IDS } from './contracts/files.js';
import { createFaultFileSystem } from './fixtures/fault-file-system.js';

/** Resolve one lazily registered family definition. */
async function loadDefinition(exampleId: string): Promise<ExampleDefinition> {
  const entry = EXAMPLES.find((candidate) => candidate.id === exampleId);
  if (entry === undefined) throw new Error(`missing forms/files example ${exampleId}`);
  return (await entry.load()).default;
}

/** Flush modal completion continuations. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Count mounted Dialog instances owned by an application desktop. */
function dialogCount(app: Application): number {
  return app.desktop?.children.filter((view) => view instanceof Dialog).length ?? 0;
}

/** Create a manually controlled promise for asynchronous submission tests. */
function deferred(): { readonly promise: Promise<void>; resolve(): void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

/** Mount and execute one file-family dialog against the real event loop. */
function openDirectDialog<T extends Dialog>(
  dialog: T,
): {
  readonly loop: ReturnType<typeof createEventLoop>;
  readonly pending: Promise<string | undefined>;
} {
  const root = new Group();
  root.add(dialog);
  const loop = createEventLoop({ width: 80, height: 24 }, { caps: EXAMPLE_CAPS });
  loop.mount(root);
  return { loop, pending: loop.execView<string>(dialog) };
}

describe('virtual filesystem confinement and reset', () => {
  test('fault adapter rejects relative and escaping paths, then resets a denied operation', () => {
    const base = createBrowserFileSystem({
      tree: { '/workspace': { 'note.txt': 'safe' } },
      home: '/workspace',
    });
    const fs = createFaultFileSystem(base, '/workspace');
    expect(() => fs.readFile('note.txt')).toThrow('absolute');
    expect(() => fs.readFile('/outside/note.txt')).toThrow('escapes');
    expect(() => fs.readFile('/workspace/../outside/note.txt')).toThrow('escapes');
    expect(() => fs.readFile('/workspace2/note.txt')).toThrow('escapes');
    fs.setFault('denied');
    expect(() => fs.readFile('/workspace/note.txt')).toThrow('EACCES');
    fs.reset();
    expect(fs.readFile('/workspace/note.txt')).toBe('safe');
  });

  test('each demo filesystem starts pristine after writes and failures', () => {
    const first = createDemoFileSystem();
    first.fs.writeFile(`${FILE_LAB_HOME}/notes.txt`, 'changed');
    first.setFault('io-error');
    expect(() => first.fs.readFile(`${FILE_LAB_HOME}/notes.txt`)).toThrow('EIO');
    const second = createDemoFileSystem();
    expect(second.fs.readFile(`${FILE_LAB_HOME}/notes.txt`)).toBe('safe notes\u001b[2J\n');
  });

  test('FileList turns a denied scan into a real empty widget model', () => {
    const base = createBrowserFileSystem({ tree: { '/workspace': { 'note.txt': 'safe' } }, home: '/workspace' });
    const fs = createFaultFileSystem(base, '/workspace');
    fs.setFault('denied');
    createRoot((dispose) => {
      const root = new Group();
      const list = new FileList({ fs, directory: signal('/workspace') });
      root.add(at(list, 0, 0, 30, 5));
      const loop = createEventLoop({ width: 30, height: 5 }, { caps: EXAMPLE_CAPS });
      try {
        loop.mount(root);
        expect(list.entries()).toEqual([]);
      } finally {
        try {
          loop.dispose();
        } finally {
          dispose();
        }
      }
    });
  });
});

describe('real FormDialog behavior', () => {
  const schema = z.object({ name: z.string().min(1, 'Required'), age: z.coerce.number().int().min(0) });
  type Initial = { name: string; age: string };

  test('invalid OK stays open, then valid OK resolves coerced values and a reopened dialog cancels', async () => {
    const app = createApplication({ caps: EXAMPLE_CAPS });
    let form!: Form<typeof schema, Initial>;
    try {
      const pending = formDialog(app, {
        schema,
        initial: { name: '', age: '42' },
        width: 44,
        height: 9,
        asyncDebounceMs: 0,
        asyncValidators: {
          name: async (value) => (value === 'Taken' ? 'Name is already taken' : null),
        },
        body: (created) => {
          form = created;
          return new Input({ value: created.field('name').value });
        },
      });
      app.loop.emitCommand(Commands.ok);
      await tick();
      expect(dialogCount(app)).toBe(1);
      expect(form.field('name').touched()).toBe(true);

      form.field('name').value.set('Taken');
      app.loop.emitCommand(Commands.ok);
      await tick();
      expect(form.field('name').asyncError()).toBe('Name is already taken');
      expect(dialogCount(app)).toBe(1);

      form.field('name').value.set('Ada');
      app.loop.emitCommand(Commands.ok);
      await expect(pending).resolves.toEqual({ name: 'Ada', age: 42 });
      expect(dialogCount(app)).toBe(0);

      const reopened = formDialog(app, {
        schema,
        initial: { name: 'Grace', age: '37' },
        width: 44,
        height: 9,
        body: (created) => new Input({ value: created.field('name').value }),
      });
      app.loop.emitCommand(Commands.cancel);
      await expect(reopened).resolves.toBeNull();
      expect(dialogCount(app)).toBe(0);
    } finally {
      app.loop.dispose();
    }
  });

  test('pending submission seals close paths and a rejected submit can be retried', async () => {
    const app = createApplication({ caps: EXAMPLE_CAPS });
    const gate = deferred();
    let reject = true;
    let calls = 0;
    let form!: Form<typeof schema, Initial>;
    try {
      const pending = formDialog(app, {
        schema,
        initial: { name: 'Ada', age: '42' },
        width: 44,
        height: 9,
        onSubmit: async () => {
          calls += 1;
          await gate.promise;
          if (reject) throw new Error('save failed');
        },
        body: (created) => {
          form = created;
          return new Input({ value: created.field('name').value });
        },
      });
      app.loop.emitCommand(Commands.ok);
      await Promise.resolve();
      await Promise.resolve();
      expect(form.submitting()).toBe(true);
      const modal = app.desktop.children.find((view): view is Dialog => view instanceof Dialog);
      if (modal === undefined) throw new Error('FormDialog modal was not mounted');

      app.loop.emitCommand(Commands.ok);
      app.loop.emitCommand(Commands.cancel);
      app.loop.dispatch({ type: 'key', key: 'escape', ctrl: false, alt: false, shift: false });
      app.loop.dispatch({
        type: 'mouse',
        kind: 'down',
        button: 0,
        x: modal.bounds.x + 4,
        y: modal.bounds.y + 1,
      });
      app.loop.dispatch({
        type: 'mouse',
        kind: 'up',
        button: 0,
        x: modal.bounds.x + 4,
        y: modal.bounds.y + 1,
      });
      expect(modal.valid(Commands.quit)).toBe(false);
      app.loop.emitCommand(Commands.quit);
      expect(dialogCount(app)).toBe(1);

      gate.resolve();
      await tick();
      expect(form.submitting()).toBe(false);
      expect(dialogCount(app)).toBe(1);
      expect(calls).toBe(1);

      reject = false;
      app.loop.emitCommand(Commands.ok);
      await expect(pending).resolves.toEqual({ name: 'Ada', age: 42 });
      expect(calls).toBe(2);
      expect(dialogCount(app)).toBe(0);
    } finally {
      app.loop.dispose();
    }
  });

  test('a body-builder failure leaves no modal window behind', async () => {
    const app = createApplication({ caps: EXAMPLE_CAPS });
    let validatorCalls = 0;
    let form!: Form<typeof schema, Initial>;
    try {
      const pending = formDialog(app, {
        schema,
        initial: { name: 'Ada', age: '42' },
        width: 44,
        height: 9,
        asyncDebounceMs: 0,
        asyncValidators: {
          name: async () => {
            validatorCalls += 1;
            return null;
          },
        },
        body: (created) => {
          form = created;
          throw new Error('body failed');
        },
      });
      await expect(pending).rejects.toThrow('body failed');
      expect(dialogCount(app)).toBe(0);
      const callsAfterFailure = validatorCalls;
      form.field('name').value.set('post-disposal-probe');
      await tick();
      expect(validatorCalls).toBe(callsAfterFailure);
    } finally {
      app.loop.dispose();
    }
  });
});

describe('real file-family dialog behavior', () => {
  test('FileDialog browses, resolves existing and new paths, and reports denied parents', async () => {
    const browseFixture = createDemoFileSystem();
    const browseDirectory = signal(FILE_LAB_HOME);
    const browseName = signal('src');
    const browse = new FileDialog({ fs: browseFixture.fs, directory: browseDirectory, filename: browseName });
    const browseRun = openDirectDialog(browse);
    browseName.set('src');
    browseRun.loop.emitCommand(Commands.ok);
    await tick();
    expect(browseDirectory()).toBe(`${FILE_LAB_HOME}/src`);
    browseRun.loop.emitCommand(Commands.cancel);
    await expect(browseRun.pending).resolves.toBe(Commands.cancel);
    browseRun.loop.dispose();

    for (const name of ['README.md', 'new-file.txt']) {
      const fixture = createDemoFileSystem();
      const filename = signal(name);
      const dialog = new FileDialog({ fs: fixture.fs, directory: signal(FILE_LAB_HOME), filename });
      const run = openDirectDialog(dialog);
      filename.set(name);
      run.loop.emitCommand(Commands.ok);
      await expect(run.pending).resolves.toBe(Commands.ok);
      expect(dialog.result()).toBe(`${FILE_LAB_HOME}/${name}`);
      run.loop.dispose();
    }

    const deniedFixture = createDemoFileSystem();
    const errors: string[] = [];
    const deniedName = signal('blocked/item.txt');
    const denied = new FileDialog({
      fs: deniedFixture.fs,
      directory: signal(FILE_LAB_HOME),
      filename: deniedName,
      showError: (message) => errors.push(message),
    });
    const deniedRun = openDirectDialog(denied);
    deniedFixture.setFault('denied');
    deniedName.set('blocked/item.txt');
    deniedRun.loop.emitCommand(Commands.ok);
    await tick();
    expect(errors.length).toBeGreaterThan(0);
    expect(denied.result()).toBeNull();
    deniedRun.loop.emitCommand(Commands.cancel);
    await deniedRun.pending;
    deniedRun.loop.dispose();
  });

  test('ChDirDialog navigates, preserves shared navigation on cancel, reverts, resolves, and rejects denied paths', async () => {
    const fixture = createDemoFileSystem();
    const directory = signal(FILE_LAB_HOME);
    const dialog = new ChDirDialog({ fs: fixture.fs, directory });
    const run = openDirectDialog(dialog);
    const srcIndex = dialog.dirList.nodes().findIndex((node) => node.label === 'src');
    dialog.dirList.focused.set(srcIndex);
    dialog.chdir();
    expect(directory()).toBe(`${FILE_LAB_HOME}/src`);
    run.loop.emitCommand(Commands.cancel);
    await expect(run.pending).resolves.toBe(Commands.cancel);
    expect(dialog.result()).toBeNull();
    expect(directory()).toBe(`${FILE_LAB_HOME}/src`);
    run.loop.dispose();

    const resolved = new ChDirDialog({ fs: createDemoFileSystem().fs, directory: signal(`${FILE_LAB_HOME}/src`) });
    const resolvedRun = openDirectDialog(resolved);
    resolved.directory.set(FILE_LAB_HOME);
    resolved.revert();
    expect(resolved.directory()).toBe(`${FILE_LAB_HOME}/src`);
    resolved.path.set(FILE_LAB_HOME);
    resolvedRun.loop.emitCommand(Commands.ok);
    await expect(resolvedRun.pending).resolves.toBe(Commands.ok);
    expect(resolved.result()).toBe(FILE_LAB_HOME);
    resolvedRun.loop.dispose();

    const deniedFixture = createDemoFileSystem();
    const errors: string[] = [];
    const denied = new ChDirDialog({
      fs: deniedFixture.fs,
      directory: signal(FILE_LAB_HOME),
      showError: (message) => errors.push(message),
    });
    const deniedRun = openDirectDialog(denied);
    deniedFixture.setFault('denied');
    denied.path.set(FILE_LAB_HOME);
    deniedRun.loop.emitCommand(Commands.ok);
    await tick();
    expect(errors.length).toBeGreaterThan(0);
    expect(denied.result()).toBeNull();
    deniedRun.loop.emitCommand(Commands.cancel);
    await deniedRun.pending;
    deniedRun.loop.dispose();
  });
});

describe('modal cancellation and file-editor seams', () => {
  test.each(['controls/form-dialog', 'files/file-dialog', 'files/chdir-dialog'])(
    '%s launches and cancels its real modal without removing the teaching dialog',
    async (exampleId) => {
      const definition = await loadDefinition(exampleId);
      let app!: ReturnType<typeof buildLabExample>['app'];
      let dispose!: () => void;
      createRoot((rootDispose) => {
        dispose = rootDispose;
        ({ app } = buildLabExample(exampleId, definition));
      });
      try {
        dispatchExampleAction(app, { kind: 'key', key: 'o', modifiers: ['Alt'] });
        expect(dialogCount(app)).toBe(2);
        dispatchExampleAction(app, { kind: 'key', key: 'escape', modifiers: [] });
        await tick();
        expect(dialogCount(app)).toBe(1);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
    },
  );

  test('FileEditor saves exact text, rotates a backup, and keeps modifications after failure', () => {
    const fixture = createDemoFileSystem();
    const name = `${FILE_LAB_HOME}/notes.txt`;
    const editor = new FileEditor({ fs: fixture.fs, fileName: name });
    editor.loadFile();
    editor.setText('replacement\n');
    expect(editor.saveFile()).toBe(true);
    expect(fixture.fs.readFile(name)).toBe('replacement\n');
    expect(fixture.fs.readFile(`${FILE_LAB_HOME}/notes.bak`)).toBe('safe notes\u001b[2J\n');
    editor.insertText('unsaved\n');
    fixture.setFault('io-error');
    expect(editor.saveFile()).toBe(false);
    expect(editor.modified()).toBe(true);
  });
});

test('every forms/files laboratory unmounts its complete teaching-dialog subtree', async () => {
  for (const exampleId of FILE_EXAMPLE_IDS) {
    const definition = await loadDefinition(exampleId);
    createRoot((dispose) => {
      const { app, dialog } = buildLabExample(exampleId, definition);
      const descendants: View[] = viewsIn(dialog);
      try {
        expect(descendants.every((view) => view.mounted)).toBe(true);
      } finally {
        try {
          app.loop.dispose();
        } finally {
          dispose();
        }
      }
      expect(descendants.every((view) => !view.mounted)).toBe(true);
    });
  }
});
