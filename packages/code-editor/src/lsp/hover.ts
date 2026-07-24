import { boundedArray, recordValue, renderSafeMarkdown, sanitizeProtocolText } from './validation.js';

/** Creates a bounded hover presentation from plaintext or safe Markdown. */
export function presentHover(
  value: unknown,
  maximum: number,
  viewport?: { readonly width: number; readonly height: number },
): { readonly text: string; readonly clipped: boolean; readonly resourcesActive: false } | undefined {
  const record = recordValue(value);
  const contents = record?.contents;
  const contentRecord = recordValue(contents);
  const raw = typeof contents === 'string' ? contents : contentRecord?.value;
  if (typeof raw !== 'string') return undefined;
  const rendered =
    contentRecord?.kind === 'markdown'
      ? renderSafeMarkdown(raw, maximum)
      : { text: sanitizeProtocolText(raw, maximum + 1) ?? '', clipped: raw.length > maximum };
  const viewportLimit =
    viewport === undefined
      ? maximum
      : Math.max(1, Math.min(maximum, Math.max(1, viewport.width) * Math.max(1, viewport.height)));
  return Object.freeze({
    text: rendered.text.slice(0, viewportLimit),
    clipped: rendered.clipped || rendered.text.length > viewportLimit,
    resourcesActive: false,
  });
}

/** Creates terminal-safe signature lines with a non-color active parameter marker. */
export function presentSignature(value: unknown, maximum: number): readonly string[] | undefined {
  const record = recordValue(value);
  const signatureIndex = typeof record?.activeSignature === 'number' ? record.activeSignature : 0;
  const signature = recordValue(boundedArray(record?.signatures, 32)[signatureIndex]);
  const label = sanitizeProtocolText(signature?.label, maximum);
  if (label === undefined) return undefined;
  const activeParameter = typeof record?.activeParameter === 'number' ? record.activeParameter : 0;
  const parameter = recordValue(boundedArray(signature?.parameters, 64)[activeParameter]);
  const parameterLabel = sanitizeProtocolText(parameter?.label, maximum);
  return Object.freeze(parameterLabel === undefined ? [label] : [label, `▶ ${parameterLabel}`]);
}
