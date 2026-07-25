/**
 * Browser-safe public entry point for JSVision internationalization.
 *
 * Keeping this entry free of Node built-ins lets terminal applications share the same translation
 * service in Node and browser runtimes.
 */
export { I18nError, isI18nError } from './errors.js';
export type { I18nErrorOptions } from './errors.js';
export { formatCatalogIssue } from './issue-format.js';
export { mergeCatalogs } from './catalog.js';
export { plural, select } from './messages.js';
export { createI18n } from './service.js';
export { CATALOG_SCHEMA_VERSION } from './types.js';
export { defineCatalog, validateCatalog, validateCatalogs } from './validation.js';
export type {
  AcceleratorManifest,
  AcceleratorScope,
  Catalog,
  CatalogInput,
  CatalogIssue,
  CatalogSource,
  CatalogSourceContext,
  CatalogValidationMode,
  CatalogValidationOptions,
  CreateI18nOptions,
  DiagnosticSink,
  I18n,
  I18nCode,
  I18nDiagnostic,
  I18nSeverity,
  LoadI18nOptions,
  Message,
  MessageCases,
  MessageParameter,
  MessageParams,
  PlaceholderManifest,
  PluralMessage,
  SelectMessage,
  TranslateOptions,
} from './types.js';
