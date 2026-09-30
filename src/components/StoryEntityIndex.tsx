import { ProfileImage } from './ProfileEditor';
import { characterStatistics } from '../domain/profiles';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectWorkspace, ScreenplayRecord } from '../shared/models';
import type { Plot, StoryEntity, StoryRecord } from '../shared/story';
import { activitySummary, getEffectiveScenesForPlot, getEventsForPlot, queryTimeline, type TimelineFilter } from '../domain/story';
import { mergeIdentity, separateIdentity } from '../domain/story-identities';
import { PLOT_STATUSES, STORY_COLORS, storyColor } from '../shared/story-config';
import { Choices, names, type Named } from './StoryControls';

export function StoryEntityIndex({ kind, story, documents, workspace, plotTerm, sceneOptions, selectedId, change, remove, viewTimeline, createEventForPlot }: {
  kind: 'plots' | 'characters' | 'locations'; story: StoryRecord; documents: ScreenplayRecord[]; workspace: ProjectWorkspace; plotTerm: string; sceneOptions: Named[];
  selectedId?: string;
  change(story: StoryRecord): void; remove(kind: 'plots' | 'characters' | 'locations', entity: StoryEntity): void; viewTimeline(filter: TimelineFilter): void; createEventForPlot(plotId: string): void;
}) {
  const [sort, setSort] = useState('introduction');
  const [selected, setSelected] = useState(''), [search, setSearch] = useState(''), [archived, setArchived] = useState(false), [mergeTarget, setMergeTarget] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { if (selectedId) setSelected(selectedId); }, [selectedId]);
  const all = useMemo(() => queryTimeline(story, documents), [story, documents]);
  const matches = (id: string) => all.filter(item => kind === 'plots' ? item.plotIds?.includes(id) : kind === 'characters' ? (item.presentIds ?? []).includes(id) : item.locationId === id);
  const summaries = new Map(story[kind].map(item => [item.id, activitySummary(matches(item.id))]));
  const item = story[kind].find(item => item.id === selected), plot = kind === 'plots' ? item as Plot | undefined : undefined;
  const plotEvents = plot ? getEventsForPlot(story, plot.id) : [];
  const plotScenes = plot ? getEffectiveScenesForPlot(story, plot.id) : [];
  const summary = item && summaries.get(item.id);
  const term = kind === 'plots' ? plotTerm : kind.slice(0, -1);
  const update = (patch: Partial<Plot>) => item && change({ ...story, [kind]: story[kind].map(value => value.id === item.id ? { ...value, ...patch } : value) });
  const add = () => {
    const id = crypto.randomUUID();
    change({ ...story, [kind]: [...story[kind], { id, name: `Untitled ${term}`, description: '', ...(kind === 'plots' ? { color: STORY_COLORS[story.plots.length % STORY_COLORS.length], label: `Plot ${String.fromCharCode(65 + story.plots.length % 26)}`, status: 'planned', ...(workspace.project.projectType === 'series' ? { scope: 'series' } : {}) } : {}) }] });
    setSelected(id);
  };
  const parentOptions = story[kind].filter(candidate => {
    if (!item || candidate.id === item.id) return false;
    let parent: string | undefined = candidate.parentId;
    const visited = new Set<string>();
    while (parent && !visited.has(parent)) { if (parent === item.id) return false; visited.add(parent); parent = story[kind].find(value => value.id === parent)?.parentId; }
    return true;
  });
  const rows = queryTimeline(story, documents, { order: 'screenplay' });
  const dialogue = sort === 'dialogue' ? new Map(story.characters.map(item => [item.id, characterStatistics(story, documents, item.id).words])) : new Map<string, number>();
  const introduction = (id: string) => { const index = rows.findIndex(item => kind === 'characters' ? item.presentIds?.includes(id) || item.remoteIds?.includes(id) : kind === 'locations' ? item.locationId === id : item.plotIds?.includes(id)); return index < 0 ? Infinity : index; };
  const ordered = [...story[kind]].sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'scenes' ? (summaries.get(b.id)?.scenes ?? 0) - (summaries.get(a.id)?.scenes ?? 0) : sort === 'dialogue' ? (dialogue.get(b.id) ?? 0) - (dialogue.get(a.id) ?? 0) : sort === 'recent' ? (summaries.get(b.id)?.latest?.chronology?.day ?? -Infinity) - (summaries.get(a.id)?.latest?.chronology?.day ?? -Infinity) : introduction(a.id) - introduction(b.id));
  return <><div className="story-toolbar"><label>Sort index<select aria-label="Sort index" value={sort} onChange={event => setSort(event.target.value)}><option value="introduction">Screenplay introduction</option><option value="name">Name</option><option value="scenes">Most scenes</option><option value="recent">Latest story appearance</option>{kind === 'characters' && <option value="dialogue">Most dialogue</option>}</select></label><input aria-label={`Search ${kind}`} placeholder={`Search ${kind}…`} value={search} onChange={event => setSearch(event.target.value)} /><button onClick={add}>Add {term}</button><label><input type="checkbox" checked={archived} onChange={event => setArchived(event.target.checked)} />Show archived</label></div>
    <div className="story-index-layout"><div className="story-index">{ordered.filter(item => (archived || !item.archived) && [item.name, item.profile?.shortName ?? '', ...item.sourceNames ?? [], ...item.profile?.aliases ?? [], ...story.locations.filter(child => kind === 'locations' && child.parentId === item.id).map(child => child.name)].some(name => name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).map(item => { const info = summaries.get(item.id)!; return <button key={item.id} className={item.id === selected ? 'active' : ''} onClick={() => { setSelected(item.id); setMergeTarget(''); setMessage(''); }} style={'color' in item ? { borderLeftColor: storyColor(String(item.color)) } : undefined}>
      {item.profile?.primaryImageId && <ProfileImage projectId={story.projectId} assetId={item.profile.images?.find(image => image.id === item.profile?.primaryImageId)?.assetId} />}<small>{[item.profile?.age, item.profile?.occupation, item.profile?.locationType].filter(Boolean).join(' · ')}</small>
      <b>{'label' in item && item.label ? `${item.label} · ` : ''}{item.name}{item.archived ? ' (archived)' : ''}</b>
      {'status' in item && <small>{'scope' in item ? `${item.scope ?? ''} · ` : ''}{String(item.status ?? '')}</small>}
      <small>{!info.scenes ? 'Unused · ' : ''}{info.scenes} scenes · {info.events} events{info.range ? ` · ${info.range}` : ''}</small>{info.plotIds.length > 0 && kind !== 'plots' && <small>{names(info.plotIds, story.plots)}</small>}
    </button>; })}</div>
    {item && summary ? <section className="story-detail" key={item.id}>
      <label>{term.charAt(0).toUpperCase() + term.slice(1)} name<input value={item.name} onChange={event => update({ name: event.target.value })} /></label><label>Short description<textarea value={item.description} onChange={event => update({ description: event.target.value })} /></label>
      <div className="story-context"><p>{summary.scenes} scenes · {summary.events} events{summary.range ? ` · ${summary.range}` : ''}</p>{summary.screenplayIds.length > 0 && <p>{names(summary.screenplayIds, documents.map(item => ({ id: item.id, name: item.title })))}</p>}
        {summary.first && <p>First appearance: {summary.first.name}</p>}{summary.latest && summary.latest.id !== summary.first?.id && <p>Latest appearance: {summary.latest.name}</p>}
        {kind !== 'plots' && !!summary.plotIds.length && <p>{plotTerm}s: {names(summary.plotIds, story.plots)}</p>}
        {kind === 'characters' && !!summary.locationIds.length && <p>Locations: {names(summary.locationIds, story.locations)}</p>}
        {kind === 'locations' && !!summary.characterIds.length && <p>Characters seen here: {names(summary.characterIds, story.characters)}</p>}
      </div>
      {kind !== 'plots' && <><button onClick={() => { window.dispatchEvent(new CustomEvent('open-story-profile', { detail: { type: kind === 'characters' ? 'character' : 'location', entityId: item.id, full: true } })); }}>Open full profile</button> <button onClick={() => { window.dispatchEvent(new CustomEvent('open-story-profile', { detail: { type: kind === 'characters' ? 'character' : 'location', entityId: item.id } })); }}>Open in inspector</button></>}
      <button onClick={() => viewTimeline(kind === 'plots' ? { plotIds: [item.id] } : kind === 'characters' ? { characterIds: [item.id], relationship: 'present' } : { locationId: item.id })}>View timeline</button>
      {plot && <><label>Short label<input value={plot.label ?? ''} onChange={event => update({ label: event.target.value })} /></label>
        <label>Status<select aria-label="Status" value={plot.status ?? 'planned'} onChange={event => update({ status: event.target.value as Plot['status'] })}>{PLOT_STATUSES.map(status => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select></label>
        {workspace.project.projectType === 'series' && <><label>Scope<select aria-label="Scope" value={plot.scope ?? 'series'} onChange={event => update({ scope: event.target.value as Plot['scope'] })}><option value="series">Series</option><option value="episode">Episode</option></select></label>{plot.scope === 'episode' && <><Choices label="Episode" single options={documents.filter(item => item.episodeId).map(item => ({ id: item.episodeId!, name: item.title }))} value={plot.episodeId ? [plot.episodeId] : []} onChange={ids => update({ episodeId: ids[0] })} /><Choices label="Part of series plot" single options={parentOptions.filter(item => (item as Plot).scope !== 'episode')} value={plot.parentId ? [plot.parentId] : []} onChange={ids => update({ parentId: ids[0] })} /></>}</>}
        {plot.status === 'resolved' && <><Choices label="Resolved by scene" options={sceneOptions} single value={plot.resolutionSceneId ? [plot.resolutionSceneId] : []} onChange={ids => update({ resolutionSceneId: ids[0] })} /><Choices label="Resolution event" single options={story.events} value={plot.resolutionEventId ? [plot.resolutionEventId] : []} onChange={ids => update({ resolutionEventId: ids[0] })} /></>}
        <fieldset className="story-linked-section"><legend>Events</legend>{plotEvents.map(event => <button key={event.id} onClick={() => window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: { type: 'event', entityId: event.id } }))}>{event.name}</button>)}{!plotEvents.length && <small>No events assigned yet.</small>}<button onClick={() => createEventForPlot(plot.id)}>Create event for this {term}</button></fieldset>
        <fieldset className="story-linked-section"><legend>Scenes</legend>{plotScenes.map(scene => <div className="story-linked-row" key={scene.sceneId}><button onClick={() => window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: { type: 'scene', entityId: scene.sceneId } }))}>{sceneOptions.find(option => option.id === scene.sceneId)?.name ?? 'Removed scene'}</button><small>{scene.sources.map(source => source.type === 'explicit' ? 'Added to Scene' : `${source.relationship === 'revealed' ? 'Revealed via' : 'Via'} ${story.events.find(event => event.id === source.eventId)?.name ?? 'removed event'}`).join(' · ')}</small></div>)}{!plotScenes.length && <small>No scenes associated yet.</small>}</fieldset>
        <fieldset><legend>Colour</legend><div className="story-palette">{STORY_COLORS.map(color => <button key={color} aria-label={`${color} colour`} aria-pressed={plot.color === color} style={{ background: storyColor(color) }} onClick={() => update({ color })} />)}<label>Custom<input aria-label="Custom colour" type="color" value={plot.color.startsWith('#') ? plot.color : '#c49a50'} onChange={event => update({ color: event.target.value })} /></label></div></fieldset>
      </>}
      {kind !== 'plots' && <><fieldset><legend>Screenplay identities</legend><div className="story-aliases">{[...new Set([item.name.toUpperCase(), ...item.sourceNames ?? []])].map(alias => <div key={alias}><span>{alias}</span>{alias !== item.name.toUpperCase() && <button onClick={() => { if (window.confirm(`Separate “${alias}” from “${item.name}”? Original appearances and saved relationships will be restored; screenplay text will not change.`)) { try { change(separateIdentity(story, kind, item.id, alias, documents)); } catch (error) { setMessage(String(error)); } } }}>Separate identity</button>}</div>)}</div><small>Original cues and sluglines remain unchanged in the screenplay.</small></fieldset>
        <details><summary>Merge with another {term}</summary><Choices label="Merge into" single options={parentOptions} value={mergeTarget ? [mergeTarget] : []} onChange={ids => setMergeTarget(ids[0] ?? '')} /><button disabled={!mergeTarget} onClick={() => { const target = story[kind].find(value => value.id === mergeTarget); if (target && window.confirm(`Merge “${item.name}” into “${target.name}”? ${item.name} becomes a screenplay identity of ${target.name}. All scene and event relationships move to ${target.name}. Screenplay text will not change. You can separate identities later.`)) { change(mergeIdentity(story, kind, item.id, target.id)); setSelected(target.id); setMergeTarget(''); } }}>Merge identities</button></details>
      </>}
      {kind === 'locations' && <><Choices label="Parent location (optional)" single options={parentOptions} value={item.parentId ? [item.parentId] : []} onChange={ids => update({ parentId: ids[0] })} />{story.locations.some(value => value.parentId === item.id) && <p>Sub-locations: {story.locations.filter(value => value.parentId === item.id).map(value => value.name).join(' · ')}</p>}</>}
      {message && <p role="alert">{message}</p>}<details><summary>More actions</summary><button onClick={() => update({ archived: !item.archived })}>{item.archived ? 'Unarchive' : 'Archive'}</button> <button onClick={() => remove(kind, item)}>Delete {term}</button></details>
    </section> : <p className="story-hint">Select a {term.toLowerCase()} to see its story activity and details.</p>}
    </div></>;
}

