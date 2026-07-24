import type { CapabilityProfile } from '@jsvision/core';
import { Group, signal, type DispatchEvent, type DrawContext, type Point, type Signal } from '@jsvision/ui';
import type { CodeEditorController } from '../controller.js';
import { offsetToPosition } from '../document/positions.js';
import type { DocumentEditInput, DocumentSelectionInput } from '../document/types.js';
import { classicCodeEditorTheme } from '../theme/presets.js';
import { snapshotCodeEditorTheme } from '../theme/resolve.js';
import type { CodeEditorTheme, ResolvedCodeEditorTheme } from '../theme/theme.js';
import { CodeEditorAssistanceView, type CodeEditorCompletionItem, type CodeEditorModalState } from './assistance.js';
import {
  canonicalCodeEditorKeyName,
  codeEditorKeyToken,
  defaultCodeEditorKeyBindings,
  type CodeEditorCommand,
  type CodeEditorKey,
} from './input.js';
import { projectCodeEditor, type CodeEditorFrame } from './projection.js';

/** Construction options for a terminal-native code editor view. */
export interface CodeEditorOptions {
  readonly controller: CodeEditorController;
  readonly keyBindings?: Readonly<Record<string, CodeEditorCommand>>;
  /** Shows the fixed line-number gutter when the viewport is wide enough. Defaults to `false`. */
  readonly lineNumbers?: boolean;
  /** Runs after an accepted text mutation so hosts can schedule revision-aware language work. */
  readonly onDocumentChange?: () => void;
}

/** Result of deterministic keyboard routing. */
export interface CodeEditorKeyRoute {
  readonly handled: boolean;
  readonly owner: 'dismissal' | 'completion' | 'snippet' | 'editor' | 'text' | 'unhandled';
}

/**
 * Focusable terminal-native source editor backed by a document controller.
 *
 * @example
 * ```ts
 * const editor = new CodeEditor({ controller });
 * ```
 */
export class CodeEditor extends Group {
  public override focusable = true;
  public readonly controller: CodeEditorController;
  /** Whether this editor projects the optional line-number gutter. */
  public readonly lineNumbers: boolean;
  public readonly behavior = Object.freeze({ documentTransactions: true, keyboardOnly: true });
  public readonly nonColorIndicators = Object.freeze([
    'selection',
    'activeLine',
    'folding',
    'diagnosticSeverity',
    'pending',
    'readOnly',
    'degradation',
  ]);
  public readonly chrome = Object.freeze({ horizontalScrollBar: false, verticalScrollBar: false, statusLine: false });
  public readonly journey: string[] = [];
  public readonly assistanceView: CodeEditorAssistanceView;
  public readonly scroll: { readonly x: Signal<number>; readonly y: Signal<number> };
  public focusState: 'idle' | 'focused' | 'released' = 'idle';
  readonly #bindings: Readonly<Record<string, CodeEditorCommand>>;
  readonly #onDocumentChange: (() => void) | undefined;
  readonly #pending = new Map<'navigate' | 'save' | 'close', Promise<unknown>>();
  #theme: CodeEditorTheme = classicCodeEditorTheme;
  #themeFingerprint = fingerprint(classicCodeEditorTheme);
  #lastFrame: CodeEditorFrame | undefined;
  #modal: CodeEditorModalState | undefined;
  #completion: readonly CodeEditorCompletionItem[] | undefined;
  #snippet: readonly { readonly from: number; readonly to: number }[] | undefined;
  #snippetIndex = 0;
  #searchQuery = '';
  #disposed = false;

  public constructor(options: CodeEditorOptions) {
    super();
    this.controller = options.controller;
    this.lineNumbers = options.lineNumbers === true;
    this.assistanceView = new CodeEditorAssistanceView({
      maxItems: this.controller.limits.completionItems,
      maxWidth: this.controller.limits.popupWidth,
      maxHeight: this.controller.limits.popupHeight,
    });
    this.scroll = { x: signal(0), y: signal(0) };
    this.#bindings = Object.freeze({ ...defaultCodeEditorKeyBindings, ...options.keyBindings });
    this.#onDocumentChange = options.onDocumentChange;
    this.add(this.assistanceView);
  }

  /** Gives the editor logical focus for standalone and test-driven operation. */
  public focus(): boolean {
    this.focusState = 'focused';
    this.#record('focus');
    return true;
  }

  /** Executes one stable public editor command. */
  public execute(command: CodeEditorCommand): void {
    if (command === 'cursor.documentEnd') {
      const end = this.controller.document.text.length;
      this.controller.document.setSelection({ anchor: end, head: end });
      return;
    }
    if (command === 'search.open') {
      this.#modal = { kind: 'search' };
      this.#record('search.open');
      return;
    }
    if (command === 'search.next') {
      this.#searchNext();
      this.#record('search.next');
      return;
    }
    if (command === 'fold.toggle') this.controller.toggleFold();
    if (command === 'assist') this.controller.requestAssistance();
    if (command === 'format') this.controller.requestFormatting();
    this.#record(command);
    if (command === 'navigate' || command === 'save' || command === 'close') this.#queueHost(command);
  }

  /** Inserts text through one validated document transaction. */
  public insertText(text: string): boolean {
    const accepted = this.controller.replaceSelection(text);
    this.#finishMutation(accepted);
    return accepted;
  }

  /** Opens a validated completion list without changing the document selection. */
  public openCompletion(items: readonly CodeEditorCompletionItem[]): void {
    const normalized: CodeEditorCompletionItem[] = [];
    try {
      if (!Array.isArray(items) || items.length > 100_000) return;
      for (let index = 0; index < Math.min(items.length, this.controller.limits.completionItems); index += 1) {
        const item = ownData(items, String(index));
        const label = ownString(item, 'label', 256);
        const insertText = ownString(item, 'insertText', 65_536);
        const from = ownInteger(item, 'from');
        const to = ownInteger(item, 'to');
        if (label === undefined || (from === undefined) !== (to === undefined)) continue;
        if (
          from !== undefined &&
          (from < 0 || to === undefined || to < from || to > this.controller.document.text.length)
        )
          continue;
        normalized.push(
          Object.freeze({
            label,
            ...(insertText === undefined ? {} : { insertText }),
            ...(from === undefined ? {} : { from, to }),
          }),
        );
      }
    } catch {
      return;
    }
    this.#completion = Object.freeze(normalized);
    this.assistanceView.show(normalized.map((item) => item.label));
  }

  /** Opens one modal surface; Escape always dismisses it first. */
  public openModal(modal: CodeEditorModalState): void {
    const kind = ownData(modal, 'kind');
    if (kind === 'search' || kind === 'chooser' || kind === 'completion') this.#modal = Object.freeze({ kind });
  }

  /** Starts validated, bounded snippet placeholder traversal. */
  public startSnippet(placeholders: readonly { readonly from: number; readonly to: number }[]): void {
    const normalized: { from: number; to: number }[] = [];
    try {
      if (!Array.isArray(placeholders) || placeholders.length > 100_000) return;
      for (let index = 0; index < Math.min(placeholders.length, this.controller.limits.decorations); index += 1) {
        const item = ownData(placeholders, String(index));
        const from = ownInteger(item, 'from');
        const to = ownInteger(item, 'to');
        if (
          from !== undefined &&
          to !== undefined &&
          from >= 0 &&
          to >= from &&
          to <= this.controller.document.text.length
        )
          normalized.push(Object.freeze({ from, to }));
      }
    } catch {
      return;
    }
    this.#snippet = Object.freeze(normalized);
    this.#snippetIndex = 0;
  }

  /** Updates the keyboard-driven search query without changing source text. */
  public setSearchQuery(query: string): void {
    this.#searchQuery = query.slice(0, 4_096);
  }

  /** Routes one key according to assistance/editor/text precedence. */
  public routeKey(key: CodeEditorKey): CodeEditorKeyRoute {
    const canonicalKey = canonicalCodeEditorKeyName(key.key);
    const normalizedKey = canonicalKey === key.key ? key : { ...key, key: canonicalKey };
    if (canonicalKey === 'Escape' && this.#modal !== undefined) {
      this.#modal = undefined;
      return route('dismissal');
    }
    if (canonicalKey === 'Escape' && this.#completion !== undefined) {
      this.#completion = undefined;
      this.assistanceView.dismiss();
      return route('dismissal');
    }
    if (canonicalKey === 'Enter' && this.#completion !== undefined) {
      const item = this.#completion[0];
      this.#completion = undefined;
      this.assistanceView.dismiss();
      if (item !== undefined) this.#acceptCompletion(item);
      return route('completion');
    }
    if (canonicalKey === 'Enter' && this.#modal?.kind === 'search') {
      this.execute('search.next');
      return route('editor');
    }
    if (canonicalKey === 'Tab' && this.#snippet !== undefined) {
      this.#snippetIndex += 1;
      const target = this.#snippet[this.#snippetIndex];
      if (target === undefined) this.#snippet = undefined;
      else this.controller.document.setSelection({ anchor: target.from, head: target.to });
      return route('snippet');
    }
    const modifiedOwner = this.#routeModifiedKey(normalizedKey);
    if (modifiedOwner !== undefined) return route(modifiedOwner);
    const command = this.#bindings[codeEditorKeyToken(normalizedKey)];
    if (command !== undefined) {
      this.execute(command);
      return route('editor');
    }
    if (!key.ctrl && !key.alt && this.#routeEditingKey(canonicalKey, key.shift === true)) return route('text');
    if (key.text !== undefined && !key.ctrl && !key.alt) {
      this.insertText(key.text);
      return route('text');
    }
    return Object.freeze({ handled: false, owner: 'unhandled' });
  }

  /** Snapshots a preset or resolver result for presentation-only changes. */
  public setTheme(theme: CodeEditorTheme | ResolvedCodeEditorTheme): void {
    const candidate = ownData(theme, 'theme') ?? theme;
    const snapshot = snapshotCodeEditorTheme(candidate);
    if (snapshot === undefined) return;
    this.#theme = snapshot;
    this.#themeFingerprint = fingerprint(this.#theme);
    this.invalidate();
  }

  /** Projects the current state for a concrete terminal viewport. */
  public project(options: {
    readonly width: number;
    readonly height: number;
    readonly caps: CapabilityProfile;
  }): CodeEditorFrame {
    const startedAt = Date.now();
    const caret = Number(this.controller.document.selection.head);
    const bracketPair = this.controller.languageResult?.brackets.find(
      (pair) => pair.open === caret || pair.close === caret,
    );
    this.#lastFrame = projectCodeEditor({
      controller: this.controller,
      ...options,
      theme: this.#theme,
      themeName: this.#themeFingerprint,
      scrollX: this.scroll.x(),
      scrollY: this.scroll.y(),
      syntax: this.controller.languageResult?.syntax,
      diagnostics: this.controller.diagnostics,
      snippet: this.controller.snippets,
      search:
        this.#searchQuery.length === 0 ? [] : this.controller.document.search(this.#searchQuery, { maxResults: 1 }),
      bracket:
        bracketPair === undefined
          ? undefined
          : {
              from: Math.min(bracketPair.open, bracketPair.close),
              to: Math.max(bracketPair.open, bracketPair.close) + 1,
            },
      activeLine: Number(offsetToPosition(this.controller.document.snapshot, caret).line),
      gutter: this.lineNumbers,
    });
    this.controller.observations.record({ kind: 'render', durationMs: Date.now() - startedAt });
    return this.#lastFrame;
  }

  /** Resolves after all currently accepted host effects settle. */
  public async whenIdle(): Promise<void> {
    await Promise.all([...this.#pending.values()]);
    await this.controller.observations.whenIdle();
  }

  /** Releases view-owned assistance, host-effect, and controller resources. */
  public dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#completion = undefined;
    this.#snippet = undefined;
    this.#modal = undefined;
    this.assistanceView.dismiss();
    this.#pending.clear();
    this.controller.dispose();
  }

  /** Returns content-free retained UI counters for lifecycle inspection. */
  public get retainedState(): {
    readonly completionItems: number;
    readonly popupRows: number;
    readonly snippetPlaceholders: number;
    readonly pendingHostEffects: number;
  } {
    return Object.freeze({
      completionItems: this.#completion?.length ?? 0,
      popupRows: this.assistanceView.items.length,
      snippetPlaceholders: this.#snippet?.length ?? 0,
      pendingHostEffects: this.#pending.size,
    });
  }

  /** Paints sanitized, semantically styled cells through JSVision. */
  public override draw(context: DrawContext): void {
    const frame = this.project({ width: context.size.width, height: context.size.height, caps: context.caps });
    for (let y = 0; y < frame.cells.length; y += 1) {
      for (let x = 0; x < (frame.cells[y]?.length ?? 0); x += 1) {
        const cell = frame.cells[y]?.[x];
        if (cell !== undefined)
          context.text(
            x,
            y,
            cell.text,
            cell.style === undefined
              ? undefined
              : {
                  fg: cell.style.foreground,
                  bg: cell.style.background,
                  attrs: cell.style.attrs,
                },
          );
      }
    }
  }

  /** Exposes the projected caret to the terminal event loop. */
  public override desiredCaret(): Point | null {
    return this.focusState === 'released' || this.#lastFrame?.caret.visible === false
      ? null
      : (this.#lastFrame?.caret ?? { x: 0, y: 0 });
  }

  /** Bridges decoded terminal keys into the deterministic router. */
  public override onEvent(event: DispatchEvent): void {
    if (event.event.type !== 'key') return;
    const key = event.event;
    const result = this.routeKey({
      key: key.key,
      ctrl: key.ctrl,
      alt: key.alt,
      shift: key.shift,
      ...(key.codepoint === undefined ? {} : { text: String.fromCodePoint(key.codepoint) }),
    });
    event.handled = result.handled;
  }

  #acceptCompletion(item: CodeEditorCompletionItem): void {
    const range =
      item.from === undefined
        ? currentWordRange(this.controller.document.text, Number(this.controller.document.selection.head))
        : { from: item.from, to: item.to ?? item.from };
    this.controller.document.setSelection({ anchor: range.from, head: range.to });
    this.controller.replaceSelection(item.insertText ?? item.label);
  }

  #routeEditingKey(key: string, shift: boolean): boolean {
    if (key === ' ') return this.insertText(' ');
    if (key === 'Enter') return this.#insertNewline();
    if (key === 'Tab') {
      if (this.#hasSelection()) return this.#changeSelectedLineIndent(shift ? 'dedent' : 'indent');
      if (shift) return this.#dedentAtCaret();
      const document = this.controller.document;
      const line = document.snapshot.lineAt(Number(document.selection.head));
      const column = Number(document.selection.head) - line.from;
      const width = document.tabSize - (column % document.tabSize);
      return this.insertText(' '.repeat(width));
    }
    if (key === 'Backspace') return this.#deleteAdjacent(-1);
    if (key === 'Delete') return this.#deleteAdjacent(1);
    if (key === 'ArrowLeft') return this.#moveCaret(-1, shift);
    if (key === 'ArrowRight') return this.#moveCaret(1, shift);
    if (key === 'Home') return this.#moveToLineEdge('start', shift);
    if (key === 'End') return this.#moveToLineEdge('end', shift);
    if (key === 'ArrowUp') return this.#moveVertically(-1, shift);
    if (key === 'ArrowDown') return this.#moveVertically(1, shift);
    return false;
  }

  #routeModifiedKey(key: CodeEditorKey): Exclude<CodeEditorKeyRoute['owner'], 'unhandled'> | undefined {
    if (key.ctrl !== true || key.alt === true) return undefined;
    const lower = key.key.toLowerCase();
    if (lower === 'a') {
      this.controller.document.setSelection({ anchor: 0, head: this.controller.document.text.length });
      this.invalidate();
      return 'editor';
    }
    if (lower === 'z' || lower === 'y') {
      const redo = lower === 'y' || key.shift === true;
      this.#finishMutation(redo ? this.controller.document.redo().accepted : this.controller.document.undo().accepted);
      return 'editor';
    }
    if (key.key === 'ArrowLeft' || key.key === 'ArrowRight') {
      this.#moveByWord(key.key === 'ArrowLeft' ? -1 : 1, key.shift === true);
      return 'editor';
    }
    if (key.key === 'Home' || key.key === 'End') {
      this.#moveToDocumentEdge(key.key === 'Home' ? 'start' : 'end', key.shift === true);
      return 'editor';
    }
    return undefined;
  }

  #hasSelection(): boolean {
    const selection = this.controller.document.selection;
    return selection.anchor !== selection.head;
  }

  #insertNewline(): boolean {
    const document = this.controller.document;
    const line = document.snapshot.lineAt(Number(document.selection.head));
    const indentation = line.text.match(/^[\t ]*/u)?.[0] ?? '';
    return this.insertText(lineSeparator(document.lineEnding) + indentation);
  }

  #changeSelectedLineIndent(direction: 'indent' | 'dedent'): boolean {
    const document = this.controller.document;
    const selection = document.selection;
    const start = Math.min(Number(selection.anchor), Number(selection.head));
    const end = Math.max(Number(selection.anchor), Number(selection.head));
    const firstLine = document.snapshot.lineAt(start).number;
    const lastOffset = end > start && document.snapshot.lineAt(end).from === end ? end - 1 : end;
    const lastLine = document.snapshot.lineAt(Math.max(start, lastOffset)).number;
    const edits: DocumentEditInput[] = [];
    for (let number = Number(firstLine); number <= Number(lastLine); number += 1) {
      const line = document.snapshot.line(number);
      if (direction === 'indent') {
        edits.push({ range: { from: line.from, to: line.from }, text: ' '.repeat(document.tabSize) });
        continue;
      }
      const removable = indentationWidth(line.text, document.tabSize);
      if (removable > 0) edits.push({ range: { from: line.from, to: line.from + removable }, text: '' });
    }
    if (edits.length === 0) return true;
    return this.#applyEdits(edits, {
      anchor: transformOffset(Number(selection.anchor), edits),
      head: transformOffset(Number(selection.head), edits),
    });
  }

  #applyEdits(edits: readonly DocumentEditInput[], selection: DocumentSelectionInput): boolean {
    const document = this.controller.document;
    const accepted = document.apply(
      document.createTransaction({
        edits,
        selection,
        origin: 'typing',
      }),
    ).accepted;
    this.#finishMutation(accepted);
    return accepted;
  }

  #finishMutation(accepted: boolean): void {
    if (!accepted) return;
    this.#record('edit');
    this.invalidateLayout();
    try {
      this.#onDocumentChange?.();
    } catch {
      this.controller.degradation.fail('parser');
    }
  }

  #deleteAdjacent(direction: -1 | 1): boolean {
    const selection = this.controller.document.selection;
    const anchor = Number(selection.anchor);
    const head = Number(selection.head);
    if (anchor === head) {
      const target = Math.max(0, Math.min(this.controller.document.text.length, head + direction));
      if (target === head) return true;
      this.controller.document.setSelection({ anchor: Math.min(head, target), head: Math.max(head, target) });
    }
    this.insertText('');
    return true;
  }

  #moveCaret(delta: -1 | 1, extend: boolean): boolean {
    const selection = this.controller.document.selection;
    const head = Math.max(0, Math.min(this.controller.document.text.length, Number(selection.head) + delta));
    this.controller.document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.invalidate();
    return true;
  }

  #moveByWord(direction: -1 | 1, extend: boolean): void {
    const document = this.controller.document;
    const selection = document.selection;
    const text = document.text;
    let head = Number(selection.head);
    if (direction === 1) {
      while (head < text.length && isSourceWordCharacter(text[head] ?? '')) head += 1;
      while (head < text.length && isSourceWhitespace(text[head] ?? '')) head += 1;
    } else {
      while (head > 0 && isSourceWhitespace(text[head - 1] ?? '')) head -= 1;
      while (head > 0 && isSourceWordCharacter(text[head - 1] ?? '')) head -= 1;
    }
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.invalidate();
  }

  #moveToDocumentEdge(edge: 'start' | 'end', extend: boolean): void {
    const document = this.controller.document;
    const selection = document.selection;
    const head = edge === 'start' ? 0 : document.text.length;
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.invalidate();
  }

  #moveToLineEdge(edge: 'start' | 'end', extend: boolean): boolean {
    const document = this.controller.document;
    const selection = document.selection;
    const line = document.snapshot.lineAt(Number(selection.head));
    const head = edge === 'start' ? line.from : line.to;
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.invalidate();
    return true;
  }

  #moveVertically(delta: -1 | 1, extend: boolean): boolean {
    const document = this.controller.document;
    const selection = document.selection;
    const current = document.snapshot.lineAt(Number(selection.head));
    const targetNumber = Math.max(0, Math.min(document.snapshot.lineCount - 1, current.number + delta));
    const target = document.snapshot.line(targetNumber);
    const head = target.from + Math.min(Number(selection.head) - current.from, target.length);
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.invalidate();
    return true;
  }

  #dedentAtCaret(): boolean {
    const document = this.controller.document;
    const head = Number(document.selection.head);
    const line = document.snapshot.lineAt(head);
    const prefix = line.text.slice(0, Math.min(document.tabSize, line.text.length));
    const removable = prefix.match(/^ {1,}/u)?.[0].length ?? (prefix.startsWith('\t') ? 1 : 0);
    if (removable === 0) return true;
    document.setSelection({ anchor: line.from, head: line.from + removable });
    this.insertText('');
    return true;
  }

  #searchNext(): void {
    if (this.#searchQuery.length === 0) return;
    const text = this.controller.document.snapshot.slice(0);
    const start = Number(this.controller.document.selection.head);
    const candidate = text.indexOf(this.#searchQuery, start);
    const found = candidate >= 0 ? candidate : text.indexOf(this.#searchQuery);
    if (found >= 0) this.controller.document.setSelection({ anchor: found, head: found + this.#searchQuery.length });
  }

  #queueHost(kind: 'navigate' | 'save' | 'close'): void {
    if (this.#pending.has(kind)) return;
    const pending = this.controller
      .hostAction(kind)
      .then((accepted) => {
        if (kind === 'close' && accepted) this.focusState = 'released';
      })
      .catch(() => undefined)
      .finally(() => this.#pending.delete(kind));
    this.#pending.set(kind, pending);
  }

  #record(event: string): void {
    if (this.journey.length >= 128) this.journey.shift();
    this.journey.push(event);
  }
}

function route(owner: Exclude<CodeEditorKeyRoute['owner'], 'unhandled'>): CodeEditorKeyRoute {
  return Object.freeze({ handled: true, owner });
}

function fingerprint(theme: CodeEditorTheme): string {
  let hash = 2_166_136_261;
  const sections = [theme.surfaces, theme.syntax, theme.structure, theme.diagnostics, theme.assistance];
  const values = [
    theme.name,
    ...sections.flatMap((section) =>
      Object.values(section).flatMap((style) => [style.foreground, style.background, String(style.attrs ?? 0)]),
    ),
  ];
  for (const value of values)
    for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  return (hash >>> 0).toString(16);
}

function ownString(value: unknown, key: string, limit: number): string | undefined {
  const candidate = ownData(value, key);
  return typeof candidate === 'string' && candidate.length <= limit ? candidate : undefined;
}

function ownInteger(value: unknown, key: string): number | undefined {
  const candidate = ownData(value, key);
  return Number.isSafeInteger(candidate) ? (candidate as number) : undefined;
}

function ownData(value: unknown, key: string): unknown {
  try {
    if (value === null || typeof value !== 'object') return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && 'value' in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

function currentWordRange(text: string, caret: number): { from: number; to: number } {
  let from = Math.max(0, Math.min(caret, text.length));
  let to = from;
  while (from > 0 && /[A-Za-z0-9_$]/u.test(text[from - 1] ?? '')) from -= 1;
  while (to < text.length && /[A-Za-z0-9_$]/u.test(text[to] ?? '')) to += 1;
  return { from, to };
}

/** Returns whether one UTF-16 code unit participates in source-code word navigation. */
function isSourceWordCharacter(character: string): boolean {
  return /^[A-Za-z0-9_$]$/u.test(character);
}

/** Returns whether word navigation may cross a source whitespace boundary. */
function isSourceWhitespace(character: string): boolean {
  return /^\s$/u.test(character);
}

/** Counts the removable indentation prefix for one logical line. */
function indentationWidth(text: string, tabSize: number): number {
  let width = 0;
  while (width < Math.min(text.length, tabSize) && (text[width] === ' ' || text[width] === '\t')) width += 1;
  return width;
}

/**
 * Maps an original document offset through a sorted atomic edit set.
 *
 * Insertions at the offset are treated as preceding it so selected content stays selected after
 * indentation. Offsets inside removed text collapse to the replacement.
 */
function transformOffset(offset: number, edits: readonly DocumentEditInput[]): number {
  let delta = 0;
  for (const edit of edits) {
    const { from, to } = edit.range;
    if (offset < from) break;
    if (from === to) {
      delta += edit.text.length;
      continue;
    }
    if (offset <= to) return from + delta + Math.min(edit.text.length, offset - from);
    delta += edit.text.length - (to - from);
  }
  return offset + delta;
}

function lineSeparator(lineEnding: 'none' | 'lf' | 'crlf' | 'cr' | 'mixed'): string {
  if (lineEnding === 'crlf') return '\r\n';
  if (lineEnding === 'cr') return '\r';
  return '\n';
}
