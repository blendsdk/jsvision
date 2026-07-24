import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { isAbsolute, normalize } from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';

import {
  CancellationTokenSource,
  createMessageConnection,
  type MessageConnection,
  NullLogger,
} from 'vscode-jsonrpc/node';

import type { CodeEditorLspSession, CodeEditorLspSessionState } from '../lsp/session.js';
import type { CodeEditorLspCapabilities } from '../lsp/types.js';
import { recordValue, sanitizeProtocolText } from '../lsp/validation.js';

type ResponseListener = (result: unknown, error?: Error) => void;
type DiagnosticListener = (
  uri: string,
  version: number | undefined,
  diagnostics: unknown,
  metadata: { readonly generation: number },
) => void;
type StateListener = (state: CodeEditorLspSessionState, generation: number) => void;

/** Host-authorized process configuration for the optional Node LSP adapter. */
export interface CodeEditorNodeSessionOptions {
  readonly executable: string;
  readonly arguments?: readonly string[];
  readonly cwd?: string;
  readonly stderrLimit?: number;
  readonly onStderr?: (safeText: string) => void;
  readonly messageByteLimit?: number;
  readonly lifecycleTimeoutMs?: number;
}

/**
 * Node-only stdio/JSON-RPC session adapter.
 *
 * It never invokes a shell and accepts only absolute executable and working-directory paths.
 *
 * @example
 * ```ts
 * const session = createCodeEditorNodeSession({
 *   executable: '/usr/bin/typescript-language-server',
 *   arguments: ['--stdio'],
 * });
 * await session.start();
 * ```
 */
export class CodeEditorNodeSession implements CodeEditorLspSession {
  public readonly contractVersion = 1 as const;
  public generation = 1;
  public state: CodeEditorLspSessionState = 'connecting';
  public capabilities: Readonly<CodeEditorLspCapabilities> = Object.freeze({});
  readonly #options: Required<
    Pick<
      CodeEditorNodeSessionOptions,
      'executable' | 'arguments' | 'stderrLimit' | 'messageByteLimit' | 'lifecycleTimeoutMs'
    >
  > &
    Pick<CodeEditorNodeSessionOptions, 'cwd' | 'onStderr'>;
  readonly #diagnosticListeners = new Set<DiagnosticListener>();
  readonly #stateListeners = new Set<StateListener>();
  readonly #cancellations = new Map<number, CancellationTokenSource>();
  #nextRequestId = 1;
  #process: ChildProcessWithoutNullStreams | undefined;
  #connection: MessageConnection | undefined;
  #boundedInput: BoundedLspInput | undefined;
  #stderrCharacters = 0;

  public constructor(options: CodeEditorNodeSessionOptions) {
    this.#options = normalizeOptions(options);
  }

  /** Starts the authorized process and completes the standard LSP initialize handshake. */
  public async start(): Promise<void> {
    if (this.#process !== undefined) return;
    const child = spawn(this.#options.executable, this.#options.arguments, {
      cwd: this.#options.cwd,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.#process = child;
    const boundedInput = new BoundedLspInput(this.#options.messageByteLimit);
    this.#boundedInput = boundedInput;
    child.stdout.pipe(boundedInput);
    boundedInput.once('error', () => {
      this.#setState('degraded');
      if (!child.killed) child.kill('SIGTERM');
    });
    const connection = createMessageConnection(boundedInput, child.stdin, NullLogger);
    this.#connection = connection;
    connection.onNotification('textDocument/publishDiagnostics', (params: unknown) => {
      const record = recordValue(params);
      const uri = record?.uri;
      const version = record?.version;
      if (typeof uri !== 'string') return;
      const normalizedVersion =
        typeof version === 'number' && Number.isSafeInteger(version) && version >= 0 ? version : undefined;
      for (const listener of this.#diagnosticListeners) {
        listener(uri, normalizedVersion, record?.diagnostics, { generation: this.generation });
      }
    });
    connection.onRequest('client/registerCapability', (params: unknown) => {
      this.capabilities = updateDynamicCapabilities(this.capabilities, params, true);
      return null;
    });
    connection.onRequest('client/unregisterCapability', (params: unknown) => {
      this.capabilities = updateDynamicCapabilities(this.capabilities, params, false);
      return null;
    });
    connection.onClose(() => {
      this.#connection = undefined;
      this.#process = undefined;
      if (this.state !== 'closed') this.#setState('degraded');
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => this.#receiveStderr(chunk));
    child.once('error', () => this.#setState('degraded'));
    connection.listen();
    try {
      const earlyExit = new Promise<never>((_resolve, reject) => {
        child.once('exit', (code, signal) => {
          reject(new Error(`Language server exited during initialization (${code ?? signal ?? 'unknown'}).`));
        });
      });
      const result = await Promise.race([
        connection.sendRequest('initialize', {
          processId: process.pid,
          rootUri: null,
          capabilities: {},
        }),
        earlyExit,
        rejectAfter(this.#options.lifecycleTimeoutMs, 'Language server initialization timed out.'),
      ]);
      this.capabilities = Object.freeze(mapCapabilities(result));
      await connection.sendNotification('initialized', {});
      this.#setState('ready');
    } catch (error) {
      this.#setState('degraded');
      await this.#terminateProcess();
      throw error;
    }
  }

  /** Stops JSON-RPC and the child process without invoking a shell. */
  public async stop(): Promise<void> {
    if (this.state === 'closed') return;
    this.#setState('closed');
    const connection = this.#connection;
    this.#connection = undefined;
    for (const source of this.#cancellations.values()) source.cancel();
    this.#cancellations.clear();
    if (connection !== undefined) {
      try {
        await Promise.race([
          connection.sendRequest('shutdown'),
          rejectAfter(this.#options.lifecycleTimeoutMs, 'Language server shutdown timed out.'),
        ]);
        await connection.sendNotification('exit');
      } catch {
        // A failed server may no longer accept the shutdown handshake.
      }
      connection.dispose();
    }
    await this.#terminateProcess();
  }

  /** Reserves a coordinator-visible request identifier. */
  public reserveRequestId(): number {
    const id = this.#nextRequestId;
    this.#nextRequestId += 1;
    return id;
  }

  /** Sends a request through the official JSON-RPC connection. */
  public request(
    id: number,
    method: string,
    params: Readonly<Record<string, unknown>>,
    listener: ResponseListener,
  ): void {
    const connection = this.#connection;
    if (connection === undefined || this.state !== 'ready') {
      listener(undefined, new Error('Language server is not ready.'));
      return;
    }
    const cancellation = new CancellationTokenSource();
    this.#cancellations.set(id, cancellation);
    void connection.sendRequest(method, params, cancellation.token).then(
      (result: unknown) => {
        this.#cancellations.delete(id);
        listener(result);
      },
      (error: unknown) => {
        this.#cancellations.delete(id);
        listener(undefined, error instanceof Error ? error : new Error('Language server request failed.'));
      },
    );
  }

  /** Sends an ordered protocol notification. */
  public async notify(method: string, params: Readonly<Record<string, unknown>>): Promise<void> {
    if (this.#connection === undefined || this.state === 'closed' || this.state === 'degraded') return;
    await this.#connection.sendNotification(method, params);
  }

  /** Cancels one pending request through the JSON-RPC cancellation token. */
  public cancel(id: number): void {
    this.#cancellations.get(id)?.cancel();
    this.#cancellations.delete(id);
  }

  /** Subscribes to diagnostic publications. */
  public subscribeDiagnostics(listener: DiagnosticListener): () => void {
    this.#diagnosticListeners.add(listener);
    return () => this.#diagnosticListeners.delete(listener);
  }

  /** Subscribes to lifecycle changes. */
  public subscribeState(listener: StateListener): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  /** Marks the adapter ready after the coordinator has resynchronized its active document. */
  public markReady(): void {
    if (this.#connection !== undefined) this.#setState('ready');
  }

  #setState(state: CodeEditorLspSessionState): void {
    this.state = state;
    for (const listener of this.#stateListeners) listener(state, this.generation);
  }

  #receiveStderr(chunk: string): void {
    const remaining = this.#options.stderrLimit - this.#stderrCharacters;
    if (remaining <= 0) return;
    const safe = sanitizeProtocolText(chunk, remaining) ?? '';
    this.#stderrCharacters += safe.length;
    if (safe.length > 0) this.#options.onStderr?.(safe);
  }

  async #terminateProcess(): Promise<void> {
    this.#boundedInput?.destroy();
    this.#boundedInput = undefined;
    const child = this.#process;
    this.#process = undefined;
    if (child === undefined) {
      this.#setState('closed');
      return;
    }
    child.stdout.unpipe();
    child.stderr.removeAllListeners('data');
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    if (!(await waitForExit(child, this.#options.lifecycleTimeoutMs))) {
      child.kill('SIGKILL');
      await waitForExit(child, this.#options.lifecycleTimeoutMs);
    }
    this.#setState('closed');
  }
}

/** Creates an unstarted Node-only LSP process session. */
export function createCodeEditorNodeSession(options: CodeEditorNodeSessionOptions): CodeEditorNodeSession {
  return new CodeEditorNodeSession(options);
}

function normalizeOptions(
  options: CodeEditorNodeSessionOptions,
): Required<
  Pick<
    CodeEditorNodeSessionOptions,
    'executable' | 'arguments' | 'stderrLimit' | 'messageByteLimit' | 'lifecycleTimeoutMs'
  >
> &
  Pick<CodeEditorNodeSessionOptions, 'cwd' | 'onStderr'> {
  if (typeof options.executable !== 'string' || !isAbsolute(options.executable) || options.executable.includes('\0')) {
    throw new TypeError('Language-server executable must be an absolute path.');
  }
  const executable = normalize(options.executable);
  const argumentsValue = options.arguments ?? [];
  if (
    !Array.isArray(argumentsValue) ||
    argumentsValue.length > 128 ||
    argumentsValue.some((value) => typeof value !== 'string' || value.length > 4096 || value.includes('\0'))
  ) {
    throw new TypeError('Language-server arguments are invalid.');
  }
  if (options.cwd !== undefined && (!isAbsolute(options.cwd) || options.cwd.includes('\0'))) {
    throw new TypeError('Language-server working directory must be an absolute path.');
  }
  if (options.onStderr !== undefined && typeof options.onStderr !== 'function') {
    throw new TypeError('Language-server stderr handler must be a function.');
  }
  const stderrLimit = options.stderrLimit ?? 16_384;
  if (!Number.isSafeInteger(stderrLimit) || stderrLimit < 0 || stderrLimit > 65_536) {
    throw new RangeError('Language-server stderr limit is outside the supported range.');
  }
  const messageByteLimit = options.messageByteLimit ?? 4 * 1024 * 1024;
  if (!Number.isSafeInteger(messageByteLimit) || messageByteLimit < 1024 || messageByteLimit > 16 * 1024 * 1024) {
    throw new RangeError('Language-server message byte limit is outside the supported range.');
  }
  const lifecycleTimeoutMs = options.lifecycleTimeoutMs ?? 5_000;
  if (!Number.isSafeInteger(lifecycleTimeoutMs) || lifecycleTimeoutMs < 100 || lifecycleTimeoutMs > 60_000) {
    throw new RangeError('Language-server lifecycle timeout is outside the supported range.');
  }
  return Object.freeze({
    executable,
    arguments: Object.freeze([...argumentsValue]),
    stderrLimit,
    messageByteLimit,
    lifecycleTimeoutMs,
    ...(options.cwd === undefined ? {} : { cwd: normalize(options.cwd) }),
    ...(options.onStderr === undefined ? {} : { onStderr: options.onStderr }),
  });
}

class BoundedLspInput extends Transform {
  readonly #maximum: number;
  #buffer = Buffer.alloc(0);

  public constructor(maximum: number) {
    super();
    this.#maximum = maximum;
  }

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    try {
      if (chunk.length > this.#maximum + 8_192 || this.#buffer.length + chunk.length > this.#maximum + 8_192) {
        throw new RangeError('Language-server input chunk exceeds the pre-buffer byte limit.');
      }
      this.#buffer = Buffer.concat([this.#buffer, chunk]);
      while (this.#buffer.length > 0) {
        const headerEnd = this.#buffer.indexOf('\r\n\r\n');
        if (headerEnd < 0) {
          if (this.#buffer.length > 8_192) throw new RangeError('Language-server frame header is too large.');
          break;
        }
        const header = this.#buffer.subarray(0, headerEnd).toString('ascii');
        const match = /(?:^|\r\n)Content-Length: ([0-9]+)(?:\r\n|$)/iu.exec(header);
        if (match === null) throw new TypeError('Language-server frame has no valid Content-Length.');
        const length = Number(match[1]);
        if (!Number.isSafeInteger(length) || length < 0 || length > this.#maximum) {
          throw new RangeError('Language-server frame exceeds the configured byte limit.');
        }
        const frameLength = headerEnd + 4 + length;
        if (this.#buffer.length < frameLength) {
          if (this.#buffer.length > 8_192 + this.#maximum) {
            throw new RangeError('Language-server frame buffer exceeds its byte limit.');
          }
          break;
        }
        this.push(this.#buffer.subarray(0, frameLength));
        this.#buffer = this.#buffer.subarray(frameLength);
      }
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error('Language-server frame validation failed.'));
    }
  }
}

function rejectAfter(milliseconds: number, message: string): Promise<never> {
  return new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    timer.unref();
  });
}

function waitForExit(child: ChildProcessWithoutNullStreams, milliseconds: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, milliseconds);
    timer.unref();
    child.once('exit', onExit);
  });
}

function mapCapabilities(value: unknown): CodeEditorLspCapabilities {
  const result = recordValue(value);
  const capabilities = recordValue(result?.capabilities);
  return {
    completion: capabilities?.completionProvider !== undefined,
    hover: capabilities?.hoverProvider === true || recordValue(capabilities?.hoverProvider) !== undefined,
    signatureHelp: capabilities?.signatureHelpProvider !== undefined,
    diagnostics: true,
    definition:
      capabilities?.definitionProvider === true || recordValue(capabilities?.definitionProvider) !== undefined,
    documentSymbols:
      capabilities?.documentSymbolProvider === true || recordValue(capabilities?.documentSymbolProvider) !== undefined,
    documentFormatting: capabilities?.documentFormattingProvider === true,
    rangeFormatting: capabilities?.documentRangeFormattingProvider === true,
    textDocumentSync: capabilities?.textDocumentSync === 2 ? 'incremental' : 'full',
    completionTriggers: stringArray(recordValue(capabilities?.completionProvider)?.triggerCharacters),
    signatureTriggers: stringArray(recordValue(capabilities?.signatureHelpProvider)?.triggerCharacters),
  };
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.slice(0, 64).filter((item): item is string => typeof item === 'string' && item.length <= 8),
  );
}

function updateDynamicCapabilities(
  current: Readonly<CodeEditorLspCapabilities>,
  value: unknown,
  enabled: boolean,
): Readonly<CodeEditorLspCapabilities> {
  const record = recordValue(value);
  const entries = Array.isArray(record?.registrations)
    ? record.registrations
    : Array.isArray(record?.unregisterations)
      ? record.unregisterations
      : [];
  let updated: CodeEditorLspCapabilities = { ...current };
  for (const candidate of entries.slice(0, 64)) {
    const registration = recordValue(candidate);
    switch (registration?.method) {
      case 'textDocument/completion':
        updated = { ...updated, completion: enabled };
        break;
      case 'textDocument/hover':
        updated = { ...updated, hover: enabled };
        break;
      case 'textDocument/signatureHelp':
        updated = { ...updated, signatureHelp: enabled };
        break;
      case 'textDocument/definition':
        updated = { ...updated, definition: enabled };
        break;
      case 'textDocument/documentSymbol':
        updated = { ...updated, documentSymbols: enabled };
        break;
      case 'textDocument/formatting':
        updated = { ...updated, documentFormatting: enabled };
        break;
      case 'textDocument/rangeFormatting':
        updated = { ...updated, rangeFormatting: enabled };
        break;
    }
  }
  return Object.freeze(updated);
}
