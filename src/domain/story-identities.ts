import type { ScreenplayRecord } from '../shared/models';
import type { IdentityMerge, StoryEntity, StoryRecord } from '../shared/story';
import { extractSceneHeading, synchronizeSceneDefaults } from './story-extraction';
import { parseCharacterCue } from './continuous-editor';

const unique = (values: string[]) => [...new Set(values)];
const key = (name: string) => name.trim().replace(/\s+/g, ' ').toUpperCase();
const aliases = (entity: StoryEntity) => unique([key(entity.name), ...entity.sourceNames ?? []]);
const fields = (kind: IdentityMerge['kind']) => kind === 'characters' ? ['presentIds', 'involvedIds', 'remoteIds', 'referencedIds', 'participantIds'] : ['locationId'];

/** Attach a screenplay cue/heading identity to an existing canonical entity. */
export function addScreenplayIdentity(story: StoryRecord, kind: IdentityMerge['kind'], targetId: string, name: string, documents: ScreenplayRecord[]): StoryRecord {
  const identity = key(name);
  if (!identity) throw new Error('Enter a screenplay identity.');
  const owner = story[kind].find(item => aliases(item).includes(identity));
  if (owner && owner.id !== targetId) throw new Error(`${identity} already belongs to ${owner.name}. Merge those identities instead.`);
  const next = structuredClone(story), target = next[kind].find(item => item.id === targetId);
  if (!target) throw new Error('Identity not found.');
  target.sourceNames = unique([...aliases(target), identity]);
  const sourceIds = new Set(target.sourceElementIds ?? []);
  for (const document of documents) for (const scene of document.scenes) for (const element of scene.elements) {
    const sourceName = kind === 'characters' && element.type === 'character' ? parseCharacterCue(element.content).name : kind === 'locations' && element.type === 'scene_heading' ? extractSceneHeading(element.content).location : undefined;
    if (sourceName && key(sourceName) === identity) sourceIds.add(element.id);
  }
  target.sourceElementIds = [...sourceIds];
  if (kind === 'characters') next.ignoredCharacterNames = next.ignoredCharacterNames?.filter(item => key(item) !== identity);
  else next.ignoredLocationNames = next.ignoredLocationNames?.filter(item => key(item) !== identity);
  return synchronizeSceneDefaults(next, documents);
}

/** Only the story sidecar is changed. The source entity and its pre-merge links remain recoverable. */
export function mergeIdentity(story: StoryRecord, kind: IdentityMerge['kind'], sourceId: string, targetId: string): StoryRecord {
  if (sourceId === targetId) return story;
  const next = structuredClone(story);
  const source = next[kind].find(item => item.id === sourceId), target = next[kind].find(item => item.id === targetId);
  if (!source || !target) throw new Error('Identity not found.');
  let ancestor = target.parentId;
  const visited = new Set<string>();
  while (ancestor && !visited.has(ancestor)) {
    if (ancestor === sourceId) throw new Error('Move the child location outside this hierarchy before merging its parent into it.');
    visited.add(ancestor); ancestor = next[kind].find(item => item.id === ancestor)?.parentId;
  }
  const record: IdentityMerge = { kind, targetId, source: structuredClone(source), links: [] };
  if (kind === 'characters') {
    record.relationships = next.relationships?.filter(item => item.fromId === sourceId || item.toId === sourceId);
    next.relationships = next.relationships?.map(item => ({ ...item, fromId: item.fromId === sourceId ? targetId : item.fromId, toId: item.toId === sourceId ? targetId : item.toId }));
  } else record.childIds = next.locations.filter(item => item.parentId === sourceId).map(item => item.id);
  if (source.profile) {
    const sourceProfile = source.profile, targetProfile = target.profile ?? {};
    target.profile = { ...sourceProfile, ...targetProfile,
      images: [...targetProfile.images ?? [], ...sourceProfile.images ?? []],
      skills: [...targetProfile.skills ?? [], ...sourceProfile.skills ?? []],
      customFields: [...targetProfile.customFields ?? [], ...sourceProfile.customFields ?? []],
      aliases: unique([...targetProfile.aliases ?? [], ...sourceProfile.aliases ?? []]),
      appearances: [...targetProfile.appearances ?? [], ...(sourceProfile.appearances ?? []).map(item => targetProfile.appearances?.some(value => value.isDefault) ? { ...item, isDefault: false } : item)],
    };
  }
  const replace = (object: object, itemKind: 'scene' | 'event', id: string, recordLinks: boolean) => {
    const data = object as Record<string, unknown>;
    for (const field of fields(kind)) {
      const value = data[field];
      if (Array.isArray(value) && value.includes(sourceId)) {
        if (recordLinks) record.links.push({ kind: itemKind, id, field, targetHad: value.includes(targetId) });
        data[field] = unique(value.map(value => value === sourceId ? targetId : value));
      } else if (value === sourceId) {
        if (recordLinks) record.links.push({ kind: itemKind, id, field, targetHad: false });
        data[field] = targetId;
      }
    }
  };
  for (const scene of next.scenes) { replace(scene, 'scene', scene.sceneId, true); if (scene.derived) replace(scene.derived, 'scene', scene.sceneId, false); }
  for (const event of next.events) replace(event, 'event', event.id, true);
  const worldKind = kind === 'characters' ? 'character' : 'location';
  record.worldLinks = [];
  for (const world of next.worlds ?? []) {
    const key = kind === 'characters' ? 'characterIds' : 'locationIds';
    if (world[key].includes(sourceId)) { record.worldLinks.push({ worldId: world.id, type: 'member', targetHad: world[key].includes(targetId) }); world[key] = unique(world[key].map(id => id === sourceId ? targetId : id)); }
    for (const owner of world.entities) for (const [field,ref] of Object.entries(owner.fieldLinks ?? {})) if (ref.kind === worldKind && ref.id === sourceId) { record.worldLinks.push({ worldId: world.id, type: 'field', id: owner.id, field }); ref.id = targetId; }
    for (const relationship of world.relationships) {
      for (const field of ['from', 'to'] as const) if (relationship[field].kind === worldKind && relationship[field].id === sourceId) { record.worldLinks.push({ worldId: world.id, type: field, id: relationship.id }); relationship[field].id = targetId; }
      if (kind === 'characters' && relationship.reportsToIds?.includes(sourceId)) { record.worldLinks.push({worldId:world.id,type:'reportsToMany',id:relationship.id,targetHad:relationship.reportsToIds.includes(targetId)}); relationship.reportsToIds=unique(relationship.reportsToIds.map(id=>id===sourceId?targetId:id)); }
      if (kind === 'characters' && relationship.reportsToId === sourceId) { record.worldLinks.push({ worldId: world.id, type: 'reportsTo', id: relationship.id }); relationship.reportsToId = targetId; }
    }
  }
  for (const occurrence of next.worldOccurrences ?? []) if (occurrence.entity.kind === worldKind && occurrence.entity.id === sourceId) { record.worldLinks.push({ worldId: occurrence.worldId, type: 'occurrence', id: occurrence.id }); occurrence.entity.id = targetId; }
  target.sourceNames = unique([...aliases(target), ...aliases(source)]);
  target.sourceElementIds = unique([...target.sourceElementIds ?? [], ...source.sourceElementIds ?? []]);
  for (const item of next[kind]) if (item.parentId === sourceId) item.parentId = item.id === targetId ? source.parentId : targetId;
  // Nested merges can be separated in reverse order without losing their original records.
  for (const old of next.identityMerges ?? []) if (old.kind === kind && old.targetId === sourceId) old.targetId = targetId;
  next.identityMerges = [...next.identityMerges ?? [], record];
  next[kind] = next[kind].filter(item => item.id !== sourceId);
  return next;
}

export function separateIdentity(story: StoryRecord, kind: IdentityMerge['kind'], targetId: string, name: string, documents: ScreenplayRecord[]): StoryRecord {
  const next = structuredClone(story);
  const target = next[kind].find(item => item.id === targetId);
  if (!target) throw new Error('Identity not found.');
  const history = next.identityMerges?.find(item => item.kind === kind && item.targetId === targetId && aliases(item.source).includes(key(name)));
  const containing = history && next.identityMerges?.find(item => item !== history && item.kind === kind && item.targetId === targetId && aliases(item.source).includes(key(history.source.name)));
  if (containing) throw new Error(`Separate ${containing.source.name} first, then separate ${name} from that restored identity.`);
  const source: StoryEntity = history ? structuredClone(history.source) : { id: crypto.randomUUID(), name, description: '', sourceNames: [key(name)] };
  if (next[kind].some(item => item.id === source.id)) throw new Error('Identity already exists.');
  const sourceAliases = aliases(source);
  target.sourceNames = aliases(target).filter(name => !sourceAliases.includes(name));
  if (!target.sourceNames.length) throw new Error('Keep at least one identity on the canonical entity.');
  const sourceElements = new Set(source.sourceElementIds ?? []);
  for (const document of documents) for (const scene of document.scenes) for (const element of scene.elements) {
    const name = kind === 'characters' && element.type === 'character' ? parseCharacterCue(element.content).name : kind === 'locations' && element.type === 'scene_heading' ? extractSceneHeading(element.content).location : undefined;
    if (name && sourceAliases.includes(key(name))) sourceElements.add(element.id);
  }
  source.sourceElementIds = [...sourceElements];
  target.sourceElementIds = target.sourceElementIds?.filter(id => !sourceElements.has(id));
  if (source.parentId && !next[kind].some(item => item.id === source.parentId)) source.parentId = undefined;
  next[kind].push(source);
  for (const link of history?.worldLinks ?? []) {
    if (link.type === 'occurrence') { const o = next.worldOccurrences?.find(o => o.id === link.id); if (o?.entity.id === targetId) o.entity.id = source.id; continue; }
    const world = next.worlds?.find(w => w.id === link.worldId); if (!world) continue;
    if (link.type === 'field') { const ref = link.field ? world.entities.find(e => e.id === link.id)?.fieldLinks?.[link.field] : undefined; if (ref?.id === targetId) ref.id = source.id; continue; }
    if (link.type === 'member') { const key = kind === 'characters' ? 'characterIds' : 'locationIds'; if (world[key].includes(targetId)) world[key] = unique([...world[key].filter(id => link.targetHad || id !== targetId), source.id]); }
    else { const r = world.relationships.find(r => r.id === link.id); if (!r) continue; if (link.type === 'reportsToMany') { if(r.reportsToIds?.includes(targetId)) r.reportsToIds=unique([...r.reportsToIds.filter(id=>link.targetHad||id!==targetId),source.id]); } else if (link.type === 'reportsTo') { if (r.reportsToId === targetId) r.reportsToId = source.id; } else if (r[link.type].id === targetId) r[link.type].id = source.id; }
  }
  for (const original of history?.relationships ?? []) {
    const relation = next.relationships?.find(item => item.id === original.id);
    if (!relation) continue;
    if (original.fromId === source.id && relation.fromId === targetId) relation.fromId = source.id;
    if (original.toId === source.id && relation.toId === targetId) relation.toId = source.id;
  }
  for (const id of history?.childIds ?? []) { const child = next.locations.find(item => item.id === id); if (child?.parentId === targetId) child.parentId = source.id; }
  if (target.profile && source.profile) {
    for (const field of ['images', 'skills', 'appearances', 'customFields'] as const) {
      const sourceIds = new Set(source.profile[field]?.map(item => item.id));
      Object.assign(target.profile, { [field]: target.profile[field]?.filter(item => !sourceIds.has(item.id)) });
    }
    if (!target.profile.images?.some(item => item.id === target.profile?.primaryImageId)) target.profile.primaryImageId = target.profile.images?.[0]?.id;
  }
  for (const old of next.identityMerges ?? []) if (old !== history && old.kind === kind && old.targetId === targetId && sourceAliases.includes(key(old.source.name))) old.targetId = source.id;
  for (const link of history?.links ?? []) {
    const item = link.kind === 'scene' ? next.scenes.find(item => item.sceneId === link.id) : next.events.find(item => item.id === link.id);
    if (!item) continue;
    const restore = (object: object) => {
      const data = object as Record<string, unknown>, value = data[link.field];
      if (Array.isArray(value) && value.includes(targetId)) data[link.field] = unique([...value.filter(id => link.targetHad || id !== targetId), source.id]);
      else if (value === targetId) data[link.field] = source.id;
    };
    restore(item);
    if ('derived' in item && item.derived) restore(item.derived);
  }
  next.identityMerges = next.identityMerges?.filter(item => item !== history);
  // Recalculate automatic appearances, including scenes written since the merge.
  for (const scene of next.scenes) for (const field of fields(kind)) {
    if (!scene.manualFields?.includes(field) && scene.derived) {
      const data = scene as unknown as Record<string, unknown>;
      const derived = scene.derived as Record<string, unknown>;
      if (JSON.stringify(data[field]) === JSON.stringify(derived[field])) { delete data[field]; delete derived[field]; }
    }
  }
  return synchronizeSceneDefaults(next, documents);
}
