import { ScreenplaySourceDetails } from './ScreenplayCaptureContext';
import { WorldDeleteDialog } from './WorldDeleteDialog';
import { deleteWorldData } from '../domain/world-delete';
import type { WorldRecord } from '../shared/worlds';
import { membershipTarget } from '../domain/world-structure';
import { useState } from 'react';
import { RelationshipEditor } from './WorldRelationshipEditor';
import { validateWorld } from '../domain/worlds';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldRef } from '../shared/worlds';
import { refKey, relationshipAt, resolveWorldRef } from '../domain/worlds';
export function WorldEntityContext({ story, documents, entity, sceneId, navigate, change, omitMemberships = false, omitRelationships = false }: {
    story: StoryRecord;
    documents: ScreenplayRecord[];
    entity: WorldRef;
    sceneId?: string;
    navigate(sceneId: string): void;
    change?(story: StoryRecord): void;
    omitMemberships?: boolean;
    omitRelationships?: boolean;
}) {
    const [deleting, setDeleting] = useState<{world: WorldRecord; id:string}>();
    const [error, setError] = useState('');
    const relationships = (omitRelationships?[]:story.worlds ?? []).flatMap(world => world.relationships.filter(r => (!omitMemberships || r.type !== 'member of') && (refKey(r.from) === refKey(entity) || refKey(r.to) === refKey(entity))).map(r => ({ world, r })));
    const occurrences = (story.worldOccurrences ?? []).filter(o => refKey(o.entity) === refKey(entity));
    if (!change && !relationships.length && !occurrences.length && !(story.worlds ?? []).some(w=>w.entities.some(e=>Object.values(e.fieldLinks ?? {}).some(ref=>refKey(ref)===refKey(entity)))))
        return null;
    return <section>{deleting && change && <WorldDeleteDialog story={story} world={deleting.world} target={{kind:'relationship',id:deleting.id}} cancel={()=>setDeleting(undefined)} confirm={()=>{window.dispatchEvent(new Event('world-permanent-delete'));change(deleteWorldData(story,deleting.world.id,{kind:'relationship',id:deleting.id}));setDeleting(undefined);}}/>}<h3>World relationships & references</h3>{error && <p role="alert">{error}</p>}{change && (story.worlds ?? []).filter(w => !w.archived).map(world => <details key={world.id}><summary>{world.name} · Links & history</summary><RelationshipEditor world={world} story={story} documents={documents} selected={entity} remove={id=>setDeleting({world,id})} patch={next => { try { validateWorld(next, story, documents); const key = entity.kind === 'character' ? 'characterIds' : 'locationIds'; if (entity.kind === 'character' || entity.kind === 'location') next = { ...next, [key]: [...new Set([...next[key], entity.id])] }; change({ ...story, worlds: story.worlds?.map(w => w.id === next.id ? next : w) }); setError(''); } catch (e) { setError(String(e)); } }} open={other => window.dispatchEvent(new CustomEvent('open-world-reference', { detail: { worldId: world.id, entity: other } }))}/></details>)}{(story.worlds ?? []).flatMap(world => world.entities.flatMap(owner => Object.entries(owner.fieldLinks ?? {}).filter(([,ref]) => refKey(ref) === refKey(entity)).map(([key]) => <label key={world.id + owner.id + key}>{world.name} · {owner.name} · {key}<input readOnly={!change} value={owner.fields?.[key] ?? ''} onChange={e => change?.({ ...story, worlds: story.worlds?.map(w => w.id !== world.id ? w : { ...w, entities: w.entities.map(o => o.id !== owner.id ? o : { ...o, fields: { ...o.fields, [key]: e.target.value } }) }) })}/></label>)))}{relationships.map(({ world, r }) => { const other = refKey(r.from) === refKey(entity) ? membershipTarget(r) : r.from; return <div key={r.id}><button onClick={() => window.dispatchEvent(new CustomEvent('open-world-reference', { detail: { worldId: world.id, entity: other } }))}>{world.name} · {r.type} · {resolveWorldRef(world, story, other, documents)?.name ?? 'Linked entry unavailable'}</button><small>{relationshipAt(r, sceneId ? { sceneId } : undefined, story, documents)}{r.rankId ? ' · ' + world.entities.find(e => e.id === r.rankId)?.name : ''}{r.positionId ? ' · ' + world.entities.find(e => e.id === r.positionId)?.name : ''}</small></div>; })}<p>{new Set(occurrences.map(o => o.sceneId)).size} linked screenplay scenes</p>{occurrences.map(o => { const d = documents.find(d => d.id === o.screenplayId); const index = d?.scenes.findIndex(s => s.id === o.sceneId) ?? -1; return <button key={o.id} disabled={index < 0} onClick={() => navigate(o.sceneId)}>{d?.title ?? 'Removed screenplay'} · {index >= 0 ? 'Scene ' + (index + 1) : 'Removed scene'} · {o.source ? 'Established here' : o.scope === 'text' ? 'Selected text' : 'Scene link'}{o.selectedText ? ' · ' + o.selectedText : ''}<ScreenplaySourceDetails source={o.source} story={story}/></button>; })}</section>;
}
