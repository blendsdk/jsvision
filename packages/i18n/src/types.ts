/**
 * Public data contracts for the browser-safe internationalization service.
 *
 * Catalog inputs cross a validation boundary before they become {@link Catalog} values. Runtime
 * APIs therefore accept `unknown` at publication seams and expose only copied, readonly data.
 */

/** Schema version understood by this release. */
export const CATALOG_SCHEMA_VERSION = 1 as const;

/** A primitive value that can be inserted into a message without user-defined coercion. */
export type MessageParameter = string | number | boolean | bigint;

/** Named values available to interpolation and structured-message controllers. */
export type MessageParams = Readonly<Record<string, MessageParameter>>;

/**
 * A case map with a mandatory fallback.
 *
 * Plural case names are checked against the selected locale. Select case names are exact string
 * representations of safe primitive controllers.
 */
export type MessageCases = Readonly<Record<string, string>> & {
  readonly other: string;
};

/** A cardinal plural selected with `Intl.PluralRules`. */
export interface PluralMessage {
  /** Discriminator for cardinal plural selection. */
  readonly kind: 'plural';
  /** Name of the finite numeric parameter controlling the selected case. */
  readonly parameter: string;
  /** Locale-valid plural cases with a mandatory `other` fallback. */
  readonly cases: MessageCases;
}

/** A message selected by exact primitive string matching. */
export interface SelectMessage {
  /** Discriminator for exact select matching. */
  readonly kind: 'select';
  /** Name of the safe primitive parameter controlling the selected case. */
  readonly parameter: string;
  /** Exact case names with a mandatory `other` fallback. */
  readonly cases: MessageCases;
}

/** A catalog message supported by the version-1 JSON schema. */
export type Message = string | PluralMessage | SelectMessage;

/**
 * A validated, locale-scoped message catalog.
 *
 * @example
 * ```ts
 * import type { Catalog } from '@jsvision/i18n';
 *
 * const catalog: Catalog = {
 *   schema: 1,
 *   locale: 'nl',
 *   messages: { 'app.greeting': 'Hallo' },
 * };
 * ```
 */
export interface Catalog {
  /** Exact schema version used by this catalog. */
  readonly schema: typeof CATALOG_SCHEMA_VERSION;
  /** Canonical BCP-47 catalog locale without Unicode or private-use extensions. */
  readonly locale: string;
  /** Flat namespaced message-key map. */
  readonly messages: Readonly<Record<string, Message>>;
}

/** Untrusted value supplied at a catalog validation or publication boundary. */
export type CatalogInput = unknown;

/** Stable code shared by thrown errors, validation issues, and runtime diagnostics. */
export type I18nCode =
  | 'INVALID_LOCALE'
  | 'UNSUPPORTED_SCHEMA'
  | 'INVALID_CATALOG'
  | 'INVALID_KEY'
  | 'INVALID_MESSAGE'
  | 'INVALID_PARAMETER'
  | 'MISSING_TRANSLATION'
  | 'MISSING_PARAMETER'
  | 'INVALID_CONTROLLER'
  | 'UNSAFE_TEXT'
  | 'CATALOG_LIMIT_EXCEEDED'
  | 'ABORTED'
  | 'SOURCE_FAILED'
  | 'INVALID_FORMATTER_OPTIONS'
  | 'INVALID_NUMBER'
  | 'INVALID_DATE'
  | 'INVALID_PATH'
  | 'INVALID_JSON'
  | 'INVALID_UTF8';

/** Severity attached to a validation issue or recoverable diagnostic. */
export type I18nSeverity = 'warning' | 'error';

/**
 * One structural catalog problem.
 *
 * Values and translated text are intentionally absent so issue reporters are safe for terminals
 * and CI logs.
 */
export interface CatalogIssue {
  /** Machine-stable issue category. */
  readonly code: I18nCode;
  /** Whether the issue blocks publication in the selected validation mode. */
  readonly severity: I18nSeverity;
  /** Structural path within the catalog input. */
  readonly path: readonly string[];
  /** Canonical locale when it was safely available. */
  readonly locale?: string;
  /** Message key when it was safely available. */
  readonly key?: string;
  /** Caller-supplied source identifier when one was provided. */
  readonly source?: string;
}

/**
 * One recoverable translation fault retained by a service.
 *
 * Diagnostics contain identities only. Parameter values and translated text are never captured.
 */
export interface I18nDiagnostic {
  /** Machine-stable diagnostic category. */
  readonly code: I18nCode;
  /** Runtime diagnostics are warnings because translation returns a safe fallback. */
  readonly severity: 'warning';
  /** Message key involved in the fault. */
  readonly key: string;
  /** Locale being evaluated when the fault occurred. */
  readonly locale: string;
  /** Optional source identifier inherited from the catalog layer. */
  readonly source?: string;
}

/** Receives each new deduplicated diagnostic after it enters the bounded store. */
export type DiagnosticSink = (diagnostic: I18nDiagnostic) => void;

/** Options accepted by {@link I18n.t}. */
export interface TranslateOptions {
  /** Safe named values used by interpolation and structured-message controllers. */
  readonly params?: MessageParams;
  /** English fallback evaluated after every catalog locale. */
  readonly defaultMessage?: Message;
}

/** A named group of labels that can appear together and must have unique accelerators. */
export interface AcceleratorScope {
  /** Stable developer-facing scope identifier. */
  readonly name: string;
  /** Message keys whose labels coexist in this scope. */
  readonly keys: readonly string[];
  /**
   * Labels that must contain one accelerator marker.
   *
   * Omit this property to require every key. Supply a subset when a translated label is
   * intentionally reachable without a keyboard accelerator.
   */
  readonly requiredKeys?: readonly string[];
}

/** Accelerator topology used by strict catalog validation. */
export interface AcceleratorManifest {
  /** Every independently validated group of co-visible labels. */
  readonly scopes: readonly AcceleratorScope[];
}

/** Placeholder names expected for each reference message key. */
export type PlaceholderManifest = Readonly<Record<string, readonly string[]>>;

/** Completeness policy used by catalog validation. */
export type CatalogValidationMode = 'partial' | 'strict';

/** Options controlling structural and cross-catalog validation. */
export interface CatalogValidationOptions {
  /** Partial application validation or complete official-catalog validation. */
  readonly mode?: CatalogValidationMode;
  /** English or other authoritative catalog used for parity checks. */
  readonly referenceCatalog?: CatalogInput;
  /** Optional reference-key set when a full catalog object is not available. */
  readonly referenceKeys?: readonly string[];
  /** Required placeholder names per reference key. */
  readonly placeholderManifest?: PlaceholderManifest;
  /** Co-visible labels used for accelerator validation. */
  readonly acceleratorManifest?: AcceleratorManifest;
  /** Treat accelerator warnings as blocking official-catalog errors. */
  readonly official?: boolean;
  /** Value-free identifier included in returned issues. */
  readonly source?: string;
}

/** Options used to synchronously create an internationalization service. */
export interface CreateI18nOptions {
  /** Explicit locale, or `auto` to opt into environment detection. Defaults to `en`. */
  readonly locale?: string | 'auto';
  /** Ordered locale fallbacks. English remains the final implicit fallback. */
  readonly fallbackLocales?: readonly string[];
  /** Ordered catalog layers; later layers win within the same locale. */
  readonly catalogs?: readonly CatalogInput[];
  /** Optional observer for each new recoverable diagnostic. */
  readonly diagnosticSink?: DiagnosticSink;
}

/** Context shared by every catalog source participating in one atomic load. */
export interface CatalogSourceContext {
  /** Caller-owned or service-created cancellation signal. */
  readonly signal: AbortSignal;
}

/**
 * An asynchronous provider of one or more catalog inputs.
 *
 * Network, authentication, timeout, retry, and cache policy remain the caller's responsibility.
 */
export interface CatalogSource {
  /** Stable value-free identifier used by diagnostics. */
  readonly name: string;
  /** Whether a failure aborts loading. Defaults to `true`. */
  readonly required?: boolean;
  /**
   * Loads catalog inputs for one atomic service publication.
   *
   * @param context Shared cancellation context.
   * @returns One catalog input or an ordered list of catalog inputs.
   */
  load(context: CatalogSourceContext): Promise<CatalogInput | readonly CatalogInput[]>;
}

/** Options used to create a service from asynchronous catalog sources. */
export interface LoadI18nOptions extends CreateI18nOptions {
  /** Sources whose results are merged in declaration order; at most 256 sources may be started. */
  readonly sources: readonly CatalogSource[];
  /** Optional caller-owned cancellation signal. */
  readonly signal?: AbortSignal;
}

/**
 * Locale-bound translation and formatting service.
 *
 * @example
 * ```ts
 * import { createI18n } from '@jsvision/i18n';
 *
 * const i18n = createI18n({ locale: 'nl' });
 * i18n.t('app.greeting', { defaultMessage: 'Hello' });
 * ```
 */
export interface I18n {
  /** Canonical requested locale used for formatting. */
  readonly locale: string;
  /** Canonical configured fallbacks including final English. */
  readonly fallbackLocales: readonly string[];
  /** Sorted catalog locales currently available to lookup. */
  readonly availableLocales: readonly string[];
  /** Deduplicated recoverable diagnostics, bounded to 100 records. */
  readonly diagnostics: readonly I18nDiagnostic[];

  /**
   * Resolves and evaluates one translated message.
   *
   * @param key Namespaced message key.
   * @param options Safe parameters and optional English default.
   * @returns Resolved text, the call-site default, or the key.
   */
  t(key: string, options?: TranslateOptions): string;

  /**
   * Formats a finite number or bigint for the service locale.
   *
   * @param value Numeric value to format.
   * @param options Copied native formatting options.
   * @returns Locale-formatted number.
   */
  number(value: number | bigint, options?: Intl.NumberFormatOptions): string;

  /**
   * Formats a valid date or finite epoch milliseconds for the service locale.
   *
   * @param value Date value to format.
   * @param options Copied native formatting options.
   * @returns Locale-formatted date.
   */
  date(value: Date | number, options?: Intl.DateTimeFormatOptions): string;

  /**
   * Compares normalized strings with a locale-bound collator.
   *
   * @param left First string.
   * @param right Second string.
   * @param options Copied native collation options.
   * @returns Negative, zero, or positive comparison result.
   */
  compare(left: string, right: string, options?: Intl.CollatorOptions): number;

  /**
   * Reports whether a key exists in the selected locale's catalog fallback path.
   *
   * @param key Namespaced message key.
   * @param locale Optional locale override for introspection only.
   * @returns `true` when a catalog message can be resolved.
   */
  has(key: string, locale?: string): boolean;

  /**
   * Atomically replaces the highest-priority runtime overlay for one locale.
   *
   * @param catalog Untrusted catalog input validated before publication.
   * @throws An `I18nError` when the catalog is invalid.
   */
  setCatalog(catalog: CatalogInput): void;
}
