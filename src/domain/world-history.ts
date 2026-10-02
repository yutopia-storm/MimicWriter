import type { WorldEntity, WorldPoint } from '../shared/worlds';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import { compareWorldPoints, relationshipAt } from './worlds';

export type WorldState = NonNullable<WorldEntity['history']>[number];
export function worldStateAt(entity: WorldEntity, story: StoryRecord, documents: ScreenplayRecord[], at?: WorldPoint) {
  const active = (entity.history ?? []).filter(h => relationshipAt({ ...h, type: 'state', from: entity, to: entity }, at, story, documents) === 'active');
  active.sort((a,b) => !a.fromPoint ? -1 : !b.fromPoint ? 1 : compareWorldPoints(a.fromPoint,b.fromPoint,story,documents) ?? 0);
  return Object.assign({}, entity.fields, ...active.map(h => h.fields)) as Record<string,string>;
}
/** Close an earlier ongoing change at the new boundary; never replace the original description. */
export function saveWorldState(entity: WorldEntity, draft: WorldState, story: StoryRecord, documents: ScreenplayRecord[]) {
  if (draft.fromPoint && draft.untilPoint && (compareWorldPoints(draft.fromPoint,draft.untilPoint,story,documents) ?? -1) >= 0) throw new Error('The end must be after the start.');
  const existing = (entity.history ?? []).filter(h => h.id !== draft.id);
  const history = existing.map(h => draft.fromPoint && !h.untilPoint && (!h.fromPoint || (compareWorldPoints(h.fromPoint,draft.fromPoint,story,documents) ?? 1) < 0) ? { ...h, untilPoint: draft.fromPoint } : h);
  return [...history,draft];
}
