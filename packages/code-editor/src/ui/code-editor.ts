import type { CapabilityProfile } from '@jsvision/core';
import type { I18n } from '@jsvision/i18n';
import { Group, signal, type DispatchEvent, type DrawContext, type Point, type Signal } from '@jsvision/ui';
import type { CodeEditorController, CodeEditorControllerEvent } from '../controller.js';
import type { CodeEditorDisposable } from '../integration.js';
import { offsetToPosition } from '../document/positions.js';
import type { DocumentEditInput, DocumentSelectionInput } from '../document/types.js';
import { createEnglishCodeEditorI18n } from '../i18n/catalog.js';
import { formatCodeEditorDiagnosticOverlay } from '../i18n/presentation.js';
import type {
  CodeEditorTheme,
  CodeEditorThemeResolutionReport,
  CodeEditorThemeSource,
  ResolvedCodeEditorTheme,
} from '../theme/theme.js';
import { CodeEditorAssistanceView, type CodeEditorCompletionItem, type CodeEditorModalState } from './assistance.js';
import { routeCodeEditorCommand } from './command-events.js';
import { CodeEditorEditingActions } from './editing-actions.js';
import {
  canonicalCodeEditorKeyName,
  codeEditorKeyToken,
  defaultCodeEditorKeyBindings,
  type CodeEditorCommand,
  type CodeEditorKey,
} from './input.js';
import { normalizeSnippetPlaceholders, ownData } from './input-validation.js';
import { CodeEditorMouseSelection } from './mouse-selection.js';
import { registerCodeEditorKeyBindings } from './keybindings.js';
import { codeEditorGutterWidth, projectCodeEditor, type CodeEditorFrame } from './projection.js';
import { codeEditorVisibleRows } from './folding.js';
import { CodeEditorSearchSession, type CodeEditorSearchState } from './search-session.js';
import { projectCodeEditorSearchPresentation } from './search-presentation.js';
import { CodeEditorThemeState } from './theme-state.js';
import { CodeEditorViewport, type CodeEditorViewportMetrics } from './viewport.js';

/** Construction options for a terminal-native code editor view. */
export interface CodeEditorOptions {
  readonly controller: CodeEditorController;
  /** Locale-bound service used for editor-owned presentation. Defaults to isolated English. */
  readonly i18n?: I18n;
  readonly keyBindings?: Readonly<Record<string, CodeEditorCommand>>;
  /** Exact existing commands that explicitly authorize canonical custom-binding collisions. */
  readonly keyBindingOverrides?: Readonly<Record<string, CodeEditorCommand>>;
  /** Shows the fixed line-number gutter when the viewport is wide enough. Defaults to `false`. */
  readonly lineNumbers?: boolean;
  /** Optional live hybrid theme source resolved from application roles during drawing. */
  readonly themeSource?: CodeEditorThemeSource;
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
  /** Exact locale-bound service used by this editor instance. */
  public readonly i18n: I18n;
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
  readonly #controllerSubscription: CodeEditorDisposable;
  readonly #viewport: CodeEditorViewport;
  readonly #editingActions: CodeEditorEditingActions;
  readonly #search: CodeEditorSearchSession;
  readonly #mouseSelection: CodeEditorMouseSelection;
  readonly #themeState = new CodeEditorThemeState();
  readonly #interactionRevision = signal(0);
  readonly #pending = new Map<'navigate' | 'save' | 'close', Promise<unknown>>();
  #hostQueue: Promise<void> = Promise.resolve();
  #lastFrame: CodeEditorFrame | undefined;
  #modal: CodeEditorModalState | undefined;
  #snippet: readonly { readonly from: number; readonly to: number }[] | undefined;
  #snippetIndex = 0;
  #assistanceSource: readonly unknown[] | undefined;
  readonly #locallyHandledRevisions = new Set<number>();
  #lastSelectionHead: number;
  #disposed = false;

  public constructor(options: CodeEditorOptions) {
    super();
    this.controller = options.controller;
    this.i18n = options.i18n ?? createEnglishCodeEditorI18n();
    this.#lastSelectionHead = Number(this.controller.document.selection.head);
    this.lineNumbers = options.lineNumbers === true;
    this.assistanceView = new CodeEditorAssistanceView({
      maxItems: this.controller.limits.completionItems,
      maxWidth: this.controller.limits.popupWidth,
      maxHeight: this.controller.limits.popupHeight,
    });
    this.#viewport = new CodeEditorViewport(this.controller);
    this.#editingActions = new CodeEditorEditingActions({
      controller: this.controller,
      insertText: (text) => this.insertText(text),
      applyEdits: (edits, selection) => this.#applyEdits(edits, selection),
      finishMutation: (accepted) => this.#finishMutation(accepted),
      finishSelectionChange: () => this.#finishSelectionChange(),
    });
    this.#search = new CodeEditorSearchSession({
      controller: this.controller,
      apply: (edits, selection) => this.#applySearchEdits(edits, selection),
      finishSelectionChange: () => this.#finishSelectionChange(false, true),
      changed: () => {
        this.#touchInteraction();
        const rect = this.layout.rect;
        if (rect !== undefined) this.resizeViewport(rect.width, rect.height);
        this.invalidate();
      },
    });
    this.#mouseSelection = new CodeEditorMouseSelection(this, this.controller.document, this.#viewport, () =>
      this.#finishSelectionChange(),
    );
    this.scroll = { x: this.#viewport.x, y: this.#viewport.y };
    this.#bindings = registerCodeEditorKeyBindings(
      defaultCodeEditorKeyBindings,
      options.keyBindings,
      options.keyBindingOverrides,
    );
    this.#onDocumentChange = options.onDocumentChange;
    if (options.themeSource !== undefined) this.#themeState.setSource(options.themeSource);
    this.#controllerSubscription = this.controller.subscribe((event) => this.#handleControllerEvent(event));
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
      this.controller.revealOffset(end);
      this.controller.document.setSelection({ anchor: end, head: end });
      this.#finishSelectionChange();
      return;
    }
    if (command === 'search.open') {
      this.#search.open(false);
      this.#record('search.open');
      return;
    }
    if (command === 'search.replaceOpen') {
      this.#search.open(true);
      this.#record('search.replaceOpen');
      return;
    }
    if (command === 'search.next') {
      this.#search.navigate(1);
      this.#record('search.next');
      return;
    }
    if (command === 'search.previous') {
      this.#search.navigate(-1);
      this.#record('search.previous');
      return;
    }
    if (command === 'search.replaceCurrent') {
      this.#search.replaceCurrent();
      this.#record('search.replaceCurrent');
      return;
    }
    if (command === 'search.replaceAll') {
      this.#search.replaceAll();
      this.#record('search.replaceAll');
      return;
    }
    if (command === 'search.dismiss') {
      this.#search.dismiss();
      this.#record('search.dismiss');
      return;
    }
    const foldCommand =
      command === 'fold.toggle' ||
      command === 'fold.collapse' ||
      command === 'fold.expand' ||
      command === 'fold.collapseAll' ||
      command === 'fold.expandAll';
    if (command === 'fold.toggle') this.controller.toggleFold();
    if (command === 'fold.collapse') this.controller.fold();
    if (command === 'fold.expand') this.controller.unfold();
    if (command === 'fold.collapseAll') this.controller.foldAll();
    if (command === 'fold.expandAll') this.controller.unfoldAll();
    if (foldCommand) this.#finishSelectionChange();
    if (command === 'assist') this.controller.requestAssistance();
    if (command === 'hover') this.controller.requestHover();
    if (command === 'symbols') this.controller.requestDocumentSymbols();
    if (command === 'navigate' && !this.controller.requestDefinition()) this.#queueHost(command);
    if (command === 'format') this.controller.requestFormatting();
    this.#record(command);
    if (command === 'save' || command === 'close') this.#queueHost(command);
  }

  /** Inserts text through one validated document transaction. */
  public insertText(text: string): boolean {
    const accepted = this.controller.replaceSelection(text);
    if (accepted) {
      this.#finishMutation(true);
      this.#locallyHandledRevisions.add(Number(this.controller.document.identity.revision));
    }
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

  /** Returns immutable keyboard find/replace state for host status and accessibility surfaces. */
  public get searchState(): CodeEditorSearchState {
    return this.#search.state;
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
    const documentHeight = Math.max(
      0,
      height - projectCodeEditorSearchPresentation(this.#search.state, this.i18n, width).rowCount,
    );
    const gutterWidth = codeEditorGutterWidth(width, this.controller.document.snapshot.lineCount, this.lineNumbers);
    if (this.#viewport.resize(width, documentHeight, gutterWidth)) this.#touchInteraction();
  }

  /** Opens a validated completion list without changing the document selection. */
  public openCompletion(items: readonly CodeEditorCompletionItem[]): void {
    if (this.controller.openCompletion(items)) this.#syncAssistance();
  }

  /** Opens one modal surface; Escape always dismisses it first. */
  public openModal(modal: CodeEditorModalState): void {
    const kind = ownData(modal, 'kind');
    if (kind === 'search') this.#search.open(false);
    if (kind === 'chooser' || kind === 'completion') this.#modal = Object.freeze({ kind });
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
    this.#search.setQuery(query);
  }

  /** Updates bounded replacement text without mutating the source document. */
  public setReplacementText(replacement: string): void {
    this.#search.setReplacement(replacement);
  }

  /** Selects case-sensitive or case-insensitive literal matching. */
  public setSearchCaseSensitive(caseSensitive: boolean): void {
    this.#search.setCaseSensitive(caseSensitive);
  }

  /** Routes one key according to assistance/editor/text precedence. */
  public routeKey(key: CodeEditorKey): CodeEditorKeyRoute {
    const canonicalKey = canonicalCodeEditorKeyName(key.key);
    const normalizedKey = canonicalKey === key.key ? key : { ...key, key: canonicalKey };
    const searchOwner = this.#search.routeKey(normalizedKey);
    if (searchOwner !== undefined) {
      if (canonicalKey === 'Enter') this.#record(key.shift === true ? 'search.previous' : 'search.next');
      return route(searchOwner);
    }
    if (canonicalKey === 'Escape' && this.#modal !== undefined) {
      this.#modal = undefined;
      return route('dismissal');
    }
    const assistanceRevision = Number(this.controller.document.identity.revision);
    const assistanceOwner = this.controller.routeAssistanceKey({
      key: canonicalKey,
      ...(key.text === undefined ? {} : { text: key.text }),
      ...(key.shift === undefined ? {} : { shift: key.shift }),
    });
    if (assistanceOwner === 'completion') {
      const currentRevision = Number(this.controller.document.identity.revision);
      if (currentRevision !== assistanceRevision) {
        this.#finishMutation(true);
        this.#locallyHandledRevisions.add(currentRevision);
      }
      this.#syncAssistance();
      this.#finishSelectionChange(true);
      return route(canonicalKey === 'Escape' ? 'dismissal' : 'completion');
    }
    if (assistanceOwner === 'snippet') {
      this.#finishSelectionChange(true);
      return route('snippet');
    }
    if (assistanceOwner === 'dismissal') {
      this.#syncAssistance();
      return route('dismissal');
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
    const command = this.#bindings[codeEditorKeyToken(normalizedKey)];
    if (command !== undefined) {
      this.execute(command);
      return route('editor');
    }
    const modifiedOwner = this.#editingActions.routeModifiedKey(normalizedKey);
    if (modifiedOwner !== undefined) return route(modifiedOwner);
    if (canonicalKey === 'F8') {
      if (!this.controller.navigateDiagnostic(key.shift === true ? -1 : 1)) return route('editor');
      this.#syncAssistance();
      this.#finishSelectionChange(true);
      return route('editor');
    }
    if (!key.ctrl && !key.alt && this.#editingActions.routeEditingKey(canonicalKey, key.shift === true))
      return route('text');
    if (key.text !== undefined && !key.ctrl && !key.alt) {
      if (this.insertText(key.text)) this.controller.triggerAssistance(key.text);
      return route('text');
    }
    return Object.freeze({ handled: false, owner: 'unhandled' });
  }

  /** Snapshots a preset or resolver result for presentation-only changes. */
  public setTheme(theme: CodeEditorTheme | ResolvedCodeEditorTheme): void {
    this.#themeState.setTheme(theme);
    this.invalidate();
  }

  /** Selects a live source resolved from the active application theme on every coalesced repaint. */
  public setThemeSource(source: CodeEditorThemeSource): void {
    this.#themeState.setSource(source);
    this.invalidate();
  }

  /** Returns immutable content-free evidence for the active or retained palette. */
  public get themeInspection(): CodeEditorThemeResolutionReport {
    return this.#themeState.inspection;
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
      height: this.#viewport.metrics.height,
      theme: this.#themeState.theme,
      themeName: this.#themeState.fingerprint,
      scrollX: this.scroll.x(),
      scrollY: this.scroll.y(),
      syntax: this.controller.languageResult?.syntax,
      diagnostics: this.controller.diagnostics,
      snippet: this.controller.snippets,
      search: this.#search.matches,
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
    this.#positionAssistance();
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
    this.#snippet = undefined;
    this.#modal = undefined;
    this.assistanceView.dismiss();
    this.#search.dispose();
    this.#pending.clear();
    this.#locallyHandledRevisions.clear();
    this.#controllerSubscription.dispose();
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
      completionItems: this.controller.presentation.assistance.completion?.items.length ?? 0,
      popupRows: this.assistanceView.items.length,
      snippetPlaceholders: this.#snippet?.length ?? 0,
      pendingHostEffects: this.#pending.size,
    });
  }

  /** Paints sanitized, semantically styled cells through JSVision. */
  public override draw(context: DrawContext): void {
    this.#themeState.resolveApplication(
      {
        editorNormal: context.role('editorNormal'),
        editorSelected: context.role('editorSelected'),
        statusBar: context.role('statusBar'),
      },
      context.caps,
    );
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
    const search = projectCodeEditorSearchPresentation(this.#search.state, this.i18n, context.size.width);
    const searchStyle = context.color('statusBar');
    for (let index = 0; index < search.rows.length; index += 1) {
      const y = context.size.height - search.rowCount + index;
      if (y < 0 || y >= context.size.height) continue;
      context.fillRect(0, y, context.size.width, 1, ' ', searchStyle);
      context.text(0, y, search.rows[index] ?? '', searchStyle);
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
    const layoutHeight = this.layout.rect?.height ?? this.#viewport.metrics.height;
    if (
      this.#search.state.open &&
      event.event.type === 'mouse' &&
      event.event.kind === 'down' &&
      event.local !== undefined &&
      event.local.y >= this.#viewport.metrics.height &&
      event.local.y < layoutHeight
    ) {
      event.handled = true;
      return;
    }
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

  #applyEdits(edits: readonly DocumentEditInput[], selection: DocumentSelectionInput): boolean {
    const accepted = this.controller.applyDocumentEdits(edits, selection);
    if (accepted) {
      this.#finishMutation(true);
      this.#locallyHandledRevisions.add(Number(this.controller.document.identity.revision));
    }
    return accepted;
  }

  #applySearchEdits(edits: readonly DocumentEditInput[], selection: DocumentSelectionInput): boolean {
    const accepted = this.controller.applyMutation({ edits, selection, origin: 'search' }).accepted;
    if (accepted) {
      this.#finishMutation(true);
      this.#locallyHandledRevisions.add(Number(this.controller.document.identity.revision));
    }
    return accepted;
  }

  #handleControllerEvent(event: CodeEditorControllerEvent): void {
    if (this.#disposed) return;
    this.#syncAssistance();
    if (event.kind === 'document') {
      if (this.#locallyHandledRevisions.delete(Number(event.mutation.after.revision))) return;
      this.#record('edit');
      this.#viewport.synchronize(true);
      this.#touchInteraction();
      this.invalidateLayout();
      try {
        this.#onDocumentChange?.();
      } catch {
        this.controller.degradation.fail('parser');
      }
      return;
    }
    const selectionHead = Number(this.controller.document.selection.head);
    if (selectionHead !== this.#lastSelectionHead) {
      this.#lastSelectionHead = selectionHead;
      this.#viewport.synchronize(true);
      this.invalidateLayout();
    } else {
      this.invalidate();
    }
    this.#touchInteraction();
  }

  #syncAssistance(): void {
    const completion = this.controller.presentation.assistance.completion;
    if (completion !== undefined) {
      if (this.#assistanceSource !== completion.items) {
        this.#assistanceSource = completion.items;
        this.assistanceView.show(completion.items.map((item) => item.label));
      }
      this.assistanceView.selected = completion.selected;
      this.#positionAssistance();
      return;
    }
    const overlay = this.controller.presentation.assistance.overlay;
    if (overlay === undefined) {
      if (this.#assistanceSource !== undefined) {
        this.#assistanceSource = undefined;
        this.assistanceView.dismiss();
      }
      return;
    }
    if (this.#assistanceSource !== overlay.items) {
      this.#assistanceSource = overlay.items;
      this.assistanceView.show(
        overlay.diagnostic === undefined
          ? overlay.items
          : formatCodeEditorDiagnosticOverlay(overlay, this.i18n, this.controller.limits.popupWidth),
      );
    }
    this.assistanceView.selected = overlay.selected;
    this.#positionAssistance();
  }

  /** Anchors visible assistance to the latest projection and viewport dimensions. */
  #positionAssistance(): void {
    if (this.#lastFrame === undefined) return;
    this.assistanceView.placeAtCaret(this.#lastFrame.caret, this.#viewport.metrics);
  }

  #finishMutation(accepted: boolean): void {
    if (!accepted) return;
    this.#lastSelectionHead = Number(this.controller.document.selection.head);
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

  #finishSelectionChange(preserveAssistance = false, preserveSearchSelection = false): void {
    if (!preserveSearchSelection) this.#search.selectionChanged();
    if (!preserveAssistance) {
      this.controller.caretChanged();
      this.#syncAssistance();
    }
    this.#lastSelectionHead = Number(this.controller.document.selection.head);
    this.#viewport.synchronize(true);
    this.#touchInteraction();
    this.invalidate();
  }

  #touchInteraction(): void {
    this.#interactionRevision.set((this.#interactionRevision() + 1) % Number.MAX_SAFE_INTEGER);
  }

  #queueHost(kind: 'navigate' | 'save' | 'close'): void {
    if (this.#pending.has(kind)) return;
    const pending = this.#hostQueue
      .then(() => this.controller.hostAction(kind))
      .then((accepted) => {
        if (kind === 'close' && accepted) this.focusState = 'released';
      })
      .catch(() => undefined)
      .finally(() => this.#pending.delete(kind));
    this.#hostQueue = pending.then(
      () => undefined,
      () => undefined,
    );
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
