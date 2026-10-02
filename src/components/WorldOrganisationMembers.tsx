import { useState } from 'react';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldRecord, WorldRef, WorldPoint } from '../shared/worlds';
import { matchingCharacters, membershipPeriod } from '../domain/world-memberships';
import { relationshipAt } from '../domain/worlds';
import { RelationshipEditor } from './WorldRelationshipEditor';

export function WorldOrganisationMembers({story,world,documents,selected,at,change,patch,open,remove,library}:{story:StoryRecord;world:WorldRecord;documents:ScreenplayRecord[];selected:WorldRef;at?:WorldPoint;change(s:StoryRecord):void;patch(w:WorldRecord):void;open(r:WorldRef):void;remove(id:string):void;library?:boolean}) {
 const [person,setPerson]=useState(''), [name,setName]=useState(''), [create,setCreate]=useState(false), [editing,setEditing]=useState(''), [begin,setBegin]=useState<{token:number;organisationId:string;unitId?:string}>(), [history,setHistory]=useState(false);
 const unit=selected.kind==='structure' ? world.entities.find(e=>e.id===selected.id) : undefined, organisationId=unit?.organisationId ?? selected.id;
 const matches=matchingCharacters(story,name);
 const memberships=world.relationships.filter(r=>r.type==='member of'&&r.from.kind==='character'&&r.to.id===organisationId&&(!unit||r.unitId===unit.id));
 const visible=memberships.filter(r=>history||relationshipAt(r,at,story,documents)==='active');
 const start=(id:string)=>{setEditing(id);setBegin({token:Date.now(),organisationId,unitId:unit?.id});};
 return <section className="organisation-members"><h4>People / Members</h4><label><input type="checkbox" checked={history} onChange={e=>setHistory(e.target.checked)}/>Include membership history</label>{visible.map(r=><div className="world-relationship" key={r.id}><button onClick={()=>{setEditing(r.from.id);setBegin(undefined);}}>{story.characters.find(c=>c.id===r.from.id)?.name ?? 'Character unavailable'}<small>{r.unitId?world.entities.find(e=>e.id===r.unitId)?.name:'Organisation-wide'} · {membershipPeriod(r,story,documents)}</small></button>{!library && <button onClick={()=>open(r.from)}>Open Character profile</button>}</div>)}{!visible.length&&<p>No members{history?'':' at this point'}.</p>}
 <label>Link existing Character<select aria-label="Link existing Character" value={person} onChange={e=>setPerson(e.target.value)}><option value="">Choose Character…</option>{story.characters.filter(c=>!c.archived).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button disabled={!person} onClick={()=>start(person)}>+ Add membership</button><button onClick={()=>setCreate(true)}>Create Character</button>
 {create&&<fieldset><legend>Create Character</legend><label>Character name<input value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={!name.trim() || matches.length > 0} onClick={()=>{const id=crypto.randomUUID();change({...story,characters:[...story.characters,{id,name:name.trim(),description:''}],worlds:story.worlds?.map(w=>w.id===world.id?{...w,characterIds:[...new Set([...w.characterIds,id])]}:w)});start(id);setCreate(false);setName('');}}>Create Character and assign membership</button>{matches.length > 0 && <p>This name already belongs to an existing Character. Link that Character: {matches.map(c=><button key={c.id} onClick={()=>{start(c.id);setCreate(false);setName('');}}>Use existing {c.name}</button>)}</p>}<button onClick={()=>setCreate(false)}>Cancel Character</button><small>The Character will have a profile. Save their membership below.</small></fieldset>}
 {editing && story.characters.some(c=>c.id===editing) && <div className="member-editor"><h4>{story.characters.find(c=>c.id===editing)?.name}</h4><RelationshipEditor key={editing} world={world} story={story} documents={documents} selected={{kind:'character',id:editing}} at={at} membershipOnly membershipScope={{organisationId,unitId:unit?.id}} beginMembership={begin} patch={patch} open={open} remove={remove}/><button onClick={()=>{setEditing('');setBegin(undefined);}}>Close member editor</button></div>}
 </section>;
}
