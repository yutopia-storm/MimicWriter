// @vitest-environment jsdom
import { cleanup, fireEvent, render, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { StoryTimeline } from './StoryTimeline';
import { createScene, createScreenplay, createElement } from '../domain/screenplay';
import { migrateStory } from '../domain/story';
import type { DesktopApi } from '../shared/models';
afterEach(cleanup);
it('shows scene-effective rank and position abbreviations beside characters without organisation abbreviations',()=>{
 const f=fixture(); f.story.scenes[0].chronology={day:1}; f.story.scenes[1].chronology={day:5};
 f.story.worlds=[{schemaVersion:1,id:'world',name:'Universe',description:'',characterIds:['char'],locationIds:[],entities:[{id:'unit',kind:'organisation',name:'Special Crimes Unit',abbreviation:'SCU',description:''},{id:'dc',kind:'organisation',organisationRole:'rank',name:'Detective Constable',abbreviation:'DC',description:''},{id:'di',kind:'organisation',organisationRole:'rank',name:'Detective Inspector',abbreviation:'DI',description:''}],relationships:[{id:'old',type:'member of',from:{kind:'character',id:'char'},to:{kind:'organisation',id:'unit'},rankId:'dc',untilPoint:{chronology:{day:5}}},{id:'new',type:'member of',from:{kind:'character',id:'char'},to:{kind:'organisation',id:'unit'},rankId:'di',fromPoint:{chronology:{day:5}}}],diagrams:[]}];
 const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 expect(view.getByRole('button',{name:'Apple (DC)'})).toBeInTheDocument(); expect(view.getByRole('button',{name:'Apple (DI)'})).toBeInTheDocument(); expect(view.queryByText('Apple (SCU)')).not.toBeInTheDocument();
});
function fixture() {
 const script = createScreenplay({ projectId: 'p', title: 'Episode', screenplayType: 'feature' });
 script.scenes.push(createScene(1));
 script.scenes.forEach((scene,i)=>{ scene.elements=[createElement('scene_heading',i?'INT. OFFICE - NIGHT':'EXT. COURT - MORNING',0)]; });
 const story=migrateStory(null,'p');
 story.plots=[{id:'plot',name:'Disappearance',description:'',color:'#2563eb'}];
 story.characters=[{id:'char',name:'Apple',description:''}];
 story.locations=[{id:'court',name:'Court',description:''},{id:'office',name:'Office',description:''}];
 story.scenes=script.scenes.map((scene,i)=>({sceneId:scene.id,screenplayId:script.id,chronology:{day:14,date:'2026-09-29',timeOfDay:i?'night':'morning'},locationId:i?'office':'court',presentIds:['char']}));
 story.events=[{id:'e',name:'Sara disappears',description:'',major:true,plotIds:['plot'],chronology:{day:1},referencedInSceneIds:[script.scenes[0].id],sceneInteractions:[{sceneId:script.scenes[1].id,relationship:'investigated'}]},{id:'bail',name:'Bail granted',description:'',contextOverrides:[],occursInSceneId:script.scenes[0].id}];
 const savePreferences=vi.fn(async value=>value);
 window.desktop={bootstrap:vi.fn(async()=>({preferences:{schemaVersion:1,theme:'dark',compactLibrary:false,spellingLanguage:'en-GB'}})),savePreferences} as unknown as DesktopApi;
 const change=vi.fn(); const select=vi.fn();
 return {script,story,change,select,savePreferences};
}
it('groups shared days once, nests inherited occurrences and projects later relationships on the same event',()=>{
 const f=fixture();const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{order:'day'}} tracks={false} plotsOnly={false} select={f.select}/>);
 expect(view.getAllByRole('heading',{name:'Day 14 · 29 Sept 2026'})).toHaveLength(1);
 expect(view.getByRole('heading',{name:'Morning'})).toBeInTheDocument();
 expect(view.getByRole('heading',{name:'Night'})).toBeInTheDocument();
 expect(view.getAllByRole('button',{name:'Bail granted · Occurs'})).toHaveLength(1);
 fireEvent.click(view.getByRole('button',{name:'Sara disappears · Investigated'}));
 expect(f.select).toHaveBeenLastCalledWith('event','e');
 expect(within(view.getByRole('button',{name:'Sara disappears · Referenced'}).parentElement!).getByRole('button',{name:'Disappearance'})).toBeInTheDocument();
 expect(f.story.events).toHaveLength(2);
});
it('follows event progression through screenplay order while retaining occurrence day',()=>{
 const f=fixture();const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{order:'day'}} tracks plotsOnly={false} select={f.select}/>);
 fireEvent.change(view.getByLabelText('Track type'),{target:{value:'event'}});
 expect(view.getByText('Day 1')).toBeInTheDocument();
 const items=within(view.getByRole('list')).getAllByRole('listitem');
 expect(items[0]).toHaveTextContent('Referenced');expect(items[1]).toHaveTextContent('Investigated');
 expect(view.queryByText('First shown')).not.toBeInTheDocument();
});
it('saves name-only preference, retains readable names and orders the semantic key',async()=>{
 const f=fixture();const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 fireEvent.change(view.getByLabelText('Timeline display'),{target:{value:'names'}});
 await waitFor(()=>expect(f.savePreferences).toHaveBeenCalledWith(expect.objectContaining({timelineDisplay:'names'})));
 const item=view.getByRole('button',{name:'Bail granted · Occurs'});
 expect(item).toHaveTextContent('Bail granted');expect(item.querySelector('svg')).toBeNull();
 expect(view.queryByRole('option',{name:'Icon only'})).not.toBeInTheDocument();
 expect([...view.getByLabelText('Timeline icon key').children].map(node=>node.textContent)).toEqual(['Scene','Event','Major event','Plot','Character','Location']);
});
it('normalizes a legacy icon-only preference to the named default',async()=>{
 const f=fixture();vi.mocked(window.desktop.bootstrap).mockResolvedValue({preferences:{timelineDisplay:'icons'}} as never);
 const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 await waitFor(()=>expect(window.desktop.bootstrap).toHaveBeenCalled());
 expect(view.getByLabelText('Timeline display')).toHaveValue('icons_names');
 expect(view.getByRole('button',{name:'Bail granted · Occurs'})).toHaveTextContent('Bail granted');
});
it('retains detached events with inherited time and location and includes removed scenes only on request',()=>{
 const f=fixture();const documents=[{...f.script,scenes:f.script.scenes.slice(1)}];
 const view=render(<StoryTimeline story={f.story} documents={documents} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 expect(view.getByText('No active scene')).toBeInTheDocument();expect(view.queryByText('Removed scene')).not.toBeInTheDocument();
 expect(view.getByRole('button',{name:'Court'})).toBeInTheDocument();
 view.rerender(<StoryTimeline story={f.story} documents={documents} filter={{includeRemovedScenes:true}} tracks={false} plotsOnly={false} select={f.select}/>);
 expect(view.getByText('Removed')).toBeInTheDocument();
});
it('shows investigation in Events filter at the scene time and preserves the original event identity',()=>{
 const f=fixture();const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{kind:'event'}} tracks={false} plotsOnly={false} select={f.select}/>);
 fireEvent.click(view.getByRole('button',{name:'Sara disappears · Investigated'}));expect(f.select).toHaveBeenCalledWith('event','e');
});

it('displays canonical Event and direct Scene plot effects in read-only Tracks and navigates to their owners',()=>{
 const f=fixture();f.story.events[0].plotEffects={plot:'Developed'};
 f.story.scenes[0].plotIds=['plot'];f.story.scenes[0].plotRoles={plot:'Complicated'};
 const before=JSON.stringify(f.story);
 const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks plotsOnly={false} select={f.select}/>);
 expect(view.queryByRole('combobox',{name:/Relationship/})).not.toBeInTheDocument();
 const effects=view.getAllByRole('button',{name:'Disappearance · Developed'});
 fireEvent.click(effects[0]);expect(f.select).toHaveBeenLastCalledWith('event','e');
 fireEvent.click(view.getByRole('button',{name:'Disappearance · Complicated'}));expect(f.select).toHaveBeenLastCalledWith('scene',f.script.scenes[0].id);
 expect(JSON.stringify(f.story)).toBe(before);
});
it('keeps scene children in Event, Plot, Character, Location order and suppresses redundant same-scene revelation',()=>{
 const f=fixture();f.story.events[1].plotIds=['plot'];f.story.events[1].plotEffects={plot:'Developed'};
 f.story.events[1].revealedInSceneIds=[f.script.scenes[0].id,f.script.scenes[1].id];
 const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 const scene=view.getByRole('button',{name:/^Episode · Scene 1:/}).closest('article')!;
 const labels=within(scene).getAllByRole('button').map(button=>button.getAttribute('aria-label'));
 expect(labels.indexOf('Bail granted · Occurs')).toBeLessThan(labels.indexOf('Disappearance · Developed'));
 expect(labels.indexOf('Disappearance · Developed')).toBeLessThan(labels.indexOf('Apple'));
 expect(labels.indexOf('Apple')).toBeLessThan(labels.indexOf('Court'));
 expect(within(scene).queryByRole('button',{name:'Bail granted · Revealed'})).not.toBeInTheDocument();
 expect(view.getByRole('button',{name:'Bail granted · Revealed'})).toBeInTheDocument();
});

it.each([false,true])('preserves owning Events and suppresses matching legacy Scene effects (tracks=%s)',tracks=>{
 const f=fixture(), sceneId=f.script.scenes[0].id;
 f.story.events=[{id:'one',name:'First',description:'',contextOverrides:[],occursInSceneId:sceneId,plotIds:['plot'],plotEffects:{plot:'Introduced'},occurrenceTiming:{mode:'exact',time:'09:47'}},{id:'two',name:'Second',description:'',contextOverrides:[],occursInSceneId:sceneId,plotIds:['plot'],plotEffects:{plot:'Developed'}}];
 f.story.scenes[0].plotIds=['plot'];f.story.scenes[0].plotRoles={plot:'Introduced'};
 const before=JSON.stringify(f.story);const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={tracks} plotsOnly={false} select={f.select}/>);
 expect(view.getAllByRole('button',{name:'Disappearance · Introduced'})).toHaveLength(1);
 expect(within(view.getByRole('button',{name:'First · Occurs'}).parentElement!).getByRole('button',{name:'Disappearance · Introduced'})).toBeInTheDocument();
 expect(within(view.getByRole('button',{name:'Second · Occurs'}).parentElement!).getByRole('button',{name:'Disappearance · Developed'})).toBeInTheDocument();
 expect(within(view.getByRole('button',{name:'First · Occurs'}).parentElement!).getByText('09:47')).toBeInTheDocument();
 expect(view.getByRole('button',{name:'Second · Occurs'}).parentElement?.querySelector(':scope > small')).toBeNull();
 expect(JSON.stringify(f.story)).toBe(before);
 if(tracks){fireEvent.change(view.getByLabelText('Track type'),{target:{value:'event'}});expect(view.getAllByRole('button',{name:'First · Occurs'})).toHaveLength(1);expect(view.queryByText('No scene')).not.toBeInTheDocument();}
});

it('links Compare by identity with opposite-pane-only scrolling and appearance navigation',async()=>{
 const f=fixture();f.story.events[0].revealedInSceneIds=[f.script.scenes[0].id];
 const before=JSON.stringify(f.story);const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 fireEvent.change(view.getByLabelText('Timeline order'),{target:{value:'compare'}});
 const left=view.getByRole('region',{name:'Story Order'}),right=view.getByRole('region',{name:'Screenplay Order'});
 for(const pane of [left,right]){Object.defineProperties(pane,{clientHeight:{value:300},scrollHeight:{value:3000}});pane.getBoundingClientRect=()=>({top:100,height:300} as DOMRect);pane.scrollTo=vi.fn();pane.querySelectorAll<HTMLElement>('[data-timeline-key]').forEach((row,i)=>{row.getBoundingClientRect=()=>({top:100+(i+1)*300-pane.scrollTop,height:30} as DOMRect);});}
 const occurrence=within(left).getByRole('button',{name:'Sara disappears · Occurs'}),first=within(right).getByRole('button',{name:'Sara disappears · Revealed'});
 fireEvent.mouseEnter(occurrence);expect(first.closest('[data-match-id]')).toHaveClass('timeline-hover');expect(right.scrollTo).not.toHaveBeenCalled();expect(left.scrollTo).not.toHaveBeenCalled();
 fireEvent.mouseLeave(occurrence);fireEvent.click(occurrence);
 await waitFor(()=>expect(right.scrollTo).toHaveBeenCalledTimes(1));expect(left.scrollTo).not.toHaveBeenCalled();expect(right.scrollTo).toHaveBeenLastCalledWith({top:465,behavior:'smooth'});
 expect(occurrence.closest('[data-match-id]')).toHaveClass('timeline-selected');expect(first.closest('[data-match-id]')).toHaveClass('timeline-selected');expect(view.getByText('1 of 3')).toBeInTheDocument();
 fireEvent.click(view.getByRole('button',{name:'Next screenplay appearance'}));await waitFor(()=>expect(right.scrollTo).toHaveBeenCalledTimes(2));expect(view.getByText('2 of 3')).toBeInTheDocument();
 const referenced=within(right).getByRole('button',{name:'Sara disappears · Referenced'});expect(referenced.closest('[data-match-id]')).toHaveClass('timeline-selected');expect(occurrence.closest('[data-match-id]')).toHaveClass('timeline-selected');expect(left.scrollTo).not.toHaveBeenCalled();
 fireEvent.scroll(right,{target:{scrollTop:250}});expect(left.scrollTo).not.toHaveBeenCalled();
 fireEvent.click(within(right).getByRole('button',{name:'Sara disappears · Investigated'}));await waitFor(()=>expect(left.scrollTo).toHaveBeenCalledTimes(1));expect(right.scrollTo).toHaveBeenCalledTimes(2);expect(view.getByText('3 of 3')).toBeInTheDocument();expect(f.select).not.toHaveBeenCalled();expect(JSON.stringify(f.story)).toBe(before);
});
it('reveals a collapsed opposite Scene and matches Events separately from their containing Scene',async()=>{
 const f=fixture();const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);fireEvent.change(view.getByLabelText('Timeline order'),{target:{value:'compare'}});
 const left=view.getByRole('region',{name:'Story Order'}),right=view.getByRole('region',{name:'Screenplay Order'});left.scrollTo=vi.fn();right.scrollTo=vi.fn();
 const collapse=within(right).getByRole('button',{name:/^Collapse Episode · Scene 1:/});fireEvent.click(collapse);expect(within(right).queryByRole('button',{name:'Bail granted · Occurs'})).not.toBeInTheDocument();
 fireEvent.click(within(left).getByRole('button',{name:'Bail granted · Occurs'}));await waitFor(()=>expect(within(right).getByRole('button',{name:'Bail granted · Occurs'})).toBeInTheDocument());
 expect(within(right).getByRole('button',{name:'Bail granted · Occurs'}).closest('[data-match-id]')).toHaveClass('timeline-selected');expect(within(right).getByRole('button',{name:/^Episode · Scene 1:/}).closest('[data-match-id]')).not.toHaveClass('timeline-selected');
 fireEvent.click(within(right).getByRole('button',{name:/^Episode · Scene 1:/}));await waitFor(()=>expect(left.scrollTo).toHaveBeenCalled());expect(within(left).getByRole('button',{name:/^Episode · Scene 1:/}).closest('[data-match-id]')).toHaveClass('timeline-selected');
});
it('collapses hierarchy without changing canon, remembers preferences, and expands secondary information by density',async()=>{
 const f=fixture(),before=JSON.stringify(f.story);const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 fireEvent.click(view.getByRole('button',{name:'Collapse all'}));expect(view.queryByRole('button',{name:'Bail granted · Occurs'})).not.toBeInTheDocument();
 fireEvent.click(view.getByRole('button',{name:'Expand all'}));expect(view.getByRole('button',{name:'Bail granted · Occurs'})).toBeInTheDocument();
 const scene=view.getByRole('button',{name:/^Episode · Scene 1:/}).closest('article')!;fireEvent.click(within(scene).getByRole('button',{name:/^Collapse /}));expect(within(scene).getByText('2 Events · 1 Plots')).toBeInTheDocument();expect(within(scene).queryByRole('button',{name:'Bail granted · Occurs'})).not.toBeInTheDocument();
 fireEvent.change(view.getByLabelText('Timeline density'),{target:{value:'expanded'}});expect(view.getByRole('button',{name:'Bail granted · Occurs'})).toBeInTheDocument();expect(view.getAllByRole('button',{name:'Apple'})).toHaveLength(2);
 fireEvent.change(view.getByLabelText('Timeline order'),{target:{value:'screenplay'}});await waitFor(()=>expect(f.savePreferences).toHaveBeenCalledWith(expect.objectContaining({timelineDensity:'expanded',timelineOrder:'screenplay'})));
 expect(JSON.stringify(f.story)).toBe(before);
});
it('restores saved Compare and density preferences without restoring icon-only',async()=>{
 const f=fixture();vi.mocked(window.desktop.bootstrap).mockResolvedValue({preferences:{timelineOrder:'compare',timelineDensity:'compact',timelineDisplay:'names'}} as never);
 const view=render(<StoryTimeline story={f.story} documents={[f.script]} filter={{}} tracks={false} plotsOnly={false} select={f.select}/>);
 await waitFor(()=>expect(view.getByLabelText('Timeline order')).toHaveValue('compare'));expect(view.getByLabelText('Timeline density')).toHaveValue('compact');expect(view.getByLabelText('Timeline display')).toHaveValue('names');expect(view.getByRole('region',{name:'Story Order'})).toBeInTheDocument();
});
