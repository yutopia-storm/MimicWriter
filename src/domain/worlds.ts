import { migrateWorldRecord } from './world-structure';
import { z } from 'zod';
import type { WorldRecord, WorldRef, WorldPoint, WorldPackage, WorldRelationship } from '../shared/worlds';
import type { StoryRecord, StoryEntity } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import { validateProfileImage } from '../shared/profile-assets';
import { chronology as storyChronology, migrateStory, resolveEvent } from './story';
const id = z.string().min(1);
export const worldRefSchema = z.object({ kind: z.enum(['organisation', 'structure', 'rank', 'position', 'character', 'location', 'object', 'vehicle', 'rule', 'lore', 'note', 'event', 'plot', 'scene', 'world', 'custom']), id });
const chronology = z.lazy(() => storyChronology);
const point = z.object({ sceneId: id.optional(), eventId: id.optional(), screenplayId: id.optional(), chronology: chronology.optional() });
export const worldSchema = z.object({ schemaVersion: z.literal(1), structureModelVersion: z.literal(1).optional(), id, name: z.string().min(1), description: z.string(), characterIds: z.array(id), locationIds: z.array(id), entities: z.array(z.object({ id, name: z.string().min(1), description: z.string(), kind: z.enum(['organisation', 'structure', 'rank', 'position', 'object', 'vehicle', 'rule', 'lore', 'note', 'custom']), organisationId: id.optional(), structureType: z.string().optional(), hierarchyLevel: z.number().int().positive().optional(), displayOrder: z.number().int().optional(), category: z.string().optional(), organisationRole: z.enum(['unit', 'rank', 'position']).optional(), customType: z.string().optional(), abbreviation: z.string().optional(), rankLevel: z.number().finite().optional(), rankGroup: z.string().optional(), fieldLinks: z.record(z.string(), worldRefSchema).optional(), archived: z.boolean().optional(), fields: z.record(z.string(), z.string()).optional(), aliases: z.array(z.string()).optional(), imageIds: z.array(z.string().uuid()).optional(), allowedRankIds: z.array(id).optional(), unitIds: z.array(id).optional(), history: z.array(z.object({id,fromPoint:point.optional(),untilPoint:point.optional(),fields:z.record(z.string(),z.string()),notes:z.string().optional()})).optional() })), relationships: z.array(z.object({ id, from: worldRefSchema, to: worldRefSchema, type: z.string().min(1), fromPoint: point.optional(), untilPoint: point.optional(), notes: z.string().optional(), importance: z.string().optional(), unitId: id.optional(), rankId: id.optional(), positionId: id.optional(), reportsToId: id.optional(), reportsToIds: z.array(id).optional(), archived: z.boolean().optional() })), diagrams: z.array(z.object({ id, name: z.string(), mode: z.enum(['organisation', 'command']).optional(), root: worldRefSchema.optional(), relationshipTypes: z.array(z.string()).optional(), kinds: z.array(worldRefSchema.shape.kind).optional(), collapsedIds: z.array(id).optional() })), fieldOptions: z.record(z.string(),z.array(z.string())).optional(), relationshipOptions: z.array(z.object({sourceKind:worldRefSchema.shape.kind,targetKind:worldRefSchema.shape.kind,label:z.string().min(1),inverseLabel:z.string().optional()})).optional(), provenance: z.object({ worldId: id, copiedAt: z.string(), identityMap: z.record(z.string(), id) }).optional(), archived: z.boolean().optional() });
export const worldOccurrenceSchema = z.object({ source: z.object({elementId:id.optional(),elementType:z.string().optional(),speakerId:id.optional(),characterIds:z.array(id).optional(),locationId:id.optional(),chronology:chronology.optional(),recordId:id.optional()}).optional(), id, worldId: id.optional(), entity: worldRefSchema, screenplayId: id, sceneId: id, scope: z.enum(['scene', 'text']), from: z.object({ elementId: id, offset: z.number().int().nonnegative() }).optional(), to: z.object({ elementId: id, offset: z.number().int().nonnegative() }).optional(), selectedText: z.string().optional(), needsReview: z.boolean().optional() }).refine(o => o.scope !== 'text' || Boolean(o.from && o.to && o.selectedText), 'Text link needs stable anchors');
export const worldUiSchema = z.object({ pins: z.array(z.object({ worldId: id, entity: worldRefSchema.optional(), diagramId: id.optional() })), showLinks: z.boolean().optional() });
export const refKey = (ref: WorldRef) => ref.kind + ':' + ref.id;
export function createWorld(name: string): WorldRecord { return { schemaVersion: 1, structureModelVersion: 1, id: crypto.randomUUID(), name: name.trim(), description: '', characterIds: [], locationIds: [], entities: [], relationships: [], diagrams: [] }; }
export function worldEntities(world: WorldRecord, story: StoryRecord): (StoryEntity & {
    kind: WorldRef['kind'];
})[] { const characters = new Set(world.characterIds), locations = new Set(world.locationIds); return [...world.entities, ...story.characters.filter(e => characters.has(e.id)).map(e => ({ ...e, kind: 'character' as const })), ...story.locations.filter(e => locations.has(e.id)).map(e => ({ ...e, kind: 'location' as const }))]; }
export function resolveWorldRef(world: WorldRecord, story: StoryRecord, ref: WorldRef, documents: ScreenplayRecord[] = []): StoryEntity | undefined { if (ref.kind === 'character')
    return story.characters.find(e => e.id === ref.id); if (ref.kind === 'location')
    return story.locations.find(e => e.id === ref.id); if (ref.kind === 'scene') {
    const d = documents.find(d => d.scenes.some(s => s.id === ref.id));
    const scene = d?.scenes.find(s => s.id === ref.id);
    return scene ? { id: scene.id, name: d!.title + ' · Scene ' + (d!.scenes.indexOf(scene) + 1), description: scene.elements.find(e => e.type === 'scene_heading')?.content ?? '' } : undefined;
} if (ref.kind === 'world')
    return world.id === ref.id ? world : undefined; if (ref.kind === 'event')
    return story.events.find(e => e.id === ref.id); if (ref.kind === 'plot')
    return story.plots.find(e => e.id === ref.id); return worldEntities(world, story).find(e => e.kind === ref.kind && e.id === ref.id); }
function pointValue(point: WorldPoint, story: StoryRecord, documents: ScreenplayRecord[]) { const scene = point.sceneId ? story.scenes.find(s => s.sceneId === point.sceneId) : undefined; const event = point.eventId ? story.events.find(e => e.id === point.eventId) : undefined; const chronology = point.chronology ?? (event ? resolveEvent(story, event).chronology : scene?.chronology); const screenplayId = point.screenplayId ?? scene?.screenplayId ?? (event?.occursInSceneId ? story.scenes.find(s => s.sceneId === event.occursInSceneId)?.screenplayId : undefined) ?? documents.find(d => d.scenes.some(s => s.id === (point.sceneId ?? event?.occursInSceneId)))?.id; return { chronology, screenplay: screenplayId ? documents.findIndex(d => d.id === screenplayId) : undefined, scene: point.sceneId ? documents.flatMap(d => d.scenes).findIndex(s => s.id === point.sceneId) : undefined }; }
export function compareWorldPoints(a: WorldPoint, b: WorldPoint, story: StoryRecord, documents: ScreenplayRecord[]): number | undefined { const x = pointValue(a, story, documents), y = pointValue(b, story, documents); if (a.screenplayId || b.screenplayId) {
    if (x.screenplay !== undefined && y.screenplay !== undefined && x.screenplay >= 0 && y.screenplay >= 0)
        return x.screenplay - y.screenplay;
} if (x.chronology?.date && y.chronology?.date)
    return (x.chronology.date + (x.chronology.time ?? '00:00')).localeCompare(y.chronology.date + (y.chronology.time ?? '00:00')); if (x.chronology?.day !== undefined && y.chronology?.day !== undefined)
    return x.chronology.day - y.chronology.day || (x.chronology.time ?? '00:00').localeCompare(y.chronology.time ?? '00:00'); if (x.chronology?.position !== undefined && y.chronology?.position !== undefined)
    return x.chronology.position - y.chronology.position; if (x.scene !== undefined && y.scene !== undefined && x.scene >= 0 && y.scene >= 0)
    return x.scene - y.scene; return undefined; }
/** Effective periods are [from, until). Unknown comparisons remain unknown, never guessed. */
export function relationshipAt(r: WorldRelationship, at: WorldPoint | undefined, story: StoryRecord, documents: ScreenplayRecord[]): 'active' | 'inactive' | 'unknown' { if (r.archived)
    return 'inactive'; if (!at)
    return r.untilPoint ? 'inactive' : 'active'; let unknown = false; if (r.fromPoint) {
    const n = compareWorldPoints(at, r.fromPoint, story, documents);
    if (n === undefined)
        unknown = true;
    else if (n < 0)
        return 'inactive';
} if (r.untilPoint) {
    const n = compareWorldPoints(at, r.untilPoint, story, documents);
    if (n === undefined)
        unknown = true;
    else if (n >= 0)
        return 'inactive';
} return unknown ? 'unknown' : 'active'; }
export function validateWorld(world: WorldRecord, story: StoryRecord = { schemaVersion: 1, projectId: 'world-validation', characters: [], locations: [], events: [], plots: [], scenes: [] }, documents: ScreenplayRecord[] = []) {
    const allIds = [world.id, ...world.entities.map(e => e.id), ...world.relationships.map(r => r.id), ...world.diagrams.map(d => d.id)];
    if (new Set(allIds).size !== allIds.length || new Set(world.characterIds).size !== world.characterIds.length || new Set(world.locationIds).size !== world.locationIds.length)
        throw Error('Duplicate World identity');
    const boundaries: (WorldPoint | undefined)[] = [undefined, ...world.relationships.flatMap(r => [r.fromPoint, r.untilPoint].filter((p): p is WorldPoint => Boolean(p)))];
    for (const at of boundaries) {
        const edges = [...world.relationships.filter(r => (r.type === 'part of' || r.type === 'reports to' && r.from.kind === 'structure' && r.to.kind === 'structure') && relationshipAt(r, at, story, documents) === 'active'), ...world.entities.filter(e => e.kind === 'structure' && e.organisationId).map(e => ({ from: { kind: 'structure' as const, id: e.id }, to: { kind: 'organisation' as const, id: e.organisationId! } }))];
        const adjacency = new Map<string, string[]>(), indegree = new Map<string, number>();
        for (const r of edges) {
            const from = refKey(r.from), to = refKey(r.to);
            adjacency.set(from, [...adjacency.get(from) ?? [], to]);
            if (!indegree.has(from))
                indegree.set(from, 0);
            indegree.set(to, (indegree.get(to) ?? 0) + 1);
        }
        const queue = [...indegree.keys()].filter(key => indegree.get(key) === 0);
        let visited = 0;
        for (let index = 0; index < queue.length; index++) {
            const key = queue[index];
            visited++;
            for (const target of adjacency.get(key) ?? []) {
                indegree.set(target, indegree.get(target)! - 1);
                if (indegree.get(target) === 0)
                    queue.push(target);
            }
        }
        if (visited !== indegree.size)
            throw Error('Circular organisation hierarchy');
    }
    return world;
}
export function parseWorldPackage(value: unknown): WorldPackage { const p = z.object({ format: z.literal('story-world'), schemaVersion: z.literal(1), world: worldSchema, characters: z.array(z.object({ id, name: z.string(), description: z.string() }).passthrough()), locations: z.array(z.object({ id, name: z.string(), description: z.string() }).passthrough()), assets: z.record(z.string().uuid(), z.string()) }).parse(value) as WorldPackage; p.world = migrateWorldRecord(p.world); validateWorld(p.world); for (const data of Object.values(p.assets))
    validateProfileImage(data); const canonical = migrateStory({ schemaVersion: 1, projectId: 'world-package', characters: p.characters, locations: p.locations, plots: [], events: [], scenes: [] }, 'world-package'); p.characters = canonical.characters; p.locations = canonical.locations; const imageIds = [...p.world.entities.flatMap(e => e.imageIds ?? []), ...[...p.characters, ...p.locations].flatMap(e => e.profile?.images?.map(i => i.assetId) ?? [])]; if (imageIds.some(id => !p.assets[id]))
    throw Error('World package is missing a referenced image'); if (p.world.characterIds.some(id => !p.characters.some(e => e.id === id)) || p.world.locationIds.some(id => !p.locations.some(e => e.id === id)))
    throw Error('World package is missing linked people or places'); return p; }
export function packageWorld(world: WorldRecord, story: StoryRecord, assets: Record<string, string> = {}): WorldPackage {
    const fieldRefs = world.entities.flatMap(e => Object.values(e.fieldLinks ?? {}));
    const characterIds = new Set([...world.characterIds, ...fieldRefs.filter(r => r.kind === 'character').map(r => r.id), ...world.relationships.flatMap(r => [...r.reportsToIds ?? [], r.reportsToId, r.from.kind === 'character' ? r.from.id : undefined, r.to.kind === 'character' ? r.to.id : undefined].filter((id): id is string => Boolean(id)))]);
    const locationIds = new Set([...world.locationIds, ...fieldRefs.filter(r => r.kind === 'location').map(r => r.id), ...world.relationships.flatMap(r => [r.from.kind === 'location' ? r.from.id : undefined, r.to.kind === 'location' ? r.to.id : undefined].filter((id): id is string => Boolean(id)))]);
    for (const id of locationIds) {
        const parent = story.locations.find(e => e.id === id)?.parentId;
        if (parent)
            locationIds.add(parent);
    }
    return { ...structuredClone({ format: 'story-world' as const, schemaVersion: 1 as const, world, characters: story.characters.filter(e => characterIds.has(e.id)), locations: story.locations.filter(e => locationIds.has(e.id)) }), assets: { ...assets } };
}
export function copyWorld(p: WorldPackage, story: StoryRecord, assetMap: Record<string, string> = {}): StoryRecord {
    p = parseWorldPackage(p);
    const map: Record<string, string> = {};
    for (const old of [p.world.id, ...p.world.entities.map(e => e.id), ...p.characters.map(e => e.id), ...p.locations.map(e => e.id), ...p.world.relationships.map(e => e.id), ...p.world.diagrams.map(e => e.id)])
        map[old] = crypto.randomUUID();
    for (const [items, existing] of [[p.characters, story.characters], [p.locations, story.locations]] as const)
        for (const item of items) {
            const original = existing.find(e => e.id === item.id || p.world.provenance?.identityMap[e.id] === item.id);
            if (original)
                map[item.id] = original.id;
        }
    const mapped = (ref: WorldRef) => ({ ...ref, id: map[ref.id] ?? ref.id });
    const profile = (e: StoryEntity): StoryEntity => ({ ...structuredClone(e), id: map[e.id], sourceElementIds: undefined, parentId: e.parentId ? map[e.parentId] : undefined, profile: e.profile ? { ...e.profile, images: e.profile.images?.map(i => ({ ...i, assetId: assetMap[i.assetId] ?? i.assetId })), primaryImageId: e.profile.primaryImageId } : undefined });
    const world: WorldRecord = { ...structuredClone(p.world), id: map[p.world.id], characterIds: p.world.characterIds.map(id => map[id]), locationIds: p.world.locationIds.map(id => map[id]), entities: p.world.entities.map(e => ({ ...e, id: map[e.id], organisationId: e.organisationId ? map[e.organisationId] ?? e.organisationId : undefined, fieldLinks: e.fieldLinks ? Object.fromEntries(Object.entries(e.fieldLinks).map(([key,ref]) => [key,mapped(ref)])) : undefined, imageIds: e.imageIds?.map(id => assetMap[id] ?? id), allowedRankIds:e.allowedRankIds?.map(id=>map[id]??id), unitIds:e.unitIds?.map(id=>map[id]??id), history:e.history?.map(h=>({...h,id:crypto.randomUUID()})) })), relationships: p.world.relationships.map(r => ({ ...r, id: map[r.id], from: mapped(r.from), to: mapped(r.to), unitId: r.unitId ? map[r.unitId] ?? r.unitId : undefined, rankId: r.rankId ? map[r.rankId] : undefined, positionId: r.positionId ? map[r.positionId] : undefined, reportsToId: r.reportsToId ? map[r.reportsToId] : undefined, reportsToIds: r.reportsToIds?.map(id => map[id] ?? id) })), diagrams: p.world.diagrams.map(d => ({ ...d, id: map[d.id], root: d.root ? mapped(d.root) : undefined, collapsedIds: d.collapsedIds?.map(key => { const split = key.indexOf(':'); return split >= 0 ? key.slice(0, split + 1) + (map[key.slice(split + 1)] ?? key.slice(split + 1)) : map[key] ?? key; }) })), provenance: { worldId: p.world.id, copiedAt: new Date().toISOString(), identityMap: map } };
    return { ...story, characters: [...story.characters, ...p.characters.filter(e => !story.characters.some(x => x.id === map[e.id])).map(profile)], locations: [...story.locations, ...p.locations.filter(e => !story.locations.some(x => x.id === map[e.id])).map(profile)], worlds: [...story.worlds ?? [], world] };
}
export function searchWorld(world: WorldRecord, story: StoryRecord, query: string, includeArchived = false) { const q = query.trim().toLocaleLowerCase(); return worldEntities(world, story).filter(e => (includeArchived || !e.archived) && JSON.stringify(e).toLocaleLowerCase().includes(q)); }
/** Existing story entities keep Scene-level relationship ownership in the story model. */
export function linkCanonicalScene(story: StoryRecord, sceneId: string, screenplayId: string, ref: WorldRef): StoryRecord | undefined {
    if (ref.kind === 'event') {
        const event = story.events.find(e => e.id === ref.id);
        if (!event)
            return;
        return { ...story, events: story.events.map(e => e.id !== ref.id || e.occursInSceneId === sceneId ? e : { ...e, referencedInSceneIds: [...new Set([...e.referencedInSceneIds ?? [], sceneId])] }) };
    }
    if (ref.kind !== 'plot' && ref.kind !== 'character')
        return;
    const scene = story.scenes.find(s => s.sceneId === sceneId) ?? { sceneId, screenplayId };
    const field = ref.kind === 'plot' ? 'plotIds' : 'referencedIds';
    const next = { ...scene, [field]: [...new Set([...scene[field] ?? [], ref.id])], manualFields: [...new Set([...scene.manualFields ?? [], field])] };
    return { ...story, scenes: [...story.scenes.filter(s => s.sceneId !== sceneId), next] };
}
export function canonicalWorldUsages(story: StoryRecord, ref: WorldRef, documents: ScreenplayRecord[]) {
    const sceneIds = new Set<string>();
    if (ref.kind === 'character')
        for (const s of story.scenes)
            if ([...s.presentIds ?? [], ...s.referencedIds ?? [], ...s.involvedIds ?? [], ...s.remoteIds ?? []].includes(ref.id))
                sceneIds.add(s.sceneId);
    if (ref.kind === 'location')
        for (const s of story.scenes)
            if (s.locationId === ref.id)
                sceneIds.add(s.sceneId);
    if (ref.kind === 'plot')
        for (const s of story.scenes)
            if (s.plotIds?.includes(ref.id))
                sceneIds.add(s.sceneId);
    const events = ref.kind === 'event' ? story.events.filter(e => e.id === ref.id) : ref.kind === 'plot' ? story.events.filter(e => e.plotIds?.includes(ref.id)) : ref.kind === 'character' ? story.events.filter(e => [...resolveEvent(story, e).presentIds ?? [], ...e.participantIds ?? [], ...e.referencedIds ?? [], ...e.remoteIds ?? []].includes(ref.id)) : ref.kind === 'location' ? story.events.filter(e => resolveEvent(story, e).locationId === ref.id) : [];
    for (const e of events)
        for (const id of [e.occursInSceneId, ...e.revealedInSceneIds ?? [], ...e.referencedInSceneIds ?? [], ...e.sceneInteractions?.map(i => i.sceneId) ?? []])
            if (id)
                sceneIds.add(id);
    return [...sceneIds].map(sceneId => ({ sceneId, screenplayId: documents.find(d => d.scenes.some(s => s.id === sceneId))?.id ?? story.scenes.find(s => s.sceneId === sceneId)?.screenplayId }));
}

/** Rank/position labels are projections of the same effective membership used by profiles. */
export function characterWorldTerms(story: StoryRecord, characterId: string, documents: ScreenplayRecord[], at?: WorldPoint): string {
    const terms = (story.worlds ?? []).filter(w => !w.archived).flatMap(w => w.relationships.filter(r => r.type === 'member of' && r.from.kind === 'character' && r.from.id === characterId && relationshipAt(r,at,story,documents) === 'active').flatMap(r => [r.rankId,r.positionId].flatMap(id => { const e = w.entities.find(e => e.id === id && !e.archived); return e?.abbreviation?.trim() ? [e.abbreviation.trim()] : []; })));
    return terms.length ? ' (' + [...new Set(terms)].join(', ') + ')' : '';
}
