// Hand-written declaration for the JS acceptance-gate aggregator (gate.mjs). It has no build
// step of its own, so this file exists only to let TS test files import it without TS7016/
// TS7006. It declares just the three data structures the spec oracle indexes and iterates;
// `runGate` stays untyped since no test invokes it directly.
//
// `criteria` is typed as a plain (non-readonly) `number[]`: the spec test destructures STEPS
// with an explicitly annotated callback parameter of that exact shape, and a readonly array
// type would not be assignable to it.

/** One automatable gate step and the go/no-go criteria numbers it provides evidence for. */
export interface GateStep {
  readonly id: string;
  readonly cmd: string;
  readonly args: readonly string[];
  readonly criteria: number[];
}

/** The automatable steps, each mapped to the go/no-go criteria it provides evidence for. */
export declare const STEPS: readonly GateStep[];

/** The 11 go/no-go criteria (canonical numbering 1–11), keyed by criterion number. */
export declare const CRITERIA: Record<number, string>;

/** Criteria deferred under the local-no-remote boundary, keyed by criterion number. */
export declare const DEFERRED: Record<number, string>;
