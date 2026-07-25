import { I18nError } from './errors.js';
import type { I18nCode, Message, MessageCases, MessageParameter, PluralMessage, SelectMessage } from './types.js';

const PARAMETER_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/u;

/** One precompiled literal or named placeholder. */
export type TemplateToken =
  { readonly kind: 'literal'; readonly value: string } | { readonly kind: 'parameter'; readonly name: string };

/** Immutable tokens for one catalog string. */
export interface CompiledTemplate {
  /** Tokens emitted from left to right during interpolation. */
  readonly tokens: readonly TemplateToken[];
}

/** Immutable internal message representation published in catalog snapshots. */
export type CompiledMessage =
  | { readonly kind: 'text'; readonly template: CompiledTemplate }
  | {
      readonly kind: 'plural';
      readonly parameter: string;
      readonly cases: ReadonlyMap<string, CompiledTemplate>;
    }
  | {
      readonly kind: 'select';
      readonly parameter: string;
      readonly cases: ReadonlyMap<string, CompiledTemplate>;
    };

/** Runtime services needed to evaluate a precompiled message without retaining caller data. */
export interface MessageEvaluationContext {
  /** Locale of the catalog message being evaluated. */
  readonly locale: string;
  /** Untrusted parameters supplied for this call. */
  readonly params?: unknown;
  /** Locale-bound cardinal plural rules. */
  readonly pluralRules: Intl.PluralRules;
  /** Formats numeric interpolation with the resolved message locale. */
  readonly formatNumber: (value: number | bigint) => string;
  /** Records one recoverable fault without throwing. */
  readonly report: (code: I18nCode) => void;
}

/**
 * Reports whether text is safe to render in a terminal cell stream.
 *
 * @param value Text to inspect without normalizing or coercing it.
 * @returns `true` when the text contains well-formed Unicode and no terminal control sequences.
 *
 * @example
 * ```ts
 * isSafeText('Hello\nworld'); // true
 * ```
 */
export function isSafeText(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
      continue;
    }
    if (unit >= 0xdc00 && unit <= 0xdfff) return false;

    if (unit === 0x0a) continue;
    if (unit <= 0x1f || (unit >= 0x7f && unit <= 0x9f)) return false;
    if ((unit >= 0x202a && unit <= 0x202e) || (unit >= 0x2066 && unit <= 0x2069)) {
      return false;
    }
  }
  return true;
}

/**
 * Reject terminal-unsafe control and bidi text before catalog publication.
 *
 * @param value Text to validate.
 * @throws {@link I18nError} when text could inject terminal state or has malformed Unicode.
 *
 * @example
 * ```ts
 * assertSafeText('Hello\nworld');
 * ```
 */
export function assertSafeText(value: string): void {
  if (!isSafeText(value)) {
    throw new I18nError('UNSAFE_TEXT', 'Message text contains unsafe Unicode or control characters.');
  }
}

/** Push a literal token while coalescing adjacent literal fragments. */
function pushLiteral(tokens: TemplateToken[], value: string): void {
  if (value.length === 0) return;
  const previous = tokens[tokens.length - 1];
  if (previous?.kind === 'literal') {
    tokens[tokens.length - 1] = Object.freeze({
      kind: 'literal',
      value: previous.value + value,
    });
    return;
  }
  tokens.push(Object.freeze({ kind: 'literal', value }));
}

/** Read and validate the name terminated by the next closing brace. */
function readParameter(value: string, start: number): { readonly name: string; readonly end: number } {
  const end = value.indexOf('}', start);
  if (end < 0) {
    throw new I18nError('INVALID_MESSAGE', 'Message contains an unclosed placeholder.');
  }
  const name = value.slice(start, end);
  if (!PARAMETER_PATTERN.test(name)) {
    throw new I18nError('INVALID_PARAMETER', 'Message contains an invalid parameter name.');
  }
  return { name, end };
}

/**
 * Compile message text into immutable literal and placeholder tokens.
 *
 * @param value Safe message text.
 * @returns Reusable token sequence.
 * @throws {@link I18nError} for unsafe text or malformed placeholders.
 *
 * @example
 * ```ts
 * compileTemplate('Hello ${name}');
 * ```
 */
export function compileTemplate(value: string): CompiledTemplate {
  assertSafeText(value);
  const tokens: TemplateToken[] = [];
  let literalStart = 0;
  let index = 0;

  while (index < value.length) {
    const escaped = value.startsWith('$${', index);
    const placeholder = !escaped && value.startsWith('${', index);
    if (!escaped && !placeholder) {
      index += 1;
      continue;
    }

    pushLiteral(tokens, value.slice(literalStart, index));
    const parsed = readParameter(value, index + (escaped ? 3 : 2));
    if (escaped) {
      pushLiteral(tokens, `\${${parsed.name}}`);
    } else {
      tokens.push(Object.freeze({ kind: 'parameter', name: parsed.name }));
    }
    index = parsed.end + 1;
    literalStart = index;
  }

  pushLiteral(tokens, value.slice(literalStart));
  return Object.freeze({ tokens: Object.freeze(tokens) });
}

/** Compile every string in one structured-message case map. */
function compileCases(cases: MessageCases): ReadonlyMap<string, CompiledTemplate> {
  if (!Object.hasOwn(cases, 'other') || typeof cases.other !== 'string') {
    throw new I18nError('INVALID_MESSAGE', 'Structured message requires a string other case.');
  }

  const compiled = new Map<string, CompiledTemplate>();
  for (const [name, value] of Object.entries(cases)) {
    if (typeof value !== 'string') {
      throw new I18nError('INVALID_MESSAGE', 'Structured message cases must be strings.');
    }
    compiled.set(name, compileTemplate(value));
  }
  return compiled;
}

/**
 * Compile one validated public message for immutable snapshot publication.
 *
 * @param message Public message value.
 * @returns Allocation-free lookup representation.
 * @throws {@link I18nError} when the message is malformed.
 *
 * @example
 * ```ts
 * compileMessage('Hello ${name}');
 * ```
 */
export function compileMessage(message: Message): CompiledMessage {
  if (typeof message === 'string') {
    return Object.freeze({ kind: 'text', template: compileTemplate(message) });
  }
  if (!PARAMETER_PATTERN.test(message.parameter)) {
    throw new I18nError('INVALID_PARAMETER', 'Structured message has an invalid controller name.');
  }
  return Object.freeze({
    kind: message.kind,
    parameter: message.parameter,
    cases: compileCases(message.cases),
  });
}

/** Read an own data property without invoking getters or walking the prototype chain. */
function ownParameter(params: unknown, name: string): unknown {
  if ((typeof params !== 'object' && typeof params !== 'function') || params === null) {
    return undefined;
  }
  const descriptor = Object.getOwnPropertyDescriptor(params, name);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

/** Narrow an untrusted parameter while rejecting non-finite numbers. */
function safeParameter(value: unknown): MessageParameter | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') return isSafeText(value) ? value : undefined;
  if (typeof value === 'boolean' || typeof value === 'bigint') return value;
  return undefined;
}

/** Render one safe primitive without invoking user-defined coercion. */
function renderParameter(value: MessageParameter, context: MessageEvaluationContext): string {
  if (typeof value === 'number' || typeof value === 'bigint') {
    return context.formatNumber(value);
  }
  return typeof value === 'string' ? value : value ? 'true' : 'false';
}

/** Interpolate one compiled template and preserve unresolved placeholders. */
function interpolate(template: CompiledTemplate, context: MessageEvaluationContext): string {
  let output = '';
  for (const token of template.tokens) {
    if (token.kind === 'literal') {
      output += token.value;
      continue;
    }

    const raw = ownParameter(context.params, token.name);
    const value = safeParameter(raw);
    if (value === undefined) {
      context.report(typeof raw === 'string' && !isSafeText(raw) ? 'UNSAFE_TEXT' : 'MISSING_PARAMETER');
      output += `\${${token.name}}`;
      continue;
    }
    output += renderParameter(value, context);
  }
  return output;
}

/** Select the structured case while reporting an invalid or missing controller. */
function selectCase(
  message: Exclude<CompiledMessage, { readonly kind: 'text' }>,
  context: MessageEvaluationContext,
): CompiledTemplate {
  const raw = ownParameter(context.params, message.parameter);
  const controller = safeParameter(raw);
  let name: string | undefined;

  if (message.kind === 'plural') {
    if (typeof controller === 'number') {
      name = context.pluralRules.select(controller);
    }
  } else if (controller !== undefined) {
    name =
      typeof controller === 'string'
        ? controller
        : typeof controller === 'bigint'
          ? controller.toString()
          : typeof controller === 'number'
            ? String(controller)
            : controller
              ? 'true'
              : 'false';
  }

  if (name === undefined) context.report('INVALID_CONTROLLER');
  const selected = name === undefined ? undefined : message.cases.get(name);
  const fallback = message.cases.get('other');
  if (!fallback) {
    throw new I18nError('INVALID_MESSAGE', 'Compiled structured message has no other case.');
  }
  return selected ?? fallback;
}

/**
 * Evaluate one precompiled message with locale-bound services.
 *
 * @param message Compiled message from an immutable catalog snapshot.
 * @param context Per-call parameters, formatters, and diagnostic reporter.
 * @returns Safely interpolated text.
 *
 * @example
 * ```ts
 * evaluateMessage(compileMessage('Hello'), {
 *   locale: 'en',
 *   pluralRules: new Intl.PluralRules('en'),
 *   formatNumber: (value) => new Intl.NumberFormat('en').format(value),
 *   report: () => undefined,
 * });
 * ```
 */
export function evaluateMessage(message: CompiledMessage, context: MessageEvaluationContext): string {
  const template = message.kind === 'text' ? message.template : selectCase(message, context);
  return interpolate(template, context);
}

/**
 * Create the exact JSON representation of a cardinal plural message.
 *
 * @param parameter Finite numeric controller name.
 * @param cases Locale-valid plural cases with `other`.
 * @returns Frozen copied plural message.
 *
 * @example
 * ```ts
 * plural('count', { one: 'One item', other: '${count} items' });
 * ```
 */
export function plural(parameter: string, cases: MessageCases): PluralMessage {
  return Object.freeze({
    kind: 'plural',
    parameter,
    cases: Object.freeze({ ...cases }),
  });
}

/**
 * Create the exact JSON representation of an exact select message.
 *
 * @param parameter Safe primitive controller name.
 * @param cases Exact cases with `other`.
 * @returns Frozen copied select message.
 *
 * @example
 * ```ts
 * select('state', { ready: 'Ready', other: 'Unknown' });
 * ```
 */
export function select(parameter: string, cases: MessageCases): SelectMessage {
  return Object.freeze({
    kind: 'select',
    parameter,
    cases: Object.freeze({ ...cases }),
  });
}
