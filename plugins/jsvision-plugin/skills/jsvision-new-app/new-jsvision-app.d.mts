export interface AppFileOptions {
  root?: string;
  archetype?: string;
  currentDir?: boolean;
}

export interface AppWriteResult {
  slug: string;
  dir: string;
  files: string[];
}

export function slugify(name: string): string;
export function listArchetypes(): { name: string; description: string }[];
export function buildAppFiles(name: string, archetype?: string): Map<string, string>;
export function writeApp(name: string, options?: AppFileOptions): AppWriteResult;
export function detectPackageManager(directory: string): 'npm' | 'yarn' | 'pnpm' | 'bun' | null;
