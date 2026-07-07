/**
 * `Memo` — the dialog-embeddable editor: a faithful `TMemo` port (RD-08 03-04).
 *
 * Decode (`tmemo.cpp:27-98`, `editors.h:363-391`, re-verified 2026-07-07 @ 57b6f56): `TEditor`
 * minus files; palette `cpMemo "\x1A\x1B"` → `cpGrayDialog[26/27]=0x39/0x3A` → `cpAppColor` =
 * **`memoNormal` `0x30` black-on-cyan / `memoSelected` `0x2F` white-on-green** (PA-8);
 * `handleEvent` drops `kbTab` entirely (`tmemo.cpp:69-73`) so dialog Tab-nav works — realized for
 * free here: the keymap never consumes `'tab'` and the loop's built-in Tab traversal runs before
 * the phases (the house Input precedent, semantically identical to TV's drop). The `ushort`-blob
 * `getData`/`setData` surface (`tmemo.cpp:38-61`) is modernized to a two-way `Signal<string>`
 * (AR-263) with the ComboBox-idiom feedback guard (each direction reads only the other side,
 * same-tick, no loop); no 64 KB cap.
 * GATE-2 AFTER-diff (2026-07-07): rendered headlessly and diffed against the decode — the gray
 * cpMemo byte pair and the Tab drop match. No draw mismatch.
 * The `.js` extension in import specifiers is required by NodeNext ESM resolution.
 */
import type { Signal } from '../reactive/index.js';
import { Editor } from './editor.js';
import type { EditorOptions } from './editor.js';

/** Construction options: the two-way bound value + the base editor options. */
export interface MemoOptions extends EditorOptions {
  /** The two-way bound content (AR-263): edits write it; external writes replace the buffer. */
  value: Signal<string>;
}

/** The dialog-embeddable multiline editor (gray-chain colours, Tab-transparent). */
export class Memo extends Editor {
  /** @internal The bound value signal. */
  protected readonly value: Signal<string>;
  /** @internal Re-entry guard for the two-way bind (the ComboBox idiom). */
  protected syncing = false;

  constructor(options: MemoOptions) {
    super(options);
    this.normalRole = 'memoNormal';
    this.selectedRole = 'memoSelected';
    this.value = options.value;
    this.setText(options.value());
    // External writes → buffer (this direction reads ONLY the signal; the guard stops feedback).
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

  /** @internal Every mutation tick also mirrors the buffer into the bound signal (same tick). */
  override update(): void {
    super.update();
    if (this.value === undefined) return; // the base-ctor update() runs before our fields init
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
