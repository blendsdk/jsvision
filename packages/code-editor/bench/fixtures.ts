const MAX_FIXTURE_BYTES = 2 * 1024 * 1024;
const MAX_FIXTURE_LINES = 100_000;

/**
 * Describes one deterministic benchmark fixture.
 */
export interface ReferenceFixtureRequest {
  readonly label: string;
  readonly sizeBytes?: number;
  readonly lineCount?: number;
}

function requirePositiveInteger(value: number | undefined, name: string, maximum: number): number {
  if (value === undefined || !Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function sizeFixture(sizeBytes: number): string {
  const line = 'const value = source + 1;\n';
  const repeatCount = Math.ceil(sizeBytes / line.length);
  return line.repeat(repeatCount).slice(0, sizeBytes);
}

function lineFixture(lineCount: number): string {
  return 'select id from records;\n'.repeat(lineCount);
}

/**
 * Creates bounded, repeatable source text for a benchmark request.
 *
 * @example
 * ```ts
 * const source = createReferenceFixture({ label: 'small', sizeBytes: 1024 });
 * ```
 */
export function createReferenceFixture(request: ReferenceFixtureRequest): string {
  if (
    request.label.length === 0 ||
    request.label.length > 80 ||
    (request.sizeBytes === undefined) === (request.lineCount === undefined)
  ) {
    throw new RangeError('A fixture needs a short label and exactly one size constraint');
  }

  if (request.sizeBytes !== undefined) {
    return sizeFixture(requirePositiveInteger(request.sizeBytes, 'sizeBytes', MAX_FIXTURE_BYTES));
  }

  return lineFixture(requirePositiveInteger(request.lineCount, 'lineCount', MAX_FIXTURE_LINES));
}
