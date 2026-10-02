import { WORLD_FORM_SCHEMAS } from '../shared/world-forms';
import { useState } from 'react';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldEntity, WorldRecord, WorldRef } from '../shared/worlds';
import { WORLD_FIELDS } from '../shared/worlds';
import { worldEntities, refKey } from '../domain/worlds';

export function WorldCustomFields({ entity, world, story, documents, patch, permanent }: {
  entity: WorldEntity; world: WorldRecord; story: StoryRecord; documents: ScreenplayRecord[]; patch(p: Partial<WorldEntity>): void; permanent(): void;
}) {
  const [adding, setAdding] = useState(false), [name, setName] = useState(''), [error, setError] = useState('');
  const options: (WorldRef & { name: string })[] = [{kind: 'world' as const,id:world.id,name:world.name}, ...worldEntities(world, story), ...story.characters.map(e => ({ ...e, kind: 'character' as const })), ...story.locations.map(e => ({ ...e, kind: 'location' as const })), ...story.events.map(e => ({ ...e, kind: 'event' as const })), ...story.plots.map(e => ({ ...e, kind: 'plot' as const })), ...documents.flatMap(d => d.scenes.map((s,i) => ({ kind: 'scene' as const, id: s.id, name: d.title + ' · Scene ' + (i+1) })))].filter((e,i,all) => all.findIndex(o => refKey(o) === refKey(e)) === i);
  const builtins = [...WORLD_FORM_SCHEMAS[entity.kind]?.fields.map(f=>f.key)??[], ...WORLD_FIELDS[entity.kind] ?? [], ...(entity.kind === 'lore' && entity.fields?.Type === 'Potion/Recipe' ? ['Ingredients', 'Preparation', 'Effect', 'Duration', 'Restrictions'] : [])];
  const link = (key: string, value: string) => { const target = options.find(o => refKey(o) === value); const links = { ...entity.fieldLinks }; if (target) links[key] = { kind: target.kind, id: target.id }; else delete links[key]; patch({ fieldLinks: links }); };
  return <details open={adding || undefined}><summary>Custom fields</summary>{Object.entries(entity.fields ?? {}).filter(([key]) => !builtins.includes(key)).map(([key,value]) => <fieldset key={key}><legend>{key}</legend><label>{key} value<input value={value} onChange={e => patch({ fields: { ...entity.fields, [key]: e.target.value } })}/></label><label>{key} linked entity<select value={entity.fieldLinks?.[key] ? refKey(entity.fieldLinks[key]) : ''} onChange={e => link(key,e.target.value)}><option value="">Text only</option>{entity.fieldLinks?.[key] && !options.some(o => refKey(o) === refKey(entity.fieldLinks![key])) && <option value={refKey(entity.fieldLinks[key])}>Linked entry unavailable · {entity.fieldLinks[key].kind}</option>}{options.map(o => <option key={refKey(o)} value={refKey(o)}>{o.name} · {o.kind}</option>)}</select></label><button onClick={() => { if (!window.confirm('Delete '+key+' field? This permanently removes its value and link. Linked entities remain. This cannot be undone.')) return; permanent(); const fields = { ...entity.fields }, links = { ...entity.fieldLinks }; delete fields[key]; delete links[key]; patch({ fields, fieldLinks: links }); }}>Delete {key} field…</button></fieldset>)}
    <button onClick={() => { setAdding(true); setName(''); setError(''); }}>Add custom field</button>{adding && <fieldset><legend>New custom field</legend><label>Custom field name<input value={name} onChange={e => setName(e.target.value)}/></label>{error && <p role="alert">{error}</p>}<button disabled={!name.trim()} onClick={() => { const key = name.trim(); if (builtins.includes(key) || Object.hasOwn(entity.fields ?? {},key)) { setError('A field with this name already exists.'); return; } patch({ fields: { ...entity.fields, [key]: '' } }); setAdding(false); }}>Save custom field</button><button onClick={() => setAdding(false)}>Cancel custom field</button></fieldset>}
  </details>;
}

