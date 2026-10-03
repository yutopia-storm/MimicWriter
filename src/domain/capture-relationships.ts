import type { StoryRecord } from '../shared/story';
import type { WorldPoint, WorldRef } from '../shared/worlds';
import { WORLD_LINK_LABELS } from '../shared/world-forms';
import type {ScreenplayRecord} from '../shared/models';
import {relationshipAt} from './worlds';
export interface CapturedRelationship {id:string;target:WorldRef;type:string;primary?:boolean;}
export function applyCaptureRelationships(story:StoryRecord,worldId:string|undefined,entity:WorldRef,drafts:CapturedRelationship[],fromPoint?:WorldPoint,untilPoint?:WorldPoint,replace?:{documents:ScreenplayRecord[]}):StoryRecord {
 let next=story;
 for(const draft of drafts){
  if(!draft.target.id||!draft.type.trim())throw Error('Choose an entry and relationship for each row, or remove the unfinished row.');
  if(draft.target.id===entity.id&&draft.target.kind===entity.kind)throw Error('Choose a different related entry.');
  const valid=draft.target.kind==='character'?story.characters.some(c=>c.id===draft.target.id):draft.target.kind==='location'?story.locations.some(l=>l.id===draft.target.id):draft.target.kind==='event'?story.events.some(e=>e.id===draft.target.id):draft.target.kind==='plot'?story.plots.some(p=>p.id===draft.target.id):draft.target.kind==='scene'?true:story.worlds?.some(w=>draft.target.kind==='world'?w.id===draft.target.id:w.id===worldId&&w.entities.some(e=>e.id===draft.target.id&&e.kind===draft.target.kind));
  if(!valid)throw Error('The related entry is no longer available. Choose it again.');
  if(entity.kind==='event'&&draft.target.kind==='character'&&draft.type==='involved'){
   next={...next,events:next.events.map(e=>e.id===entity.id?{...e,participantIds:[...new Set([...e.participantIds??[],draft.target.id])]}:e)};continue;
  }
  const world=next.worlds?.find(w=>w.id===worldId);if(!world)throw Error('Choose a Project World to store these relationships.');
  const prior=world.relationships.map(r=>replace&&fromPoint&&r.from.id===entity.id&&r.from.kind===entity.kind&&r.type===draft.type&&r.to.id!==draft.target.id&&relationshipAt(r,fromPoint,story,replace.documents)==='active'?{...r,untilPoint:fromPoint}:r);
  const exists=world.relationships.some(r=>!r.archived&&r.from.id===entity.id&&r.from.kind===entity.kind&&r.to.id===draft.target.id&&r.to.kind===draft.target.kind&&r.type===draft.type&&JSON.stringify(r.fromPoint)===JSON.stringify(fromPoint)&&JSON.stringify(r.untilPoint)===JSON.stringify(untilPoint));
  const updated={...world,characterIds:[...new Set([...world.characterIds,...[entity,draft.target].filter(r=>r.kind==='character').map(r=>r.id)])],locationIds:[...new Set([...world.locationIds,...[entity,draft.target].filter(r=>r.kind==='location').map(r=>r.id)])],relationships:exists?prior:[...prior,{id:draft.id,from:entity,to:draft.target,type:draft.type.trim(),fromPoint,untilPoint}],relationshipOptions:[...world.relationshipOptions??[],...WORLD_LINK_LABELS[draft.type]||world.relationshipOptions?.some(o=>o.sourceKind===entity.kind&&o.targetKind===draft.target.kind&&o.label===draft.type)?[]:[{sourceKind:entity.kind,targetKind:draft.target.kind,label:draft.type.trim()}]]};
  next={...next,worlds:next.worlds?.map(w=>w.id===updated.id?updated:w)};
 }
 return next;
}
