import { formatCodeEditorDiagnosticOverlay } from '@jsvision/code-editor';

/** Maximum source size used by docs-only Code Editor fixtures. */
export const MAX_DOCS_DOCUMENT_BYTES = 256_000;

/** Representative hostile protocol presentation kept as inert fixture data. */
export const HOSTILE_PROTOCOL_TEXT =
  'diagnostic\u0000\u001b[31m: unsafe\u202e range\u009b and bell\u0007\u001b]0;title\u0007' + 'x'.repeat(160);

const MAX_DOCS_DOCUMENT_LINES = 2_000;

/**
 * Build deterministic source without letting a documentation example allocate pathological input.
 *
 * @param lines Requested logical line count.
 * @returns Bounded TypeScript-like source.
 * @throws RangeError when the request exceeds the docs-only line or byte ceiling.
 */
export function createBoundedLargeDocument(lines: number): string {
  if (!Number.isSafeInteger(lines) || lines < 1 || lines > MAX_DOCS_DOCUMENT_LINES) {
    throw new RangeError(`Code Editor documentation fixtures are bounded to ${MAX_DOCS_DOCUMENT_LINES} lines.`);
  }
  const source = Array.from({ length: lines }, (_, index) => `const value${index + 1} = ${index + 1};`).join('\n');
  if (Buffer.byteLength(source, 'utf8') > MAX_DOCS_DOCUMENT_BYTES) {
    throw new RangeError(`Code Editor documentation fixtures are bounded to ${MAX_DOCS_DOCUMENT_BYTES} bytes.`);
  }
  return source;
}

/**
 * Project untrusted text through the SDK's real bounded diagnostic presentation boundary.
 *
 * @param text Untrusted diagnostic, completion, hover, or host-detail text.
 * @returns One inert row bounded to the example's 80-cell presentation width.
 */
export function sanitizeProtocolText(text: string): string {
  return (
    formatCodeEditorDiagnosticOverlay(
      {
        kind: 'diagnostic',
        items: [],
        selected: 0,
        diagnostic: { severity: 'error', detail: text },
      },
      undefined,
      80,
    )[0] ?? ''
  );
}
