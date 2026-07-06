/**
 * Story: `FileDialog` (RD-09, `@jsvision/files`) — a button that opens the modal open/save file picker
 * over the real filesystem and reports the chosen path.
 *
 * The launch button calls `ctx.execView` (wired by the live shell) to open a `TFileDialog` — the 2-col
 * listing + filename input with a `History` dropdown + the live `FileInfoPane` + the `valid()`
 * wildcard/directory/file state machine. A live echo shows the resolved path (or an error / cancel).
 * The 49×19 dialog exceeds the 72×16 smoke canvas, so — like the `Dialog` story — headless (no
 * `ctx.execView`) it renders only the launch button + a hint (PF-005, no clipped text); the modal path
 * is exercised by `demo:files`.
 *
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import { cwd } from 'node:process';
import { Group, Button, Text, signal, Commands } from '@jsvision/ui';
import { FileDialog, nodeFileSystem } from '@jsvision/files';
import { at } from '../story.js';
import type { Story, StoryContext } from '../story.js';

export const fileDialogStory: Story = {
  id: 'files/file-dialog',
  category: 'Files',
  title: 'File Dialog',
  rd: 'RD-09',
  blurb:
    'TFileDialog: a modal open file picker — 2-col listing + filename input + History + a live info pane; valid() re-filters on a wildcard, descends a directory, or resolves a file.',
  build(ctx: StoryContext) {
    const result = signal('(not opened yet)');
    const g = new Group();

    const openDialog = (): void => {
      if (ctx.execView === undefined) {
        result.set('(headless — run demo:files for the walkthrough)');
        return;
      }
      const dlg = new FileDialog({
        fs: nodeFileSystem,
        directory: signal(cwd()),
        showError: (message) => result.set(`error: ${message}`),
      });
      void ctx.execView(dlg).then((cmd) => {
        result.set(cmd === Commands.ok ? `opened: ${dlg.result()}` : 'cancelled');
      });
    };

    g.add(
      at(new Button('~O~pen file dialog…', { command: 'files.file-dialog.open', onClick: openDialog }), 1, 1, 22, 2),
    );
    g.add(at(new Text(() => result()), 1, 4, ctx.width - 2, 1));
    g.add(
      at(
        new Text(
          '↑↓ navigate · type *.ts + OK to re-filter · Enter a folder to descend · pick a file + OK · drag the ┘ corner to resize.',
        ),
        1,
        6,
        ctx.width - 2,
        2,
      ),
    );
    return g;
  },
};
