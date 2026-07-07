/**
 * A dialog-embeddable multiline text editor bound two-way to a `Signal<string>`. See {@link Memo}.
 */
import type { Signal } from '../reactive/index.js';
import { Editor } from './editor.js';
import type { EditorOptions } from './editor.js';

/** Options for {@link Memo}. */
export interface MemoOptions extends EditorOptions {
  /** The two-way bound content: edits write it; writing it from outside replaces the buffer. */
  value: Signal<string>;
}

/**
 * A dialog-embeddable, signal-bound multiline editor.
 *
 * `Memo` is an `Editor` styled for the gray dialog palette and safe to place among other controls:
 * it lets Tab pass through, so dialog focus traversal still works. Its content is bound to a signal
 * — typing writes the signal the same tick, and writing the signal from outside replaces the
 * buffer — so you read and write the memo's text through that signal rather than through the editor.
 *
 * @example
 * import { Dialog, Memo, signal } from '@jsvision/ui';
 *
 * const notes = signal('initial text');
 * const memo = new Memo({ value: notes });
 * memo.layout = { position: 'absolute', rect: { x: 2, y: 2, width: 40, height: 8 } };
 *
 * const dialog = new Dialog({ title: 'Notes', width: 46, height: 14 });
 * dialog.add(memo);
 *
 * // Read the bound signal (e.g. inside an effect) to observe edits; write it to replace the buffer.
 * notes.set('replaced from outside'); // updates the memo's buffer
 * console.log('memo text is', notes());
 */
export class Memo extends Editor {
  /** @internal The bound value signal. */
  protected readonly value: Signal<string>;
  /** @internal Guard against the two-way bind feeding back on itself. */
  protected syncing = false;

  constructor(options: MemoOptions) {
    super(options);
    this.normalRole = 'memoNormal';
    this.selectedRole = 'memoSelected';
    this.value = options.value;
    this.setText(options.value());
    // Outside writes flow into the buffer. This direction reads only the signal; the guard stops
    // it from ping-ponging with the buffer→signal mirror in update().
    this.onMount(() => {
      this.bind(
        () => this.value(),
        (v) => {
          if (this.syncing || v === this.buf.text()) return;
          this.syncing = true;
          this.setText(v);
          this.syncing = false;
        },
      );
    });
  }

  /** @internal Mirror the buffer back into the bound signal after every edit. */
  override update(): void {
    super.update();
    if (this.value === undefined) return; // the base constructor's update() runs before our fields exist
    if (!this.syncing) {
      const text = this.buf.text();
      if (this.value() !== text) {
        this.syncing = true;
        this.value.set(text);
        this.syncing = false;
      }
    }
  }
}
