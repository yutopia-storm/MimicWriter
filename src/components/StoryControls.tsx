import { characterDisplayName, chronologyLabel } from '../domain/story';
import { StoryIcon } from './StoryIcon';
import { useState } from 'react';
import type { Chronology, StoryEvent, StoryLinks, StoryRecord } from '../shared/story';
import { SCENE_POSITIONS, STORY_TIME_PERIODS, periodFromTime, storyColor, PLOT_RELATIONSHIPS } from '../shared/story-config';
import { durationLabel } from '../domain/story-extraction';

export type Named = { id: string; name: string; archived?: boolean; color?: string };

/** Edit only at the canonical Event/Scene Plot relationship. */
export function PlotEffectField({ plotName, value, onChange }: { plotName: string; value?: string; onChange(value: typeof PLOT_RELATIONSHIPS[number] | undefined): void }) {
  return <label>Effect on plot · {plotName}<select aria-label={`Effect on plot for ${plotName}`} value={value ?? ''} onChange={event => onChange((event.target.value || undefined) as typeof PLOT_RELATIONSHIPS[number] | undefined)}>
    <option value="">Not set</option>{value && !PLOT_RELATIONSHIPS.some(effect => effect === value) && <option value={value}>{value}</option>}{PLOT_RELATIONSHIPS.map(effect => <option key={effect} value={effect}>{effect}</option>)}
  </select></label>;
}
export const names = (ids: string[] | undefined, options: Named[]) => (ids ?? []).map(id => options.find(item => item.id === id)?.name ?? 'Removed identity').join(' · ');

/** Bounded, searchable picker shared by all relationship editors. Selected IDs survive filtering. */
export function Choices({ label, options, value = [], onChange, single = false }: { label: string; options: Named[]; value?: string[]; single?: boolean; onChange(value: string[]): void }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const matches = options.filter(item => !value.includes(item.id) && !item.archived && item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <fieldset className="story-picker"><legend>{label}</legend><div className="story-chips">
    {value.map(id => <span className="story-chip" key={id}>{(() => { const item = options.find(item => item.id === id); return item?.color ? <span style={{ color: storyColor(item.color) }}><StoryIcon kind="plot"/>{item.name}</span> : item?.name || 'Removed item (link retained)'; })()}<button aria-label={`Remove ${options.find(item => item.id === id)?.name ?? 'item'} from ${label}`} onClick={() => onChange(value.filter(item => item !== id))}>×</button></span>)}
    <button aria-expanded={open} onClick={() => setOpen(!open)}>+ {single && value.length ? 'Change' : 'Add'}</button>
  </div>{open && <div className="story-picker-menu"><input autoFocus aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={event => setSearch(event.target.value)} />
    <div className="story-picker-results">{matches.slice(0, 40).map(item => <button key={item.id} onClick={() => { onChange(single ? [item.id] : [...value, item.id]); setOpen(false); setSearch(''); }}>{item.color && <StoryIcon kind="plot"/>}<span style={item.color ? { color: storyColor(item.color) } : undefined}>{item.name || 'Untitled'}</span></button>)}{!matches.length && <small>No matches.</small>}{matches.length > 40 && <small>Keep typing to narrow {matches.length} matches.</small>}</div>
  </div>}</fieldset>;
}

export function ChronologyFields({ value = {}, onChange, scene = false, dateOnly = false }: { dateOnly?: boolean; value?: Chronology; scene?: boolean; onChange(value: Chronology): void }) {
  const [exact, setExact] = useState(Boolean(value.time));
  return <fieldset className="story-fields"><legend>When</legend>
    <label>Story day<input type="number" step="1" value={value.day ?? ''} onChange={event => onChange({ ...value, day: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
    <label>Calendar date<input type="date" value={value.date ?? ''} onChange={event => onChange({ ...value, date: event.target.value || undefined })} /></label>
    {!dateOnly && <><label>Time precision<select aria-label="Time precision" value={value.time ? 'exact' : exact ? 'exact' : 'approximate'} onChange={event => { setExact(event.target.value === 'exact'); if (event.target.value !== 'exact') onChange({ ...value, time: undefined }); }}><option value="approximate">Approximate</option><option value="exact">Exact time</option></select></label>
    {exact || value.time ? <label>Time<input type="time" value={value.time ?? ''} onChange={event => onChange({ ...value, time: event.target.value || undefined, timeOfDay: event.target.value ? periodFromTime(event.target.value) : value.timeOfDay })} /></label> : <label>Time of day<select aria-label="Time of day" value={value.timeOfDay ?? ''} onChange={event => onChange({ ...value, timeOfDay: (event.target.value || undefined) as Chronology['timeOfDay'] })}><option value="">Not set</option>{STORY_TIME_PERIODS.map(period => <option key={period.value} value={period.value}>{period.label}</option>)}</select></label>}
    {scene && value.time && <label>End time (optional)<input type="time" value={value.endTime ?? ''} onChange={e=>onChange({...value,endTime:e.target.value||undefined})}/></label>}
    </>}
    {scene && <label>Timeline position<select aria-label="Timeline position" value={SCENE_POSITIONS.includes(value.type as typeof SCENE_POSITIONS[number]) ? value.type : ''} onChange={event => onChange({ ...value, type: (event.target.value || undefined) as Chronology['type'] })}><option value="">Not set</option>{SCENE_POSITIONS.map(type => <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>)}</select></label>}
  </fieldset>;
}

export function Duration({ value, automatic, onChange, onReset }: { value?: number; automatic: boolean; onChange(value: number | undefined): void; onReset(): void }) {
  const [editing, setEditing] = useState(false);
  return <div className="story-duration">Duration: {value === undefined ? 'Not estimated' : `${automatic ? '~' : ''}${durationLabel(value)}`} <button onClick={() => setEditing(!editing)}>Override</button>
    {editing && <><label>Duration in seconds<input type="number" min="0" step="1" value={value === undefined ? '' : Math.round(value * 60)} onChange={event => onChange(event.target.value === '' ? undefined : Math.max(0, Number(event.target.value)) / 60)} /></label><button onClick={() => { onReset(); setEditing(false); }}>Use estimate</button></>}
  </div>;
}

export function Notes({ value, onChange }: { value?: string; onChange(value: string): void }) {
  return <details className="story-notes" open={value ? true : undefined}><summary>Notes{!value ? ' · Add note…' : ''}</summary><label>Notes<textarea value={value ?? ''} onChange={event => onChange(event.target.value)} placeholder="Add note…" /></label></details>;
}

export function ContextSummary({ value, story, showPlots = true }: { value: StoryLinks; story: StoryRecord; showPlots?: boolean }) {
  const time = value.chronology ? chronologyLabel(value.chronology) : '';
  return <div className="story-context">{time && <p>{time}</p>}{value.locationId && <p>{story.locations.find(item => item.id === value.locationId)?.name}</p>}{!!value.presentIds?.length && <p>{names(value.presentIds, story.characters.map(c=>({...c,name:characterDisplayName(story,c)})))}</p>}{showPlots && !!value.plotIds?.length && <p>{names(value.plotIds, story.plots)}</p>}</div>;
}

export function EventTimingFields({ value, onChange }: { value?: StoryEvent['occurrenceTiming']; onChange(value: NonNullable<StoryEvent['occurrenceTiming']>): void }) {
 const mode = value?.mode ?? 'inherit';
 return <fieldset className="story-fields"><legend>Occurrence time</legend><label>Event time<select aria-label="Event time" value={mode} onChange={e=>onChange({mode:e.target.value as typeof mode})}><option value="inherit">Use scene time</option><option value="exact">Exact time</option><option value="range">Start/end time range</option><option value="duration">Duration</option><option value="approximate">Approximate time</option></select></label>
 {(mode === 'exact' || mode === 'range') && <label>Start time<input type="time" value={value?.time ?? ''} onChange={e=>onChange({...value,mode,time:e.target.value||undefined})}/></label>}
 {mode === 'range' && <label>End time<input type="time" value={value?.endTime ?? ''} onChange={e=>onChange({...value,mode,endTime:e.target.value||undefined})}/></label>}
 {mode === 'duration' && <label>Duration in minutes<input type="number" min="0" step="any" value={value?.duration ?? ''} onChange={e=>onChange({...value,mode,duration:e.target.value===''?undefined:Number(e.target.value)})}/></label>}
 {mode === 'approximate' && <label>Occurrence time of day<select value={value?.timeOfDay ?? ''} onChange={e=>onChange({...value,mode,timeOfDay:e.target.value as Chronology['timeOfDay']||undefined})}><option value="">Not set</option>{STORY_TIME_PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>}
 </fieldset>;
}
