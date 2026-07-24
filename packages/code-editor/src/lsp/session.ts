import type { CodeEditorLspCapabilities, LspRecordedNotification, LspRecordedRequest } from './types.js';

/** Transport-neutral session lifecycle state. */
export type CodeEditorLspSessionState = 'connecting' | 'ready' | 'degraded' | 'closed';
type ResponseListener = (result: unknown, error?: Error) => void;
type DiagnosticListener = (
  uri: string,
  version: number | undefined,
  diagnostics: unknown,
  metadata: { readonly generation: number },
) => void;
type StateListener = (state: CodeEditorLspSessionState, generation: number) => void;

/** Minimal editor-owned LSP session contract implemented by hosts and runtime adapters. */
export interface CodeEditorLspSession {
  readonly contractVersion: 1;
  readonly capabilities: Readonly<CodeEditorLspCapabilities>;
  readonly state: CodeEditorLspSessionState;
  readonly generation: number;
  reserveRequestId(): number;
  request(id: number, method: string, params: Readonly<Record<string, unknown>>, listener: ResponseListener): void;
  notify(method: string, params: Readonly<Record<string, unknown>>): Promise<void>;
  cancel(id: number): void;
  subscribeDiagnostics(listener: DiagnosticListener): () => void;
  subscribeState(listener: StateListener): () => void;
  markReady(): void;
}

/** Options for the deterministic protocol-faithful in-process session. */
export interface CreateInProcessLspSessionOptions {
  readonly capabilities?: CodeEditorLspCapabilities;
}

/**
 * Deterministic transport-neutral session used by hosts and tests.
 *
 * @example
 * ```ts
 * const session = createInProcessLspSession({ capabilities: { hover: true } });
 * ```
 */
export class InProcessLspSession {
  public readonly contractVersion = 1 as const;
  public capabilities: Readonly<CodeEditorLspCapabilities>;
  public readonly requests: LspRecordedRequest[] = [];
  public readonly notifications: LspRecordedNotification[] = [];
  public state: CodeEditorLspSessionState = 'ready';
  public generation = 1;
  #nextRequestId = 1;
  readonly #responses = new Map<number, ResponseListener>();
  readonly #diagnosticListeners = new Set<DiagnosticListener>();
  readonly #stateListeners = new Set<StateListener>();

  public constructor(options: CreateInProcessLspSessionOptions) {
    this.capabilities = Object.freeze({ ...options.capabilities });
  }

  /** Reserves an identifier before a request is allowed through a resynchronization gate. */
  public reserveRequestId(): number {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return id;
  }

  /** Records and activates a previously reserved request. */
  public request(
    id: number,
    method: string,
    params: Readonly<Record<string, unknown>>,
    listener: ResponseListener,
  ): void {
    if (this.state === 'closed') {
      listener(undefined, new Error('Session is closed.'));
      return;
    }
    this.requests.push(Object.freeze({ id, method, params: Object.freeze({ ...params }) }));
    this.#responses.set(id, listener);
  }

  /** Records an ordered notification. */
  public async notify(method: string, params: Readonly<Record<string, unknown>>): Promise<void> {
    if (this.state !== 'closed') {
      this.notifications.push(Object.freeze({ method, params: Object.freeze({ ...params }) }));
    }
  }

  /** Cancels one pending request without relying on transport support for correctness. */
  public cancel(id: number): void {
    this.#responses.delete(id);
  }

  /** Delivers a test response to the matching pending request. */
  public respond(id: number | undefined, result: unknown): void {
    if (id === undefined) return;
    const listener = this.#responses.get(id);
    if (listener === undefined) return;
    this.#responses.delete(id);
    listener(result);
  }

  /** Fails a matching pending operation. */
  public fail(id: number | undefined, error: Error): void {
    if (id === undefined) return;
    const listener = this.#responses.get(id);
    if (listener === undefined) return;
    this.#responses.delete(id);
    listener(undefined, error);
  }

  /** Produces the same operation-local failure as an interactive timeout. */
  public timeout(id: number | undefined): void {
    this.fail(id, new Error('LSP request timed out.'));
  }

  /** Publishes diagnostics to subscribed coordinators. */
  public publishDiagnostics(
    uri: string,
    version: number | undefined,
    diagnostics: unknown,
    metadata: { readonly generation: number } = { generation: this.generation },
  ): void {
    for (const listener of this.#diagnosticListeners) listener(uri, version, diagnostics, metadata);
  }

  /** Advances the session generation and requires coordinators to resynchronize. */
  public reconnect(): void {
    this.generation += 1;
    this.state = 'connecting';
    for (const listener of this.#stateListeners) listener(this.state, this.generation);
    // The in-process transport reconnects immediately; coordinators still retain their
    // document-synchronization gate until didClose/didOpen completes.
    this.state = 'ready';
  }

  /** Replaces negotiated capabilities after a dynamic registration change. */
  public updateCapabilities(capabilities: CodeEditorLspCapabilities): void {
    this.capabilities = Object.freeze({ ...capabilities });
  }

  /** Accepts an untrusted envelope without throwing or executing its content. */
  public deliverEnvelope(_envelope: unknown): void {
    // Real transports validate envelopes before dispatch. This fixture deliberately treats
    // unsolicited or malformed values as inert.
  }

  /** Subscribes to server-published diagnostics. */
  public subscribeDiagnostics(listener: DiagnosticListener): () => void {
    this.#diagnosticListeners.add(listener);
    return () => this.#diagnosticListeners.delete(listener);
  }

  /** Subscribes to connection-generation changes. */
  public subscribeState(listener: StateListener): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  /** Marks a successful resynchronization ready. */
  public markReady(): void {
    this.state = 'ready';
    for (const listener of this.#stateListeners) listener(this.state, this.generation);
  }
}

/**
 * Creates a deterministic in-process LSP session.
 *
 * @example
 * ```ts
 * const session = createInProcessLspSession({ capabilities: { completion: true } });
 * ```
 */
export function createInProcessLspSession(options: CreateInProcessLspSessionOptions = {}): InProcessLspSession {
  return new InProcessLspSession(options);
}
