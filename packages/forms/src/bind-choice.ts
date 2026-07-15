import type { Signal } from '@jsvision/ui';
import type { Field } from './types.js';

/**
 * Adapt a single-choice field to a `RadioGroup`'s `Signal<number>` (the selected index), keeping the
 * field's value in domain terms so validation runs on the real value, never an index.
 *
 * The returned value is a **stateless lens** over `field.value` — it stores nothing and holds no
 * subscription of its own. Reading it subscribes to `field.value` (so the group repaints when the
 * domain value changes); writing an index sets `field.value` to the matching option.
 *
 * Gotchas:
 * - A domain value not in `options` reads back as `-1`. Seed a valid `initial` (or a schema default)
 *   so the first read isn't `-1`.
 * - Setting an out-of-range index writes `undefined` to the field — there is no bounds guard, because
 *   a `RadioGroup` only ever sets `0..options.length-1`. Keep `options` aligned with the schema.
 *
 * @param field   The single-choice field handle.
 * @param options The choices, in display order; index `i` maps to `options[i]`.
 * @returns A `Signal<number>` lens suitable as a `RadioGroup`'s `value`.
 *
 * @example
 * import { Group, RadioGroup } from '@jsvision/ui';
 * import { createForm, bindRadio } from '@jsvision/forms';
 * import { z } from 'zod';
 *
 * const options = ['left', 'center', 'right'];
 * const form = createForm({
 *   schema: z.object({ align: z.enum(['left', 'center', 'right']) }),
 *   initial: { align: 'left' },
 * });
 * const group = new RadioGroup({
 *   labels: ['~L~eft', '~C~enter', '~R~ight'],
 *   value: bindRadio(form.field('align'), options),
 * });
 * new Group().add(group);
 * // Selecting "Right" sets form.field('align').value() to 'right' — validation sees the enum, not an index.
 */
export function bindRadio<T>(field: Field<T>, options: readonly T[]): Signal<number> {
  const read = (): number => options.indexOf(field.value());
  const peek = (): number => options.indexOf(field.value.peek());
  const set = (index: number): void => {
    field.value.set(options[index]);
  };
  const update = (fn: (previous: number) => number): void => {
    set(fn(peek()));
  };
  return Object.assign(read, { peek, set, update });
}

/**
 * Adapt a multi-choice field to a `CheckGroup`'s `Signal<boolean[]>` (one flag per option), keeping
 * the field's value as the list of **selected values** so validation runs on the domain array.
 *
 * The returned value is a **stateless lens** over `field.value` — it stores nothing and holds no
 * subscription of its own. Reading it subscribes to `field.value` and maps each option to whether it
 * is currently selected (`includes`), so the domain array may be in any order; writing a flag array
 * replaces `field.value` with the options whose flag is truthy, in option order.
 *
 * Gotcha: only members of `options` are ever written back, so a selected value not in `options` is
 * dropped on the first widget write-back. Keep `options` equal to the field's enum (model the field
 * as `z.array(z.enum([...options]))`) so every value is representable.
 *
 * @param field   The multi-choice field handle (its value is the selected-values array).
 * @param options The choices, in display order; flag `i` corresponds to `options[i]`.
 * @returns A `Signal<boolean[]>` lens suitable as a `CheckGroup`'s `value`.
 *
 * @example
 * import { Group, CheckGroup } from '@jsvision/ui';
 * import { createForm, bindCheck } from '@jsvision/forms';
 * import { z } from 'zod';
 *
 * const options = ['bold', 'italic', 'underline'];
 * const form = createForm({
 *   schema: z.object({ styles: z.array(z.enum(['bold', 'italic', 'underline'])) }),
 *   initial: { styles: ['bold'] },
 * });
 * const group = new CheckGroup({
 *   labels: ['~B~old', '~I~talic', '~U~nderline'],
 *   value: bindCheck(form.field('styles'), options),
 * });
 * new Group().add(group);
 * // Checking "Italic" makes form.field('styles').value() deep-equal ['bold', 'italic'] (option order).
 */
export function bindCheck<T>(field: Field<T[]>, options: readonly T[]): Signal<boolean[]> {
  const read = (): boolean[] => {
    const selected = field.value();
    return options.map((option) => selected.includes(option));
  };
  const peek = (): boolean[] => {
    const selected = field.value.peek();
    return options.map((option) => selected.includes(option));
  };
  const set = (flags: boolean[]): void => {
    field.value.set(options.filter((_, i) => flags[i]));
  };
  const update = (fn: (previous: boolean[]) => boolean[]): void => {
    set(fn(peek()));
  };
  return Object.assign(read, { peek, set, update });
}
