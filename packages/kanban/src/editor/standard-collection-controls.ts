import { Text, View, stringWidth } from '@jsvision/ui';
import type { DispatchEvent, DrawContext } from '@jsvision/ui';

import type { KanbanSemanticValue } from '../contract/semantic-query.js';
import type { KanbanEditorControlContext, KanbanEditorControlInstance } from './types.js';

/** Maximum rows reserved by the standard checklist control before the dialog scroller takes over. */
const CHECKLIST_ROWS = 6;

/** Reads one semantic object property without invoking application prototypes. */
function property(value: KanbanSemanticValue, key: string): KanbanSemanticValue | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return Object.getOwnPropertyDescriptor(value, key)?.value;
}

/** Creates a compact visible summary for assignee and label collections. */
function collectionSummary(value: KanbanSemanticValue | undefined): string {
  if (!Array.isArray(value) || value.length === 0) return '—';
  return value
    .map((item) => {
      const label = property(item, 'label');
      return typeof label === 'string' ? label : '—';
    })
    .join(', ');
}

/** Safe checklist item shape used only after semantic snapshot validation. */
interface ChecklistItem {
  readonly itemId: string;
  readonly text: string;
  readonly completed: boolean;
}

/** Safe checklist group shape used by the interactive standard control. */
interface ChecklistGroup {
  readonly checklistId: string;
  readonly title?: string;
  readonly items: readonly ChecklistItem[];
}

/** Converts the semantic field snapshot into stable checklist identities and values. */
function checklists(value: KanbanSemanticValue | undefined): readonly ChecklistGroup[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze(
    value.flatMap((group) => {
      const checklistId = property(group, 'checklistId');
      const title = property(group, 'title');
      const rawItems = property(group, 'items');
      if (typeof checklistId !== 'string' || !Array.isArray(rawItems)) return [];
      const items = rawItems.flatMap((item) => {
        const itemId = property(item, 'itemId');
        const text = property(item, 'text');
        const completed = property(item, 'completed');
        return typeof itemId === 'string' && typeof text === 'string' && typeof completed === 'boolean'
          ? [{ itemId, text, completed }]
          : [];
      });
      return [{ checklistId, ...(typeof title === 'string' ? { title } : {}), items: Object.freeze(items) }];
    }),
  );
}

/** Flattens a checklist tree into stable render and mutation coordinates. */
function itemCoordinates(
  groups: readonly ChecklistGroup[],
): readonly { readonly group: number; readonly item: number }[] {
  return Object.freeze(
    groups.flatMap((group, groupIndex) => group.items.map((_, itemIndex) => ({ group: groupIndex, item: itemIndex }))),
  );
}

/** Rebuilds a semantic checklist snapshot while preserving every untouched identity and order. */
function replaceChecklistItem(
  groups: readonly ChecklistGroup[],
  coordinate: { readonly group: number; readonly item: number },
  update: (items: ChecklistItem[], item: ChecklistItem) => void,
): readonly ChecklistGroup[] {
  return Object.freeze(
    groups.map((group, groupIndex) => {
      if (groupIndex !== coordinate.group) return group;
      const items = [...group.items];
      const item = items[coordinate.item];
      if (item !== undefined) update(items, item);
      return Object.freeze({ ...group, items: Object.freeze(items) });
    }),
  );
}

/** Focusable mainstream checklist control with stable toggle/edit/reorder/delete operations. */
class StandardChecklistControl extends View {
  readonly #context: KanbanEditorControlContext;
  #active = 0;
  #editing = false;
  #newItemSequence = 1;

  /** Creates one control over the session's bounded checklist field context. */
  constructor(context: KanbanEditorControlContext) {
    super();
    this.#context = context;
    this.focusable = true;
  }

  /** Draws the active checklist item with a non-color cursor cue. */
  override draw(ctx: DrawContext): void {
    ctx.fill(' ', ctx.color(this.state.disabled ? 'buttonDisabled' : 'inputNormal'));
    const groups = checklists(this.#context.value());
    const coordinates = itemCoordinates(groups);
    if (coordinates.length === 0) {
      ctx.text(0, 0, 'No checklist items · Insert adds one', ctx.color('buttonDisabled'));
      return;
    }
    this.#active = Math.min(this.#active, coordinates.length - 1);
    for (let row = 0; row < Math.min(ctx.size.height, coordinates.length); row += 1) {
      const coordinate = coordinates[row];
      if (coordinate === undefined) continue;
      const item = groups[coordinate.group]?.items[coordinate.item];
      if (item === undefined) continue;
      const cursor = row === this.#active ? '>' : ' ';
      const mark = item.completed ? '[x]' : '[ ]';
      const suffix = row === this.#active && this.#editing ? '_' : '';
      ctx.text(
        0,
        row,
        `${cursor}${mark} ${item.text}${suffix}`,
        ctx.color(row === this.#active ? 'inputSelected' : 'inputNormal'),
      );
    }
  }

  /** Applies keyboard checklist operations without replacing stable item identities. */
  override onEvent(event: DispatchEvent): void {
    const inner = event.event;
    if (inner.type !== 'key' || this.state.disabled) return;
    const groups = checklists(this.#context.value());
    const coordinates = itemCoordinates(groups);
    const coordinate = coordinates[this.#active];
    if (inner.key === 'up' || inner.key === 'down') {
      if (inner.ctrl && coordinate !== undefined) {
        const delta = inner.key === 'up' ? -1 : 1;
        const group = groups[coordinate.group];
        const target = coordinate.item + delta;
        if (group !== undefined && target >= 0 && target < group.items.length) {
          this.#context.setValue(
            replaceChecklistItem(groups, coordinate, (items) => {
              const current = items[coordinate.item];
              const neighbor = items[target];
              if (current !== undefined && neighbor !== undefined)
                [items[coordinate.item], items[target]] = [neighbor, current];
            }),
          );
          this.#active += delta;
        }
      } else if (coordinates.length > 0) {
        const delta = inner.key === 'up' ? -1 : 1;
        this.#active = Math.max(0, Math.min(coordinates.length - 1, this.#active + delta));
      }
      event.handled = true;
      this.invalidate();
      return;
    }
    if (inner.key === 'insert') {
      const first = groups[0];
      if (first !== undefined) {
        const existing = new Set(first.items.map((item) => item.itemId));
        let itemId = `${first.checklistId}:item-${this.#newItemSequence++}`;
        while (existing.has(itemId)) itemId = `${first.checklistId}:item-${this.#newItemSequence++}`;
        const next = Object.freeze([
          Object.freeze({
            ...first,
            items: Object.freeze([...first.items, { itemId, text: 'New item', completed: false }]),
          }),
          ...groups.slice(1),
        ]);
        this.#context.setValue(next);
        this.#active = itemCoordinates(next).length - 1;
      }
      event.handled = true;
      return;
    }
    if (coordinate === undefined) return;
    if (inner.key === ' ' && !this.#editing) {
      this.#context.setValue(
        replaceChecklistItem(groups, coordinate, (items, item) => {
          items[coordinate.item] = { ...item, completed: !item.completed };
        }),
      );
      event.handled = true;
      return;
    }
    if (inner.key === 'delete' && !this.#editing) {
      this.#context.setValue(replaceChecklistItem(groups, coordinate, (items) => items.splice(coordinate.item, 1)));
      this.#active = Math.max(0, this.#active - 1);
      event.handled = true;
      return;
    }
    if (inner.key === 'enter') {
      this.#editing = !this.#editing;
      event.handled = true;
      this.invalidate();
      return;
    }
    if (!this.#editing) return;
    const item = groups[coordinate.group]?.items[coordinate.item];
    if (item === undefined) return;
    const text =
      inner.key === 'backspace'
        ? item.text.slice(0, -1)
        : inner.key.length === 1
          ? `${item.text}${inner.key}`
          : undefined;
    if (text !== undefined) {
      this.#context.setValue(
        replaceChecklistItem(groups, coordinate, (items, current) => {
          items[coordinate.item] = { ...current, text };
        }),
      );
      event.handled = true;
    }
  }
}

/** Creates one visible package control for assignee or label summaries. */
export function createStandardSummaryControl(context: KanbanEditorControlContext): KanbanEditorControlInstance {
  const view = new Text(() => collectionSummary(context.value()));
  return Object.freeze({
    view,
    measure: (availableWidth: number) => ({
      minimumWidth: 12,
      preferredWidth: Math.max(12, Math.min(48, stringWidth(collectionSummary(context.value())))),
      rows: Math.max(1, Math.ceil(stringWidth(collectionSummary(context.value())) / Math.max(1, availableWidth))),
    }),
    dispose: () => undefined,
  });
}

/** Creates the interactive package checklist control. */
export function createStandardChecklistControl(context: KanbanEditorControlContext): KanbanEditorControlInstance {
  return Object.freeze({
    view: new StandardChecklistControl(context),
    measure: (availableWidth: number) => ({
      minimumWidth: 18,
      preferredWidth: Math.min(56, availableWidth),
      rows: CHECKLIST_ROWS,
    }),
    dispose: () => undefined,
  });
}
