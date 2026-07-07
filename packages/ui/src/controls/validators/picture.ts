/**
 * A formatted-mask validator: constrain input to a template such as a phone number, date, or
 * product code, and optionally auto-fill the fixed punctuation as the user types.
 *
 * ## Mask syntax
 * - `#` — a digit
 * - `?` — a letter
 * - `&` — a letter, forced to UPPER case
 * - `!` — any character, forced to UPPER case
 * - `@` — any character
 * - `*N` / `*` — repeat the following element N times (or any number of times)
 * - `{ }` — a required group · `[ ]` — an optional group
 * - `,` — alternation between whole templates ("this OR that")
 * - `;x` — treat the next character `x` as a literal, even if it is a special
 * - any other character — a literal (matched case-insensitively; typing a space fills in the literal)
 *
 * `isValidInput` accepts a partially-typed value; `isValid` requires a value that completely fills
 * the mask. With auto-fill on (the default), trailing literals are inserted for you — e.g. after
 * typing `123` into `###-##` the field becomes `123-`.
 *
 * Malicious or malformed masks are rejected safely: a mask that is empty, ends in `;`, has unbalanced
 * brackets, or asks for an unreasonable repeat count fails validation instead of throwing or hanging.
 */
import type { Validator } from './types.js';

/** The internal outcome codes for running the mask machine over one input. */
const Pr = {
  complete: 'complete',
  incomplete: 'incomplete',
  empty: 'empty',
  error: 'error',
  syntax: 'syntax',
  ambiguous: 'ambiguous',
  incompNoFill: 'incompNoFill',
} as const;
type PicResult = (typeof Pr)[keyof typeof Pr];

/** Special mask characters; auto-fill stops as soon as it reaches any of these. */
const SPECIALS = '#?&!@*{}[],';
/** Hard cap on an explicit `*N` repeat count — a mask asking for more than this fails as unsafe. */
const MAX_REPEAT = 1024;

/** ASCII digit test. */
function isNumber(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
/** ASCII letter test (case-folded A–Z). */
function isLetter(ch: string): boolean {
  const up = ch.toUpperCase();
  return up >= 'A' && up <= 'Z' && up.length === 1;
}
function isComplete(r: PicResult): boolean {
  return r === Pr.complete || r === Pr.ambiguous;
}
function isIncomplete(r: PicResult): boolean {
  return r === Pr.incomplete || r === Pr.incompNoFill;
}

/**
 * The result of running the picture machine over one input: the outcome code + the (possibly
 * transformed/filled) input string.
 */
interface Syntax {
  readonly ok: boolean;
  readonly error?: string;
}

/**
 * Check that a mask is well-formed and safe to run. Rejects an empty mask, a mask ending in `;`,
 * unbalanced `[]`/`{}`, and any `*N` whose count exceeds {@link MAX_REPEAT}.
 *
 * @param mask The picture mask.
 * @returns `{ ok, error? }`.
 */
function syntaxCheck(mask: string): Syntax {
  if (mask.length === 0) return { ok: false, error: 'picture mask is empty' };
  if (mask[mask.length - 1] === ';') return { ok: false, error: 'picture mask ends with ";"' };
  let brk = 0;
  let brc = 0;
  for (let i = 0; i < mask.length; i += 1) {
    switch (mask[i]) {
      case '[':
        brk += 1;
        break;
      case ']':
        brk -= 1;
        break;
      case '{':
        brc += 1;
        break;
      case '}':
        brc -= 1;
        break;
      case ';':
        i += 1; // the next char is an escaped literal — skip it
        break;
      case '*': {
        let n = 0;
        for (let j = i + 1; j < mask.length && isNumber(mask[j]); j += 1) {
          n = n * 10 + (mask.charCodeAt(j) - 48);
          if (n > MAX_REPEAT) return { ok: false, error: `picture "*N" repeat ${n} exceeds MAX_REPEAT ${MAX_REPEAT}` };
        }
        break;
      }
    }
  }
  if (brk !== 0 || brc !== 0) return { ok: false, error: 'picture mask has unbalanced [] or {}' };
  return { ok: true };
}

/**
 * The mask matcher — one instance per validation call. Holds the mask, a mutable input buffer (a
 * char array, so a matched character can be transformed in place and auto-fill can append), the
 * mask/input cursors (`index`/`jndex`), and a step budget that guarantees termination on any mask.
 */
class PictureMachine {
  private index = 0;
  private jndex = 0;
  private steps = 0;
  private readonly maxSteps: number;
  private readonly input: string[];

  /**
   * @param pic      The (syntax-checked) mask.
   * @param inputStr The input to validate (copied into a mutable char buffer).
   */
  constructor(
    private readonly pic: string,
    inputStr: string,
  ) {
    this.input = [...inputStr];
    // Bound total work so no mask — however adversarial — can spin forever.
    this.maxSteps = 64 * (pic.length + this.input.length) + 4096;
  }

  /** The input after a run, with matched-character transforms and any auto-fill applied. */
  result(): string {
    return this.input.join('');
  }

  /** Whether the step budget is exhausted. */
  private overBudget(): boolean {
    this.steps += 1;
    return this.steps > this.maxSteps;
  }

  /** Store a matched character at the cursor, advancing both the mask and input cursors. */
  private consume(ch: string): void {
    this.input[this.jndex] = ch;
    this.index += 1;
    this.jndex += 1;
  }

  /** Skip one char or a whole bracketed group, returning the advanced mask index. */
  private toGroupEnd(start: number, termCh: number): number {
    let i = start;
    let brk = 0;
    let brc = 0;
    do {
      if (i === termCh) return i;
      switch (this.pic[i]) {
        case '[':
          brk += 1;
          break;
        case ']':
          brk -= 1;
          break;
        case '{':
          brc += 1;
          break;
        case '}':
          brc -= 1;
          break;
        case ';':
          i += 1;
          break;
      }
      i += 1;
      if (this.overBudget()) return termCh;
    } while (!(brk === 0 && brc === 0));
    return i;
  }

  /** Advance `index` to the next alternation comma or the group end. */
  private skipToComma(termCh: number): boolean {
    do {
      this.index = this.toGroupEnd(this.index, termCh);
      if (this.overBudget()) break;
    } while (!(this.index === termCh || this.pic[this.index] === ','));
    if (this.pic[this.index] === ',') this.index += 1;
    return this.index < termCh;
  }

  /** The mask index at the end of the current group. */
  private calcTerm(termCh: number): number {
    return this.toGroupEnd(this.index, termCh);
  }

  /** Match a `*` / `*N` iteration group (a repeated element). */
  private iteration(inTerm: number): PicResult {
    let itr = 0;
    let rslt: PicResult = Pr.error;
    this.index += 1; // skip '*'
    while (isNumber(this.pic[this.index] ?? '')) {
      itr = itr * 10 + (this.pic.charCodeAt(this.index) - 48);
      this.index += 1;
      if (this.overBudget()) return Pr.error;
    }
    const k = this.index;
    const termCh = this.calcTerm(inTerm);
    if (itr !== 0) {
      for (let l = 1; l <= itr; l += 1) {
        if (this.overBudget()) return Pr.error;
        this.index = k;
        rslt = this.process(termCh);
        if (!isComplete(rslt)) {
          if (rslt === Pr.empty) rslt = Pr.incomplete; // all required → empty means incomplete
          return rslt;
        }
      }
    } else {
      do {
        if (this.overBudget()) return Pr.error;
        this.index = k;
        const beforeJ = this.jndex;
        rslt = this.process(termCh);
        if (rslt === Pr.complete && this.jndex === beforeJ) break; // consumed nothing this pass → stop, or we'd spin
      } while (rslt === Pr.complete);
      if (rslt === Pr.empty || rslt === Pr.error) {
        this.index += 1;
        rslt = Pr.ambiguous;
      }
    }
    this.index = termCh;
    return rslt;
  }

  /** Match a `{ }` (required) or `[ ]` (optional) group. */
  private group(inTerm: number): PicResult {
    const termCh = this.calcTerm(inTerm);
    this.index += 1;
    const rslt = this.process(termCh - 1);
    if (!isIncomplete(rslt)) this.index = termCh;
    return rslt;
  }

  /** Resolve an incomplete result to "ambiguous" when only optional pieces of the mask remain. */
  private checkComplete(rslt: PicResult, termCh: number): PicResult {
    if (!isIncomplete(rslt)) return rslt;
    let j = this.index;
    let scanning = true;
    while (scanning) {
      switch (this.pic[j]) {
        case '[':
          j = this.toGroupEnd(j, termCh);
          break;
        case '*':
          if (!isNumber(this.pic[j + 1] ?? '')) j += 1;
          j = this.toGroupEnd(j, termCh);
          break;
        default:
          scanning = false;
      }
      if (this.overBudget()) return rslt;
    }
    return j === termCh ? Pr.ambiguous : rslt;
  }

  /** Match the mask against the input linearly from the current cursors. */
  private scan(termCh: number): PicResult {
    let rslt: PicResult = Pr.empty;
    while (this.index !== termCh && this.pic[this.index] !== ',') {
      if (this.overBudget()) return Pr.error;
      if (this.jndex >= this.input.length) return this.checkComplete(rslt, termCh);
      const ch = this.input[this.jndex];
      switch (this.pic[this.index]) {
        case '#':
          if (!isNumber(ch)) return Pr.error;
          this.consume(ch);
          break;
        case '?':
          if (!isLetter(ch)) return Pr.error;
          this.consume(ch);
          break;
        case '&':
          if (!isLetter(ch)) return Pr.error;
          this.consume(ch.toUpperCase());
          break;
        case '!':
          this.consume(ch.toUpperCase());
          break;
        case '@':
          this.consume(ch);
          break;
        case '*':
          rslt = this.iteration(termCh);
          if (!isComplete(rslt)) return rslt;
          break;
        case '{':
          rslt = this.group(termCh);
          if (!isComplete(rslt)) return rslt;
          break;
        case '[':
          rslt = this.group(termCh);
          if (isIncomplete(rslt)) return rslt;
          if (rslt === Pr.error) rslt = Pr.ambiguous;
          break;
        default: {
          if (this.pic[this.index] === ';') this.index += 1; // escaped literal
          const lit = this.pic[this.index];
          // Case-insensitive literal match; typing a space here fills in the mask's literal instead.
          if (lit.toUpperCase() !== ch.toUpperCase() && ch !== ' ') return Pr.error;
          this.consume(lit);
        }
      }
      rslt = rslt === Pr.ambiguous ? Pr.incompNoFill : Pr.incomplete;
    }
    return rslt === Pr.incompNoFill ? Pr.ambiguous : Pr.complete;
  }

  /** Try each alternation branch (the `,`-separated templates) with backtracking. */
  private process(termCh: number): PicResult {
    let rslt: PicResult;
    let rProcess: PicResult = Pr.error;
    let incomp = false;
    let oldI = this.index;
    const oldJ = this.jndex;
    let incompI = 0;
    let incompJ = 0;
    do {
      if (this.overBudget()) return Pr.error;
      rslt = this.scan(termCh);
      // Only accept a "complete" branch if it consumed at least as much input as the furthest
      // incomplete branch seen so far — otherwise a shorter branch could win over a better match.
      if (rslt === Pr.complete && incomp && this.jndex < incompJ) {
        rslt = Pr.incomplete;
        this.jndex = incompJ;
      }
      if (rslt === Pr.error || rslt === Pr.incomplete) {
        rProcess = rslt;
        if (!incomp && rslt === Pr.incomplete) {
          incomp = true;
          incompI = this.index;
          incompJ = this.jndex;
        }
        this.index = oldI;
        this.jndex = oldJ;
        if (!this.skipToComma(termCh)) {
          if (incomp) {
            rProcess = Pr.incomplete;
            this.index = incompI;
            this.jndex = incompJ;
          }
          return rProcess;
        }
        oldI = this.index;
      }
    } while (rslt === Pr.error || rslt === Pr.incomplete);
    if (rslt === Pr.complete && incomp) return Pr.ambiguous;
    return rslt;
  }

  /** Run the full match; with `autoFill`, append the mask's trailing literals and re-run once. */
  run(autoFill: boolean): PicResult {
    if (this.input.length === 0) return Pr.empty;
    this.jndex = 0;
    this.index = 0;
    let rslt = this.process(this.pic.length);
    if (rslt !== Pr.error && this.jndex < this.input.length) rslt = Pr.error; // leftover input
    if (rslt === Pr.incomplete && autoFill) {
      let reprocess = false;
      while (this.index < this.pic.length && !SPECIALS.includes(this.pic[this.index])) {
        if (this.overBudget()) break;
        if (this.pic[this.index] === ';') this.index += 1;
        this.input.push(this.pic[this.index]);
        this.index += 1;
        reprocess = true;
      }
      this.jndex = 0;
      this.index = 0;
      if (reprocess) rslt = this.process(this.pic.length);
    }
    if (rslt === Pr.ambiguous) return Pr.complete;
    if (rslt === Pr.incompNoFill) return Pr.incomplete;
    return rslt;
  }
}

/**
 * Create a formatted-mask validator. Auto-fill is on by default, so fixed literals (dashes,
 * parentheses) are inserted as the user types. A malformed mask (empty, ending in `;`, unbalanced
 * brackets, or an unreasonable `*N` repeat) makes both gates reject and sets `error` — it never
 * throws and never hangs.
 *
 * @param mask     The mask template — see the mask-syntax list above (e.g. `'(###) ###-####'`).
 * @param autoFill Whether to auto-insert trailing literals and apply case transforms. Default `true`.
 * @returns A {@link Validator} you can pass to an {@link Input}.
 * @example
 * import { signal } from '@jsvision/ui';
 * import { Input, picture } from '@jsvision/ui';
 *
 * const phone = signal('');
 * // Typing "5551234567" fills the punctuation automatically → "(555) 123-4567".
 * const input = new Input({ value: phone, validator: picture('(###) ###-####') });
 */
export function picture(mask: string, autoFill = true): Validator {
  const syntax = syntaxCheck(mask);
  const run = (s: string, fill: boolean): { code: PicResult; result: string } => {
    const machine = new PictureMachine(mask, s);
    return { code: machine.run(fill), result: machine.result() };
  };
  return {
    isValidInput(s: string): boolean {
      return syntax.ok && run(s, autoFill).code !== Pr.error;
    },
    isValid(s: string): boolean {
      return syntax.ok && run(s, false).code === Pr.complete;
    },
    fill(s: string): string {
      if (!syntax.ok) return s;
      const r = run(s, autoFill);
      return r.code === Pr.error ? s : r.result; // don't transform an invalid input
    },
    error: syntax.ok ? undefined : syntax.error,
  };
}
