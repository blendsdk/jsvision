/**
 * A single-line filename field that mirrors the entry the user is browsing. Whenever a different list
 * entry gains focus — and this field is *not* itself focused — it copies that entry's name into its
 * value; for a directory it fills in `subdir<sep><wildcard>` so the field previews where a descent
 * would land. Once the user clicks into the field and starts typing, mirroring stops, so it never
 * overwrites what they are entering. Everything else (the two-way value binding, an optional keystroke
 * validator) is standard {@link Input} behaviour.
 *
 * This is the filename field embedded in {@link FileDialog}; use it directly only when composing a
 * custom file picker.
 */
import { Input, untrack } from '@jsvision/ui';
import type { Signal, Validator } from '@jsvision/ui';
import type { DirEntry } from '../fs/types.js';

/** Construction options for {@link FileInput}. */
export interface FileInputOptions {
  /** The two-way filename value (reflects the field, receives the typed name). */
  value: Signal<string>;
  /** The currently-focused list entry to mirror. */
  focusedEntry: () => DirEntry | undefined;
  /** The active wildcard, appended after the separator when mirroring a directory. */
  wildcard: () => string;
  /** The path separator to insert between a directory name and the wildcard. */
  sep: string;
  /** Maximum length of the stored value. */
  maxLength?: number;
  /** An optional keystroke validator (standard {@link Input} behaviour). */
  validator?: Validator;
}

/**
 * The filename input that mirrors the focused directory entry unless it is itself focused.
 *
 * @example
 * import { Group, signal } from '@jsvision/ui';
 * import { FileInput, nodeFileSystem } from '@jsvision/files';
 * import type { DirEntry } from '@jsvision/files';
 *
 * const filename = signal('');
 * const focused = signal<DirEntry | undefined>(undefined);
 * const field = new FileInput({
 *   value: filename,          // two-way: reflects and receives the typed name
 *   focusedEntry: () => focused(),
 *   wildcard: () => '*.ts',
 *   sep: nodeFileSystem.sep,
 * });
 * field.layout = { position: 'absolute', rect: { x: 0, y: 0, width: 28, height: 1 } };
 * new Group().add(field);
 */
export class FileInput extends Input {
  constructor(opts: FileInputOptions) {
    super({ value: opts.value, maxLength: opts.maxLength, validator: opts.validator });
    const value = opts.value;
    this.onMount(() => {
      // Re-mirror only when the focused entry changes: subscribe to `focusedEntry`, but read
      // `wildcard` untracked so changing the wildcard alone never re-writes the field.
      this.bind(
        () => opts.focusedEntry(),
        (entry) => {
          if (entry === undefined) return;
          if (this.state.focused) return; // don't clobber what the user is typing
          value.set(entry.kind === 'dir' ? entry.name + opts.sep + untrack(() => opts.wildcard()) : entry.name);
        },
      );
    });
  }
}
