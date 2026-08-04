import type { CardKey } from '../contract/identity.js';
import type { KanbanRevision } from '../contract/revision.js';
import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanCellState } from '../source/states.js';
import type { KanbanCellAddress, KanbanColumnMeta } from '../source/types.js';

/** Semantic swimlane header retained before any terminal geometry is assigned. */
export interface KanbanSceneSwimlane {
  /** Stable application-owned swimlane identity. */
  readonly swimlaneId: string;
  /** Sanitized display label. */
  readonly label: string;
  /** Equality-only presentation revision. */
  readonly revision: KanbanRevision;
  /** Optional detached count or summary evidence. */
  readonly count?: KanbanSemanticValue;
}

/** Renderer-neutral card descriptor fields required by scene geometry and inspection. */
export interface KanbanSceneCardDescriptor {
  /** Typed card identity repeated by the descriptor. */
  readonly cardKey: CardKey;
  /** Exact descriptor width in terminal cells. */
  readonly width: number;
  /** Exact descriptor height in terminal rows. */
  readonly measuredHeight: number;
  /** Equality-only card presentation revision. */
  readonly presentationRevision?: KanbanRevision;
  /** Complete detached descriptor payload already validated by its owning presentation boundary. */
  readonly value: KanbanSemanticValue;
}

/** One resident card in the canonical semantic scene. */
export interface KanbanSceneCard {
  /** Stable application-owned card identity. */
  readonly cardKey: CardKey;
  /** Semantic source cell containing the card. */
  readonly address: KanbanCellAddress;
  /** Zero-based logical position in the owning cursor. */
  readonly logicalIndex: number;
  /** Equality-only application entity revision. */
  readonly entityRevision: KanbanRevision;
  /** Immutable renderer-neutral descriptor. */
  readonly descriptor: KanbanSceneCardDescriptor;
  /** Detached focus and selection evidence. */
  readonly interaction: KanbanSemanticValue;
  /** Detached workflow eligibility evidence. */
  readonly workflow: KanbanSemanticValue;
}

/** One occupied or explicitly retained semantic source cell. */
export interface KanbanSceneCell {
  /** Stable workflow-column and optional swimlane coordinate. */
  readonly address: KanbanCellAddress;
  /** Equality-only owning cursor revision. */
  readonly cursorRevision: KanbanRevision;
  /** Current source lifecycle state. */
  readonly state: KanbanCellState;
  /** Source-ordered resident cards retained within the descriptor ceiling. */
  readonly cards: readonly KanbanSceneCard[];
}

/** Non-actionable semantic evidence that visible descriptor demand exceeded its finite budget. */
export interface KanbanSceneLimitState {
  /** Stable state code used by drawing and inspection. */
  readonly code: 'descriptor-limit';
  /** Owning source cell. */
  readonly scope: { readonly kind: 'cell'; readonly address: KanbanCellAddress };
  /** Limit surfaces never become an interaction target. */
  readonly actionable: false;
  /** Number of source-ordered resident descriptors omitted from this scene. */
  readonly omittedCount: number;
}

/** Canonical immutable semantic scene shared by every presentation variant. */
export interface KanbanScene {
  /** Equality-only scene revision. */
  readonly revision: KanbanRevision;
  /** Query generation that owns every resident cell. */
  readonly queryGeneration: number;
  /** Revision of the owning board-wide query session. */
  readonly sessionRevision: KanbanRevision;
  /** Source-ordered workflow columns. */
  readonly columns: readonly KanbanColumnMeta[];
  /** Source-ordered visible swimlanes. */
  readonly swimlanes: readonly KanbanSceneSwimlane[];
  /** Occupied or explicitly retained cells only; no Cartesian synthesis. */
  readonly cells: readonly KanbanSceneCell[];
  /** Source-ordered resident cards flattened for bounded projection. */
  readonly cards: readonly KanbanSceneCard[];
  /** Non-actionable partial-state evidence. */
  readonly states: readonly KanbanSceneLimitState[];
  /** Hidden and collapsed semantic evidence with no terminal geometry. */
  readonly detached: KanbanSemanticValue;
}
