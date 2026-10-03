import { useState } from 'react';
import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldPoint, WorldRef } from '../shared/worlds';
import { rulesForEntity } from '../domain/world-rules';
import { RuleEditor } from './RuleEditor';
export function EntityRules({story,documents,entity,at,change}:{story:StoryRecord;documents:ScreenplayRecord[];entity:WorldRef;at?:WorldPoint;change?(s:StoryRecord):void}) {
 const [editing,setEditing]=useState<{worldId:string;ruleId:string}>();
 const entries=rulesForEntity(story,documents,entity,at).sort((a,b)=>Number(b.status==='active')-Number(a.status==='active'));
 const world=story.worlds?.find(w=>w.id===editing?.worldId),rule=world?.entities.find(e=>e.id===editing?.ruleId);
 return <section><h3>Rules</h3>{(['applies to','concerns'] as const).map(meaning=><fieldset key={meaning}><legend>{meaning==='applies to'?'Rules applying to':'Rules concerning'} this {entity.kind==='character'?'Character':'entry'}</legend>{entries.filter(e=>e.link.type===meaning).filter((e,i,all)=>all.findIndex(x=>x.rule.id===e.rule.id)===i).map(e=><article key={e.rule.id}><button onClick={()=>change?setEditing({worldId:e.world.id,ruleId:e.rule.id}):window.dispatchEvent(new CustomEvent('open-world-reference',{detail:{worldId:e.world.id,entity:{kind:'rule',id:e.rule.id}}}))}>{e.rule.name}</button><small>{e.world.name} · {e.status==='active'?'Active':e.status==='inactive'?'Outside this period':e.status}</small>{e.status==='active'&&<p>{e.text}</p>}{e.rule.fields?.Exceptions&&<p>Exceptions / Conditions: {e.rule.fields.Exceptions}</p>}</article>)}{!entries.some(e=>e.link.type===meaning)&&<p>No Rules recorded.</p>}</fieldset>)}{editing&&rule&&change&&<RuleEditor key={rule.id} story={story} documents={documents} worldId={editing.worldId} entity={rule} at={at} change={change} done={()=>setEditing(undefined)}/>}</section>;
}
