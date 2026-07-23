export interface RenderOptions {
  module: string;
  exportName?: string;
  pick?: string;
  width?: number;
  height?: number;
  keys?: string;
  cwd?: string;
}

export interface RenderKeyEvent {
  type: 'key';
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export function bufferToText(rows: readonly (readonly { char: string }[])[], width: number, title: string): string;
export function parseKeys(spec?: string): RenderKeyEvent[];
export function renderModule(options: RenderOptions): Promise<string>;
