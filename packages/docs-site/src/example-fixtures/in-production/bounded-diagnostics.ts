import {
  createLogger,
  dumpCaps,
  redactEvent,
  sanitize,
  type CapabilityResolution,
  type InputEvent,
  type LogRecord,
} from '@jsvision/core';

/** Allowlisted display categories that may appear in retained diagnostics. */
export type DiagnosticDisplayCategory = 'ready' | 'degraded' | 'failed';

/** Maximum number of records retained by the course diagnostic bundle. */
export const MAX_DIAGNOSTIC_RECORDS = 256;

/** Stable, non-user-authored labels for retained display categories. */
const DISPLAY_LABELS: Readonly<Record<DiagnosticDisplayCategory, string>> = {
  ready: 'Ready',
  degraded: 'Degraded',
  failed: 'Failed',
};

/** Inputs allowed into the bounded production diagnostic collector. */
export interface DiagnosticSample {
  readonly releaseId: string;
  readonly resolution: CapabilityResolution;
  readonly event: InputEvent;
  readonly displayCategory: DiagnosticDisplayCategory;
  readonly size: number;
}

/** Secret-free evidence suitable for a bounded support bundle. */
export interface DiagnosticBundle {
  readonly capabilityEvidence: string;
  readonly safeDisplayLabel: string;
  readonly entries: readonly LogRecord[];
}

/**
 * Build a bounded support bundle using only explicitly supplied, allowlisted data.
 *
 * Raw input is reduced through `redactEvent`; the retained display label comes
 * from a closed allowlist and is made inert through `sanitize`. Caller-authored
 * display text is never retained. The requested capacity is clamped to a
 * positive maximum so an external value cannot create unbounded evidence.
 */
export function collectBoundedDiagnostics(sample: DiagnosticSample): DiagnosticBundle {
  const size =
    Number.isFinite(sample.size) && sample.size > 0
      ? Math.min(Math.max(Math.trunc(sample.size), 1), MAX_DIAGNOSTIC_RECORDS)
      : 1;
  const logger = createLogger({ sink: 'ring', size: size });
  const capabilityEvidence = dumpCaps(sample.resolution);
  const safeDisplayLabel = sanitize(DISPLAY_LABELS[sample.displayCategory]);

  logger.info('release', 'diagnostic sample', { releaseId: sample.releaseId });
  logger.debug('input', 'event', redactEvent(sample.event));
  logger.info('capabilities', capabilityEvidence);
  const entries = logger.entries();
  logger.close();

  return { capabilityEvidence, safeDisplayLabel, entries };
}
