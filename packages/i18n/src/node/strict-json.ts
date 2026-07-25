import { I18nError } from '../errors.js';

/** Default maximum syntactic nesting accepted from one JSON document. */
const DEFAULT_MAX_DEPTH = 64;

/** Default maximum lexical tokens accepted from one bounded JSON document. */
const DEFAULT_MAX_TOKENS = 1_000_000;

/** Default maximum decoded Unicode scalars accepted from JSON string tokens. */
const DEFAULT_MAX_STRING_SCALARS = 2 * 1024 * 1024;

/** Internal limits used to keep parsing work bounded independently from file size. */
export interface StrictJsonLimits {
  /** Maximum nested object/array depth, including the root container. */
  readonly maxDepth?: number;
  /** Maximum number of values, names, and structural punctuation tokens. */
  readonly maxTokens?: number;
  /** Maximum aggregate decoded Unicode scalars across string tokens. */
  readonly maxStringScalars?: number;
}

/** Fully resolved positive parser limits. */
interface ResolvedStrictJsonLimits {
  /** Maximum nested object/array depth. */
  readonly maxDepth: number;
  /** Maximum lexical token count. */
  readonly maxTokens: number;
  /** Maximum aggregate string scalar count. */
  readonly maxStringScalars: number;
}

/** Create one value-free strict-JSON failure. */
function invalidJson(): I18nError {
  return new I18nError('INVALID_JSON', 'Catalog file is not valid strict JSON.');
}

/** Resolve bounded positive integer parser limits. */
function resolveLimits(limits: StrictJsonLimits): ResolvedStrictJsonLimits {
  const maxDepth = limits.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxTokens = limits.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxStringScalars = limits.maxStringScalars ?? DEFAULT_MAX_STRING_SCALARS;
  if (
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 1 ||
    maxDepth > DEFAULT_MAX_DEPTH ||
    !Number.isSafeInteger(maxTokens) ||
    maxTokens < 1 ||
    maxTokens > DEFAULT_MAX_TOKENS ||
    !Number.isSafeInteger(maxStringScalars) ||
    maxStringScalars < 1 ||
    maxStringScalars > DEFAULT_MAX_STRING_SCALARS
  ) {
    throw invalidJson();
  }
  return Object.freeze({ maxDepth, maxStringScalars, maxTokens });
}

/** Stateful single-pass recursive-descent parser for one immutable input string. */
class StrictJsonParser {
  /** Current UTF-16 input offset. */
  #index = 0;

  /** Lexical tokens consumed so far. */
  #tokens = 0;

  /** Decoded Unicode scalars across all string tokens. */
  #stringScalars = 0;

  /**
   * Create a parser with already-resolved resource limits.
   *
   * @param input Complete decoded JSON text.
   * @param limits Positive hard parser bounds.
   */
  constructor(
    private readonly input: string,
    private readonly limits: ResolvedStrictJsonLimits,
  ) {}

  /** Parse exactly one JSON value and reject trailing non-whitespace input. */
  parse(): unknown {
    this.#skipWhitespace();
    const value = this.#parseValue(0);
    this.#skipWhitespace();
    if (this.#index !== this.input.length) throw invalidJson();
    return value;
  }

  /** Consume one bounded lexical token. */
  #token(): void {
    this.#tokens += 1;
    if (this.#tokens > this.limits.maxTokens) throw invalidJson();
  }

  /** Count one decoded string scalar. */
  #scalar(): void {
    this.#stringScalars += 1;
    if (this.#stringScalars > this.limits.maxStringScalars) throw invalidJson();
  }

  /** Consume only the four whitespace characters admitted by the JSON grammar. */
  #skipWhitespace(): void {
    while (this.#index < this.input.length) {
      const unit = this.input.charCodeAt(this.#index);
      if (unit !== 0x20 && unit !== 0x09 && unit !== 0x0a && unit !== 0x0d) return;
      this.#index += 1;
    }
  }

  /** Parse one value according to its first input character. */
  #parseValue(depth: number): unknown {
    const current = this.input[this.#index];
    if (current === '"') return this.#parseString();
    if (current === '{') return this.#parseObject(depth + 1);
    if (current === '[') return this.#parseArray(depth + 1);
    if (current === 't') return this.#parseLiteral('true', true);
    if (current === 'f') return this.#parseLiteral('false', false);
    if (current === 'n') return this.#parseLiteral('null', null);
    if (current === '-' || (current !== undefined && current >= '0' && current <= '9')) {
      return this.#parseNumber();
    }
    throw invalidJson();
  }

  /** Ensure a new object or array remains inside the nesting limit. */
  #checkDepth(depth: number): void {
    if (depth > this.limits.maxDepth) throw invalidJson();
  }

  /** Consume one exact punctuation character. */
  #punctuation(expected: string): void {
    if (this.input[this.#index] !== expected) throw invalidJson();
    this.#index += 1;
    this.#token();
  }

  /** Parse an object into a null-prototype data record with duplicate detection. */
  #parseObject(depth: number): Record<string, unknown> {
    this.#checkDepth(depth);
    this.#punctuation('{');
    this.#skipWhitespace();
    const result: Record<string, unknown> = Object.create(null);
    const names = new Set<string>();
    if (this.input[this.#index] === '}') {
      this.#punctuation('}');
      return result;
    }

    while (true) {
      if (this.input[this.#index] !== '"') throw invalidJson();
      const name = this.#parseString();
      if (names.has(name)) throw invalidJson();
      names.add(name);
      this.#skipWhitespace();
      this.#punctuation(':');
      this.#skipWhitespace();
      const value = this.#parseValue(depth);
      Object.defineProperty(result, name, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      });
      this.#skipWhitespace();
      if (this.input[this.#index] === '}') {
        this.#punctuation('}');
        return result;
      }
      this.#punctuation(',');
      this.#skipWhitespace();
    }
  }

  /** Parse an ordered JSON array. */
  #parseArray(depth: number): unknown[] {
    this.#checkDepth(depth);
    this.#punctuation('[');
    this.#skipWhitespace();
    const result: unknown[] = [];
    if (this.input[this.#index] === ']') {
      this.#punctuation(']');
      return result;
    }

    while (true) {
      result.push(this.#parseValue(depth));
      this.#skipWhitespace();
      if (this.input[this.#index] === ']') {
        this.#punctuation(']');
        return result;
      }
      this.#punctuation(',');
      this.#skipWhitespace();
    }
  }

  /** Parse one JSON string with exact escape and surrogate validation. */
  #parseString(): string {
    this.#punctuation('"');
    let output = '';
    while (this.#index < this.input.length) {
      const unit = this.input.charCodeAt(this.#index);
      if (unit === 0x22) {
        this.#index += 1;
        return output;
      }
      if (unit <= 0x1f) throw invalidJson();
      if (unit === 0x5c) {
        this.#index += 1;
        output += this.#parseEscape();
        continue;
      }
      if (unit >= 0xd800 && unit <= 0xdbff) {
        const low = this.input.charCodeAt(this.#index + 1);
        if (low < 0xdc00 || low > 0xdfff) throw invalidJson();
        output += this.input.slice(this.#index, this.#index + 2);
        this.#index += 2;
        this.#scalar();
        continue;
      }
      if (unit >= 0xdc00 && unit <= 0xdfff) throw invalidJson();
      output += this.input[this.#index];
      this.#index += 1;
      this.#scalar();
    }
    throw invalidJson();
  }

  /** Parse one backslash escape, joining surrogate-pair escapes when required. */
  #parseEscape(): string {
    const escape = this.input[this.#index];
    this.#index += 1;
    const simple = new Map<string, string>([
      ['"', '"'],
      ['\\', '\\'],
      ['/', '/'],
      ['b', '\b'],
      ['f', '\f'],
      ['n', '\n'],
      ['r', '\r'],
      ['t', '\t'],
    ]).get(escape ?? '');
    if (simple !== undefined) {
      this.#scalar();
      return simple;
    }
    if (escape !== 'u') throw invalidJson();

    const high = this.#parseHexUnit();
    if (high >= 0xdc00 && high <= 0xdfff) throw invalidJson();
    if (high < 0xd800 || high > 0xdbff) {
      this.#scalar();
      return String.fromCharCode(high);
    }
    if (this.input.slice(this.#index, this.#index + 2) !== '\\u') throw invalidJson();
    this.#index += 2;
    const low = this.#parseHexUnit();
    if (low < 0xdc00 || low > 0xdfff) throw invalidJson();
    this.#scalar();
    return String.fromCharCode(high, low);
  }

  /** Parse exactly four hexadecimal digits into one UTF-16 code unit. */
  #parseHexUnit(): number {
    const digits = this.input.slice(this.#index, this.#index + 4);
    if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) throw invalidJson();
    this.#index += 4;
    return Number.parseInt(digits, 16);
  }

  /** Parse a fixed JSON literal. */
  #parseLiteral(token: string, value: boolean | null): boolean | null {
    if (this.input.slice(this.#index, this.#index + token.length) !== token) throw invalidJson();
    this.#index += token.length;
    this.#token();
    return value;
  }

  /** Parse the JSON number grammar and reject non-finite numeric results. */
  #parseNumber(): number {
    const start = this.#index;
    if (this.input[this.#index] === '-') this.#index += 1;
    if (this.input[this.#index] === '0') {
      this.#index += 1;
      const next = this.input[this.#index];
      if (next !== undefined && next >= '0' && next <= '9') throw invalidJson();
    } else {
      const first = this.input[this.#index];
      if (first === undefined || first < '1' || first > '9') throw invalidJson();
      while (this.#isDigit(this.input[this.#index])) this.#index += 1;
    }
    if (this.input[this.#index] === '.') {
      this.#index += 1;
      if (!this.#isDigit(this.input[this.#index])) throw invalidJson();
      while (this.#isDigit(this.input[this.#index])) this.#index += 1;
    }
    const exponent = this.input[this.#index];
    if (exponent === 'e' || exponent === 'E') {
      this.#index += 1;
      const sign = this.input[this.#index];
      if (sign === '+' || sign === '-') this.#index += 1;
      if (!this.#isDigit(this.input[this.#index])) throw invalidJson();
      while (this.#isDigit(this.input[this.#index])) this.#index += 1;
    }

    const value = Number(this.input.slice(start, this.#index));
    if (!Number.isFinite(value)) throw invalidJson();
    this.#token();
    return value;
  }

  /** Report whether one optional character is an ASCII decimal digit. */
  #isDigit(value: string | undefined): boolean {
    return value !== undefined && value >= '0' && value <= '9';
  }
}

/**
 * Parse one decoded JSON document without accepting duplicate object members.
 *
 * Objects use a null prototype so special member names remain inert data. The parser enforces the
 * JSON grammar directly, including exact number, escape, surrogate, whitespace, and trailing-token
 * behavior, while bounding nesting, tokens, and decoded string scalars.
 *
 * @param input Complete decoded JSON text.
 * @param limits Optional lower parser bounds used by focused tests and trusted callers.
 * @returns JSON-compatible arrays, primitives, and null-prototype records.
 * @throws {@link I18nError} with `INVALID_JSON` for grammar, duplicate, Unicode, or limit failures.
 *
 * @example
 * ```ts
 * parseStrictJson('{"schema":1,"locale":"en","messages":{}}');
 * ```
 */
export function parseStrictJson(input: string, limits: StrictJsonLimits = {}): unknown {
  if (typeof input !== 'string') throw invalidJson();
  return new StrictJsonParser(input, resolveLimits(limits)).parse();
}
