/** Namespaced public message-key grammar. */
export const MESSAGE_KEY_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;

/** Named interpolation and structured-controller parameter grammar. */
export const PARAMETER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/u;
