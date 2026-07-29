import type { ExampleDefinition } from '../../examples/_contract.js';

/** Placement metadata and lazy loader for one independently runnable example. */
export interface ExampleEntry {
  /** Stable deep-link and menu identifier. */
  readonly id: string;
  /** Navigation category. */
  readonly category: string;
  /** Whether the module builds a complete application or a host-wrapped component. */
  readonly kind: 'component' | 'app';
  /** Package-relative runnable source used by source embeds and parity checks. */
  readonly sourcePath: string;
  /** Whether the host should expose theme-preset controls. */
  readonly themeMenu?: boolean;
  /** Load the independently split example module. */
  load(): Promise<{ default: ExampleDefinition }>;
}
