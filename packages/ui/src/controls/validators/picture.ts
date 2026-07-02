/**
 * `picture(mask)` — the Paradox picture-mask validator, a faithful port of Turbo Vision
 * `TPXPictureValidator` (`tvalidat.cpp`, `validate.h`), RD-07 (DEF-02). Implements the {@link Validator}
 * shape (+ the RD-07 additive `fill` for autoFill delivery, PA-17). The `.js` extension in import
 * specifiers is required by NodeNext ESM resolution.
 *
 * ## GATE-1 decode (`tvalidat.cpp`, code-point unit PA-1)
 * - **Result codes** (`validate.h:74-75`): complete / incomplete / empty / error / syntax / ambiguous
 *   (→ complete, `:594`) / incompNoFill (→ incomplete, `:596`).
 * - **Specials** (`scan`, `:371-463`): `#` digit · `?` letter · `&` letter→UPPER · `!` any→UPPER ·
 *   `@` any · `*N`/`*` iteration (`:264-319`) · `{ }` required group · `[ ]` optional group (`:322-336`)
 *   · `,` alternation (`process`/`skipToComma`, `:244,465-517`) · `;x` literal escape · else literal
 *   (case-insensitive; a typed space becomes the mask literal, `:438-451`).
 * - **Machine**: `picture` (`:552-599`) → `process` (alternation/backtrack, `:465-517`) → `scan`
 *   (linear match, `:371-463`) → `group`/`iteration`/`checkComplete` (`:322-368`). `consume` transforms
 *   the input in place (`:210-215`); autoFill appends **trailing non-special literals** then reprocesses
 *   (`:572-585`) — default ON (PA-3), delivered via {@link Validator.fill} (PA-17).
 * - **`isValidInput`** = `picture(s, fill) != error` (transient); **`isValid`** = `picture(s, false) ==
 *   complete` (blocking; never autoFills) (`:149-162`).
 * - **`syntaxCheck`** (`:519-550`): reject empty / trailing `;` / unbalanced `[]`/`{}`. **PA-2 bounds:**
 *   we additionally reject `*N` with `N > MAX_REPEAT` (allowlist), enforce a global step budget, and
 *   break an unbounded `*` that consumes nothing — no hostile mask can hang/overflow (AC-15).
 */
import type { Validator } from './types.js';

/** The picture result codes (TV `TPicResult`, `validate.h:74-75`). */
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

/** Special mask characters (autoFill stops at any of these — `tvalidat.cpp:576`). */
const SPECIALS = '#?&!@*{}[],';
/** Hard cap on an explicit `*N` repeat count (PA-2). A mask over this fails `syntaxCheck`. */
const MAX_REPEAT = 1024;

/** ASCII digit test (TV `isNumber`). */
function isNumber(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
/** ASCII letter test (TV `isLetter` — case-folded A–Z). */
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
 * Validate a mask's syntax + enforce the PA-2 repeat bound (TV `syntaxCheck`, `:519-550`). Rejects an
 * empty mask, a mask ending in `;`, unbalanced `[]`/`{}`, and any `*N` with `N > MAX_REPEAT`.
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
 * The picture matcher — one instance per validation call. Holds the mask, a mutable input buffer (a
 * char array, so `consume` can transform in place and autoFill can append), the mask/input cursors
 * (`index`/`jndex`), and a step budget (PA-2). Faithful to the `TPXPictureValidator` members.
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
    this.maxSteps = 64 * (pic.length + this.input.length) + 4096; // PA-2 global budget
  }

  /** The (transformed + filled) input after a run — TV's mutated `data` buffer. */
  result(): string {
    return this.input.join('');
  }

  /** Whether the step budget is exhausted (PA-2). */
  private overBudget(): boolean {
    this.steps += 1;
    return this.steps > this.maxSteps;
  }

  /** Store a char at the cursor, advancing both cursors (TV `consume`, `:210-215`). */
  private consume(ch: string): void {
    this.input[this.jndex] = ch;
    this.index += 1;
    this.jndex += 1;
  }

  /** Skip one char or a bracketed group, returning the advanced mask index (TV `toGroupEnd`, `:222-241`). */
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

  /** Advance `index` to the next alternation comma or the group end (TV `skipToComma`, `:243-254`). */
  private skipToComma(termCh: number): boolean {
    do {
      this.index = this.toGroupEnd(this.index, termCh);
      if (this.overBudget()) break;
    } while (!(this.index === termCh || this.pic[this.index] === ','));
    if (this.pic[this.index] === ',') this.index += 1;
    return this.index < termCh;
  }

  /** The mask index at the end of the current group (TV `calcTerm`, `:257-261`). */
  private calcTerm(termCh: number): number {
    return this.toGroupEnd(this.index, termCh);
  }

  /** A `*`/`*N` iteration group (TV `iteration`, `:264-319`). */
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
        if (rslt === Pr.complete && this.jndex === beforeJ) break; // no progress → stop (PA-2 spin guard)
      } while (rslt === Pr.complete);
      if (rslt === Pr.empty || rslt === Pr.error) {
        this.index += 1;
        rslt = Pr.ambiguous;
      }
    }
    this.index = termCh;
    return rslt;
  }

  /** A `{ }` / `[ ]` group (TV `group`, `:322-336`). */
  private group(inTerm: number): PicResult {
    const termCh = this.calcTerm(inTerm);
    this.index += 1;
    const rslt = this.process(termCh - 1);
    if (!isIncomplete(rslt)) this.index = termCh;
    return rslt;
  }

  /** Resolve an incomplete result to ambiguous if only optional pieces remain (TV `checkComplete`, `:339-368`). */
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

  /** Linear match of the mask against the input from the current cursors (TV `scan`, `:370-463`). */
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
          // Case-insensitive literal match; a typed space is replaced by the literal (:445-449).
          if (lit.toUpperCase() !== ch.toUpperCase() && ch !== ' ') return Pr.error;
          this.consume(lit);
        }
      }
      rslt = rslt === Pr.ambiguous ? Pr.incompNoFill : Pr.incomplete;
    }
    return rslt === Pr.incompNoFill ? Pr.ambiguous : Pr.complete;
  }

  /** Try each alternation branch with backtracking (TV `process`, `:465-517`). */
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
      // Only accept a complete that made it as far as the last incomplete (:481-486).
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

  /** Run the full machine (TV `picture`, `:552-599`); with `autoFill`, append trailing literals + reprocess. */
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
 * Create a Paradox picture-mask validator (TV `TPXPictureValidator`). autoFill defaults ON (PA-3),
 * delivered via {@link Validator.fill} (PA-17). A mask that fails `syntaxCheck` (empty, trailing `;`,
 * unbalanced brackets, or `*N > MAX_REPEAT`) makes both gates reject and populates `error` (allowlist,
 * PA-2) — it never throws, never hangs.
 *
 * @param mask     The picture mask (e.g. `"(###)###-####"`).
 * @param autoFill Auto-insert trailing literals + case transforms (default `true`).
 * @returns A {@link Validator} with `isValidInput` / `isValid` / `fill` / `error`.
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
