import type { StoryRecord, StoryEvent } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldLinkContext, WorldRef } from '../shared/worlds';
import { cueCharacter } from './profiles';
import { extractSceneHeading } from './story-extraction';

export function screenplayContext(story: StoryRecord, documents: ScreenplayRecord[], context: WorldLinkContext) {
  const document = documents.find(d => d.id === context.screenplayId);
  const scene = document?.scenes.find(s => s.id === context.sceneId);
  const elementId = context.from?.elementId ?? context.elementId;
  const index = scene?.elements.findIndex(e => e.id === elementId) ?? -1;
  let cue = scene?.elements[index]?.type === 'character' ? scene.elements[index].content : '';
  let cueElementId=cue?scene?.elements[index]?.id:undefined;
  if (!cue && ['dialogue','parenthetical'].includes(context.type)) {
    for (let i = index - 1; i >= 0; i--) {
      const e = scene!.elements[i];
      if (e.type === 'character') { cue = e.content; cueElementId=e.id; break; }
      if (!['dialogue','parenthetical'].includes(e.type)) break;
    }
  }
  const normalize = (text: string) => text.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  const matches = story.characters.filter(c => [c.name,...c.sourceNames ?? [],...c.profile?.aliases ?? [],c.profile?.shortName ?? ''].some(n => normalize(n) === normalize(cue) && !!cue));
  const selected = ' ' + normalize(context.selectedText ?? '').replace(/[^\p{L}\p{N}]+/gu,' ') + ' ';
  const mentioned = story.characters.filter(c => !c.archived && [c.name,...c.sourceNames ?? [],...c.profile?.aliases ?? [],c.profile?.shortName ?? ''].some(n => n.trim() && selected.includes(' '+normalize(n).replace(/[^\p{L}\p{N}]+/gu,' ')+' ')));
  const offset = (anchor?: {elementId:string;offset:number}) => {
    const i=scene?.elements.findIndex(e=>e.id===anchor?.elementId)??-1;
    return i < 0 ? undefined : scene!.elements.slice(0,i).reduce((sum,e)=>sum+e.content.length+1,0)+(anchor?.offset??0);
  };
  const start=offset(context.from),end=offset(context.to);
  const occurrences = (story.worldOccurrences ?? []).filter(o => {
    if(o.needsReview||o.sceneId!==context.sceneId||o.screenplayId!==context.screenplayId||o.scope!=='text')return false;
    const a=offset(o.from),b=offset(o.to);
    return start!==undefined&&end!==undefined&&a!==undefined&&b!==undefined ? b>=start&&a<=end : o.from?.elementId===elementId;
  });
  const bound=story.characters.find(c=>cueElementId&&c.sourceElementIds?.includes(cueElementId));
  const cueId=bound?.id??(matches.length>1?undefined:cueCharacter(story,cue,cueElementId)?.id??(matches.length===1?matches[0].id:undefined));
  const speakerId=['dialogue','parenthetical'].includes(context.type)?cueId:undefined;
  const identified=[...new Set([...occurrences.filter(o=>o.entity.kind==='character').map(o=>o.entity.id),...mentioned.filter(c=>![c.name,...c.sourceNames??[],...c.profile?.aliases??[],c.profile?.shortName??''].some(n=>n.trim()&&selected.includes(' '+normalize(n).replace(/[^\p{L}\p{N}]+/gu,' ')+' ')&&mentioned.some(other=>other.id!==c.id&&[other.name,...other.sourceNames??[],...other.profile?.aliases??[],other.profile?.shortName??''].some(v=>normalize(v)===normalize(n))))).map(c=>c.id),...context.type==='character'&&cueId?[cueId]:[]])];
  const characterId=context.type==='character'?cueId:identified.length===1?identified[0]:identified.length===0?speakerId:undefined;
  const heading=scene?.elements.find(e=>e.type==='scene_heading'), parsed=extractSceneHeading(heading?.content??'');
  const location=story.locations.find(l=>heading&&l.sourceElementIds?.includes(heading.id))??story.locations.find(l=>parsed.location&&[l.name,...l.sourceNames??[]].some(n=>normalize(n)===normalize(parsed.location!)));
  const sceneStory=story.scenes.find(s=>s.sceneId===context.sceneId)??{sceneId:context.sceneId,screenplayId:context.screenplayId,chronology:parsed.chronology,locationId:location?.id};
  const named=(story.worlds??[]).filter(w=>!w.archived).flatMap(w=>w.entities.filter(e=>!e.archived&&['object','vehicle','lore'].includes(e.kind)&&[e.name,...e.aliases??[]].some(n=>n.trim()&&selected.includes(' '+normalize(n).replace(/[^\p{L}\p{N}]+/gu,' ')+' '))).map(e=>({worldId:w.id,entity:{kind:e.kind,id:e.id}})));
  return { document, scene, element:scene?.elements[index], characterId, speakerId, characterIds:identified, occurrences, recognised:named.length===1?named[0]:undefined, sceneStory, locationId:sceneStory?.locationId, point: { sceneId: context.sceneId } };
}

export function captureSource(story: StoryRecord, context: WorldLinkContext, entity: WorldRef, worldId?: string, documents:ScreenplayRecord[]=[], overrides?:Partial<NonNullable<import('../shared/worlds').WorldOccurrence['source']>>): StoryRecord {
  const resolved=screenplayContext(story,documents,context);
  const source={elementId:context.from?.elementId??context.elementId,elementType:context.type,speakerId:resolved.speakerId,characterIds:resolved.characterIds,locationId:resolved.locationId,chronology:resolved.sceneStory?.chronology,...overrides};
  return { ...story, worldOccurrences: [...story.worldOccurrences ?? [], { id: crypto.randomUUID(), worldId, entity, source, screenplayId: context.screenplayId, sceneId: context.sceneId, scope: context.selectedText && context.from && context.to ? 'text' : 'scene', from: context.from, to: context.to, selectedText: context.selectedText??resolved.element?.content }] };
}

export type ScreenplayAction='event'|'plot'|'character'|'membership'|'object'|'rule'|'lore'|'note'|'location';
export function contextualActions(type:string,characterId?:string,linked?:WorldRef):ScreenplayAction[] {
  if(linked?.kind==='vehicle'||linked?.kind==='object')return ['object','note'];
  if(linked?.kind==='lore')return ['lore','note'];
  if(type==='character')return characterId?['membership','character','object','rule','note']:['character','note'];
  if(type==='scene_heading')return ['location','note','rule'];
  if(type==='dialogue'||type==='parenthetical')return ['lore','rule','plot','event','character','note'];
  if(type==='action')return ['event','character','object','rule','plot','note','lore'];
  return ['note'];
}

export function eventSceneAction(event: StoryEvent, sceneId: string, action: string): StoryEvent {
  if (action === 'occurs') {
    if (event.occursInSceneId && event.occursInSceneId !== sceneId) throw Error('This Event already occurs in another Scene. Choose how it appears here.');
    return { ...event, occursInSceneId: sceneId };
  }
  if (action === 'revealed' || action === 'referenced') {
    const key = action === 'revealed' ? 'revealedInSceneIds' : 'referencedInSceneIds';
    return { ...event, [key]: [...new Set([...event[key] ?? [], sceneId])] };
  }
  return { ...event, sceneInteractions: [...(event.sceneInteractions ?? []).filter(i => i.sceneId !== sceneId), {sceneId, relationship: action as 'investigated' | 'new_evidence' | 'reinterpreted'}] };
}
