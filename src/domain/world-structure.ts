import { membershipReporterIds } from './world-memberships';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldRecord, WorldEntity, WorldRef, WorldPoint, WorldRelationship } from '../shared/worlds';
import { STRUCTURE_TYPES } from '../shared/worlds';
import { refKey, relationshipAt, validateWorld } from './worlds';

export const MAX_STRUCTURE_BATCH = 500;
export const isOrganisation = (e: WorldEntity) => e.kind === 'organisation' && e.organisationRole !== 'rank' && e.organisationRole !== 'position';
export const isRole = (e: WorldEntity, role: 'rank' | 'position') => e.kind === role || e.kind === 'organisation' && e.organisationRole === role;
export const structureSort = (a: WorldEntity, b: WorldEntity) => (a.hierarchyLevel ?? Infinity) - (b.hierarchyLevel ?? Infinity) || (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name);
export const membershipTarget = (r: WorldRelationship): WorldRef => r.unitId ? { kind: 'structure', id: r.unitId } : r.to;

/** One-time conservative migration. Names alone never convert an unparented body. */
export function migrateWorldRecord(source: WorldRecord): WorldRecord {
  const w = structuredClone(source), changed = new Map<string, WorldEntity['kind']>(source.entities.filter(e=>['structure','rank','position'].includes(e.kind)).map(e=>[e.id,e.kind]));
  for (const e of w.entities) if (e.kind === 'organisation' && (e.organisationRole === 'rank' || e.organisationRole === 'position')) { e.kind = e.organisationRole; changed.set(e.id,e.kind); delete e.organisationRole; }
  if (!source.structureModelVersion) {
    const candidates = new Map<string,string>();
    for (const e of w.entities.filter(isOrganisation)) {
      const type = e.fields?.['Unit label']?.trim() || e.name.match(/^(Division|Department|Branch|Unit|Team|Command|Section|Crew)(?:\s+\d+)?$/i)?.[1];
      const parents = [...new Set(w.relationships.filter(r => r.type === 'part of' && r.from.id === e.id && r.to.kind === 'organisation').map(r => r.to.id))];
      if (type && STRUCTURE_TYPES.some(t => t.toLowerCase() === type.toLowerCase()) && parents.length === 1) candidates.set(e.id,parents[0]);
    }
    for (const [id,parent] of candidates) {
      let owner = parent; const seen = new Set([id]);
      while (candidates.has(owner) && !seen.has(owner)) { seen.add(owner); owner = candidates.get(owner)!; }
      if (seen.has(owner) || !w.entities.some(e => e.id === owner && isOrganisation(e))) continue;
      const e = w.entities.find(e => e.id === id)!;
      e.kind = 'structure'; e.organisationId = owner;
      e.structureType = STRUCTURE_TYPES.find(t => t.toLowerCase() === (e.fields?.['Unit label'] || e.name.match(/^\w+/)?.[0])?.toLowerCase()) ?? 'Unit';
      changed.set(id,'structure'); delete e.organisationRole;
    }
  }
  const remap = (ref: WorldRef): WorldRef => ref.kind === 'organisation' && changed.has(ref.id) ? { ...ref,kind:changed.get(ref.id)! } : ref;
  w.entities = w.entities.map(e => ({ ...e, fieldLinks:e.fieldLinks ? Object.fromEntries(Object.entries(e.fieldLinks).map(([k,r])=>[k,remap(r)])) : undefined }));
  w.relationships = w.relationships.map(r => { const next = { ...r,from:remap(r.from),to:remap(r.to) }; if (next.type === 'member of' && next.to.kind === 'structure') { const owner = w.entities.find(e=>e.id===next.to.id)?.organisationId; if(owner) { next.unitId=next.to.id; next.to={kind:'organisation',id:owner}; } } return next; });
  // Existing explicit applicability keeps its meaning; clear assigned container links become applicability.
  w.relationships=w.relationships.map(r=>r.from.kind==='rule'&&['organisation','structure','location'].includes(r.to.kind)&&r.type==='belongs to'?{...r,type:'applies to'}:r).map(r=>r.from.kind==='rule'&&['applies to','concerns'].includes(r.type)&&r.unitId&&w.entities.some(e=>e.id===r.unitId&&e.kind==='structure')?{...r,to:{kind:'structure' as const,id:r.unitId},unitId:undefined}:r);
  w.diagrams = w.diagrams.map(d=>({...d,root:d.root?remap(d.root):undefined,kinds:d.kinds?.includes('organisation')?[...new Set([...d.kinds,'structure' as const])]:d.kinds,collapsedIds:d.collapsedIds?.map(k=>{ const id=k.slice(k.indexOf(':')+1); return k.startsWith('organisation:') && changed.has(id)?changed.get(id)+':'+id:k; })}));
  w.structureModelVersion=1;
  return w;
}
export function migrateWorldModel(story: StoryRecord): StoryRecord {
  if (!story.worlds) return story;
  const worlds=story.worlds.map(migrateWorldRecord);
  const remap=(ref:WorldRef,worldId?:string) => { const e=worlds.find(w=>w.id===worldId)?.entities.find(e=>e.id===ref.id); return ref.kind==='organisation' && e && e.kind!=='organisation'?{...ref,kind:e.kind}:ref; };
  return {...story,worlds,worldOccurrences:story.worldOccurrences?.map(o=>({...o,entity:remap(o.entity,o.worldId)})),worldUi:story.worldUi?{...story.worldUi,pins:story.worldUi.pins.map(p=>({...p,entity:p.entity?remap(p.entity,p.worldId):undefined}))}:undefined};
}

export function organisationCategory(world:WorldRecord,id:string,story:StoryRecord,documents:ScreenplayRecord[],at?:WorldPoint,path=new Set<string>()): string | undefined {
  if(path.has(id)) return; const next=new Set(path); next.add(id);
  const e=world.entities.find(e=>e.id===id); if(e?.category?.trim()) return e.category.trim();
  if(e?.kind==='structure' && e.organisationId) return organisationCategory(world,e.organisationId,story,documents,at,next);
  const parents=world.relationships.filter(r=>r.type==='part of' && r.from.id===id && r.to.kind==='organisation' && relationshipAt(r,at,story,documents)==='active');
  const categories=[...new Set(parents.map(r=>organisationCategory(world,r.to.id,story,documents,at,next)).filter(Boolean))];
  return categories.length===1?categories[0]:undefined;
}

export interface StructureDraft { type:string; names?:string; prefix?:string; from?:number; to?:number; sequence?:boolean; abbreviationPattern?:string; hierarchyLevel?:number; parentId?:string; }
export function previewStructures(d:StructureDraft): {name:string;abbreviation?:string}[] {
  let names:{name:string;n:number}[];
  if(d.sequence) {
    if(!d.prefix?.trim() || !Number.isInteger(d.from) || !Number.isInteger(d.to) || d.to! < d.from! || d.to! - d.from! + 1 > MAX_STRUCTURE_BATCH) throw Error('Enter a prefix and a valid numbered range (up to '+MAX_STRUCTURE_BATCH+' entries).');
    names=Array.from({length:d.to!-d.from!+1},(_,i)=>({name:d.prefix!.trim()+' '+(d.from!+i),n:d.from!+i}));
  } else names=(d.names??'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((name,i)=>({name,n:i+1}));
  if(!names.length || names.length>MAX_STRUCTURE_BATCH) throw Error('Enter between 1 and '+MAX_STRUCTURE_BATCH+' names.');
  if(new Set(names.map(e=>e.name.toLocaleLowerCase())).size!==names.length) throw Error('Remove duplicate names from this batch.');
  if(d.hierarchyLevel!==undefined && (!Number.isInteger(d.hierarchyLevel)||d.hierarchyLevel<1)) throw Error('Hierarchy levels start at 1.');
  return names.map(e=>({name:e.name,abbreviation:d.abbreviationPattern?.trim()?d.abbreviationPattern.trim().replaceAll('{n}',String(e.n)):undefined}));
}
export function createStructures(world:WorldRecord,organisationId:string,draft:StructureDraft,at?:WorldPoint):WorldRecord {
  if(!world.entities.some(e=>e.id===organisationId && isOrganisation(e) && !e.archived)) throw Error('Choose an active Organisation.');
  if(draft.parentId && !world.entities.some(e=>e.id===draft.parentId && e.kind==='structure' && e.organisationId===organisationId && !e.archived)) throw Error('Choose a parent unit in this Organisation.');
  const start=Math.max(-1,...world.entities.filter(e=>e.kind==='structure' && e.organisationId===organisationId).map(e=>e.displayOrder??0))+1;
  const entries=previewStructures(draft).map((e,i):WorldEntity=>({id:crypto.randomUUID(),kind:'structure',organisationId,structureType:draft.type.trim()||'Unit',name:e.name,abbreviation:e.abbreviation,description:'',hierarchyLevel:draft.hierarchyLevel,displayOrder:start+i}));
  return {...world,entities:[...world.entities,...entries],relationships:[...world.relationships,...draft.parentId?entries.map(e=>({id:crypto.randomUUID(),type:'part of',from:{kind:'structure' as const,id:e.id},to:{kind:'structure' as const,id:draft.parentId!},fromPoint:at})):[]]};
}
/** Explicit parents win. Numeric levels only supply a display parent when unambiguous. */
export function structureParents(world:WorldRecord,story:StoryRecord,documents:ScreenplayRecord[],at?:WorldPoint):Map<string,WorldRef[]> {
  const units=world.entities.filter(e=>e.kind==='structure'&&!e.archived), result=new Map<string,WorldRef[]>();
  for(const e of units) {
    const explicit=world.relationships.filter(r=>['part of','reports to'].includes(r.type)&&r.from.id===e.id&&['structure','organisation'].includes(r.to.kind)&&relationshipAt(r,at,story,documents)==='active');
    if(explicit.length) {result.set(e.id,explicit.map(r=>r.to));continue;}
    const lower=units.filter(other=>other.organisationId===e.organisationId&&other.id!==e.id&&other.hierarchyLevel!==undefined&&e.hierarchyLevel!==undefined&&other.hierarchyLevel<e.hierarchyLevel&&!world.relationships.some(r=>r.from.id===other.id&&r.to.kind==='structure'&&['part of','reports to'].includes(r.type)&&relationshipAt(r,at,story,documents)==='active'));
    const level=Math.max(0,...lower.map(e=>e.hierarchyLevel!)), peers=lower.filter(e=>e.hierarchyLevel===level);
    result.set(e.id,peers.length===1?[{kind:'structure',id:peers[0].id}]:e.organisationId?[{kind:'organisation',id:e.organisationId}]:[]);
  }
  return result;
}
export function setStructureParent(world:WorldRecord,ids:string[],parentId:string|undefined,at?:WorldPoint):WorldRecord {
  const selected=new Set(ids);
  if(parentId && selected.has(parentId)) throw Error('A unit cannot report to itself or another selected unit.');
  const entries=world.entities.filter(e=>selected.has(e.id)&&e.kind==='structure');
  if(entries.length!==selected.size) throw Error('Choose existing internal structures.');
  if(parentId){const parent=world.entities.find(e=>e.id===parentId&&e.kind==='structure'&&!e.archived);if(!parent||entries.some(e=>e.organisationId!==parent.organisationId))throw Error('Choose a parent unit in the same Organisation.');}
  const relationships=world.relationships.map(r=>selected.has(r.from.id)&&r.from.kind==='structure'&&['part of','reports to'].includes(r.type)&&!r.untilPoint&&!r.archived?at?{...r,untilPoint:at}:{...r,archived:true}:r);
  return {...world,relationships:[...relationships,...parentId?ids.map(id=>({id:crypto.randomUUID(),type:'part of',from:{kind:'structure' as const,id},to:{kind:'structure' as const,id:parentId},fromPoint:at})):[]]};
}
export function moveStructures(world:WorldRecord,ids:string[],organisationId:string,story:StoryRecord,documents:ScreenplayRecord[],at?:WorldPoint):WorldRecord {
 if(!world.entities.some(e=>e.id===organisationId&&isOrganisation(e)&&!e.archived))throw Error('Choose an active destination Organisation.');
 const selected=new Set(ids),active=world.relationships.filter(r=>relationshipAt(r,at,story,documents)==='active'&&r.from.kind==='structure'&&['part of','reports to'].includes(r.type));
 if(world.entities.filter(e=>selected.has(e.id)&&e.kind==='structure').length!==selected.size)throw Error('Choose existing internal structures.');
 let added=true;while(added){added=false;for(const r of active)if(r.to.kind==='structure'&&selected.has(r.to.id)&&!selected.has(r.from.id)){selected.add(r.from.id);added=true;}}
 const roots=[...selected].filter(id=>!active.some(r=>r.from.id===id&&r.to.kind==='structure'&&selected.has(r.to.id)));
 const external=active.filter(r=>selected.has(r.from.id)&&!selected.has(r.to.id));
 const retained=world.relationships.map(r=>external.some(e=>e.id===r.id)?at?{...r,untilPoint:at}:{...r,archived:true}:r);
 const placements=roots.flatMap(id=>{
   const oldOwner=world.entities.find(e=>e.id===id)?.organisationId;
   const prior:WorldRelationship[] = oldOwner&&!external.some(r=>r.from.id===id)?[{id:crypto.randomUUID(),type:'part of',from:{kind:'structure',id},to:{kind:'organisation',id:oldOwner},...(at?{untilPoint:at}:{archived:true})}]:[];
   return [...prior,{id:crypto.randomUUID(),type:'part of',from:{kind:'structure' as const,id},to:{kind:'organisation' as const,id:organisationId},fromPoint:at}];
 });
 const next={...world,entities:world.entities.map(e=>selected.has(e.id)?{...e,organisationId}:e),relationships:[...retained,...placements]};
 validateWorld(next,story,documents);return next;
}
export function validateStructureChange(next:WorldRecord,story:StoryRecord,documents:ScreenplayRecord[]) { validateWorld(next,story,documents); return next; }

export function reorderStructures(world:WorldRecord,ids:string[],delta:-1|1,story:StoryRecord,documents:ScreenplayRecord[],at?:WorldPoint):WorldRecord {
 const selected=new Set(ids),parents=structureParents(world,story,documents,at),groups=new Map<string,WorldEntity[]>();
 for(const e of world.entities.filter(e=>e.kind==='structure'&&!e.archived)) {const key=[e.organisationId,e.hierarchyLevel,parents.get(e.id)?.map(refKey).sort().join(',')].join('|');groups.set(key,[...groups.get(key)??[],e]);}
 const order=new Map<string,number>();
 for(const peers of groups.values()) {if(!peers.some(e=>selected.has(e.id)))continue;peers.sort((a,b)=>(a.displayOrder??0)-(b.displayOrder??0)||a.name.localeCompare(b.name));if(delta===-1){for(let i=1;i<peers.length;i++)if(selected.has(peers[i].id)&&!selected.has(peers[i-1].id))[peers[i-1],peers[i]]=[peers[i],peers[i-1]];}else{for(let i=peers.length-2;i>=0;i--)if(selected.has(peers[i].id)&&!selected.has(peers[i+1].id))[peers[i+1],peers[i]]=[peers[i],peers[i+1]];}peers.forEach((e,i)=>order.set(e.id,i));}
 return {...world,entities:world.entities.map(e=>order.has(e.id)?{...e,displayOrder:order.get(e.id)}:e)};
}

export function diagramChildren(world:WorldRecord,story:StoryRecord,documents:ScreenplayRecord[],at:WorldPoint|undefined,ref:WorldRef,command=false,kind='all',types?:string[]): {ref:WorldRef;r?:WorldRelationship}[] {
 const relationships=world.relationships.filter(r=>relationshipAt(r,at,story,documents)==='active'&&(!types?.length||types.includes(r.type)));
 const parents=structureParents(world,story,documents,at);
 const result:{ref:WorldRef;r?:WorldRelationship}[]=[];
 for(const e of world.entities.filter(e=>e.kind==='structure'&&!e.archived)) if(parents.get(e.id)?.some(p=>refKey(p)===refKey(ref))) result.push({ref:{kind:'structure',id:e.id}});
 for(const r of relationships) {
   if(r.type==='part of'&&r.from.kind==='organisation'&&refKey(r.to)===refKey(ref)) result.push({ref:r.from,r});
   if(r.type==='member of') {
     const target=membershipTarget(r);
     const managers=membershipReporterIds(world,story,r,documents,at).filter(id=>relationships.some(other=>other.type==='member of'&&other.from.kind==='character'&&other.from.id===id&&refKey(membershipTarget(other))===refKey(target)));
     if((refKey(target)===refKey(ref)&&!managers.length)||(ref.kind==='character'&&managers.includes(ref.id))) result.push({ref:r.from,r});
     continue;
   }
   if(r.type==='reports to'&&r.from.kind==='character'&&refKey(r.to)===refKey(ref)) result.push({ref:r.from,r});
   if(command || ['part of','reports to'].includes(r.type)&&['organisation','structure'].includes(r.from.kind))continue;
   if(refKey(r.to)===refKey(ref)&&['belongs to','applies to','attached to','owned by','used by','known by'].includes(r.type)) result.push({ref:r.from,r});
   if(refKey(r.from)===refKey(ref)&&['based at','located at','requires','governed by'].includes(r.type)) result.push({ref:r.to,r});
 }
 return result.filter((x,i,all)=>all.findIndex(y=>refKey(y.ref)===refKey(x.ref)&&y.r?.id===x.r?.id)===i&&(kind==='all'||['organisation','structure'].includes(x.ref.kind)||x.ref.kind===kind)).sort((a,b)=>{
   const x=world.entities.find(e=>e.id===a.ref.id),y=world.entities.find(e=>e.id===b.ref.id);
   if(x&&y)return structureSort(x,y);
   if(x?.kind==='structure')return -1;if(y?.kind==='structure')return 1;
   const rankA=world.entities.find(e=>e.id===a.r?.rankId)?.rankLevel??Infinity,rankB=world.entities.find(e=>e.id===b.r?.rankId)?.rankLevel??Infinity;
   return rankA-rankB;
 });
}
