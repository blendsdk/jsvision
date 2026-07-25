/**
 * Small catalog inputs shared by the public translation-service specification tests.
 *
 * The fixtures deliberately keep Dutch framework text separate from English application text so
 * fallback ordering can be tested independently from same-locale layer ordering.
 */

/** Dutch framework messages used to verify language fallback. */
export const frameworkDutch = {
  schema: 1 as const,
  locale: 'nl',
  messages: {
    'app.greeting': 'Nederlands',
    'app.named': 'Hallo ${name}',
    'app.escaped': 'Hi ${name}; $${name}',
  },
};

/** An older Dutch layer used to verify that newer layers win within one locale. */
export const olderDutch = {
  schema: 1 as const,
  locale: 'nl',
  messages: {
    'app.layered': 'Oud',
  },
};

/** A newer Dutch layer used to verify same-locale precedence. */
export const newerDutch = {
  schema: 1 as const,
  locale: 'nl',
  messages: {
    'app.layered': 'Nieuw',
  },
};

/** English application messages that must not outrank an available Dutch framework message. */
export const applicationEnglish = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'app.greeting': 'Application English',
  },
};

/** Polish messages covering every cardinal category used by the service. */
export const polishCardinals = {
  schema: 1 as const,
  locale: 'pl',
  messages: {
    'items.count': {
      kind: 'plural' as const,
      parameter: 'count',
      cases: {
        one: '${count}:one',
        few: '${count}:few',
        many: '${count}:many',
        other: '${count}:other',
      },
    },
  },
};

/** Exact select cases for each primitive controller accepted by translated messages. */
export const primitiveSelections = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'choice.value': {
      kind: 'select' as const,
      parameter: 'choice',
      cases: {
        alpha: 'string',
        '42': 'number',
        true: 'boolean',
        '9007199254740993': 'bigint',
        other: 'other',
      },
    },
  },
};

/** Initial and replacement runtime overlays used to prove atomic catalog updates. */
export const initialRuntimeCatalog = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'runtime.kept': 'original bytes',
    'runtime.removed': 'removed with the old overlay',
  },
};

/** Replacement overlay that intentionally omits a key from the initial overlay. */
export const replacementRuntimeCatalog = {
  schema: 1 as const,
  locale: 'en',
  messages: {
    'runtime.kept': 'replacement bytes',
  },
};
