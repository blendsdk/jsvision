export interface DoctorFinding {
  file: string;
  line: number;
  level: 'error' | 'warn' | 'info';
  rule: string;
  message: string;
}

export function lintText(source: string, fileName?: string): DoctorFinding[];
export function lintPaths(paths: string[]): DoctorFinding[];
