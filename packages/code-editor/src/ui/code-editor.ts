import type { CapabilityProfile } from '@jsvision/core';
import { Group, signal, type DispatchEvent, type DrawContext, type Point, type Signal } from '@jsvision/ui';
import type { CodeEditorController } from '../controller.js';
import { offsetToPosition } from '../document/positions.js';
import type { DocumentEditInput, DocumentSelectionInput } from '../document/types.js';
import { builtInCommentMetadata } from '../languages/metadata.js';
import { classicCodeEditorTheme } from '../theme/presets.js';
import { snapshotCodeEditorTheme } from '../theme/resolve.js';
import type { CodeEditorTheme, ResolvedCodeEditorTheme } from '../theme/theme.js';
import { CodeEditorAssistanceView, type CodeEditorCompletionItem, type CodeEditorModalState } from './assistance.js';
import { routeCodeEditorCommand } from './command-events.js';
import {
  advanceCharacterRun,
  currentWordRange,
  lineSeparator,
  removableIndentationLength,
  retreatCharacterRun,
  sourceCharacterAt,
  sourceCharacterBefore,
  transformOffset,
} from './editing-operations.js';
import {
  canonicalCodeEditorKeyName,
  codeEditorKeyToken,
  defaultCodeEditorKeyBindings,
  type CodeEditorCommand,
  type CodeEditorKey,
} from './input.js';
import {
  fingerprintTheme,
  normalizeCompletionItems,
  normalizeSnippetPlaceholders,
  ownData,
} from './input-validation.js';
import { CodeEditorMouseSelection } from './mouse-selection.js';
import { codeEditorGutterWidth, projectCodeEditor, type CodeEditorFrame } from './projection.js';
import { codeEditorVisibleRows } from './folding.js';
import { CodeEditorViewport, type CodeEditorViewportMetrics } from './viewport.js';

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
  public readonly behavior = Object.freeze({ documentTransactions: true, keyboardOnly: false });
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
  readonly #viewport: CodeEditorViewport;
  readonly #mouseSelection: CodeEditorMouseSelection;
  readonly #interactionRevision = signal(0);
  readonly #pending = new Map<'navigate' | 'save' | 'close', Promise<unknown>>();
  #theme: CodeEditorTheme = classicCodeEditorTheme;
  #themeFingerprint = fingerprintTheme(classicCodeEditorTheme);
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
    this.#viewport = new CodeEditorViewport(this.controller);
    this.#mouseSelection = new CodeEditorMouseSelection(this, this.controller.document, this.#viewport, () =>
      this.#finishSelectionChange(),
    );
    this.scroll = { x: this.#viewport.x, y: this.#viewport.y };
    this.#bindings = Object.freeze({ ...defaultCodeEditorKeyBindings, ...options.keyBindings });
    this.#onDocumentChange = options.onDocumentChange;
    this.add(this.assistanceView);
    this.onMount(() =>
      this.bind(
        () => [this.scroll.x(), this.scroll.y()] as const,
        () => {
          this.#viewport.synchronize(false);
          this.invalidate();
        },
      ),
    );
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
      this.#finishSelectionChange();
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
    if (command === 'fold.collapse') this.controller.fold();
    if (command === 'fold.expand') this.controller.unfold();
    if (command === 'fold.collapseAll') this.controller.foldAll();
    if (command === 'fold.expandAll') this.controller.unfoldAll();
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

  /** Returns reactive viewport geometry and clamped scroll limits for passive host chrome. */
  public get viewportMetrics(): CodeEditorViewportMetrics {
    return this.#viewport.metrics;
  }

  /** Returns a reactive counter that changes after each caret, selection, or document update. */
  public get interactionRevision(): number {
    return this.#interactionRevision();
  }

  /**
   * Re-fits a standalone or window-hosted editor before the next layout pass applies real bounds.
   *
   * Normal drawing discovers its own dimensions automatically. Window composition calls this
   * method during resize so caret tracking and scrollbar ranges update in the same event tick.
   *
   * @throws {RangeError} When either dimension is not a supported non-negative integer.
   */
  public resizeViewport(width: number, height: number): void {
    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width < 0 ||
      height < 0 ||
      width > 2_000 ||
      height > 500
    ) {
      throw new RangeError('Invalid editor viewport dimension.');
    }
    const gutterWidth = codeEditorGutterWidth(width, this.controller.document.snapshot.lineCount, this.lineNumbers);
    if (this.#viewport.resize(width, height, gutterWidth)) this.#touchInteraction();
  }

  /** Opens a validated completion list without changing the document selection. */
  public openCompletion(items: readonly CodeEditorCompletionItem[]): void {
    const normalized = normalizeCompletionItems(
      items,
      this.controller.limits.completionItems,
      this.controller.document.text.length,
    );
    if (normalized === undefined) return;
    this.#completion = normalized;
    this.assistanceView.show(normalized.map((item) => item.label));
  }

  /** Opens one modal surface; Escape always dismisses it first. */
  public openModal(modal: CodeEditorModalState): void {
    const kind = ownData(modal, 'kind');
    if (kind === 'search' || kind === 'chooser' || kind === 'completion') this.#modal = Object.freeze({ kind });
  }

  /** Starts validated, bounded snippet placeholder traversal. */
  public startSnippet(placeholders: readonly { readonly from: number; readonly to: number }[]): void {
    const normalized = normalizeSnippetPlaceholders(
      placeholders,
      this.controller.limits.decorations,
      this.controller.document.text.length,
    );
    if (normalized === undefined) return;
    this.#snippet = normalized;
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
      else {
        this.controller.document.setSelection({ anchor: target.from, head: target.to });
        this.#finishSelectionChange();
      }
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
    this.#themeFingerprint = fingerprintTheme(this.#theme);
    this.invalidate();
  }

  /** Projects the current state for a concrete terminal viewport. */
  public project(options: {
    readonly width: number;
    readonly height: number;
    readonly caps: CapabilityProfile;
  }): CodeEditorFrame {
    const startedAt = Date.now();
    this.resizeViewport(options.width, options.height);
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
    if (event.event.type === 'wheel') {
      const direction = event.event.dir;
      this.#viewport.scrollBy(
        direction === 'left' ? -3 : direction === 'right' ? 3 : 0,
        direction === 'up' ? -3 : direction === 'down' ? 3 : 0,
      );
      this.#touchInteraction();
      this.invalidate();
      event.handled = true;
      return;
    }
    if (event.event.type === 'mouse') {
      this.#routeMouseEvent(event);
      return;
    }
    if (event.event.type === 'command') {
      event.handled = routeCodeEditorCommand(
        this.controller,
        event,
        (text) => this.insertText(text),
        (accepted) => this.#finishMutation(accepted),
        () => this.#finishSelectionChange(),
      );
      return;
    }
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

  #routeMouseEvent(event: DispatchEvent): void {
    if (
      event.event.type === 'mouse' &&
      event.event.kind === 'down' &&
      event.event.button === 0 &&
      event.local !== undefined &&
      this.lineNumbers &&
      event.local.x === this.#viewport.metrics.gutterWidth - 1
    ) {
      const line = this.#viewport.logicalLineAtViewportRow(event.local.y);
      if (codeEditorVisibleRows(this.controller).foldableAt(line) !== undefined) {
        this.controller.toggleFoldLine(line);
        this.#finishSelectionChange();
        event.handled = true;
        return;
      }
    }
    event.handled = this.#mouseSelection.route(event, this.#lastFrame);
  }

  #acceptCompletion(item: CodeEditorCompletionItem): void {
    const range =
      item.from === undefined
        ? currentWordRange(this.controller.document.text, Number(this.controller.document.selection.head))
        : { from: item.from, to: item.to ?? item.from };
    this.controller.document.setSelection({ anchor: range.from, head: range.to });
    this.insertText(item.insertText ?? item.label);
  }

  #routeEditingKey(key: string, shift: boolean): boolean {
    if (key === ' ') return this.insertText(' ');
    if (key === 'Enter') return this.#insertNewline();
    if (key === 'Tab') {
      if (this.#hasSelection()) return this.#changeSelectedLineIndent(shift ? 'dedent' : 'indent');
      if (shift) return this.#dedentAtCaret();
      const document = this.controller.document;
      const column = document.visualColumnAt(Number(document.selection.head));
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
      this.#finishSelectionChange();
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
    if (key.key === '/') return this.#toggleLineComments();
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
    const { firstLine, lastLine } = this.#selectedLineRange();
    const edits: DocumentEditInput[] = [];
    for (let number = Number(firstLine); number <= Number(lastLine); number += 1) {
      const line = document.snapshot.line(number);
      if (direction === 'indent') {
        edits.push({ range: { from: line.from, to: line.from }, text: ' '.repeat(document.tabSize) });
        continue;
      }
      const removable = removableIndentationLength(line.text, document.tabSize);
      if (removable > 0) edits.push({ range: { from: line.from, to: line.from + removable }, text: '' });
    }
    if (edits.length === 0) return true;
    return this.#applyEdits(edits, {
      anchor: transformOffset(Number(selection.anchor), edits),
      head: transformOffset(Number(selection.head), edits),
    });
  }

  #toggleLineComments(): 'text' | 'editor' {
    const document = this.controller.document;
    const comments = builtInCommentMetadata(document.languageId);
    if (comments?.line === undefined) return 'editor';
    const { firstLine, lastLine } = this.#selectedLineRange();
    const lines = [];
    for (let number = firstLine; number <= lastLine; number += 1) lines.push(document.snapshot.line(number));
    const nonblank = lines.filter((line) => line.text.trim().length > 0);
    if (nonblank.length === 0) return 'editor';
    const minimumIndent = Math.min(...nonblank.map((line) => line.text.length - line.text.trimStart().length));
    const delimiter = comments.line;
    const uncomment = nonblank.every((line) => line.text.slice(minimumIndent).startsWith(delimiter));
    const edits: DocumentEditInput[] = nonblank.map((line) => {
      const from = line.from + minimumIndent;
      if (!uncomment) return { range: { from, to: from }, text: `${delimiter} ` };
      const following = line.text.slice(minimumIndent + delimiter.length);
      const removeSpace = following.startsWith(' ') ? 1 : 0;
      return { range: { from, to: from + delimiter.length + removeSpace }, text: '' };
    });
    const selection = document.selection;
    const accepted = this.#applyEdits(edits, {
      anchor: transformOffset(Number(selection.anchor), edits),
      head: transformOffset(Number(selection.head), edits),
    });
    return accepted ? 'text' : 'editor';
  }

  #selectedLineRange(): { readonly firstLine: number; readonly lastLine: number } {
    const document = this.controller.document;
    const selection = document.selection;
    const start = Math.min(Number(selection.anchor), Number(selection.head));
    const end = Math.max(Number(selection.anchor), Number(selection.head));
    const firstLine = Number(document.snapshot.lineAt(start).number);
    const lastOffset = end > start && document.snapshot.lineAt(end).from === end ? end - 1 : end;
    const lastLine = Number(document.snapshot.lineAt(Math.max(start, lastOffset)).number);
    return { firstLine, lastLine };
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
    this.#viewport.synchronize(true);
    this.#touchInteraction();
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
    this.#finishSelectionChange();
    return true;
  }

  #moveByWord(direction: -1 | 1, extend: boolean): void {
    const document = this.controller.document;
    const selection = document.selection;
    const text = document.text;
    let head = Number(selection.head);
    if (direction === 1) {
      const initial = sourceCharacterAt(text, head);
      if (initial !== undefined) {
        head = advanceCharacterRun(text, head, initial.kind);
        if (initial.kind !== 'whitespace') head = advanceCharacterRun(text, head, 'whitespace');
      }
    } else {
      head = retreatCharacterRun(text, head, 'whitespace');
      const prior = sourceCharacterBefore(text, head);
      if (prior !== undefined) head = retreatCharacterRun(text, head, prior.kind);
    }
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
  }

  #moveToDocumentEdge(edge: 'start' | 'end', extend: boolean): void {
    const document = this.controller.document;
    const selection = document.selection;
    const head = edge === 'start' ? 0 : document.text.length;
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
  }

  #moveToLineEdge(edge: 'start' | 'end', extend: boolean): boolean {
    const document = this.controller.document;
    const selection = document.selection;
    const line = document.snapshot.lineAt(Number(selection.head));
    const head = edge === 'start' ? line.from : line.to;
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
    return true;
  }

  #moveVertically(delta: -1 | 1, extend: boolean): boolean {
    const document = this.controller.document;
    const selection = document.selection;
    const current = document.snapshot.lineAt(Number(selection.head));
    const targetNumber = codeEditorVisibleRows(this.controller).adjacentLogicalLine(Number(current.number), delta);
    const target = document.snapshot.line(targetNumber);
    const head = target.from + Math.min(Number(selection.head) - current.from, target.length);
    document.setSelection({ anchor: extend ? Number(selection.anchor) : head, head });
    this.#finishSelectionChange();
    return true;
  }

  #dedentAtCaret(): boolean {
    const document = this.controller.document;
    const head = Number(document.selection.head);
    const line = document.snapshot.lineAt(head);
    const removable = removableIndentationLength(line.text, document.tabSize);
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
    if (found >= 0) {
      this.controller.document.setSelection({ anchor: found, head: found + this.#searchQuery.length });
      this.#finishSelectionChange();
    }
  }

  #finishSelectionChange(): void {
    this.#viewport.synchronize(true);
    this.#touchInteraction();
    this.invalidate();
  }

  #touchInteraction(): void {
    this.#interactionRevision.set((this.#interactionRevision() + 1) % Number.MAX_SAFE_INTEGER);
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
