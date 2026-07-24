import { runReferenceBenchmarkWorker } from './reference.js';

const result = runReferenceBenchmarkWorker({
  fixtures: [
    { label: '1 MiB', sizeBytes: 1_048_576 },
    { label: '50,000 lines', lineCount: 50_000 },
  ],
  sampleCount: 20,
  warmupCount: 5,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
