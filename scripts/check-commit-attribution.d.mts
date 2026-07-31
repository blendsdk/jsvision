/** A prohibited co-author line found in a commit message. */
export interface AttributionFinding {
  /** One-based line number in the complete commit message. */
  lineNumber: number;
  /** Offending attribution line, trimmed for diagnostic output. */
  line: string;
}

/**
 * Find the first prohibited co-author attribution in a commit message.
 *
 * @param message Complete commit message to inspect.
 * @returns The first prohibited attribution, or `undefined` when the message is allowed.
 */
export function findCoAuthorAttribution(message: string): AttributionFinding | undefined;

/**
 * Parse the NUL-delimited commit records emitted by the history scanner.
 *
 * @param output Alternating commit hashes and complete messages.
 * @returns Parsed commit records.
 * @throws When the output contains a truncated record.
 */
export function parseHistoryRecords(output: string): Array<{ sha: string; message: string }>;

/**
 * Extract unique local commit IDs from Git pre-push input.
 *
 * @param input Reference updates supplied to a pre-push hook.
 * @returns Unique non-deletion commit IDs.
 * @throws When a reference update or local commit ID is invalid.
 */
export function parsePushedRevisions(input: string): string[];
