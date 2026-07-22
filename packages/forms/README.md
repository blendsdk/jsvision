# @jsvision/forms

A headless, reactive **form/field store with synchronous [Zod](https://zod.dev)
validation** for [jsvision](https://github.com/blendsdk/jsvision), built on
[`@jsvision/ui`](../ui)'s Solid-style signals.

`createForm` owns the raw editing values, validates the whole object through
`schema.safeParse` in one memoized computed, and exposes per-field and form-level
accessors plus `submit` / `reset`. It holds **no view** and draws nothing — widget
binding is a separate layer — so the whole store runs headless in tests and anywhere
signals run.

`zod` is a required **peer dependency** (`^4`); `@jsvision/core` and `@jsvision/ui`
stay zero-runtime-dependency.

See the [documentation site](https://blendsdk.github.io/jsvision/) for the full
reference and [API docs](https://blendsdk.github.io/jsvision/api/).
