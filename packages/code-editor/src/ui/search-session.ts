import type { CodeEditorController } from '../controller.js';
import { utf8ByteLengthAtMost } from '../document/limits.js';
import {
  MAXIMUM_DOCUMENT_SEARCH_QUERY_CODE_POINTS,
  searchDocumentText,
  type DocumentSearchMatch,
} from '../document/search.js';
import type { DocumentEditInput, DocumentSelectionInput } from '../document/types.js';
import type { CodeEditorKey } from './input.js';
import { CODE_EDITOR_MAX_PROJECTED_SPANS } from './projection.js';

const LARGE_SEARCH_CHUNK_CODE_UNITS = 262_144;

/** Field that currently receives keyboard input in the find/replace surface. */
export type CodeEditorSearchField = 'query' | 'replacement';

/** Immutable public state for the keyboard-operable find/replace surface. */
export interface CodeEditorSearchState {
  /** Whether the search surface currently owns text input. */
  readonly open: boolean;
  /** Whether replacement controls are available. */
  readonly replace: boolean;
  /** Field that receives printable keys and Backspace. */
  readonly activeField: CodeEditorSearchField;
  /** Bounded literal query. */
  readonly query: string;
  /** Bounded literal replacement text. */
  readonly replacement: string;
  /** Whether matching distinguishes letter case. */
  readonly caseSensitive: boolean;
  /** One-based active result, or zero when no result exists. */
  readonly current: number;
  /** Number of retained non-overlapping matches. */
  readonly total: number;
}

/** Mutation and repaint seams supplied by the editor facade. */
export interface CodeEditorSearchSessionOptions {
  /** Controller that owns document mutation and viewport reveal policy. */
  readonly controller: CodeEditorController;
  /** Applies search edits as one controller-visible atomic transaction. */
  readonly apply: (edits: readonly DocumentEditInput[], selection: DocumentSelectionInput) => boolean;
  /** Completes selection and viewport bookkeeping after navigation. */
  readonly finishSelectionChange: () => void;
  /** Schedules a repaint after search-only state changes. */
  readonly changed: () => void;
}

/**
 * Owns bounded find/replace interaction state without performing host I/O.
 *
 * Search field focus is presentation state, while all text changes are delegated to the
 * controller-owned mutation callback. This keeps replacement subject to the same read-only,
 * revision, history, and size policies as every other editing operation.
 */
export class CodeEditorSearchSession {
  readonly #controller: CodeEditorController;
  readonly #apply: (edits: readonly DocumentEditInput[], selection: DocumentSelectionInput) => boolean;
  readonly #finishSelectionChange: () => void;
  readonly #changed: () => void;
  #open = false;
  #replace = false;
  #activeField: CodeEditorSearchField = 'query';
  #query = '';
  #replacement = '';
  #replacementValid = true;
  #caseSensitive = false;
  #matches: readonly DocumentSearchMatch[] = Object.freeze([]);
  #matchLineage = '';
  #matchRevision = -1;
  #matchQuery = '';
  #matchCaseSensitive = false;
  #currentIndex = 0;
  #currentSelected = false;
  #scanGeneration = 0;
  #scanTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(options: CodeEditorSearchSessionOptions) {
    this.#controller = options.controller;
    this.#apply = options.apply;
    this.#finishSelectionChange = options.finishSelectionChange;
    this.#changed = options.changed;
  }

  /** Returns a detached immutable snapshot suitable for status and accessibility surfaces. */
  public get state(): CodeEditorSearchState {
    const matches = this.#currentMatches();
    return Object.freeze({
      open: this.#open,
      replace: this.#replace,
      activeField: this.#activeField,
      query: this.#query,
      replacement: this.#replacement,
      caseSensitive: this.#caseSensitive,
      current: matches.length === 0 ? 0 : Math.min(this.#currentIndex, matches.length - 1) + 1,
      total: matches.length,
    });
  }

  /** Returns current bounded matches for viewport decoration. */
  public get matches(): readonly DocumentSearchMatch[] {
    return this.#currentMatches();
  }

  /** Opens find or replace input while retaining the previous bounded values. */
  public open(replace: boolean): void {
    this.#open = true;
    this.#replace = replace;
    this.#activeField = 'query';
    this.#currentSelected = false;
    this.#changed();
  }

  /** Dismisses field input while retaining the query for repeat-search commands. */
  public dismiss(): void {
    if (!this.#open) return;
    this.#open = false;
    this.#changed();
  }

  /** Replaces the literal query with a bounded string. */
  public setQuery(query: string): void {
    if (typeof query !== 'string') return;
    this.#query = boundedCodePointPrefix(query, MAXIMUM_DOCUMENT_SEARCH_QUERY_CODE_POINTS);
    this.#invalidateMatches();
    this.#changed();
  }

  /** Replaces the literal replacement value within the configured mutation budget. */
  public setReplacement(replacement: string): void {
    if (typeof replacement !== 'string') return;
    const limit = this.#controller.limits.replacementBytes;
    this.#replacementValid = replacement.length <= limit && utf8ByteLengthAtMost(replacement, limit) <= limit;
    this.#replacement = this.#replacementValid ? replacement : boundedUtf8Prefix(replacement, limit);
    this.#changed();
  }

  /** Enables or disables locale-independent case-sensitive matching. */
  public setCaseSensitive(caseSensitive: boolean): void {
    this.#caseSensitive = caseSensitive;
    this.#invalidateMatches();
    this.#changed();
  }

  /**
   * Routes field-editing keys while the search surface is open.
   *
   * @returns The route owner, or `undefined` when normal editor command routing should continue.
   */
  public routeKey(key: CodeEditorKey): 'dismissal' | 'editor' | undefined {
    if (!this.#open) return undefined;
    if (key.key === 'Escape') {
      this.dismiss();
      return 'dismissal';
    }
    if (key.key === 'Enter') {
      this.navigate(key.shift === true ? -1 : 1);
      return 'editor';
    }
    if (key.key === 'Tab') {
      if (this.#replace) {
        this.#activeField = this.#activeField === 'query' ? 'replacement' : 'query';
        this.#changed();
      }
      return 'editor';
    }
    if (key.key === 'Backspace' && key.ctrl !== true && key.alt !== true) {
      this.#removeLastCharacter();
      return 'editor';
    }
    if (key.ctrl === true || key.alt === true || typeof key.text !== 'string') return undefined;
    this.#appendText(key.text);
    return 'editor';
  }

  /** Selects the next or previous result, wrapping at most once. */
  public navigate(direction: -1 | 1): boolean {
    const matches = this.#currentMatches();
    if (matches.length === 0) return false;
    if (!this.#currentSelected) {
      this.#currentIndex = this.#initialIndex(matches, direction);
    } else {
      this.#currentIndex = (this.#currentIndex + direction + matches.length) % matches.length;
    }
    this.#selectMatch(matches[this.#currentIndex]);
    return true;
  }

  /** Replaces only the exact search match currently selected in the document. */
  public replaceCurrent(): boolean {
    if (!this.#replacementValid || !this.#currentSelected) return false;
    const matches = this.#currentMatches();
    const active = matches[this.#currentIndex];
    if (active === undefined) return false;
    const selection = this.#controller.document.selection;
    const from = Math.min(Number(selection.anchor), Number(selection.head));
    const to = Math.max(Number(selection.anchor), Number(selection.head));
    if (active.from !== from || active.to !== to) return false;
    const replacedIndex = this.#currentIndex;
    const head = from + this.#replacement.length;
    const accepted = this.#apply([{ range: { from, to }, text: this.#replacement }], { anchor: head, head });
    if (!accepted) return false;
    this.#invalidateMatches();
    this.#currentIndex = Math.min(replacedIndex, Math.max(0, this.#currentMatches().length - 1));
    return true;
  }

  /** Revokes active-result ownership after a selection change initiated outside search navigation. */
  public selectionChanged(): void {
    this.#currentSelected = false;
  }

  /** Cancels deferred large-document work and releases its timer. */
  public dispose(): void {
    this.#cancelScan();
    this.#matches = Object.freeze([]);
  }

  /** Replaces every retained non-overlapping result as one bounded atomic transaction. */
  public replaceAll(): boolean {
    if (this.#query.length === 0 || !this.#replacementValid) return false;
    const maximum = this.#controller.limits.editsPerTransaction;
    const matches = this.#controller.document.search(this.#query, {
      caseSensitive: this.#caseSensitive,
      maxResults: Math.min(100_000, maximum + 1),
    });
    if (matches.length === 0 || matches.length > maximum) return false;
    const edits = matches.map((match) => ({
      range: { from: match.from, to: match.to },
      text: this.#replacement,
    }));
    const selection = this.#controller.document.selection;
    const accepted = this.#apply(edits, {
      anchor: Number(selection.anchor),
      head: Number(selection.head),
    });
    if (!accepted) return false;
    this.#invalidateMatches();
    return true;
  }

  #appendText(text: string): void {
    if (this.#activeField === 'query') this.setQuery(this.#query + text);
    else this.setReplacement(this.#replacement + text);
  }

  #removeLastCharacter(): void {
    const value = this.#activeField === 'query' ? this.#query : this.#replacement;
    const shortened = withoutLastCodePoint(value);
    if (this.#activeField === 'query') this.setQuery(shortened);
    else this.setReplacement(shortened);
  }

  #currentMatches(): readonly DocumentSearchMatch[] {
    const identity = this.#controller.document.identity;
    if (
      this.#matchLineage === identity.lineage &&
      this.#matchRevision === Number(identity.revision) &&
      this.#matchQuery === this.#query &&
      this.#matchCaseSensitive === this.#caseSensitive
    ) {
      return this.#matches;
    }
    this.#matchLineage = identity.lineage;
    this.#matchRevision = Number(identity.revision);
    this.#matchQuery = this.#query;
    this.#matchCaseSensitive = this.#caseSensitive;
    const maximumResults = Math.min(CODE_EDITOR_MAX_PROJECTED_SPANS, this.#controller.limits.decorations);
    if (this.#query.length === 0) {
      this.#matches = Object.freeze([]);
    } else if (this.#controller.document.sizeMode !== 'full') {
      this.#matches = Object.freeze([]);
      this.#startLargeDocumentScan(maximumResults);
    } else {
      this.#matches = this.#controller.document.search(this.#query, {
        caseSensitive: this.#caseSensitive,
        maxResults: maximumResults,
      });
    }
    this.#currentIndex = Math.min(this.#currentIndex, Math.max(0, this.#matches.length - 1));
    return this.#matches;
  }

  #invalidateMatches(): void {
    this.#cancelScan();
    this.#matchRevision = -1;
    this.#currentIndex = 0;
    this.#currentSelected = false;
  }

  /**
   * Scans a large immutable snapshot in bounded turns and discards stale work by generation.
   *
   * Each segment overlaps the previous segment by the bounded query width. Matches ending inside
   * the already-processed prefix are filtered, preserving non-overlapping whole-document offsets
   * without monopolizing the terminal event loop.
   */
  #startLargeDocumentScan(maximumResults: number): void {
    this.#cancelScan();
    const generation = this.#scanGeneration;
    const identity = this.#controller.document.identity;
    const snapshot = this.#controller.document.snapshot;
    const query = this.#query;
    const caseSensitive = this.#caseSensitive;
    let offset = 0;
    const matches: DocumentSearchMatch[] = [];
    const step = (): void => {
      this.#scanTimer = undefined;
      const current = this.#controller.document.identity;
      if (
        generation !== this.#scanGeneration ||
        current.lineage !== identity.lineage ||
        current.revision !== identity.revision
      ) {
        return;
      }
      let end = Math.min(snapshot.length, offset + LARGE_SEARCH_CHUNK_CODE_UNITS);
      if (
        end < snapshot.length &&
        end > 0 &&
        snapshot.slice(end - 1, end).charCodeAt(0) >= 0xd800 &&
        snapshot.slice(end - 1, end).charCodeAt(0) <= 0xdbff
      ) {
        end -= 1;
      }
      const overlap = Math.min(offset, Math.max(1, query.length * 2));
      const from = offset - overlap;
      const segment = snapshot.slice(from, end);
      const local = searchDocumentText(segment, query, {
        caseSensitive,
        maxResults: maximumResults,
      });
      for (const match of local) {
        const absolute = Object.freeze({ from: from + match.from, to: from + match.to });
        const previous = matches.at(-1);
        if (
          absolute.to <= offset ||
          (previous !== undefined && absolute.from < previous.to) ||
          matches.length >= maximumResults
        ) {
          continue;
        }
        matches.push(absolute);
      }
      this.#matches = Object.freeze([...matches]);
      this.#currentIndex = Math.min(this.#currentIndex, Math.max(0, this.#matches.length - 1));
      this.#changed();
      offset = end;
      if (offset < snapshot.length && matches.length < maximumResults) {
        this.#scanTimer = setTimeout(step, 0);
      }
    };
    this.#scanTimer = setTimeout(step, 0);
  }

  /** Cancels one deferred scan and invalidates callbacks already queued by the runtime. */
  #cancelScan(): void {
    this.#scanGeneration += 1;
    if (this.#scanTimer !== undefined) clearTimeout(this.#scanTimer);
    this.#scanTimer = undefined;
  }

  #initialIndex(matches: readonly DocumentSearchMatch[], direction: -1 | 1): number {
    const selection = this.#controller.document.selection;
    const start = Math.min(Number(selection.anchor), Number(selection.head));
    const head = Math.max(Number(selection.anchor), Number(selection.head));
    if (direction === 1) {
      const candidate = matches.findIndex((match) => match.from >= head);
      return candidate >= 0 ? candidate : 0;
    }
    for (let index = matches.length - 1; index >= 0; index -= 1) {
      if ((matches[index]?.to ?? 0) <= start) return index;
    }
    return matches.length - 1;
  }

  #selectMatch(match: DocumentSearchMatch | undefined): void {
    if (match === undefined) return;
    this.#controller.unfoldAll();
    this.#controller.revealOffset(match.from);
    this.#controller.revealOffset(match.to);
    this.#controller.document.setSelection({ anchor: match.from, head: match.to });
    this.#currentSelected = true;
    this.#finishSelectionChange();
  }
}

/** Returns a prefix without splitting a UTF-16 surrogate pair. */
function boundedCodePointPrefix(value: string, maximumCodePoints: number): string {
  let codePoints = 0;
  let end = 0;
  while (end < value.length && codePoints < maximumCodePoints) {
    const first = value.charCodeAt(end);
    const width =
      first >= 0xd800 &&
      first <= 0xdbff &&
      end + 1 < value.length &&
      value.charCodeAt(end + 1) >= 0xdc00 &&
      value.charCodeAt(end + 1) <= 0xdfff
        ? 2
        : 1;
    end += width;
    codePoints += 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

/** Retains the largest complete-code-point prefix within a UTF-8 byte budget. */
function boundedUtf8Prefix(value: string, maximumBytes: number): string {
  let bytes = 0;
  let end = 0;
  for (const character of value) {
    const characterBytes = utf8ByteLengthAtMost(character, 4);
    if (bytes + characterBytes > maximumBytes) break;
    bytes += characterBytes;
    end += character.length;
  }
  return value.slice(0, end);
}

/** Removes one final Unicode code point without copying the complete string into an array. */
function withoutLastCodePoint(value: string): string {
  if (value.length === 0) return value;
  const last = value.charCodeAt(value.length - 1);
  if (
    last >= 0xdc00 &&
    last <= 0xdfff &&
    value.length > 1 &&
    value.charCodeAt(value.length - 2) >= 0xd800 &&
    value.charCodeAt(value.length - 2) <= 0xdbff
  ) {
    return value.slice(0, -2);
  }
  return value.slice(0, -1);
}
