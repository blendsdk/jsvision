/** Maximum number of messages accepted in one catalog. */
export const MAX_CATALOG_MESSAGES = 10_000;

/** Maximum Unicode scalar count for public keys and select case names. */
export const MAX_IDENTIFIER_SCALARS = 512;

/** Maximum UTF-8 bytes accepted in one message string. */
export const MAX_MESSAGE_BYTES = 65_536;

/**
 * Maximum cases in one structured message, including `other`.
 *
 * Plural messages naturally remain below this ceiling. The bound primarily prevents a select
 * message from multiplying validation and compilation work without limit.
 */
export const MAX_STRUCTURED_CASES = 256;

/**
 * Maximum aggregate UTF-8 bytes retained by one in-memory catalog.
 *
 * File-backed catalogs have a tighter two-MiB serialized input cap. This larger ceiling keeps
 * programmatic catalogs practical while preventing the per-string limit from multiplying into
 * hundreds of megabytes.
 */
export const MAX_CATALOG_MESSAGE_BYTES = 16 * 1024 * 1024;

/** Maximum structured cases retained across one catalog. */
export const MAX_CATALOG_STRUCTURED_CASES = 16_384;

/** Maximum aggregate UTF-8 bytes used by structured case names in one catalog. */
export const MAX_CATALOG_CASE_NAME_BYTES = 4 * 1024 * 1024;
