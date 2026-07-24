import type { CapabilityProfile } from '@jsvision/core';
import type { CodeEditor, CodeEditorWindow } from '@jsvision/code-editor';
import { CODE_EDITOR_SCENARIOS } from './scenarios.js';

/** External resources that the deterministic showcase deliberately never uses. */
export interface CodeEditorDemoDependencies {
  readonly browser: false;
  readonly dom: false;
  readonly network: false;
  readonly database: false;
  readonly externalLanguageServer: false;
  readonly workspace: false;
  readonly credentials: false;
  readonly arbitraryFileAccess: false;
}

/** Input actions accepted by the deterministic headless walkthrough. */
export type CodeEditorDemoInteraction =
  { readonly kind: 'insert'; readonly text: string } | { readonly kind: 'reset' } | { readonly kind: 'next-scenario' };

/** Immutable, content-free state exposed to tests and the visible inspector. */
export interface CodeEditorDemoSnapshot {
  readonly phase: 'ready' | 'running' | 'exited';
  readonly scenarioId: string;
  readonly width: number;
  readonly height: number;
  readonly narration: readonly string[];
}

/** Options for a deterministic, terminal-only showcase session. */
export interface CreateCodeEditorDemoSessionOptions {
  readonly capabilities: CapabilityProfile;
  readonly width: number;
  readonly height: number;
}

/**
 * In-memory application session shared by the interactive demo and process-level walkthrough.
 */
export interface CodeEditorDemoSession {
  readonly dependencies: CodeEditorDemoDependencies;
  readonly surface: CodeEditor | CodeEditorWindow;
  start(): void;
  interact(interaction: CodeEditorDemoInteraction): void;
  resize(size: { readonly width: number; readonly height: number }): void;
  exit(): void;
  snapshot(): CodeEditorDemoSnapshot;
}

/** Creates a bounded showcase session with no production service or filesystem dependencies. */
export function createCodeEditorDemoSession(options: CreateCodeEditorDemoSessionOptions): CodeEditorDemoSession {
  let phase: CodeEditorDemoSnapshot['phase'] = 'ready';
  let scenarioIndex = 0;
  let width = normalizeDimension(options.width);
  let height = normalizeDimension(options.height);
  const narration: string[] = [];
  const scenario = CODE_EDITOR_SCENARIOS[scenarioIndex];
  if (scenario === undefined) throw new Error('The Code Editor showcase has no scenarios.');
  let surface = scenario.mount({ capabilities: options.capabilities, width, height });

  const record = (message: string): void => {
    if (narration.length >= 32) narration.shift();
    narration.push(message);
  };

  return {
    dependencies: Object.freeze({
      browser: false,
      dom: false,
      network: false,
      database: false,
      externalLanguageServer: false,
      workspace: false,
      credentials: false,
      arbitraryFileAccess: false,
    }),
    get surface() {
      return surface;
    },
    start() {
      if (phase !== 'ready') return;
      phase = 'running';
      record('demo started');
    },
    interact(interaction) {
      if (phase !== 'running') return;
      const editor = editorFrom(surface);
      if (interaction.kind === 'insert') {
        editor.insertText(interaction.text);
        record('document edited');
      } else if (interaction.kind === 'reset') {
        editor.dispose();
        const active = CODE_EDITOR_SCENARIOS[scenarioIndex];
        if (active === undefined) return;
        surface = active.mount({ capabilities: options.capabilities, width, height });
        record('scenario reset');
      } else {
        editor.dispose();
        scenarioIndex = (scenarioIndex + 1) % CODE_EDITOR_SCENARIOS.length;
        const active = CODE_EDITOR_SCENARIOS[scenarioIndex];
        if (active === undefined) return;
        surface = active.mount({ capabilities: options.capabilities, width, height });
        record('scenario changed');
      }
    },
    resize(size) {
      if (phase !== 'running') return;
      width = normalizeDimension(size.width);
      height = normalizeDimension(size.height);
      record('terminal resized');
    },
    exit() {
      if (phase === 'exited') return;
      editorFrom(surface).dispose();
      phase = 'exited';
      record('demo exited');
    },
    snapshot() {
      return Object.freeze({
        phase,
        scenarioId: CODE_EDITOR_SCENARIOS[scenarioIndex]?.id ?? 'unavailable',
        width,
        height,
        narration: Object.freeze([...narration]),
      });
    },
  };
}

function editorFrom(surface: CodeEditor | CodeEditorWindow): CodeEditor {
  return 'editor' in surface ? surface.editor : surface;
}

function normalizeDimension(value: number): number {
  return Number.isSafeInteger(value) ? Math.max(1, Math.min(value, 1_000)) : 1;
}
