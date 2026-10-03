import { rememberWorldOptions } from './world-form-options';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldEntity, WorldPoint, WorldRef } from '../shared/worlds';
import { refKey, relationshipAt, compareWorldPoints, validateWorld } from './worlds';
import { applyCaptureRelationships, type CapturedRelationship } from './capture-relationships';
import { saveWorldState, worldStateAt } from './world-history';

export const RULE_TARGET_KINDS: WorldRef['kind'][] = ['world','character','organisation','structure','location','object','vehicle','custom','lore','event','plot','note','rank','position','rule'];
export type RuleMeaning = 'applies to' | 'concerns';
export function rulesForEntity(story: StoryRecord, documents: ScreenplayRecord[], target: WorldRef, at?: WorldPoint) {
  return (story.worlds ?? []).filter(w=>!w.archived).flatMap(world=>world.entities.filter(e=>e.kind==='rule'&&!e.archived).flatMap(rule=> {
    const links=world.relationships.filter(r=>!r.archived&&r.from.kind==='rule'&&r.from.id===rule.id&&['applies to','concerns'].includes(r.type)&&refKey(r.to)===refKey(target));
    return links.map(link=>({world,rule,link,status:relationshipAt(link,at,story,documents),text:worldStateAt(rule,story,documents,at).Rule??rule.description}));
  }));
}
export interface RuleDraft { entity: WorldEntity; relationships: CapturedRelationship[]; period: 'always'|'point'|'custom'; from?:WorldPoint; until?:WorldPoint; }
/** Rules, typed subjects and effective history are one immutable metadata save. */
export function saveRule(story:StoryRecord,documents:ScreenplayRecord[],worldId:string,draft:RuleDraft):StoryRecord {
  const world=story.worlds?.find(w=>w.id===worldId);if(!world)throw Error('Choose a Project World.');
  if(!draft.entity.name.trim()||!draft.entity.description.trim())throw Error('Enter a name and Rule.');
  if(draft.period!=='always'&&!draft.from)throw Error('Choose when the Rule begins.');
  if(draft.period==='custom'&&draft.from&&draft.until&&(compareWorldPoints(draft.from,draft.until,story,documents)??-1)>=0)throw Error('The end must be after the start.');
  if(!draft.relationships.some(r=>r.type==='applies to'))throw Error('Choose who or what the Rule applies to.');
  if(draft.relationships.some(r=>!['applies to','concerns'].includes(r.type)||!RULE_TARGET_KINDS.includes(r.target.kind)))throw Error('Choose a supported Rule relationship.');
  const old=world.entities.find(e=>e.id===draft.entity.id);
  const from=draft.period==='always'?undefined:draft.from,until=draft.period==='custom'?draft.until:undefined;
  const text=draft.entity.description;
  const entity:WorldEntity={...draft.entity,name:draft.entity.name.trim(),kind:'rule',...(from?{description:old?.description??'',history:saveWorldState(old??draft.entity,{id:old?.history?.find(h=>JSON.stringify(h.fromPoint)===JSON.stringify(from)&&JSON.stringify(h.untilPoint)===JSON.stringify(until)&&'Rule' in h.fields)?.id??crypto.randomUUID(),fields:{Rule:text},fromPoint:from,untilPoint:until},story,documents)}:{fields:{...draft.entity.fields,Rule:text}})};
  // Current-period changes keep earlier relationships. Unknown legacy meanings are untouched.
  const owned=world.relationships.filter(r=>!r.archived&&r.from.kind==='rule'&&r.from.id===entity.id&&['applies to','concerns'].includes(r.type));
  const retained=world.relationships.flatMap(r=>!owned.includes(r)||draft.relationships.some(d=>d.type===r.type&&refKey(d.target)===refKey(r.to)&&JSON.stringify(r.fromPoint)===JSON.stringify(from)&&JSON.stringify(r.untilPoint)===JSON.stringify(until))?[r]:from&&(!r.fromPoint||(compareWorldPoints(r.fromPoint,from,story,documents)??1)<0)?[{...r,untilPoint:!r.untilPoint||relationshipAt(r,from,story,documents)==='active'?from:r.untilPoint}]:from&&r.fromPoint&&compareWorldPoints(r.fromPoint,from,story,documents)!==0?[r]:from?[]:[{...r,archived:true}]);
  let next:StoryRecord={...story,worlds:story.worlds?.map(w=>w.id!==worldId?w:{...rememberWorldOptions(w,'rule',entity.fields),entities:[...w.entities.filter(e=>e.id!==entity.id),entity],relationships:retained})};
  next=applyCaptureRelationships(next,worldId,{kind:'rule',id:entity.id},draft.relationships.map(r=>retained.some(old=>old.id===r.id)?{...r,id:crypto.randomUUID()}:r),from,until);
  validateWorld(next.worlds!.find(w=>w.id===worldId)!,next,documents);
  return next;
}
