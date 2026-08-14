import { KanbanInvalidSemanticValueError } from '../contract/error.js';
import { createKanbanCardKey } from '../contract/identity.js';
import { snapshotKanbanEditorRecordPublication, snapshotKanbanEditorResolveResult } from './session-boundary.js';
import { KanbanEditorSessionActor } from './session-actor.js';
import { awaitEditorWork } from './session-async.js';
import type { BufferedKanbanEditorRecordPublication } from './session-state.js';
import type { KanbanEditorSession, KanbanEditorSessionOptions } from './types.js';

/**
 * Opens one detached editor session after subscribing to authoritative publications.
 *
 * @example
 * ```ts
 * const session = await createKanbanEditorSession({
 *   mode: 'edit', cardKey: 'work-42', adapter, resolver, authority,
 * });
 * ```
 */
export async function createKanbanEditorSession<TCard, TDraft>(
  options: KanbanEditorSessionOptions<TCard, TDraft>,
): Promise<KanbanEditorSession> {
  const cardKey = createKanbanCardKey(options.cardKey);
  const resolutionController = new AbortController();
  let buffered: BufferedKanbanEditorRecordPublication<TCard> | undefined;
  let actor: KanbanEditorSessionActor<TCard, TDraft> | undefined;
  let unsubscribe: (() => void) | undefined;
  let subscriptionReleased = false;
  const releaseSubscription = (): void => {
    if (subscriptionReleased || unsubscribe === undefined) return;
    subscriptionReleased = true;
    try {
      unsubscribe();
    } catch {
      // Application cleanup failures cannot restore package subscription ownership.
    }
  };
  const abortOpening = (): void => {
    resolutionController.abort();
    releaseSubscription();
  };
  if (options.signal?.aborted === true) abortOpening();
  else options.signal?.addEventListener('abort', abortOpening, { once: true });
  try {
    const subscribed = options.resolver.subscribe(cardKey, (publication) => {
      let snapshot: BufferedKanbanEditorRecordPublication<TCard>;
      try {
        snapshot = snapshotKanbanEditorRecordPublication<TCard>(publication);
      } catch {
        return;
      }
      if (actor === undefined) buffered = snapshot;
      else actor.publish(snapshot);
    });
    if (typeof subscribed !== 'function') throw new KanbanInvalidSemanticValueError();
    unsubscribe = subscribed;
    if (resolutionController.signal.aborted) throw new KanbanInvalidSemanticValueError();
    const resolution = Promise.resolve(options.resolver.resolve(cardKey, { signal: resolutionController.signal }));
    const awaited = await awaitEditorWork(resolution, resolutionController.signal);
    if (awaited.kind !== 'value') throw new KanbanInvalidSemanticValueError();
    const initial = snapshotKanbanEditorResolveResult<TCard>(awaited.value);
    options.signal?.removeEventListener('abort', abortOpening);
    actor = new KanbanEditorSessionActor(options, initial);
    actor.attachResolver(releaseSubscription);
    if (buffered !== undefined) actor.publish(buffered);
    return actor;
  } catch {
    options.signal?.removeEventListener('abort', abortOpening);
    resolutionController.abort();
    releaseSubscription();
    throw new KanbanInvalidSemanticValueError();
  }
}
