/**
 * Story: `ChDirDialog` (RD-09, `@jsvision/files`) — a button that opens the modal change-directory
 * dialog over the real filesystem and reports the chosen directory.
 *
 * The launch button calls `ctx.execView` (wired by the live shell) to open a `TChDirDialog` — the path
 * input with a `History` dropdown + the `DirList` tree (ancestor chain + subdirs) + Chdir/Revert; a
 * live echo shows the resolved directory (or an error / cancel). The 48×18 dialog exceeds the 72×16
 * smoke canvas, so — like the `Dialog`/`FileDialog` stories — headless it renders only the launch
 * button + a hint (PF-005); the modal path is exercised by `demo:files`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { cwd } from 'node:process';
import { Group, Button, Text, signal, Commands } from '@jsvision/ui';
import { ChDirDialog, nodeFileSystem } from '@jsvision/files';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const chDirDialogStory: Story = {
  id: 'files/chdir-dialog',
  category: 'Files',
  title: 'Change Directory',
  rd: 'RD-09',
  blurb:
    'TChDirDialog: a modal directory picker — a path input + History over the DirList tree (ancestor chain + subdirs); Chdir descends the focused node, Revert restores the start, OK resolves the directory.',
  build(ctx: StoryContext) {
    const result = signal('(not opened yet)');
    const g = new Group();

    const openDialog = (): void => {
      if (ctx.execView === undefined) {
        result.set('(headless — run demo:files for the walkthrough)');
        return;
      }
      const dlg = new ChDirDialog({
        fs: nodeFileSystem,
        directory: signal(cwd()),
        showError: (message) => result.set(`error: ${message}`),
      });
      void ctx.execView(dlg).then((cmd) => {
        result.set(cmd === Commands.ok ? `changed to: ${dlg.result()}` : 'cancelled');
      });
    };

    g.add(
      at(new Button('~C~hange directory…', { command: 'files.chdir-dialog.open', onClick: openDialog }), 1, 1, 24, 2),
    );
    g.add(at(new Text(() => result()), 1, 4, ctx.width - 2, 1));
    g.add(
      at(
        new Text('↑↓ walk the tree · Chdir descends the focused folder · Revert restores · OK resolves.'),
        1,
        6,
        ctx.width - 2,
        2,
      ),
    );
    return g;
  },
};
