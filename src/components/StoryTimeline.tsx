import { characterWorldTerms } from '../domain/worlds';
import { useState } from 'react';
import { StoryIcon } from './StoryIcon';
import { TimelineList } from './TimelineList';
import { TimelineCompare } from './TimelineCompare';
import { useTimelinePreferences } from './useTimelinePreferences';
import type { StoryRecord, StoryEvent } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import { eventTimingLabel, characterDisplayName, orderSceneEvents, getPlotEffectsForScene, chronologyLabel, getEventsForScene, queryTimeline, resolveEvent, type TimelineFilter } from '../domain/story';
import { buildTimelineView, type TimelineActivity } from '../domain/timeline-view';
import { EVENT_RELATIONSHIPS, storyColor } from '../shared/story-config';

type Kind = 'scene' | 'event' | 'plot' | 'character' | 'location';
type Entity = { id: string; name: string; major?: boolean; color?: string; sourceNames?: string[]; layer?: 'appearance' | 'relationship'; profileId?: string; sceneId?: string; chronology?: import('../shared/story').Chronology };
export function StoryTimeline({ story, documents, filter, tracks, plotsOnly, show, onShowChange, select }: {
  story: StoryRecord; documents: ScreenplayRecord[]; filter: TimelineFilter; tracks: boolean; plotsOnly: boolean;
  show?: string; onShowChange?(value: string): void; select(kind: Kind, id: string): void;
}) {
  const preferences = useTimelinePreferences(filter.order === 'screenplay' ? 'screenplay' : 'story');
  const display = preferences.timelineDisplay, density = preferences.timelineDensity, order = preferences.timelineOrder;
  const [trackKind, setTrackKind] = useState<Exclude<Kind, 'scene'>>('plot');
  const [trackId, setTrackId] = useState('');
  const [collapseCommand, setCollapseCommand] = useState({ sequence: 0, collapsed: false });
  const label = (kind: Kind, entity: Entity, suffix?: string, target?: { kind: 'event' | 'scene'; id: string }, click?: () => void, selected?: boolean) => {
    const name = kind === 'character' ? characterDisplayName(story, entity) + characterWorldTerms(story, entity.profileId ?? entity.id, documents, entity.sceneId ? { sceneId: entity.sceneId, chronology: entity.chronology } : entity.chronology ? { chronology: entity.chronology } : undefined) : entity.name;
    return <button className="timeline-entity" title={name + ' · ' + kind} aria-label={name + (suffix ? ' · ' + suffix : '')} aria-pressed={click ? selected : undefined} style={entity.color ? { color: storyColor(entity.color) } : undefined} onClick={() => {
      if (click) click();
      else if (entity.layer && entity.profileId) window.dispatchEvent(new CustomEvent('open-story-profile', { detail: { type: 'character', entityId: entity.profileId, sourceSceneId: entity.sceneId, full: true } }));
      else select(target?.kind ?? kind, target?.id ?? entity.id);
    }}>{display !== 'names' && <StoryIcon kind={kind} major={entity.major}/>}<span>{name}</span>{suffix && <small>{suffix}</small>}</button>;
  };
  const eventPlots = (eventId: string, onlyPlotId?: string) => {
    const event = story.events.find(e => e.id === eventId);
    return event?.plotIds?.filter(id => !onlyPlotId || id === onlyPlotId).map(id => {
      const plot = story.plots.find(p => p.id === id && !p.archived);
      return plot && <div key={id}>{label('plot', plot, event.plotEffects?.[id], { kind: 'event', id: eventId })}</div>;
    });
  };
  const directPlots = (sceneId: string, onlyPlotId?: string) => {
    const scene = story.scenes.find(s => s.sceneId === sceneId), effects = getPlotEffectsForScene(story, sceneId);
    return scene?.plotIds?.filter(id => !onlyPlotId || id === onlyPlotId).map(id => {
      const plot = story.plots.find(p => p.id === id && !p.archived), effect = scene.plotRoles?.[id];
      if (!plot || effect && effects.some(e => e.source === 'event' && e.plotId === id && e.effect === effect)) return null;
      return <div key={id}>{label('plot', plot, effect, { kind: 'scene', id: sceneId })}</div>;
    });
  };
  const temporalHeader = (item: TimelineActivity, click?: () => void, selected?: boolean) => {
    const event = item.kind === 'event' && !item.layer ? story.events.find(e => e.id === item.entityId) : undefined;
    const suffix = item.layer ? item.layer === 'appearance' ? 'Appearance change' : 'Relationship change' : item.relationship ? EVENT_RELATIONSHIPS[item.relationship] : undefined;
    return <>{label(item.kind, { ...item, id: item.entityId }, suffix, undefined, click, selected)}
      {event && item.relationship === 'occurs' && eventTimingLabel(event) && <small>{eventTimingLabel(event)}</small>}
      {item.kind === 'scene' && (density === 'expanded' || order === 'screenplay' || order === 'compare') && <small className="timeline-context">{chronologyLabel(item.chronology)}{item.chronology?.type && ' · ' + item.chronology.type}</small>}
      {item.missingScene && <small>{item.kind === 'scene' ? 'Removed' : 'No active scene'}</small>}
      {item.noPresentation && <small>No screenplay appearance · No scene</small>}
      {item.kind === 'event' && item.sceneId && filter.kind && <small className="timeline-context">{documents.flatMap(d=>d.scenes.map((s,i)=>({id:s.id,name:d.title+' · Scene '+(i+1)}))).find(s=>s.id===item.sceneId)?.name}</small>}
    </>;
  };
  const plots = (item: TimelineActivity) => item.kind === 'scene' ? filter.kind === 'scene' ? null : directPlots(item.entityId) : eventPlots(item.entityId);
  const secondary = (item: TimelineActivity, expanded: boolean) => {
    if (plotsOnly || filter.kind === 'scene' || item.layer) return null;
    const event = item.kind === 'event' ? story.events.find(e => e.id === item.entityId) : undefined;
    // Scene-linked Events don't repeat inherited characters/location beneath every occurrence.
    const eventIsNested = event && item.sceneId;
    const characters = eventIsNested ? expanded ? event.participantIds ?? [] : [] : item.presentIds ?? [];
    const extra = expanded ? [...item.remoteIds ?? [], ...item.referencedIds ?? [], ...item.involvedIds ?? []].filter(id=>!characters.includes(id)) : [];
    const sceneLocation = story.scenes.find(s=>s.sceneId === item.sceneId)?.locationId;
    const locationId = eventIsNested ? event.locationId && event.contextOverrides?.includes('locationId') && event.locationId !== sceneLocation ? event.locationId : undefined : item.locationId;
    if (!characters.length && !extra.length && !locationId) return null;
    return <>{[...new Set(characters)].map(id=>{const c=story.characters.find(c=>c.id===id&&!c.archived);return c&&<div key={id}>{label('character',{...c,sceneId:item.sceneId,chronology:item.chronology},eventIsNested?'Participant':undefined)}</div>;})}
      {[...new Set(extra)].map(id=>{const c=story.characters.find(c=>c.id===id&&!c.archived);return c&&<div key={id}>{label('character',c,item.remoteIds?.includes(id)?'Remote':item.referencedIds?.includes(id)?'Mentioned':'Involved')}</div>;})}
      {locationId && (()=>{const l=story.locations.find(l=>l.id===locationId&&!l.archived);return l&&<div>{label('location',l,eventIsNested?'Event location':undefined)}</div>;})()}
    </>;
  };
  const listItems = !tracks && order !== 'compare' ? buildTimelineView(story, documents, filter, order, false, plotsOnly) : [];
  const storyItems = !tracks && order === 'compare' ? buildTimelineView(story, documents, filter, 'story', true, plotsOnly) : [];
  const screenplayItems = !tracks && order === 'compare' ? buildTimelineView(story, documents, filter, 'screenplay', false, plotsOnly) : [];
  const scenes = queryTimeline(story, documents, { ...filter, kind: undefined }).filter(item => item.kind === 'scene');
  const interaction = (sceneId: string) => orderSceneEvents(story, Object.values(getEventsForScene(story, sceneId)).flat());
  const entities = (trackKind === 'plot' ? story.plots : trackKind === 'event' ? story.events : trackKind === 'character' ? story.characters : story.locations).filter(e => !e.archived && (trackKind !== 'plot' || !filter.plotIds?.length || filter.plotIds.includes(e.id)) && (trackKind !== 'character' || !filter.characterIds?.length || filter.characterIds.includes(e.id)) && (trackKind !== 'location' || !filter.locationId || filter.locationId === e.id));
  const selected = entities.find(e => e.id === trackId) ?? entities[0];
  const progression = scenes.slice().sort((a,b) => documents.findIndex(d=>d.id===a.screenplayId)-documents.findIndex(d=>d.id===b.screenplayId) || (a.screenplayOrder ?? Infinity)-(b.screenplayOrder ?? Infinity)).flatMap(scene => {
    if (!selected) return [];
    const links = interaction(scene.id).filter(link => trackKind === 'event' ? link.event.id === selected.id : trackKind === 'plot' ? link.event.plotIds?.includes(selected.id) : false);
    const eventCharacters = interaction(scene.id).flatMap(link => link.event.participantIds ?? []);
    const eventLocations = interaction(scene.id).map(link => resolveEvent(story, link.event).locationId);
    const belongs = trackKind === 'plot' ? scene.plotIds?.includes(selected.id) : trackKind === 'character' ? [...scene.presentIds ?? [], ...scene.referencedIds ?? [], ...eventCharacters].includes(selected.id) : trackKind === 'location' ? scene.locationId === selected.id || eventLocations.includes(selected.id) : links.length > 0;
    if (!belongs) return [];
    const role = trackKind === 'character' && !scene.presentIds?.includes(selected.id) ? 'Mentioned' : trackKind === 'location' && scene.locationId !== selected.id ? 'Referenced' : undefined;
    return [{ scene, links, role }];
  });
  const appearanceIds = progression.filter(({ scene }) => trackKind === 'character' ? scene.presentIds?.includes(selected?.id ?? '') : scene.locationId === selected?.id).map(({ scene }) => scene.id);
  const trackEvent = (event: StoryEvent, relationship: keyof typeof EVENT_RELATIONSHIPS) => <div key={event.id+relationship}>{label('event',event,EVENT_RELATIONSHIPS[relationship])}{relationship==='occurs'&&eventTimingLabel(event)&&<small>{eventTimingLabel(event)}</small>}<div className="timeline-children">{eventPlots(event.id,trackKind==='plot'?selected?.id:undefined)}</div></div>;
  return <div className={'timeline-surface timeline-density-'+density}>
    <div className="story-toolbar"><label>Display<select aria-label="Timeline display" value={display} onChange={e=>preferences.update({timelineDisplay:e.target.value as typeof display})}><option value="icons_names">Icon + name</option><option value="names">Name only</option></select></label><label>Density<select aria-label="Timeline density" value={density} onChange={e=>preferences.update({timelineDensity:e.target.value as typeof density})}><option value="compact">Compact</option><option value="standard">Standard</option><option value="expanded">Expanded</option></select></label></div>
    {preferences.error&&<p role="alert">{preferences.error}<button onClick={()=>preferences.update({})}>Retry</button></p>}
    <div className="timeline-key" aria-label="Timeline icon key">{([{kind:'scene',name:'Scene'},{kind:'event',name:'Event'},{kind:'event',name:'Major event',major:true},{kind:'plot',name:'Plot'},{kind:'character',name:'Character'},{kind:'location',name:'Location'}] as const).map(item=><span key={item.name}><StoryIcon kind={item.kind} major={'major' in item&&item.major}/>{item.name}</span>)}</div>
    {!tracks ? <>
      <div className="story-toolbar">
        {onShowChange&&<label>Show<select aria-label="Show" value={show??''} onChange={e=>onShowChange(e.target.value)}><option value="">All</option><option value="scene">Scenes</option><option value="event">Events</option><option value="plots">Plots</option><option value="major">Major events</option></select></label>}
        <label>Order<select aria-label="Timeline order" value={order} onChange={e=>preferences.update({timelineOrder:e.target.value as typeof order})}><option value="story">Story</option><option value="screenplay">Screenplay</option><option value="compare">Compare</option></select></label>
        <button onClick={()=>setCollapseCommand(c=>({sequence:c.sequence+1,collapsed:true}))}>Collapse all</button><button onClick={()=>setCollapseCommand(c=>({sequence:c.sequence+1,collapsed:false}))}>Expand all</button>
      </div>
      {order==='compare'?<TimelineCompare storyItems={storyItems} screenplayItems={screenplayItems} density={density} collapseCommand={collapseCommand} header={temporalHeader} plots={plots} secondary={secondary}/>:<TimelineList items={listItems} order={order} density={density} collapseCommand={collapseCommand} header={temporalHeader} plots={plots} secondary={secondary}/>}
    </> : <>
      <div className="story-toolbar"><label>Track type<select value={trackKind} onChange={e=>{setTrackKind(e.target.value as typeof trackKind);setTrackId('');}}>{(['plot','character','event','location'] as const).map(k=><option key={k} value={k}>{k.charAt(0).toUpperCase()+k.slice(1)}</option>)}</select></label><label>Track<select value={selected?.id??''} onChange={e=>setTrackId(e.target.value)}>{entities.map(e=><option key={e.id} value={e.id}>{trackKind==='character'?characterDisplayName(story,e):e.name}</option>)}</select></label></div>
      <p className="story-hint">Progression in screenplay order · story occurrence remains separate.</p>
      {trackKind==='event'&&selected&&!documents.some(d=>d.scenes.some(s=>s.id===(selected as StoryEvent).occursInSceneId))&&<div className="timeline-entry">{label('event',selected,'Occurs')}<small>No scene</small>{(()=>{const event=resolveEvent(story,selected as StoryEvent), location=story.locations.find(l=>l.id===event.locationId);const time=[event.chronology?.day!==undefined?'Day '+event.chronology.day:'',event.chronology?.date,eventTimingLabel(selected as StoryEvent)].filter(Boolean).join(' · ');return <>{time&&<small>{time}</small>}{location&&label('location',location)}</>;})()}<div className="timeline-children">{eventPlots(selected.id)}</div></div>}
      <ol className="timeline-progression">{progression.map(({scene,links,role})=><li key={scene.id}>{label('scene',scene)}<small>{chronologyLabel(scene.chronology)}</small><div className="timeline-children">{links.map(link=>trackEvent(link.event,link.relationship))}{trackKind==='plot'&&selected&&directPlots(scene.id,selected.id)}</div>{(trackKind==='character'||trackKind==='location')&&selected&&label(trackKind,{...selected,sceneId:scene.id},role??(scene.id===appearanceIds[0]?'First appearance':trackKind==='character'&&scene.id===appearanceIds.at(-1)?'Last appearance':'Appears'))}</li>)}</ol>{!progression.length&&<p>No matching screenplay relationships.</p>}
    </>}
  </div>;
}

