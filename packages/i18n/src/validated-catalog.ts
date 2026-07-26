import { isObjectLike } from './input.js';
import type { Catalog, CatalogInput } from './types.js';

const UTF8_ENCODER = new TextEncoder();
const VALIDATED_CATALOGS = new WeakMap<object, ValidatedCatalogMetrics>();

/** Work retained by one validated catalog and consumed again during compilation. */
export interface ValidatedCatalogMetrics {
  /** Plain messages plus structured cases compiled into templates. */
  readonly compilationUnits: number;
  /** Aggregate UTF-8 message bytes compiled into tokens. */
  readonly messageBytes: number;
}

/** Calculate immutable compilation work once while registering a trusted catalog. */
function catalogMetrics(catalog: Catalog): ValidatedCatalogMetrics {
  let compilationUnits = 0;
  let messageBytes = 0;
  for (const message of Object.values(catalog.messages)) {
    if (typeof message === 'string') {
      compilationUnits += 1;
      messageBytes += UTF8_ENCODER.encode(message).byteLength;
      continue;
    }
    for (const text of Object.values(message.cases)) {
      compilationUnits += 1;
      messageBytes += UTF8_ENCODER.encode(text).byteLength;
    }
  }
  return Object.freeze({ compilationUnits, messageBytes });
}

/**
 * Mark a copied immutable catalog as having crossed the complete validation boundary.
 *
 * The mark is module-private and identity-based. It cannot be forged through catalog fields,
 * serialization, freezing, or structural typing.
 *
 * @param catalog Catalog produced by the validator.
 * @returns The same catalog identity for convenient publication.
 */
export function markValidatedCatalog(catalog: Catalog): Catalog {
  VALIDATED_CATALOGS.set(catalog, catalogMetrics(catalog));
  return catalog;
}

/**
 * Report whether a catalog identity was produced by this package's validator.
 *
 * @param input Untrusted or previously validated catalog value.
 * @returns `true` only for a catalog copied and registered by this module instance.
 */
export function isValidatedCatalog(input: CatalogInput): input is Catalog {
  return isObjectLike(input) && VALIDATED_CATALOGS.has(input);
}

/**
 * Return precomputed compilation work for one validated catalog identity.
 *
 * @param catalog Catalog known to have crossed validation.
 * @returns Immutable work metrics, or `undefined` for an unregistered identity.
 */
export function validatedCatalogMetrics(catalog: Catalog): ValidatedCatalogMetrics | undefined {
  return VALIDATED_CATALOGS.get(catalog);
}
