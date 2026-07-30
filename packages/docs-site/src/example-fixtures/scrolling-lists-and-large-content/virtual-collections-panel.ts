import { Group, ListBox, ListView, Text, Tree, at, signal } from '@jsvision/ui';
import type { DrawContext, TreeNode } from '@jsvision/ui';

/** Typed resident item used to distinguish ListView from the string convenience surface. */
interface CatalogItem {
  /** Stable identity shown independently from the display label. */
  readonly id: number;
  /** Bounded learner-facing display label. */
  readonly label: string;
}

const FULL_ITEMS: readonly CatalogItem[] = Array.from({ length: 200 }, (_, index) => ({
  id: index + 1,
  label: `item-${String(index + 1).padStart(3, '0')}`,
}));
const FULL_LABELS: readonly string[] = Array.from(
  { length: 120 },
  (_, index) => `label-${String(index + 1).padStart(3, '0')}`,
);
const ROOT: TreeNode<string> = {
  value: 'workspace',
  children: Array.from({ length: 50 }, (_, index) => ({
    value: `node-${String(index + 1).padStart(2, '0')}`,
    children: [],
  })),
};

/**
 * Compares resident ListView, ListBox, and Tree data with bounded visible-row rendering.
 *
 * The fixtures are intentionally large enough to expose accidental full scans while remaining
 * deterministic and safe for browser and headless documentation hosts.
 */
export class VirtualCollectionsPanel extends Group {
  /** Stable teaching label used by the focused course specification. */
  public readonly lessonName = 'Virtual collections';

  /** Typed resident collection whose visible rows are virtualized. */
  public readonly listView: ListView<CatalogItem>;

  /** String-specialized resident collection. */
  public readonly listBox: ListBox;

  /** Hierarchical resident collection with view-owned expansion. */
  public readonly tree: Tree<string>;

  /** List formatter calls made by the most recently painted frame. */
  public listFrameWork = 0;

  /** Tree formatter calls made by the most recently painted frame. */
  public treeFrameWork = 0;

  /** Total instrumented formatter calls made by the most recently painted frame. */
  public get visibleRowWork(): number {
    return this.listFrameWork + this.treeFrameWork;
  }

  /** Combined visible capacity of the two instrumented row renderers. */
  public get visibleRowCapacity(): number {
    return this.listView.rows.bounds.height + this.tree.rows.bounds.height;
  }

  /** Status view that publishes the latest settled uncapped counters. */
  protected readonly workStatus: Text;

  /** Reactive typed collection retained in memory for the ListView lesson. */
  protected readonly items = signal<CatalogItem[]>([...FULL_ITEMS]);

  /** Reactive string collection retained in memory for the ListBox lesson. */
  protected readonly labels = signal<string[]>([...FULL_LABELS]);

  /** Reactive root array whose stable node identity preserves expansion semantics. */
  protected readonly roots = signal<TreeNode<string>[]>([ROOT]);

  /** Explicit fixture state shown without relying on colour. */
  protected readonly dataState = signal<'full' | 'shrunk' | 'empty'>('full');

  /** Reactive mirror that lets nearby status text observe view-owned expansion. */
  protected readonly treeExpanded = signal(false);

  /** Non-colour feedback that distinguishes keyboard and mouse actions. */
  protected readonly actionSource = signal<'ready' | 'keyboard' | 'mouse'>('ready');

  /** List calls accumulated since the panel's current subtree paint began. */
  protected currentListWork = 0;

  /** Tree calls accumulated since the panel's current subtree paint began. */
  protected currentTreeWork = 0;

  /** Creates three real collection surfaces and status that separates their state models. */
  public constructor() {
    super();
    this.listView = new ListView({
      items: this.items,
      getText: (item) => {
        this.recordListWork();
        return `${item.id}: ${item.label}`;
      },
    });
    this.listBox = new ListBox({ items: this.labels });
    this.tree = new Tree({
      roots: this.roots,
      getText: (value) => {
        this.recordTreeWork();
        return value;
      },
    });

    this.onMount(() => {
      // Recompose the panel whenever either instrumented row renderer will repaint. The panel's
      // draw boundary can then reset both counters immediately before its children paint, while the
      // status child publishes the uncapped totals after those row children have finished.
      this.bind(() => {
        this.items();
        this.roots();
        this.listView.focused();
        this.listView.selected();
        this.tree.focused();
        this.tree.selected();
        this.listView.rows.focusSignal()();
        this.tree.rows.focusSignal()();
        this.treeExpanded();
        this.dataState();
        this.actionSource();
      });
    });

    this.add(at(new Text('ListView<T>'), 0, 0, 20, 1));
    this.add(at(new Text('ListBox strings'), 22, 0, 20, 1));
    this.add(at(new Text('Tree visible rows'), 44, 0, 22, 1));
    this.add(at(this.listView, 0, 1, 20, 4));
    this.add(at(this.listBox, 22, 1, 20, 4));
    this.add(at(this.tree, 44, 1, 22, 4));
    this.add(
      at(
        new Text(
          () =>
            `Data: ${this.dataState()} · Focus: ${this.listView.focused()} · Selected: ${this.listView.selected()} · ` +
            `Tree expanded: ${this.treeExpanded() ? 'yes' : 'no'}`,
        ),
        0,
        5,
        66,
        1,
      ),
    );
    this.workStatus = new Text(() => {
      this.items();
      this.labels();
      this.roots();
      this.listView.focused();
      this.listView.selected();
      this.tree.focused();
      this.tree.selected();
      this.treeExpanded();
      this.dataState();
      this.actionSource();
      this.listFrameWork = this.currentListWork;
      this.treeFrameWork = this.currentTreeWork;
      return (
        `Rendered rows: ${this.visibleRowWork} <= viewport ${this.visibleRowCapacity} · ` +
        `List ${this.listFrameWork}/${this.listView.rows.bounds.height} · ` +
        `Tree ${this.treeFrameWork}/${this.tree.rows.bounds.height}`
      );
    });
    this.add(at(this.workStatus, 0, 6, 66, 1));
    this.add(at(new Text('Remote/unbounded: use Data Grid or Code Editor windowed sources'), 0, 7, 66, 1));
    this.add(at(new Text(() => `Action source: ${this.actionSource()}`), 0, 8, 66, 1));
  }

  /**
   * Start one measured subtree paint before the collection row renderers run.
   *
   * The render root draws a Group before walking its children, so this is the real boundary for the
   * two instrumented renderers. The later status child publishes the totals after both have painted.
   *
   * @param context The panel-local draw context.
   */
  public override draw(context: DrawContext): void {
    this.currentListWork = 0;
    this.currentTreeWork = 0;
    this.listFrameWork = 0;
    this.treeFrameWork = 0;
    super.draw(context);
  }

  /** Record one uncapped formatter call in the current unsorted ListView subtree paint. */
  protected recordListWork(): void {
    this.currentListWork += 1;
    this.workStatus.invalidate();
  }

  /** Record one uncapped formatter call in the current visible Tree subtree paint. */
  protected recordTreeWork(): void {
    this.currentTreeWork += 1;
    this.workStatus.invalidate();
  }

  /**
   * Expand or collapse the stable root node without rebuilding its identity.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public toggleTree(source: 'keyboard' | 'mouse'): void {
    if (this.tree.isExpanded(ROOT)) {
      this.tree.collapse(ROOT);
      this.treeExpanded.set(false);
    } else {
      this.tree.expand(ROOT);
      this.treeExpanded.set(true);
    }
    this.actionSource.set(source);
  }

  /**
   * Replace the large fixtures with one item so focus clamping remains observable.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public shrinkData(source: 'keyboard' | 'mouse'): void {
    this.items.set(FULL_ITEMS.slice(0, 1));
    this.labels.set(FULL_LABELS.slice(0, 1));
    this.roots.set([ROOT]);
    this.dataState.set('shrunk');
    this.actionSource.set(source);
  }

  /**
   * Empty every resident source and expose each component's bounded empty state.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public emptyData(source: 'keyboard' | 'mouse'): void {
    this.items.set([]);
    this.labels.set([]);
    this.roots.set([]);
    this.dataState.set('empty');
    this.actionSource.set(source);
  }

  /**
   * Restore the original bounded large fixtures.
   *
   * @param source Whether a keyboard command or mouse-accessible button invoked the action.
   */
  public resetData(source: 'keyboard' | 'mouse'): void {
    this.items.set([...FULL_ITEMS]);
    this.labels.set([...FULL_LABELS]);
    this.roots.set([ROOT]);
    this.dataState.set('full');
    this.actionSource.set(source);
  }
}
