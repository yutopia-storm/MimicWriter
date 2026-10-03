import { membershipTarget } from '../domain/world-structure';
import { useEffect, useRef, useState } from 'react';
import type { StoryRecord } from '../shared/story';
import type { WorldOccurrence } from '../shared/worlds';
import type { ScreenplayRecord } from '../shared/models';
import { refKey, relationshipAt, resolveWorldRef } from '../domain/worlds';
import { worldStateAt } from '../domain/world-history';
export function WorldQuickReference({ story, documents, hidden }: {
    story: StoryRecord;
    documents: ScreenplayRecord[];
    hidden: boolean;
}) {
    const [hover, setHover] = useState<WorldOccurrence>();
    const latest = useRef(story);
    latest.current = story;
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => { const over = (event: PointerEvent) => { const target = (event.target as HTMLElement).closest<HTMLElement>('[data-world-occurrence]'); if (!target)
        return; clearTimeout(timer.current); const id = target.dataset.worldOccurrence; timer.current = setTimeout(() => { const occurrence = latest.current.worldOccurrences?.find(o => o.id === id); if (!occurrence)
        return; if (occurrence.entity.kind === 'character' || occurrence.entity.kind === 'location') {
        window.dispatchEvent(new CustomEvent('open-story-quick-card', { detail: { type: occurrence.entity.kind, entityId: occurrence.entity.id, sourceSceneId: occurrence.sceneId } }));
    }
    else
        setHover(occurrence); }, 300); }; const out = (event: PointerEvent) => { const to = event.relatedTarget as HTMLElement | null; if (to?.closest?.('[data-world-occurrence],.world-hover-card'))
        return; clearTimeout(timer.current); timer.current = setTimeout(() => setHover(undefined), 250); }; document.addEventListener('pointerover', over); document.addEventListener('pointerout', out); return () => { clearTimeout(timer.current); document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); }; }, []);
    if (!hover || hidden || !story.worldOccurrences?.some(o => o.id === hover.id))
        return null;
    const world = story.worlds?.find(w => w.id === hover.worldId);
    const entity = world ? resolveWorldRef(world, story, hover.entity, documents) : hover.entity.kind === 'event' ? story.events.find(e => e.id === hover.entity.id) : story.plots.find(e => e.id === hover.entity.id);
    if (!entity)
        return null;
    const generic = world?.entities.find(e=>e.id===entity.id);
    const fields = generic ? worldStateAt(generic,story,documents,{sceneId:hover.sceneId}) : undefined;
    const links = world?.relationships.filter(r => (r.from.id === entity.id || r.to.id === entity.id || r.unitId === entity.id) && relationshipAt(r, { sceneId: hover.sceneId }, story, documents) === 'active').slice(0, 3);
    const count = new Set(story.worldOccurrences?.filter(o => refKey(o.entity) === refKey(hover.entity)).map(o => o.sceneId)).size;
    return <section className="world-hover-card profile-surface" role="dialog" aria-label="World quick card" onPointerEnter={() => clearTimeout(timer.current)} onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape')
        setHover(undefined); }}><header><h3>{entity.name}</h3><button onClick={() => setHover(undefined)}>×</button></header><small>{generic?.kind==='structure' ? (generic.structureType ?? 'Unit') + ' · ' + (world?.entities.find(e=>e.id===generic.organisationId)?.name ?? 'Organisation unavailable') : hover.entity.kind}</small>{entity.description && <p>{entity.description.slice(0, 220)}</p>}{[fields?.Appearance,fields?.Condition,fields?.Rule].filter(Boolean).map((text,i)=><p key={i}>{text}</p>)}{fields?.['Literal translation'] && <p>Translation: {fields['Literal translation']}</p>}{fields?.['Meaning / usage'] && <p>Meaning: {fields['Meaning / usage']}</p>}{links?.map(r => <p key={r.id}>{r.type} · {resolveWorldRef(world!, story, r.from.id===entity.id ? membershipTarget(r) : r.from, documents)?.name ?? 'Linked entry unavailable'}</p>)}<small>{count} scenes referenced</small><button onClick={() => { if (world)
        window.dispatchEvent(new CustomEvent('open-world-reference', { detail: { worldId: world.id, entity: hover.entity } }));
    else
        window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: { type: hover.entity.kind, entityId: hover.entity.id } })); setHover(undefined); }}>Open entry</button></section>;
}
