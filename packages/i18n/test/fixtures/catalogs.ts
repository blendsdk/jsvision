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
