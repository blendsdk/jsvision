// Placeholder module confirming the @jsvision/ui + zod toolchain wiring resolves.
// The real Form / Field / CreateFormOptions contract lands with the store.
import type { Signal } from '@jsvision/ui';
import type { ZodIssue } from 'zod';

export type Placeholder = { signal?: Signal<unknown>; issue?: ZodIssue };
