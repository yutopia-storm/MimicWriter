import { ProfileWorkspace } from './ProfileWorkspace';
import { sceneHeading } from '../domain/screenplay';
import { synchronizeSceneDefaults, markSceneOverrides, refreshScene } from '../domain/story-extraction';
import { useEffect, useRef, useState, useMemo } from 'react';
import type { ProjectWorkspace, ScreenplayRecord } from '../shared/models';
import type { StoryEntity, StoryEvent, StoryLinks, StoryRecord } from '../shared/story';
import { chronologyLabel, deleteStoryEntity, getEffectivePlotsForScene, getEventsForScene, migrateStory, queryTimeline, relatedCharacters, resolveEvent, type TimelineFilter } from '../domain/story';
import { STORY_COLORS, storyColor } from '../shared/story-config';
import { Choices, ChronologyFields, Duration, Notes, ContextSummary, names } from './StoryControls';
import { StoryEntityIndex } from './StoryEntityIndex';

export function StoryPanel({ workspace, screenplay, open, sceneId, plotTerm, timelineTerm = "Story Timeline", characterCardsVisible = true, locationCardsVisible = true, onClose, onState, onSaved, onOpen, navigateScene }: {
  workspace: ProjectWorkspace; screenplay: ScreenplayRecord; open: boolean; sceneId?: string; plotTerm: string; timelineTerm?: string;
  characterCardsVisible?: boolean; locationCardsVisible?: boolean;
  onOpen?(): void; navigateScene?(sceneId: string): void;
  onClose(): void; onState(state: 'saved' | 'unsaved' | 'saving' | 'error'): void; onSaved(story: StoryRecord): void;
}) {
  const [story, setStory] = useState(() => workspace.story ?? migrateStory(null, workspace.project.id));
  const dialog = useRef<HTMLElement>(null);
  const requestedTab = useRef<'timeline' | 'events' | 'scenes' | null>(null);
  useEffect(() => { const close = () => onClose(); window.addEventListener('open-story-profile', close); return () => window.removeEventListener('open-story-profile', close); }, [onClose]);
  useEffect(() => {
    const edit = (event: Event) => { const context = (event as CustomEvent<{ type: string; entityId: string }>).detail; if (context.type === 'event') { setSelectedEvent(context.entityId); setTab('events'); } else if (context.type === 'scene') { setSelectedScene(context.entityId); setTab('scenes'); } else if (context.type === 'plot') { setSelectedEntity({ kind: 'plots', id: context.entityId }); setTab('plots'); } else if (context.type === 'character') { setSelectedEntity({ kind: 'characters', id: context.entityId }); setTab('characters'); } else if (context.type === 'location') { setSelectedEntity({ kind: 'locations', id: context.entityId }); setTab('locations'); } onOpen?.(); };
    window.addEventListener('edit-story-entity', edit);
    return () => window.removeEventListener('edit-story-entity', edit);
  }, [onOpen]);
  const [status, setStatus] = useState('Saved');
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const latest = useRef(story); latest.current = story;
  const generation = useRef(0);
  const metadataHistory = useRef<StoryRecord[]>([]);
  const queue = useRef(Promise.resolve());
  const [tab, setTab] = useState<'timeline' | 'scenes' | 'events' | 'plots' | 'characters' | 'locations'>('timeline');
  const [selectedScene, setSelectedScene] = useState(sceneId ?? screenplay.scenes[0]?.id ?? '');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<{ kind: 'plots' | 'characters' | 'locations'; id: string }>();
  const [mode, setMode] = useState<'list' | 'plots' | 'characters'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [eventInScene, setEventInScene] = useState(false);
  const [newEventPlot, setNewEventPlot] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<TimelineFilter>({ relationship: 'present', order: 'day' });
  const documents = useMemo(() => workspace.screenplays.map(item => item.id === screenplay.id ? screenplay : item), [workspace.screenplays, screenplay]);
  const sceneOptions = documents.flatMap(document => document.scenes.map((scene, index) => ({ id: scene.id, name: `${document.title} · Scene ${index + 1}: ${sceneHeading(scene, index + 1)}`, screenplayId: document.id })));
  useEffect(() => {
    if (!open) return;
    if (requestedTab.current) { setTab(requestedTab.current); requestedTab.current = null; } else if (sceneId) { setSelectedScene(sceneId); setTab('scenes'); } else setTab('timeline');
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, [open, sceneId]);
  const change = (next: StoryRecord) => { metadataHistory.current = [...metadataHistory.current.slice(-49), latest.current]; latest.current = next; setStory(next); generation.current++; setVersion(generation.current); setStatus('Unsaved changes'); onState('unsaved'); };
  useEffect(() => {
    if (!version) return;
    const timer = setTimeout(() => {
      const snapshot = latest.current;
      queue.current = queue.current.catch(() => {}).then(async () => {
        setStatus('Saving…'); onState('saving');
        try {
          const saved = await window.desktop.saveStory(workspace.project.id, snapshot);
          onSaved(saved);
          if (generation.current === version) { setStatus('Saved'); setError(''); onState('saved'); }
        } catch (reason) { setStatus('Save failed'); setError(String(reason)); onState('error'); }
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [version]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const filled = synchronizeSceneDefaults(latest.current, documents);
      if (filled !== latest.current) change(filled);
    }, open ? 0 : 500);
    return () => clearTimeout(timer);
  }, [screenplay, workspace.screenplays, open]);
  const patchFilter = (patch: Partial<TimelineFilter>) => setFilter({ ...filter, ...patch });
  const remove = (kind: 'plots' | 'characters' | 'locations' | 'events', entity: StoryEntity) => {
    const linked = queryTimeline(story, documents).filter(item => kind === 'plots' ? item.plotIds?.includes(entity.id) : kind === 'characters' ? relatedCharacters(item, 'all').includes(entity.id) : kind === 'locations' ? item.locationId === entity.id : item.id === entity.id);
    if (window.confirm('Delete “' + entity.name + '”? This removes its relationships from ' + linked.filter(item => item.kind === 'scene').length + ' scenes and ' + linked.filter(item => item.kind === 'event').length + ' events. Other scenes and events will not be deleted. Archive instead to retain relationships.')) change(deleteStoryEntity(story, kind, entity.id));
  };
  const addEvent = (context: { sceneId?: string; plotId?: string } = {}) => {
    const id = crypto.randomUUID();
    change({ ...story, events: [...story.events, { id, name: 'Untitled event', description: '', contextOverrides: [], ...(context.sceneId ? { occursInSceneId: context.sceneId } : {}), ...(context.plotId ? { plotIds: [context.plotId] } : {}) }] });
    setSelectedEvent(id); setEventInScene(Boolean(context.sceneId)); setTab('events');
  };
  const scene = sceneOptions.find(item => item.id === selectedScene);
  const sceneLinks = story.scenes.find(item => item.sceneId === selectedScene) ?? { sceneId: selectedScene, screenplayId: scene?.screenplayId ?? screenplay.id };
  const sceneEvents = getEventsForScene(story, selectedScene);
  const effectiveScenePlots = getEffectivePlotsForScene(story, selectedScene);
  const updateScene = (value: StoryLinks) => change({ ...story, scenes: [...story.scenes.filter(item => item.sceneId !== selectedScene), markSceneOverrides({ ...sceneLinks, sceneId: selectedScene, screenplayId: scene!.screenplayId }, value)] });
  const event = story.events.find(item => item.id === selectedEvent);
  const updateEvent = (patch: Partial<StoryEvent>) => event && change({ ...story, events: story.events.map(item => item.id === event.id ? { ...item, ...patch } : item) });
  const createPlotForEvent = () => {
    if (!event || !newEventPlot.trim()) return;
    const id = crypto.randomUUID();
    change({ ...story, plots: [...story.plots, { id, name: newEventPlot.trim(), description: '', color: STORY_COLORS[story.plots.length % STORY_COLORS.length], status: 'planned', ...(workspace.project.projectType === 'series' ? { scope: 'series' as const } : {}) }], events: story.events.map(item => item.id === event.id ? { ...item, plotIds: [...new Set([...item.plotIds ?? [], id])] } : item) });
    setNewEventPlot('');
  };
  const results = queryTimeline(story, documents, filter);
  const tracks = mode === 'characters' ? story.characters.filter(item => !item.archived && (!filter.characterIds?.length || filter.characterIds.includes(item.id))) : mode === 'plots' ? story.plots.filter(item => !item.archived && (!filter.plotIds?.length || filter.plotIds.includes(item.id))) : [];
  const effectiveEvent = event ? resolveEvent(story, event) : undefined;
  const activeFilters = [filter.plotIds?.length, filter.characterIds?.length, filter.locationId, filter.fromDay !== undefined, filter.toDay !== undefined, filter.screenplayId].filter(Boolean).length;
  const viewTimeline = (value: TimelineFilter) => { setFilter({ relationship: 'present', order: 'day', ...value }); setTab('timeline'); };
  const editEventContext = (patch: Partial<StoryEvent>) => {
    if (!event) return;
    const overrides = new Set(event.contextOverrides ?? []);
    const edited = { ...patch };
    for (const field of Object.keys(patch)) {
      if (field === 'chronology') {
        const chronology = { ...event.chronology };
        for (const key of ['day', 'date', 'time', 'timeOfDay'] as const) if (patch.chronology?.[key] !== effectiveEvent?.chronology?.[key]) {
          overrides.add('chronology.' + key);
          Object.assign(chronology, { [key]: patch.chronology?.[key] });
        }
        edited.chronology = chronology;
      } else overrides.add(field);
    }
    updateEvent({ ...edited, ...(event.contextOverrides ? { contextOverrides: [...overrides] } : {}) });
  };
  return <><ProfileWorkspace saveStatus={status} saveError={error} retry={() => change(story)} story={story} documents={documents} change={change} hidden={open} remove={remove} undo={() => { const previous = metadataHistory.current.pop(); if (previous) { change(previous); metadataHistory.current.pop(); } }} navigateScene={id => { onClose(); navigateScene?.(id); }} timeline={context => { requestedTab.current = context.type === 'event' ? 'events' : context.type === 'scene' ? 'scenes' : 'timeline'; if (context.type === 'event') { setSelectedEvent(context.entityId); setTab('events'); } else if (context.type === 'scene') { setSelectedScene(context.entityId); setTab('scenes'); } else viewTimeline(context.type === 'character' ? { characterIds: [context.entityId] } : context.type === 'location' ? { locationId: context.entityId } : { plotIds: [context.entityId] }); onOpen?.(); }} />{open && <div className="story-backdrop"><section ref={dialog} className="story-panel" role="dialog" aria-modal="true" aria-label={timelineTerm} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') {
      const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, summary') ?? [])].filter(node => !node.hasAttribute('disabled') && node.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header><div><h2>{timelineTerm}</h2><small>Project-wide story data · Optional, writer-controlled metadata</small></div><span role="status">{status}</span><button onClick={onClose}>Close {timelineTerm.toLowerCase()}</button></header>
    {error && <p role="alert">{error} <button onClick={() => change(story)}>Retry save</button></p>}
    <nav aria-label="Story sections">{(['timeline', 'scenes', 'events', 'plots', 'characters', 'locations'] as const).map(name => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name === 'plots' ? `${plotTerm}s` : name.charAt(0).toUpperCase() + name.slice(1)}</button>)}</nav>
    <div className="story-body">
    {tab === 'timeline' && <>
      <div className="story-toolbar">
        <div className="story-segment"><button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')}>List</button><button className={mode !== 'list' ? 'active' : ''} onClick={() => setMode('plots')}>Tracks</button></div>
        {mode !== 'list' && <label>Tracks<select aria-label="Tracks" value={mode} onChange={event => setMode(event.target.value as 'plots' | 'characters')}><option value="plots">{plotTerm} tracks</option><option value="characters">Character tracks</option></select></label>}
        <label>Show<select aria-label="Show" value={filter.kind ?? ''} onChange={event => patchFilter({ kind: (event.target.value || undefined) as TimelineFilter['kind'] })}><option value="">All</option><option value="scene">Scenes</option><option value="event">Events</option><option value="major">Major events</option></select></label>
        <button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>Filters{activeFilters ? ` (${activeFilters})` : ''}</button>
        <button onClick={() => addEvent()}>Add event</button>
        <details className="story-sort"><summary>Sort</summary><label>Order by<select aria-label="Order by" value={filter.order} onChange={event => patchFilter({ order: event.target.value as TimelineFilter['order'] })}><option value="day">Story day / time</option><option value="date">Calendar date / time</option><option value="position">Saved relative order</option><option value="screenplay">Screenplay order</option></select></label></details>
      </div>
      {filtersOpen && <section className="story-filters" aria-label="Timeline filters"><div className="story-filter-choices"><Choices label={`${plotTerm}s`} options={story.plots} value={filter.plotIds} onChange={plotIds => patchFilter({ plotIds })} /><Choices label="Characters" options={story.characters} value={filter.characterIds} onChange={characterIds => patchFilter({ characterIds })} /></div>
        <div className="story-fields">{!!filter.characterIds?.length && <><label>Character matching<select aria-label="Character matching" value={filter.allCharacters ? 'together' : 'any'} onChange={event => patchFilter({ allCharacters: event.target.value === 'together', ...(event.target.value === 'together' ? { relationship: 'present' } : {}) })}><option value="any">Any selected</option><option value="together">Together</option></select></label>{!filter.allCharacters && <label>Character relationship<select aria-label="Character relationship" value={filter.relationship} onChange={event => patchFilter({ relationship: event.target.value as TimelineFilter['relationship'] })}><option value="present">Present</option><option value="referenced">Referenced</option><option value="all">Any</option></select></label>}</>}
        {(['fromDay', 'toDay'] as const).map(key => <label key={key}>{key === 'fromDay' ? 'From day' : 'To day'}<input type="number" value={filter[key] ?? ''} onChange={event => patchFilter({ [key]: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>)}</div>
        <Choices label="Location" single options={story.locations} value={filter.locationId ? [filter.locationId] : []} onChange={ids => patchFilter({ locationId: ids[0] })} />
        {filter.locationId && <label><input type="checkbox" checked={filter.includeChildLocations ?? false} onChange={event => patchFilter({ includeChildLocations: event.target.checked })} />Include child locations</label>}
        {workspace.project.projectType === 'series' && <Choices label="Episode" single options={documents.map(item => ({ id: item.id, name: item.title }))} value={filter.screenplayId ? [filter.screenplayId] : []} onChange={ids => patchFilter({ screenplayId: ids[0] })} />}
        <label><input type="checkbox" checked={filter.appearanceChanges ?? false} onChange={event => patchFilter({ appearanceChanges: event.target.checked })} />Appearance changes</label><label><input type="checkbox" checked={filter.relationshipChanges ?? false} onChange={event => patchFilter({ relationshipChanges: event.target.checked })} />Relationship changes</label>
        <button onClick={() => setFilter({ relationship: 'present', order: filter.order })}>Clear filters</button>
      </section>}
      <p className="story-hint">{results.length} scenes and events · Unpositioned activity appears last.</p>
      <div className="story-table-scroll"><table className="story-timeline"><thead><tr><th>Story time</th><th>Activity</th>{tracks.map(track => <th key={track.id} style={{ borderColor: storyColor('color' in track ? String(track.color) : 'accent') }}>{track.name}{mode === 'plots' && <button aria-label={`Create event for ${track.name}`} onClick={() => addEvent({ plotId: track.id })}>+</button>}</th>)}</tr></thead><tbody>
        {results.map((item, index) => { const matching = tracks.filter(track => mode === 'characters' ? relatedCharacters(item, filter.relationship).includes(track.id) : item.plotIds?.includes(track.id)); return <tr key={`${item.kind}:${item.id}`}>
          <td>{chronologyLabel(item.chronology)}</td><td><button className="story-activity" onClick={() => { if (item.layer && item.profileId) { window.dispatchEvent(new CustomEvent('open-story-profile', { detail: { type: 'character', entityId: item.profileId, sourceSceneId: item.sceneId, full: true } })); } else if (item.kind === 'event') { setSelectedEvent(item.id); setEventInScene(Boolean(story.events.find(event => event.id === item.id)?.occursInSceneId)); setTab('events'); } else { setSelectedScene(item.id); setTab('scenes'); } }}><b>{item.layer ? (item.layer === 'appearance' ? 'Appearance · ' : 'Relationship · ') : item.major ? '★ ' : ''}{item.name}</b></button>
            {!!item.presentIds?.length && <p>{names(item.presentIds, story.characters)}</p>}
            {(!!item.plotIds?.length || item.locationId) && <small>{[names(item.plotIds, story.plots), story.locations.find(location => location.id === item.locationId)?.name].filter(Boolean).join(' · ')}</small>}
            {matching.length > 1 && <small className="story-intersection">Intersection · {matching.length} {mode === 'characters' ? 'characters' : `${plotTerm.toLowerCase()}s`}</small>}
          </td>{tracks.map(track => { const belongs = (row: typeof item) => mode === 'characters' ? relatedCharacters(row, filter.relationship).includes(track.id) : row.plotIds?.includes(track.id); const previous = results.slice(0, index).reverse().find(belongs); const later = results.slice(index + 1).some(belongs); return <td className="story-track" key={track.id}>{belongs(item) && <span style={{ borderColor: storyColor('color' in track ? String(track.color) : 'accent') }} aria-label={`${track.name} participates`}>●<small>{!previous ? 'First shown' : previous.chronology?.day !== undefined && item.chronology?.day !== undefined ? `${item.chronology.day - previous.chronology.day} days since previous` : ''}{!later ? ' · Last shown' : ''}</small></span>}</td>; })}
        </tr>; })}
      </tbody></table>{!results.length && <p>No matching story activity.</p>}</div>
    </>}
    {tab === 'scenes' && <>
      <Choices label="Scene" single options={sceneOptions} value={selectedScene ? [selectedScene] : []} onChange={ids => setSelectedScene(ids[0] ?? '')} />
      {scene ? <div key={selectedScene} className="story-scene-detail">
        <ChronologyFields scene value={sceneLinks.chronology} onChange={chronology => updateScene({ ...sceneLinks, chronology })} />
        <Duration value={sceneLinks.chronology?.duration} automatic={!sceneLinks.manualFields?.includes('chronology.duration')} onChange={duration => updateScene({ ...sceneLinks, chronology: { ...sceneLinks.chronology, duration } })} onReset={() => change(synchronizeSceneDefaults({ ...story, scenes: story.scenes.map(item => item.sceneId === selectedScene ? { ...item, manualFields: item.manualFields?.filter(field => field !== 'chronology.duration'), chronology: { ...item.chronology, duration: undefined } } : item) }, documents))} />
        <fieldset className="story-linked-section"><legend>{plotTerm}s</legend>
          {effectiveScenePlots.map(item => { const plot = story.plots.find(plot => plot.id === item.plotId); const explicit = item.sources.some(source => source.type === 'explicit'), eventSources = item.sources.filter(source => source.type === 'event'); return <div className="story-linked-row" key={item.plotId}><div><b>{plot?.name ?? 'Removed plot'}</b><small>{[...eventSources.map(source => `${source.relationship === 'revealed' ? 'Revealed via' : 'Via'} ${story.events.find(event => event.id === source.eventId)?.name ?? 'removed event'}`), ...(explicit ? ['Added to Scene'] : [])].join(' · ')}</small></div>{eventSources.map(source => <span key={`${source.eventId}:${source.relationship}`}><button onClick={() => { setSelectedEvent(source.eventId!); setTab('events'); }}>View event</button><button onClick={() => { const sourceEvent = story.events.find(event => event.id === source.eventId); if (sourceEvent) change({ ...story, events: story.events.map(event => event.id === sourceEvent.id ? { ...event, plotIds: event.plotIds?.filter(id => id !== item.plotId) } : event) }); }}>Remove plot from event</button></span>)}{explicit && <button onClick={() => updateScene({ ...sceneLinks, plotIds: sceneLinks.plotIds?.filter(id => id !== item.plotId) })}>Remove additional plot</button>}</div>; })}
          {!effectiveScenePlots.length && <small>No plots associated yet.</small>}
          <Choices label={`Add ${plotTerm}`} options={story.plots.filter(plot => !effectiveScenePlots.some(item => item.plotId === plot.id))} value={[]} onChange={ids => ids[0] && updateScene({ ...sceneLinks, plotIds: [...new Set([...sceneLinks.plotIds ?? [], ids[0]])] })} />
        </fieldset>
        <Choices label="Characters present" options={story.characters} value={sceneLinks.presentIds} onChange={presentIds => updateScene({ ...sceneLinks, presentIds })} />
        <details><summary>Characters referenced{sceneLinks.referencedIds?.length ? ` (${sceneLinks.referencedIds.length})` : ''}</summary><Choices label="Characters referenced" options={story.characters} value={sceneLinks.referencedIds} onChange={referencedIds => updateScene({ ...sceneLinks, referencedIds })} /></details>
        {!!sceneLinks.remoteIds?.length && <details><summary>Remote / voice-over speakers</summary><Choices label="Remote speakers" options={story.characters} value={sceneLinks.remoteIds} onChange={remoteIds => updateScene({ ...sceneLinks, remoteIds })} /></details>}
        <Choices label="Location" single options={story.locations} value={sceneLinks.locationId ? [sceneLinks.locationId] : []} onChange={ids => updateScene({ ...sceneLinks, locationId: ids[0] })} />
        <details open><summary>Events ({sceneEvents.occurs.length + sceneEvents.revealed.length + sceneEvents.referenced.length})</summary>
          {(['occurs','revealed','referenced'] as const).map(relationship => <section className="story-linked-group" key={relationship}><h4>{relationship === 'occurs' ? 'Occurs here' : relationship === 'revealed' ? 'Revealed here' : 'Referenced'}</h4>{sceneEvents[relationship].map(({ event }) => <button key={event.id} onClick={() => { setSelectedEvent(event.id); setEventInScene(Boolean(event.occursInSceneId)); setTab('events'); }}>{event.name}</button>)}{!sceneEvents[relationship].length && <small>None</small>}</section>)}
          <Choices label="Events occurring here" options={story.events} value={story.events.filter(item => item.occursInSceneId === selectedScene).map(item => item.id)} onChange={ids => change({ ...story, events: story.events.map(item => ({ ...item, occursInSceneId: ids.includes(item.id) ? selectedScene : item.occursInSceneId === selectedScene ? undefined : item.occursInSceneId })) })} />
          {(['revealedInSceneIds', 'referencedInSceneIds'] as const).map(field => <Choices key={field} label={field === 'revealedInSceneIds' ? 'Events revealed here' : 'Events referenced here'} options={story.events} value={story.events.filter(item => item[field]?.includes(selectedScene)).map(item => item.id)} onChange={ids => change({ ...story, events: story.events.map(item => ({ ...item, [field]: [...(item[field] ?? []).filter(id => id !== selectedScene), ...(ids.includes(item.id) ? [selectedScene] : [])] })) })} />)}
          <button onClick={() => addEvent({ sceneId: selectedScene })}>Create new event in this scene</button>
        </details>
        <Notes value={sceneLinks.notes} onChange={notes => updateScene({ ...sceneLinks, notes })} />
        <details><summary aria-label="More scene actions">•••</summary><button onClick={() => change(refreshScene(story, documents, selectedScene))}>Refresh from scene</button> <button onClick={() => {
          if (window.confirm('Clear manual story metadata for this scene? Story day, date, overrides, plot assignments, character corrections and notes will be cleared. Scene text and event relationships will remain.')) change(synchronizeSceneDefaults({ ...story, autoFillDisabledSceneIds: story.autoFillDisabledSceneIds?.filter(id => id !== selectedScene), scenes: story.scenes.filter(item => item.sceneId !== selectedScene) }, documents));
        }}>Clear manual story metadata</button>{!!sceneLinks.involvedIds?.length && <p className="story-hint">Retained earlier character links: {names(sceneLinks.involvedIds, story.characters)}. These do not establish physical presence.</p>}</details>
      </div> : <p>Select a scene. Removed scene relationships are retained for restoration.</p>}
    </>}
    {tab === 'events' && <>
      <div className="story-toolbar"><button onClick={() => addEvent()}>Add event</button><label><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)} />Show archived events</label></div>
      <Choices label="Event" single options={story.events.filter(item => showArchived || !item.archived).map(item => ({ ...item, archived: false }))} value={selectedEvent ? [selectedEvent] : []} onChange={ids => { setSelectedEvent(ids[0] ?? ''); setEventInScene(Boolean(story.events.find(item => item.id === ids[0])?.occursInSceneId)); }} />
      {event && effectiveEvent && <section className="story-event-detail" key={event.id}>
        <label>Event name<input value={event.name} onChange={e => updateEvent({ name: e.target.value })} /></label><label>Description<textarea value={event.description} onChange={e => updateEvent({ description: e.target.value })} /></label>
        <label>Importance<select aria-label="Importance" value={event.major ? 'major' : 'normal'} onChange={e => updateEvent({ major: e.target.value === 'major' })}><option value="normal">Normal</option><option value="major">Major</option></select></label>
        <fieldset className="story-linked-section"><legend>{plotTerm}s</legend><Choices label={`Assigned ${plotTerm}s`} options={story.plots} value={event.plotIds} onChange={plotIds => updateEvent({ plotIds })} />{!event.plotIds?.length && <small className="story-hint">Not assigned yet.</small>}{event.occursInSceneId && (() => { const suggestions = getEffectivePlotsForScene(story, event.occursInSceneId).filter(plot => !event.plotIds?.includes(plot.plotId)); return suggestions.length ? <div className="story-linked-group"><small>Suggested from scene</small>{suggestions.map(plot => <button key={plot.plotId} onClick={() => updateEvent({ plotIds: [...new Set([...event.plotIds ?? [], plot.plotId])] })}>{story.plots.find(item => item.id === plot.plotId)?.name ?? 'Removed plot'}</button>)}</div> : null; })()}<div className="story-inline-create"><label>New {plotTerm}<input value={newEventPlot} onChange={e => setNewEventPlot(e.target.value)} /></label><button disabled={!newEventPlot.trim()} onClick={createPlotForEvent}>Create new {plotTerm} and assign</button></div></fieldset>
        <label>Where does this event occur?<select aria-label="Where does this event occur?" value={event.occursInSceneId || eventInScene ? 'scene' : 'independent'} onChange={e => { setEventInScene(e.target.value === 'scene'); if (e.target.value === 'independent') updateEvent({ chronology: effectiveEvent.chronology, locationId: effectiveEvent.locationId, occursInSceneId: undefined }); }}><option value="independent">Off-screen / independent</option><option value="scene">In a scene</option></select></label>
        {(event.occursInSceneId || eventInScene) && <Choices label="Occurs in scene" single options={sceneOptions} value={event.occursInSceneId ? [event.occursInSceneId] : []} onChange={ids => updateEvent({ occursInSceneId: ids[0] })} />}
        {event.occursInSceneId && <div className="story-inherited"><b>{event.contextOverrides ? 'Context from scene' : 'Saved event context'}</b><ContextSummary value={effectiveEvent} story={story} showPlots={false} />{!event.contextOverrides && <p className="story-hint">This earlier event keeps its independent details. Choosing inheritance replaces those details with its scene context.</p>}
          <button onClick={() => { if (window.confirm('Use the current scene context? This resets chronology and location overrides. Event plots, participants and reveal/reference links remain.')) updateEvent({ contextOverrides: [] }); }}>Use scene context</button>
        </div>}
        <details open={!event.occursInSceneId ? true : undefined}><summary>{event.occursInSceneId ? 'Override inherited details' : 'Event details'}</summary>
          <ChronologyFields value={effectiveEvent.chronology} onChange={chronology => editEventContext({ chronology })} />
          <Choices label="Location" single options={story.locations} value={effectiveEvent.locationId ? [effectiveEvent.locationId] : []} onChange={ids => editEventContext({ locationId: ids[0] })} />
        </details>
        <Choices label="Participants" options={story.characters} value={event.participantIds} onChange={participantIds => updateEvent({ participantIds })} />
        {!!effectiveEvent.presentIds?.length && <p className="story-hint">Present when event occurs: {names(effectiveEvent.presentIds, story.characters)}</p>}
        <details><summary>Scene relationships</summary><Choices label="Revealed in" options={sceneOptions} value={event.revealedInSceneIds} onChange={revealedInSceneIds => updateEvent({ revealedInSceneIds })} /><Choices label="Referenced in" options={sceneOptions} value={event.referencedInSceneIds} onChange={referencedInSceneIds => updateEvent({ referencedInSceneIds })} /></details>
        {!event.contextOverrides && !!event.revealedInSceneIds?.length && <small>Earlier combined reveal/reference links are retained under Revealed in. Adjust them here if they represent later references.</small>}
        <Notes value={event.notes} onChange={notes => updateEvent({ notes })} />
        <details><summary>More actions</summary><button onClick={() => updateEvent({ archived: !event.archived })}>{event.archived ? 'Unarchive' : 'Archive'} event</button> <button onClick={() => remove('events', event)}>Delete event</button></details>
      </section>}
    </>}
    {(tab === 'plots' || tab === 'characters' || tab === 'locations') && <StoryEntityIndex key={tab} kind={tab} story={story} documents={documents} workspace={workspace} plotTerm={plotTerm} sceneOptions={sceneOptions} selectedId={selectedEntity?.kind === tab ? selectedEntity.id : undefined} change={change} remove={remove} viewTimeline={viewTimeline} createEventForPlot={plotId => addEvent({ plotId })} />}
    </div>
  </section></div>}</>;
}
