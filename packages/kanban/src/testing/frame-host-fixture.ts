import { serialize } from '@jsvision/core';
import type { CapabilityProfile, ScreenBuffer } from '@jsvision/core';

/** Exact changed-cell, contiguous-run, and encoded-byte evidence for one terminal diff. */
export interface KanbanFrameDiffSnapshot {
  /** Cells whose complete rendered value changed. */
  readonly changedCells: number;
  /** Contiguous changed runs across terminal rows. */
  readonly changedRuns: number;
  /** UTF-8 bytes emitted by the real Core serializer. */
  readonly utf8Bytes: number;
}

/** Correlated RenderRoot and stateful fake-host diff evidence for one fixture operation. */
export interface KanbanFrameHostSnapshot {
  /** Caller-owned payload-free operation identity. */
  readonly operationId: string;
  /** Diff from the caller's real before/after RenderRoot buffers. */
  readonly renderRoot: KanbanFrameDiffSnapshot;
  /** Independent diff produced by the stateful in-memory host sink. */
  readonly host: KanbanFrameDiffSnapshot;
}

/** Stateful in-memory host that serializes every accepted frame against its own prior buffer. */
export interface KanbanFrameHostFixture {
  /** Captures one real before/after RenderRoot pair and advances the independent host buffer. */
  readonly capture: (operationId: string, before: ScreenBuffer, after: ScreenBuffer) => KanbanFrameHostSnapshot;
  /** Releases the retained host buffer; later capture calls fail closed. */
  readonly dispose: () => void;
}

/** Returns complete cell equality without retaining application-facing text separately. */
function sameCell(before: ScreenBuffer, after: ScreenBuffer, x: number, y: number): boolean {
  const left = before.get(x, y);
  const right = after.get(x, y);
  return (
    left !== undefined &&
    right !== undefined &&
    left.char === right.char &&
    left.fg === right.fg &&
    left.bg === right.bg &&
    left.attrs === right.attrs &&
    left.width === right.width
  );
}

/** Measures real buffer changes and the bytes produced by Core serialization. */
function diff(before: ScreenBuffer, after: ScreenBuffer, caps: CapabilityProfile): KanbanFrameDiffSnapshot {
  if (before.width !== after.width || before.height !== after.height) throw new RangeError('Frame sizes must match.');
  let changedCells = 0;
  let changedRuns = 0;
  for (let y = 0; y < after.height; y += 1) {
    let inRun = false;
    for (let x = 0; x < after.width; x += 1) {
      const changed = !sameCell(before, after, x, y);
      if (changed) {
        changedCells += 1;
        if (!inRun) changedRuns += 1;
      }
      inRun = changed;
    }
  }
  const output = serialize(after, before, { caps });
  return Object.freeze({
    changedCells,
    changedRuns,
    utf8Bytes: new TextEncoder().encode(output).byteLength,
  });
}

/**
 * Creates a deterministic second host-diff sink over real terminal buffers and Core serialization.
 *
 * @example
 * ```ts
 * const host = createKanbanFrameHostFixture(caps);
 * const evidence = host.capture('wheel-1', beforeBuffer, afterBuffer);
 * host.dispose();
 * ```
 */
export function createKanbanFrameHostFixture(caps: CapabilityProfile): KanbanFrameHostFixture {
  let hostBuffer: ScreenBuffer | undefined;
  let disposed = false;
  return Object.freeze({
    capture: (operationId: string, before: ScreenBuffer, after: ScreenBuffer) => {
      if (disposed || !/^[a-z0-9][a-z0-9._:-]{0,127}$/u.test(operationId)) {
        throw new RangeError('Invalid frame-host operation.');
      }
      const hostBefore = hostBuffer ?? before;
      const snapshot = Object.freeze({
        operationId,
        renderRoot: diff(before, after, caps),
        host: diff(hostBefore, after, caps),
      });
      hostBuffer = after.clone();
      return snapshot;
    },
    dispose: () => {
      disposed = true;
      hostBuffer = undefined;
    },
  });
}
