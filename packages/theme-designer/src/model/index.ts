/**
 * The theme designer's pure model layer — the headless state machine plus the contrast, depth, and
 * hex-validation helpers the view binds to. No view, no I/O.
 */
export { createDesignerModel } from './model.js';
export type { DesignerModel } from './model.js';
export { contrastRows } from './contrast.js';
export type { ContrastRow } from './contrast.js';
export { depthSamples } from './depth.js';
export type { DepthSample } from './depth.js';
export { hexValidator } from './hex-validator.js';
export type { DesignerState, EditTarget, PresetName, RoleOverrides, ThemeSeeds } from './types.js';
