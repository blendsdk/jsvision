// Hand-written declaration for jsdoc-examples.mjs (plain ESM, no TypeScript
// loader). The spec test builds allowlist objects and inspects the returned
// block/failure shapes in detail, so the `ExampleBlock`/`ExampleFailure` shapes
// below are typed as precisely as the JSDoc source. Declares only the three
// exports the tests consume — every internal helper (compile, symbolName, …)
// is left out.

/** One `@example` block collected from a source file. */
interface ExampleBlock {
  /** Repo-relative path of the source the block was found in. */
  file: string;
  /** Declaration name — `Class.member` for members, `#N`-suffixed on collision. */
  symbol: string;
  /** 1-based line of the `@example` tag, for human-readable output. */
  line: number;
  /** Byte offset of the tag — the de-duplication identity. */
  pos: number;
  /** The block body, fence-stripped and terminator-unescaped. */
  body: string;
  /** Absolute path the block is compiled *as*. Never written. */
  virtualPath: string;
}

/** One block that failed to compile, or disagreed with its allowlist entry. */
interface ExampleFailure {
  /** `${file}::${symbol}`. */
  key: string;
  /** 1-based line of the `@example` tag. */
  line: number;
  /** Every distinct diagnostic code, ascending — the comparison set. */
  codes: number[];
  /** For each TS2304, the identifier it could not find. */
  missingNames: string[];
  /** All diagnostic messages joined, for human readability only. */
  message: string;
}

/** A grandfathered failure, keyed `file::Symbol`. */
interface AllowlistEntry {
  codes: number[];
  missingNames?: string[];
  message?: string;
}

/** What the guard concluded over one collected set of blocks. */
interface GuardResult {
  /** How many blocks were compiled. */
  checked: number;
  /** Failures with no entry, or whose diagnostics differ from it. */
  unexpected: ExampleFailure[];
  /** Allowlist entries that now compile, or name a vanished file/symbol. */
  stale: string[];
}

/**
 * The six shipped packages whose public JSDoc the guard governs.
 */
export declare const SHIPPED_ROOTS: readonly string[];

/**
 * Collect every `@example` block under the given roots.
 *
 * Roots are directories, absolute or repo-relative. `.d.ts` files are skipped
 * — they carry generated copies of the very JSDoc being checked.
 *
 * @param roots Directories to walk.
 * @returns Every block found, in file then source order.
 * @throws If a root does not exist.
 */
export declare function collectExamples(roots: readonly string[]): ExampleBlock[];

/**
 * Compile every block and rule each one against the allowlist.
 *
 * @param blocks Blocks from {@link collectExamples}.
 * @param allowlist Grandfathered failures, keyed `file::Symbol`.
 * @returns What the guard concluded.
 */
export declare function checkExamples(
  blocks: readonly ExampleBlock[],
  allowlist: Record<string, AllowlistEntry>,
): GuardResult;
