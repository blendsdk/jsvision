/**
 * `FileInput` — the filename field that mirrors the focused list entry (`extends Input`), a decode of
 * `TFileInputLine` (`stddlg.cpp:69-92`).
 *
 * TV decode (GATE-1): on the `cmFileFocused` broadcast, and **while not itself the focused view**
 * (`:78`), the field mirrors the focused entry's name into its value; for a **directory** it appends
 * the separator + the owner's `wildCard` (`:83-88`) so the field reads `subdir/‹wildcard›`. Otherwise
 * a plain `TInputLine` (its two-way `Signal<string>` + optional `filter` are inherited). Names are
 * sanitized at the draw boundary (AC-14). `.js` per NodeNext.
 */
import { Input, untrack } from '@jsvision/ui';
import type { Signal, Validator } from '@jsvision/ui';
import type { DirEntry } from '../fs/types.js';

/** Construction options for {@link FileInput}. */
export interface FileInputOptions {
  /** Two-way value binding (the filename field). */
  value: Signal<string>;
  /** The focused list entry to mirror (the `FileList` focus broadcast). */
  focusedEntry: () => DirEntry | undefined;
  /** The active wildcard, appended after the separator when mirroring a directory. */
  wildcard: () => string;
  /** The path separator (`fs.sep`). */
  sep: string;
  /** Length cap on the stored value. */
  maxLength?: number;
  /** Optional keystroke validator (inherited `Input` behaviour). */
  validator?: Validator;
}

/** The filename input that mirrors the focused directory entry (unless it is itself focused). */
export class FileInput extends Input {
  constructor(opts: FileInputOptions) {
    super({ value: opts.value, maxLength: opts.maxLength, validator: opts.validator });
    const value = opts.value;
    this.onMount(() => {
      // Fire on the focus broadcast only (subscribe to `focusedEntry`; read `wildcard` untracked so a
      // wildcard change alone never re-mirrors — TV mirrors on `cmFileFocused`, `stddlg.cpp:78`).
      this.bind(
        () => opts.focusedEntry(),
        (entry) => {
          if (entry === undefined) return;
          if (this.state.focused) return; // the not-focused guard — don't clobber the user's typing
          value.set(entry.kind === 'dir' ? entry.name + opts.sep + untrack(() => opts.wildcard()) : entry.name);
        },
      );
    });
  }
}
