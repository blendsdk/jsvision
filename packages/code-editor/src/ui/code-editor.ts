import type { CapabilityProfile } from '@jsvision/core';
import { Group, signal, type DispatchEvent, type DrawContext, type Point, type Signal } from '@jsvision/ui';
import type { CodeEditorController } from '../controller.js';
import { offsetToPosition } from '../document/positions.js';
import { classicCodeEditorTheme } from '../theme/presets.js';
import { snapshotCodeEditorTheme } from '../theme/resolve.js';
import type { CodeEditorTheme, ResolvedCodeEditorTheme } from '../theme/theme.js';
import { CodeEditorAssistanceView, type CodeEditorCompletionItem, type CodeEditorModalState } from './assistance.js';
import {
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
  public readonly behavior = Object.freeze({ documentTransactions: true, keyboardOnly: true });
  public readonly chrome = Object.freeze({ horizontalScrollBar: false, verticalScrollBar: false, statusLine: false });
  public readonly journey: string[] = [];
  public readonly assistanceView = new CodeEditorAssistanceView();
  public readonly scroll: { readonly x: Signal<number>; readonly y: Signal<number> };
  public focusState: 'idle' | 'focused' | 'released' = 'idle';
  readonly #bindings: Readonly<Record<string, CodeEditorCommand>>;
  readonly #pending = new Map<'navigate' | 'save' | 'close', Promise<unknown>>();
  #theme: CodeEditorTheme = classicCodeEditorTheme;
  #themeFingerprint = fingerprint(classicCodeEditorTheme);
  #lastFrame: CodeEditorFrame | undefined;
  #modal: CodeEditorModalState | undefined;
  #completion: readonly CodeEditorCompletionItem[] | undefined;
  #snippet: readonly { readonly from: number; readonly to: number }[] | undefined;
  #snippetIndex = 0;
  #searchQuery = '';

  public constructor(options: CodeEditorOptions) {
    super();
    this.controller = options.controller;
    this.scroll = { x: signal(0), y: signal(0) };
    this.#bindings = Object.freeze({ ...defaultCodeEditorKeyBindings, ...options.keyBindings });
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
    if (accepted) this.#record('edit');
    return accepted;
  }

  /** Opens a validated completion list without changing the document selection. */
  public openCompletion(items: readonly CodeEditorCompletionItem[]): void {
    const normalized: CodeEditorCompletionItem[] = [];
    try {
      if (!Array.isArray(items) || items.length > 100_000) return;
      for (let index = 0; index < Math.min(items.length, 512); index += 1) {
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
      for (let index = 0; index < Math.min(placeholders.length, 128); index += 1) {
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
    if (key.key === 'Escape' && this.#modal !== undefined) {
      this.#modal = undefined;
      return route('dismissal');
    }
    if (key.key === 'Escape' && this.#completion !== undefined) {
      this.#completion = undefined;
      this.assistanceView.dismiss();
      return route('dismissal');
    }
    if (key.key === 'Enter' && this.#completion !== undefined) {
      const item = this.#completion[0];
      this.#completion = undefined;
      this.assistanceView.dismiss();
      if (item !== undefined) this.#acceptCompletion(item);
      return route('completion');
    }
    if (key.key === 'Tab' && this.#snippet !== undefined) {
      this.#snippetIndex += 1;
      const target = this.#snippet[this.#snippetIndex];
      if (target === undefined) this.#snippet = undefined;
      else this.controller.document.setSelection({ anchor: target.from, head: target.to });
      return route('snippet');
    }
    const command = this.#bindings[codeEditorKeyToken(key)];
    if (command !== undefined) {
      this.execute(command);
      return route('editor');
    }
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
    });
    return this.#lastFrame;
  }

  /** Resolves after all currently accepted host effects settle. */
  public async whenIdle(): Promise<void> {
    await Promise.all([...this.#pending.values()]);
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
