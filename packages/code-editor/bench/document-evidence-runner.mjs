import { runDocumentBenchmark } from '../dist/document/document-benchmark.js';

const evidence = await runDocumentBenchmark({
  sampleCount: 20,
  warmupCount: 5,
  historyEdits: 1_000,
});

const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
process.stdout.write(serialized);
