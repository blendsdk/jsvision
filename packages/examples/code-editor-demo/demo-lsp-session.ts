import type { CodeEditorLspCapabilities, CodeEditorLspSession, CodeEditorLspSessionState } from '@jsvision/code-editor';

type ResponseListener = (result: unknown, error?: Error) => void;
type DiagnosticListener = (
  uri: string,
  version: number | undefined,
  diagnostics: unknown,
  metadata: { readonly generation: number },
) => void;
type StateListener = (state: CodeEditorLspSessionState, generation: number) => void;

/** Content-free snapshot of the bounded deterministic demo transport. */
export interface DemoLspSessionInspection {
  readonly pendingRequests: number;
  readonly recentMethods: readonly string[];
}

/**
 * Small self-answering language-service transport for the interactive showcase.
 *
 * It deliberately retains method names only. Request parameters may contain source code, so they
 * are consumed synchronously and never stored. Fixed responses keep every menu action responsive
 * without timers, processes, network access, or an ever-growing protocol transcript.
 */
export class DemoLspSession implements CodeEditorLspSession {
  /** Stable transport contract version understood by the editor coordinator. */
  public readonly contractVersion = 1 as const;
  /** Guarantees that notifications are accepted before their promise is returned. */
  public readonly notificationOrdering = 'synchronous-enqueue' as const;
  /** Immutable capabilities exercised by the standalone language-intelligence scenario. */
  public readonly capabilities: Readonly<CodeEditorLspCapabilities> = Object.freeze({
    completion: true,
    hover: true,
    signatureHelp: true,
    diagnostics: true,
    definition: true,
    documentSymbols: true,
    documentFormatting: true,
    rangeFormatting: true,
    completionTriggers: Object.freeze(['.']),
    signatureTriggers: Object.freeze(['(']),
  });
  /** Current bounded transport lifecycle state. */
  public state: CodeEditorLspSessionState = 'ready';
  /** Monotonic reconnection generation used to reject stale protocol work. */
  public generation = 1;

  readonly #responses = new Map<number, ResponseListener>();
  readonly #diagnosticListeners = new Set<DiagnosticListener>();
  readonly #stateListeners = new Set<StateListener>();
  readonly #recentMethods: string[] = [];
  #nextRequestId = 1;

  /** Reserves one monotonically increasing request identifier. */
  public reserveRequestId(): number {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return id;
  }

  /** Accepts one request and resolves it on the next microtask with a fixed bounded result. */
  public request(
    id: number,
    method: string,
    _params: Readonly<Record<string, unknown>>,
    listener: ResponseListener,
  ): void {
    if (this.state === 'closed') {
      listener(undefined, new Error('The demo language service is closed.'));
      return;
    }
    if (this.#responses.size >= 16) {
      listener(undefined, new Error('The demo language service request limit was reached.'));
      return;
    }
    this.#recordMethod(method);
    this.#responses.set(id, listener);
    queueMicrotask(() => {
      const pending = this.#responses.get(id);
      if (pending === undefined || this.state === 'closed') return;
      this.#responses.delete(id);
      try {
        pending(responseFor(method));
      } catch {
        // Host callbacks are isolated so one faulty consumer cannot escape the demo event loop.
      }
    });
  }

  /** Accepts an ordered notification without retaining its potentially content-bearing payload. */
  public async notify(method: string, _params: Readonly<Record<string, unknown>>): Promise<void> {
    if (this.state !== 'closed') this.#recordMethod(method);
  }

  /** Cancels one pending response before its scheduled microtask runs. */
  public cancel(id: number): void {
    this.#responses.delete(id);
  }

  /** Subscribes to deterministic diagnostic publications. */
  public subscribeDiagnostics(listener: DiagnosticListener): () => void {
    this.#diagnosticListeners.add(listener);
    return () => this.#diagnosticListeners.delete(listener);
  }

  /** Subscribes to reconnection and readiness transitions. */
  public subscribeState(listener: StateListener): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  /** Marks the session ready after a coordinator resynchronizes. */
  public markReady(): void {
    if (this.state === 'closed') return;
    this.state = 'ready';
    this.#publishState();
  }

  /** Publishes one fixed diagnostic without retaining the supplied document URI. */
  public publishDiagnostic(uri: string, version: number | undefined): void {
    if (this.state === 'closed') return;
    const diagnostics = Object.freeze([
      Object.freeze({
        range: Object.freeze({
          start: Object.freeze({ line: 0, character: 0 }),
          end: Object.freeze({ line: 0, character: 5 }),
        }),
        message: 'Simulated live diagnostic',
        severity: 2,
      }),
    ]);
    for (const listener of this.#diagnosticListeners) {
      try {
        listener(uri, version, diagnostics, { generation: this.generation });
      } catch {
        // Subscribers are independent; one failure must not suppress later listeners.
      }
    }
  }

  /** Simulates one bounded reconnect so recovery can be exercised from the action menu. */
  public reconnect(): void {
    if (this.state === 'closed') return;
    this.generation += 1;
    this.state = 'connecting';
    this.#publishState();
    this.state = 'ready';
    this.#publishState();
  }

  /** Returns a detached, content-free view of current transport activity. */
  public inspect(): DemoLspSessionInspection {
    return Object.freeze({
      pendingRequests: this.#responses.size,
      recentMethods: Object.freeze([...this.#recentMethods]),
    });
  }

  /** Releases pending operations and listeners when a scenario is replaced. */
  public dispose(): void {
    if (this.state === 'closed') return;
    this.state = 'closed';
    const responses = [...this.#responses.values()];
    const stateListeners = [...this.#stateListeners];
    this.#responses.clear();
    this.#diagnosticListeners.clear();
    this.#stateListeners.clear();
    this.#recentMethods.splice(0);
    for (const listener of stateListeners) {
      try {
        listener(this.state, this.generation);
      } catch {
        // Retention is already cleared; one state observer cannot interrupt remaining cleanup.
      }
    }
    for (const listener of responses) {
      try {
        listener(undefined, new Error('The demo language service was disposed.'));
      } catch {
        // Retention is already cleared; throwing callbacks cannot interrupt remaining cleanup.
      }
    }
  }

  #recordMethod(method: string): void {
    const safeMethod = supportedMethods.has(method) ? method : 'unsupported';
    if (this.#recentMethods.length >= 32) this.#recentMethods.shift();
    this.#recentMethods.push(safeMethod);
  }

  #publishState(): void {
    for (const listener of this.#stateListeners) {
      try {
        listener(this.state, this.generation);
      } catch {
        // State observers cannot prevent other subscribers or lifecycle cleanup.
      }
    }
  }
}

const supportedMethods = new Set([
  'textDocument/didOpen',
  'textDocument/didChange',
  'textDocument/didClose',
  'textDocument/completion',
  'textDocument/hover',
  'textDocument/signatureHelp',
  'textDocument/definition',
  'textDocument/documentSymbol',
  'textDocument/formatting',
  'textDocument/rangeFormatting',
]);

/** Creates a response compatible with the editor's validating LSP presentation boundary. */
function responseFor(method: string): unknown {
  if (method === 'textDocument/completion') {
    return Object.freeze([Object.freeze({ label: 'greet', insertText: 'greet(name)' })]);
  }
  if (method === 'textDocument/hover') return Object.freeze({ contents: 'Simulated hover information' });
  if (method === 'textDocument/signatureHelp') {
    return Object.freeze({
      signatures: Object.freeze([
        Object.freeze({
          label: 'greet(name: string): string',
          parameters: Object.freeze([Object.freeze({ label: 'name: string' })]),
        }),
      ]),
      activeSignature: 0,
      activeParameter: 0,
    });
  }
  if (method === 'textDocument/definition') {
    return Object.freeze({
      uri: 'file:///code-editor-demo/external-target.ts',
      range: Object.freeze({
        start: Object.freeze({ line: 2, character: 0 }),
        end: Object.freeze({ line: 2, character: 1 }),
      }),
    });
  }
  if (method === 'textDocument/documentSymbol') {
    return Object.freeze([
      Object.freeze({
        name: 'message',
        kind: 13,
        range: Object.freeze({
          start: Object.freeze({ line: 0, character: 0 }),
          end: Object.freeze({ line: 0, character: 5 }),
        }),
        selectionRange: Object.freeze({
          start: Object.freeze({ line: 0, character: 0 }),
          end: Object.freeze({ line: 0, character: 5 }),
        }),
      }),
    ]);
  }
  if (method === 'textDocument/formatting' || method === 'textDocument/rangeFormatting') {
    return Object.freeze([
      Object.freeze({
        range: Object.freeze({
          start: Object.freeze({ line: 0, character: 0 }),
          end: Object.freeze({ line: 1, character: 0 }),
        }),
        newText: 'const message = greet(\"formatted\");\n',
      }),
    ]);
  }
  return null;
}
