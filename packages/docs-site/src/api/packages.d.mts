/** Publishable package names included in the generated docs API inventory. */
export type DocPackageName = 'core' | 'i18n' | 'ui' | 'files' | 'forms' | 'datagrid' | 'code-editor' | 'kanban';

/** One public package and the source configuration consumed by the docs API generator. */
export interface DocPackage {
  /** Unscoped package name and generated `api/<name>/` directory. */
  readonly name: DocPackageName;
  /** Public source entry point relative to the docs-site package. */
  readonly entry: string;
  /** Package TypeScript configuration relative to the docs-site package. */
  readonly tsconfig: string;
}

/** Complete ordered publishable package inventory used by docs generation and validation. */
export const PACKAGES: readonly DocPackage[];
