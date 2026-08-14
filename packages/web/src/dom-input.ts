import type { InputEvent, KeyEvent, MouseEvent } from '@jsvision/core';

/** Browser surface operations needed by the pre-xterm input adapter. */
export interface BrowserDomInputSurface {
  /** Registers a capture listener before xterm translates the same DOM event. */
  addEventListener(type: string, listener: (event: unknown) => void, options?: boolean): void;
  /** Removes one previously registered capture listener. */
  removeEventListener(type: string, listener: (event: unknown) => void, options?: boolean): void;
  /** Returns the terminal surface rectangle in browser client coordinates. */
  getBoundingClientRect(): {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  /** Captures a pressed pointer so drag/up remain observable outside the surface. */
  setPointerCapture?(pointerId: number): void;
  /** Releases one previously captured pointer. */
  releasePointerCapture?(pointerId: number): void;
}

/** Options for one browser DOM input adapter. */
export interface BrowserDomInputAdapterOptions {
  /** Optional browser surface; omission selects documented terminal-input fallback. */
  readonly surface?: BrowserDomInputSurface;
  /** Current terminal cell geometry used for client-to-cell conversion. */
  readonly cells: () => { readonly columns: number; readonly rows: number };
  /** Browser platform label; `darwin`/`mac*` resolves semantic Primary to Command. */
  readonly platform: string;
  /** Sink for normalized Core input events emitted before xterm encoding. */
  readonly onInput: (event: InputEvent) => void;
}

/** Abortable browser input adapter and one-event terminal deduplication seam. */
export interface BrowserDomInputAdapter {
  /** Whether a DOM surface was available and listeners were installed. */
  readonly available: boolean;
  /** Returns false for the one matching SGR mouse event already emitted from DOM input. */
  readonly acceptTerminalInput: (event: InputEvent) => boolean;
  /** Removes listeners, capture bookkeeping, and pending dedupe state. */
  readonly dispose: () => void;
}

/** Minimal detached values read from one browser pointer event. */
interface PointerValues {
  readonly type: string;
  readonly pointerId: number;
  readonly button: number;
  readonly buttons: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
}

/** Reads one property without coercing its value. */
function property(value: object, key: string): unknown {
  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

/** Invokes preventDefault when the browser event supplies it. */
function preventDefault(value: object): void {
  const prevent = property(value, 'preventDefault');
  if (typeof prevent !== 'function') return;
  try {
    Reflect.apply(prevent, value, []);
  } catch {
    // A hostile or detached DOM event cannot prevent input cleanup.
  }
}

/** Returns finite pointer members without numeric coercion. */
function pointerValues(value: object): PointerValues | undefined {
  const type = property(value, 'type');
  const pointerId = property(value, 'pointerId');
  const button = property(value, 'button');
  const buttons = property(value, 'buttons');
  const clientX = property(value, 'clientX');
  const clientY = property(value, 'clientY');
  if (
    typeof type !== 'string' ||
    typeof pointerId !== 'number' ||
    !Number.isSafeInteger(pointerId) ||
    typeof button !== 'number' ||
    !Number.isSafeInteger(button) ||
    button < 0 ||
    button > 2 ||
    typeof buttons !== 'number' ||
    !Number.isSafeInteger(buttons) ||
    buttons < 0 ||
    typeof clientX !== 'number' ||
    !Number.isFinite(clientX) ||
    typeof clientY !== 'number' ||
    !Number.isFinite(clientY)
  ) {
    return undefined;
  }
  return Object.freeze({
    type,
    pointerId,
    button,
    buttons,
    clientX,
    clientY,
    ctrl: property(value, 'ctrlKey') === true,
    alt: property(value, 'altKey') === true,
    shift: property(value, 'shiftKey') === true,
    meta: property(value, 'metaKey') === true,
  });
}

/** Converts client coordinates to clamped one-based terminal cells. */
function terminalCell(
  surface: BrowserDomInputSurface,
  cells: BrowserDomInputAdapterOptions['cells'],
  event: PointerValues,
): { readonly x: number; readonly y: number } | undefined {
  try {
    const rect = surface.getBoundingClientRect();
    const size = cells();
    if (
      !Number.isFinite(rect.left) ||
      !Number.isFinite(rect.top) ||
      !Number.isFinite(rect.width) ||
      rect.width <= 0 ||
      !Number.isFinite(rect.height) ||
      rect.height <= 0 ||
      !Number.isSafeInteger(size.columns) ||
      size.columns <= 0 ||
      !Number.isSafeInteger(size.rows) ||
      size.rows <= 0
    ) {
      return undefined;
    }
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * size.columns) + 1;
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * size.rows) + 1;
    return Object.freeze({
      x: Math.max(1, Math.min(size.columns, x)),
      y: Math.max(1, Math.min(size.rows, y)),
    });
  } catch {
    return undefined;
  }
}

/** Reports whether one platform label exposes Command as semantic Primary. */
function commandIsPrimary(platform: string): boolean {
  const normalized = platform.toLocaleLowerCase('en-US');
  return normalized === 'darwin' || normalized.startsWith('mac');
}

/** Compares only identity and geometry encoded by both DOM and terminal SGR mouse paths. */
function matchingMouse(left: MouseEvent, right: MouseEvent): boolean {
  return left.kind === right.kind && left.button === right.button && left.x === right.x && left.y === right.y;
}

/**
 * Creates a pre-xterm keyboard/pointer adapter with safe terminal-input fallback.
 *
 * @example
 * ```ts
 * const adapter = createBrowserDomInputAdapter({
 *   surface: terminalElement,
 *   cells: () => ({ columns: 80, rows: 24 }),
 *   platform: 'darwin',
 *   onInput: (event) => loop.dispatch(event),
 * });
 * ```
 */
export function createBrowserDomInputAdapter(options: BrowserDomInputAdapterOptions): BrowserDomInputAdapter {
  const surface = options.surface;
  if (surface === undefined) {
    return Object.freeze({ available: false, acceptTerminalInput: () => true, dispose: () => undefined });
  }
  const activeButtons = new Map<number, number>();
  let duplicate: MouseEvent | undefined;
  let disposed = false;
  const primaryIsMeta = commandIsPrimary(options.platform);

  const keydown = (raw: unknown): void => {
    if (disposed || typeof raw !== 'object' || raw === null) return;
    if (property(raw, 'type') !== 'keydown' || property(raw, 'metaKey') !== true) return;
    const key = property(raw, 'key');
    if (typeof key !== 'string' || Array.from(key).length === 0) return;
    const event: KeyEvent = Object.freeze({
      type: 'key',
      key: key.toLocaleLowerCase('en-US'),
      ctrl: property(raw, 'ctrlKey') === true,
      alt: property(raw, 'altKey') === true,
      shift: property(raw, 'shiftKey') === true,
      meta: true,
      primary: primaryIsMeta,
    });
    preventDefault(raw);
    options.onInput(event);
  };
  const pointer = (raw: unknown): void => {
    if (disposed || typeof raw !== 'object' || raw === null) return;
    const values = pointerValues(raw);
    if (values === undefined) return;
    const cell = terminalCell(surface, options.cells, values);
    if (cell === undefined) return;
    const activeButton = activeButtons.get(values.pointerId) ?? values.button;
    const kind: MouseEvent['kind'] =
      values.type === 'pointerdown'
        ? 'down'
        : values.type === 'pointerup' || values.type === 'pointercancel'
          ? 'up'
          : values.buttons === 0
            ? 'move'
            : 'drag';
    const event: MouseEvent = Object.freeze({
      type: 'mouse',
      kind,
      button: activeButton,
      ...cell,
      ctrl: values.ctrl,
      alt: values.alt,
      shift: values.shift,
      meta: values.meta,
      primary: primaryIsMeta ? values.meta : values.ctrl,
    });
    if (kind === 'down') {
      activeButtons.set(values.pointerId, values.button);
      try {
        surface.setPointerCapture?.(values.pointerId);
      } catch {
        // Capture is an optional enhancement; document-level delivery may still continue.
      }
    } else if (kind === 'up') {
      activeButtons.delete(values.pointerId);
      try {
        surface.releasePointerCapture?.(values.pointerId);
      } catch {
        // Release failure cannot retain package bookkeeping.
      }
    }
    duplicate = event;
    preventDefault(raw);
    options.onInput(event);
  };
  surface.addEventListener('keydown', keydown, true);
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
    surface.addEventListener(type, pointer, true);
  }

  return Object.freeze({
    available: true,
    acceptTerminalInput(event: InputEvent): boolean {
      if (disposed || duplicate === undefined || event.type !== 'mouse') return true;
      if (!matchingMouse(duplicate, event)) return true;
      duplicate = undefined;
      return false;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      duplicate = undefined;
      activeButtons.clear();
      surface.removeEventListener('keydown', keydown, true);
      for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
        surface.removeEventListener(type, pointer, true);
      }
    },
  });
}
