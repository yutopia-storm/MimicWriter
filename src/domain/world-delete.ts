import type { StoryRecord } from '../shared/story';
import type { WorldRecord, WorldRef } from '../shared/worlds';
import { refKey, resolveWorldRef } from './worlds';
import { deleteStoryEntity } from './story';

export type WorldDeleteTarget = { kind: 'world' } | { kind: 'entity'; ref: WorldRef } | { kind: 'diagram'; id: string } | { kind: 'relationship'; id: string };
export type ChildDisposition = { mode: 'move'; organisationId?: string } | { mode: 'delete' };

/** Include archived and ended placements: permanent deletion applies to every time slice. */
export function structureChildren(world: WorldRecord, id: string) {
  const found = new Set<string>();
  const visit = (parent: string) => {
    for (const e of world.entities.filter(e => e.kind === 'structure' && e.id !== id)) {
      if (!found.has(e.id) && (e.organisationId === parent || world.relationships.some(r => r.from.id === e.id && r.to.id === parent && ['part of', 'reports to'].includes(r.type)))) {
        found.add(e.id); visit(e.id);
      }
    }
  };
  visit(id);
  return world.entities.filter(e => found.has(e.id));
}

export function inspectWorldDeletion(story: StoryRecord, world: WorldRecord, target: WorldDeleteTarget, disposition?: ChildDisposition) {
  const entity = target.kind === 'entity' ? resolveWorldRef(world, story, target.ref) : undefined;
  const name = target.kind === 'world' ? world.name : target.kind === 'diagram' ? world.diagrams.find(d => d.id === target.id)?.name : target.kind === 'relationship' ? 'relationship' : entity?.name;
  const children = target.kind === 'entity' && ['organisation', 'structure'].includes(target.ref.kind) ? structureChildren(world, target.ref.id) : [];
  const refs = target.kind === 'entity' ? [target.ref, ...(disposition?.mode === 'delete' ? children.map(e => ({ kind: e.kind, id: e.id })) : [])] : [];
  const keys = new Set(refs.map(refKey)), ids = new Set(refs.map(r => r.id));
  const linked = new Set<string>();
  const canonical = target.kind === 'entity' && ['character', 'location'].includes(target.ref.kind);
  if (target.kind === 'relationship') {
    const relationship = world.relationships.find(r => r.id === target.id);
    if (relationship) for (const ref of [relationship.from, relationship.to]) linked.add((resolveWorldRef(world, story, ref)?.name ?? ref.id) + ' · ' + relationship.type);
  }
  for (const w of canonical ? story.worlds ?? [] : [world]) {
    for (const r of w.relationships) {
      if (target.kind === 'world' || keys.has(refKey(r.from)) || keys.has(refKey(r.to)) || [r.unitId, r.rankId, r.positionId, r.reportsToId, ...r.reportsToIds ?? []].some(id => id && ids.has(id))) {
        for (const ref of [r.from, r.to, ...(r.unitId ? [{ kind: 'structure' as const, id: r.unitId }] : [])]) {
          if (!keys.has(refKey(ref))) linked.add((resolveWorldRef(w, story, ref)?.name ?? ref.id) + ' · ' + r.type + (r.archived || r.untilPoint ? ' (historical)' : ''));
        }
      }
    }
    for (const e of w.entities) for (const [field, ref] of Object.entries(e.fieldLinks ?? {})) if (keys.has(refKey(ref))) linked.add(e.name + ' · ' + field);
    for (const e of w.entities) if ([...e.allowedRankIds??[],...e.unitIds??[]].some(id=>ids.has(id))) linked.add(e.name+' · Position availability');
    for (const d of w.diagrams) if (target.kind === 'world' || d.root && keys.has(refKey(d.root)) || d.collapsedIds?.some(k => keys.has(k)) || target.kind === 'entity' && (!d.kinds?.length || d.kinds.includes(target.ref.kind))) linked.add(d.name + ' · Diagram view');
  }
  const occurrences = (story.worldOccurrences ?? []).filter(o => target.kind === 'world' ? o.worldId === world.id : keys.has(refKey(o.entity)) && (canonical || o.worldId === world.id));
  if (occurrences.length) linked.add(occurrences.length + ' screenplay references');
  if (canonical) {
    const id = target.kind === 'entity' ? target.ref.id : '';
    const sceneCount = story.scenes.filter(s => s.locationId === id || [s.presentIds, s.involvedIds, s.remoteIds, s.referencedIds].some(v => v?.includes(id))).length;
    const eventCount = story.events.filter(e => e.locationId === id || [e.presentIds, e.involvedIds, e.remoteIds, e.referencedIds, e.participantIds].some(v => v?.includes(id))).length;
    if (sceneCount || eventCount) linked.add(`${sceneCount} scene and ${eventCount} event metadata links`);
    for (const r of story.relationships ?? []) if (r.fromId === id || r.toId === id) linked.add((story.characters.find(c => c.id === (r.fromId === id ? r.toId : r.fromId))?.name ?? 'Character') + ' · Character relationship');
  }
  return { name: name ?? 'entry', children, linked: [...linked], canonical, refs };
}

export function deleteWorldData(story: StoryRecord, worldId: string, target: WorldDeleteTarget, disposition?: ChildDisposition): StoryRecord {
  const world = story.worlds?.find(w => w.id === worldId);
  if (!world) throw new Error('World no longer exists.');
  if (target.kind === 'world') return { ...story, worlds: story.worlds!.filter(w => w.id !== worldId), worldOccurrences: story.worldOccurrences?.filter(o => o.worldId !== worldId), worldUi: story.worldUi && { ...story.worldUi, pins: story.worldUi.pins.filter(p => p.worldId !== worldId) }, identityMerges: story.identityMerges?.map(m => ({ ...m, worldLinks: m.worldLinks?.filter(l => l.worldId !== worldId) })) };
  if (target.kind === 'diagram' || target.kind === 'relationship') return { ...story, worlds: story.worlds!.map(w => w.id !== worldId ? w : { ...w, diagrams: target.kind === 'diagram' ? w.diagrams.filter(d => d.id !== target.id) : w.diagrams, relationships: target.kind === 'relationship' ? w.relationships.filter(r => r.id !== target.id) : w.relationships }), worldUi: story.worldUi && { ...story.worldUi, pins: story.worldUi.pins.filter(p => !(p.worldId === worldId && target.kind === 'diagram' && p.diagramId === target.id)) }, identityMerges: story.identityMerges?.map(m => ({ ...m, worldLinks: m.worldLinks?.filter(l => !(l.worldId === worldId && l.id === target.id)) })) };
  const plan = inspectWorldDeletion(story, world, target, disposition);
  if (plan.children.length && !disposition) throw new Error('Choose what happens to child structures.');
  const deleted = new Set(plan.refs.map(refKey)), ids = new Set(plan.refs.map(r => r.id));
  const entity = world.entities.find(e => e.id === target.ref.id);
  const owner = entity?.kind === 'organisation' ? disposition?.mode === 'move' ? disposition.organisationId : undefined : entity?.organisationId;
  if (plan.children.length && disposition?.mode === 'move' && !world.entities.some(e => e.id === owner && e.kind === 'organisation' && e.id !== target.ref.id)) throw new Error('Choose a surviving Organisation for the child structures.');
  const children = new Set(plan.children.map(e => e.id));
  const parents = entity?.kind === 'structure' ? world.relationships.filter(r => r.from.id === entity.id && ['part of','reports to'].includes(r.type) && !r.archived && !r.untilPoint && !ids.has(r.to.id) && !children.has(r.to.id) && ['organisation','structure'].includes(r.to.kind)).map(r => r.to) : [];
  let next = plan.canonical ? deleteStoryEntity(story, target.ref.kind === 'character' ? 'characters' : 'locations', target.ref.id) : story;
  const removedRelationships = new Set((story.worlds ?? []).flatMap(w => w.relationships.filter(r => deleted.has(refKey(r.from)) || deleted.has(refKey(r.to)) || r.unitId && ids.has(r.unitId)).map(r => r.id)));
  next = { ...next, worlds: next.worlds?.map(w => {
    if (!plan.canonical && w.id !== worldId) return w;
    const relationships = w.relationships.flatMap(r => {
      if (deleted.has(refKey(r.from)) || r.unitId && ids.has(r.unitId)) { removedRelationships.add(r.id); return []; }
      if (deleted.has(refKey(r.to))) {
        if (disposition?.mode === 'move' && children.has(r.from.id) && ['part of','reports to'].includes(r.type)) return (parents.length ? parents : [{ kind: 'organisation' as const, id: owner! }]).map((to,i) => ({ ...r, id: i ? crypto.randomUUID() : r.id, to }));
        removedRelationships.add(r.id); return [];
      }
      return [{ ...r, rankId: r.rankId && ids.has(r.rankId) ? undefined : r.rankId, positionId: r.positionId && ids.has(r.positionId) ? undefined : r.positionId, reportsToId: r.reportsToId && ids.has(r.reportsToId) ? undefined : r.reportsToId, reportsToIds: r.reportsToIds?.filter(id => !ids.has(id)) }];
    });
    return { ...w, entities: w.entities.filter(e => !deleted.has(refKey(e))).map(e => ({ ...e, allowedRankIds:e.allowedRankIds?.filter(id=>!ids.has(id)), unitIds:e.unitIds?.filter(id=>!ids.has(id)), organisationId: e.organisationId && ids.has(e.organisationId) ? e.kind === 'structure' ? owner : undefined : e.organisationId, fieldLinks: e.fieldLinks && Object.fromEntries(Object.entries(e.fieldLinks).filter(([,ref]) => !deleted.has(refKey(ref)))) })), relationships, diagrams: w.diagrams.map(d => ({ ...d, root: d.root && deleted.has(refKey(d.root)) ? undefined : d.root, collapsedIds: d.collapsedIds?.filter(k => !deleted.has(k)) })) };
  }), worldOccurrences: next.worldOccurrences?.filter(o => !(deleted.has(refKey(o.entity)) && (plan.canonical || o.worldId === worldId))), worldUi: next.worldUi && { ...next.worldUi, pins: next.worldUi.pins.filter(p => !(p.entity && deleted.has(refKey(p.entity)) && (plan.canonical || p.worldId === worldId))) },
  // Identity separation must not restore permanently deleted entities or old World links.
  identityMerges: next.identityMerges?.filter(m => !ids.has(m.targetId) && !ids.has(m.source.id)).map(m => ({ ...m, worldLinks: m.worldLinks?.filter(l => !l.id || !removedRelationships.has(l.id) && !ids.has(l.id)) })) };
  return next;
}
