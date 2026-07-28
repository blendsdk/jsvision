import type { CapabilityProfile, Theme } from '@jsvision/core';
import { classicCodeEditorTheme } from '../theme/presets.js';
import {
  resolveCodeEditorTheme,
  snapshotCodeEditorTheme,
  snapshotCodeEditorThemeSource,
  snapshotThemeResolutionReport,
} from '../theme/resolve.js';
import type {
  CodeEditorTheme,
  CodeEditorThemeResolutionReport,
  CodeEditorThemeSource,
  ResolvedCodeEditorTheme,
} from '../theme/theme.js';
import { fingerprintTheme, ownData } from './input-validation.js';

/** Retains one valid palette while keeping live application derivation presentation-only. */
export class CodeEditorThemeState {
  #theme: CodeEditorTheme = classicCodeEditorTheme;
  #fingerprint = fingerprintTheme(classicCodeEditorTheme);
  #source: CodeEditorThemeSource | undefined;
  #sourceGeneration = 0;
  #resolvedGeneration = -1;
  #lastEditorNormal: Theme['editorNormal'] | undefined;
  #lastEditorSelected: Theme['editorSelected'] | undefined;
  #lastStatusBar: Theme['statusBar'] | undefined;
  #lastCaps: CapabilityProfile | undefined;
  #report: CodeEditorThemeResolutionReport = report('independent', 'classic');

  /** Returns the complete immutable palette used by viewport projection. */
  public get theme(): CodeEditorTheme {
    return this.#theme;
  }

  /** Returns a stable content-free fingerprint for frame identity. */
  public get fingerprint(): string {
    return this.#fingerprint;
  }

  /** Returns immutable evidence describing the active or retained palette. */
  public get inspection(): CodeEditorThemeResolutionReport {
    return this.#report;
  }

  /** Installs a complete palette or resolver result and disables live derivation. */
  public setTheme(theme: CodeEditorTheme | ResolvedCodeEditorTheme): boolean {
    const changed = this.#install(theme);
    if (this.#report.activeLayer === 'last-valid') return false;
    this.#source = undefined;
    this.#sourceGeneration += 1;
    return changed;
  }

  /** Selects a live hybrid source that will resolve from application roles during drawing. */
  public setSource(source: CodeEditorThemeSource): boolean {
    const snapshot = snapshotCodeEditorThemeSource(source);
    if (snapshot === undefined) {
      this.#report = report('last-valid', this.#theme.name, ['themeSource']);
      return false;
    }
    this.#source = snapshot;
    this.#sourceGeneration += 1;
    return true;
  }

  /**
   * Re-resolves a live source from the current application roles and terminal capabilities.
   *
   * The application render root already coalesces theme swaps and redraws. Resolving inside that
   * draw keeps the editor synchronized without another scheduler or any parser/LSP notification.
   */
  public resolveApplication(
    applicationTheme: Pick<Theme, 'editorNormal' | 'editorSelected' | 'statusBar'>,
    caps: CapabilityProfile,
  ): void {
    if (this.#source === undefined) return;
    if (
      this.#resolvedGeneration === this.#sourceGeneration &&
      this.#lastEditorNormal === applicationTheme.editorNormal &&
      this.#lastEditorSelected === applicationTheme.editorSelected &&
      this.#lastStatusBar === applicationTheme.statusBar &&
      this.#lastCaps === caps
    )
      return;
    this.#resolvedGeneration = this.#sourceGeneration;
    this.#lastEditorNormal = applicationTheme.editorNormal;
    this.#lastEditorSelected = applicationTheme.editorSelected;
    this.#lastStatusBar = applicationTheme.statusBar;
    this.#lastCaps = caps;
    this.#install(resolveCodeEditorTheme(this.#source, { applicationTheme, caps }));
  }

  #install(theme: CodeEditorTheme | ResolvedCodeEditorTheme): boolean {
    const candidate = ownData(theme, 'theme') ?? theme;
    const snapshot = snapshotCodeEditorTheme(candidate);
    if (snapshot === undefined) {
      this.#report = report('last-valid', this.#theme.name, ['theme']);
      return false;
    }
    const suppliedReport = snapshotThemeResolutionReport(theme);
    const fingerprint = fingerprintTheme(snapshot);
    const changed = fingerprint !== this.#fingerprint;
    this.#theme = snapshot;
    this.#fingerprint = fingerprint;
    this.#report = suppliedReport ?? report('independent', snapshot.name);
    return changed;
  }
}

function report(
  activeLayer: CodeEditorThemeResolutionReport['activeLayer'],
  fallbackSource: string,
  rejected: readonly string[] = [],
): CodeEditorThemeResolutionReport {
  return Object.freeze({
    activeLayer,
    fallbackSource,
    rejected: Object.freeze([...rejected]),
    adjustments: Object.freeze([]),
  });
}
