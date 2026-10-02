import { createWorld } from '../domain/worlds';
// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { StoryPanel } from './StoryPanel';
import { createScreenplay } from '../domain/screenplay';
import { migrateStory } from '../domain/story';
import type { DesktopApi, ProjectWorkspace } from '../shared/models';
afterEach(cleanup);

it('opens scene details, edits relationships, autosaves, and clears metadata without changing screenplay text', async () => {
  const screenplay = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  const original = JSON.stringify(screenplay);
  const story = migrateStory(null, 'p');
  story.plots = [{ id: 'a', name: 'Disappearance', description: '', color: 'accent' }];
  story.events = [{ id: 'e', name: 'Disappears', description: '', occursInSceneId: screenplay.scenes[0].id }];
  const workspace: ProjectWorkspace = { project: { id: 'p', schemaVersion: 3, documentFormat: 'screenplay', projectType: 'feature', title: 'Example', createdAt: '', updatedAt: '', metadata: { description: '' } }, screenplays: [screenplay], story };
  const saveStory = vi.fn(async (_id, value) => value);
  window.desktop = { saveStory } as unknown as DesktopApi;
  const onSaved = vi.fn();
  const view = render(<StoryPanel workspace={workspace} screenplay={screenplay} open sceneId={screenplay.scenes[0].id} plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={onSaved} />);
  fireEvent.change(view.getByLabelText('Story day'), { target: { value: '4' } });
  fireEvent.click(within(view.getByRole('group', { name: 'Plots' })).getByRole('button', { name: '+ Add' }));
  fireEvent.click(view.getByRole('button', { name: 'Disappearance' }));
  await waitFor(() => expect(saveStory).toHaveBeenCalled(), { timeout: 2000 });
  expect(saveStory.mock.calls.at(-1)?.[1].scenes[0]).toMatchObject({ chronology: { day: 4 }, plotIds: ['a'] });
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(view.getByLabelText('More scene actions'));
  fireEvent.click(view.getByRole('button', { name: 'Clear added story details' }));
  await waitFor(() => expect(saveStory.mock.calls.at(-1)?.[1].scenes).toEqual([]), { timeout: 2000 });
  expect(saveStory.mock.calls.at(-1)?.[1].events).toHaveLength(1);
  expect(saveStory.mock.calls.at(-1)?.[1].events[0].occursInSceneId).toBe(screenplay.scenes[0].id);
  expect(JSON.stringify(screenplay)).toBe(original);
  confirm.mockRestore();
});

it('assigns an event to a plot and scene once, then derives both relationships in Scene Details', async () => {
  const screenplay = createScreenplay({ projectId: 'p', title: 'Example', screenplayType: 'feature' });
  const story = migrateStory(null, 'p');
  story.plots = [{ id: 'plot-a', name: 'Investigation', description: '', color: 'accent' }];
  story.events = [{ id: 'event-a', name: 'A clue is found', description: '', contextOverrides: [] }];
  const workspace: ProjectWorkspace = { project: { id: 'p', schemaVersion: 3, documentFormat: 'screenplay', projectType: 'feature', title: 'Example', createdAt: '', updatedAt: '', metadata: { description: '' } }, screenplays: [screenplay], story };
  const saveStory = vi.fn(async (_id, value) => value);
  window.desktop = { saveStory } as unknown as DesktopApi;
  const view = render(<StoryPanel workspace={workspace} screenplay={screenplay} open plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={vi.fn()} />);

  fireEvent.click(view.getByRole('button', { name: 'Events' }));
  const eventPicker = view.getByRole('group', { name: 'Event' });
  fireEvent.click(within(eventPicker).getByRole('button', { name: '+ Add' }));
  fireEvent.click(within(eventPicker).getByRole('button', { name: 'A clue is found' }));
  const assignedPlots = view.getByRole('group', { name: 'Assigned Plots' });
  fireEvent.click(within(assignedPlots).getByRole('button', { name: '+ Add' }));
  fireEvent.click(within(assignedPlots).getByRole('button', { name: 'Investigation' }));
  fireEvent.change(view.getByLabelText('Where does this event occur?'), { target: { value: 'scene' } });
  const scenePicker = view.getByRole('group', { name: 'Occurs in scene' });
  fireEvent.click(within(scenePicker).getByRole('button', { name: '+ Add' }));
  fireEvent.click(within(scenePicker).getAllByRole('button')[1]);

  await waitFor(() => expect(saveStory.mock.calls.at(-1)?.[1].events[0]).toMatchObject({ plotIds: ['plot-a'], occursInSceneId: screenplay.scenes[0].id }), { timeout: 2000 });
  expect(saveStory.mock.calls.at(-1)?.[1].scenes[0]?.plotIds ?? []).toEqual([]);
  fireEvent.click(view.getByRole('button', { name: 'Scenes' }));
  expect(view.getAllByText('A clue is found')).not.toHaveLength(0);
  expect(view.getByText('Via A clue is found')).toBeInTheDocument();
});


it('edits separate Event-to-Plot effects once and projects them into read-only Tracks',async()=>{
 const screenplay=createScreenplay({projectId:'p',title:'Example',screenplayType:'feature'});
 screenplay.scenes[0].elements[0].type='scene_heading';screenplay.scenes[0].elements[0].content='INT. COURT - DAY';
 const story=migrateStory(null,'p');story.plots=['Alpha','Beta'].map(name=>({id:name,name,description:'',color:'accent'}));
 story.events=[{id:'e',name:'Bail granted',description:'',plotIds:['Alpha','Beta'],occursInSceneId:screenplay.scenes[0].id,contextOverrides:[]}];
 const workspace:ProjectWorkspace={project:{id:'p',schemaVersion:3,documentFormat:'screenplay',projectType:'feature',title:'Example',createdAt:'',updatedAt:'',metadata:{description:''}},screenplays:[screenplay],story};
 const saveStory=vi.fn(async(_id,value)=>value);window.desktop={saveStory} as unknown as DesktopApi;
 const view=render(<StoryPanel workspace={workspace} screenplay={screenplay} open plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={vi.fn()}/>);
 fireEvent(window,new CustomEvent('edit-story-entity',{detail:{type:'event',entityId:'e'}}));
 fireEvent.change(view.getByLabelText('Effect on plot for Alpha'),{target:{value:'Developed'}});
 fireEvent.change(view.getByLabelText('Effect on plot for Beta'),{target:{value:'Complicated'}});
 await waitFor(()=>expect(saveStory.mock.calls.at(-1)?.[1].events[0].plotEffects).toEqual({Alpha:'Developed',Beta:'Complicated'}),{timeout:2000});
 fireEvent.click(view.getByRole('button',{name:'Timeline'}));fireEvent.click(view.getByRole('button',{name:'Tracks'}));
 expect(view.getByRole('button',{name:'Alpha · Developed'})).toBeInTheDocument();
 expect(view.queryByRole('combobox',{name:/Relationship in/})).not.toBeInTheDocument();
 fireEvent.change(view.getByLabelText('Track', {exact:true}),{target:{value:'Beta'}});
 expect(view.getByRole('button',{name:'Beta · Complicated'})).toBeInTheDocument();
 fireEvent.click(view.getByRole('button',{name:'Beta · Complicated'}));
 fireEvent.click(view.getByRole('button',{name:'Remove Alpha from Assigned Plots'}));
 await waitFor(()=>expect(saveStory.mock.calls.at(-1)?.[1].events[0].plotEffects).toEqual({Beta:'Complicated'}),{timeout:2000});
});
it('edits direct Scene-to-Plot effects in Scene Details and displays them through Tracks',async()=>{
 const screenplay=createScreenplay({projectId:'p',title:'Example',screenplayType:'feature'});
 screenplay.scenes[0].elements[0].type='scene_heading';screenplay.scenes[0].elements[0].content='INT. COURT - DAY';
 const story=migrateStory(null,'p');story.plots=[{id:'plot',name:'Investigation',description:'',color:'accent'}];
 story.scenes=[{sceneId:screenplay.scenes[0].id,screenplayId:screenplay.id,plotIds:['plot']}];
 const workspace:ProjectWorkspace={project:{id:'p',schemaVersion:3,documentFormat:'screenplay',projectType:'feature',title:'Example',createdAt:'',updatedAt:'',metadata:{description:''}},screenplays:[screenplay],story};
 const saveStory=vi.fn(async(_id,value)=>value);window.desktop={saveStory} as unknown as DesktopApi;
 const view=render(<StoryPanel workspace={workspace} screenplay={screenplay} open sceneId={screenplay.scenes[0].id} plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={vi.fn()}/>);
 fireEvent.change(view.getByLabelText('Effect on plot for Investigation'),{target:{value:'Resolved'}});
 await waitFor(()=>expect(saveStory.mock.calls.at(-1)?.[1].scenes[0].plotRoles).toEqual({plot:'Resolved'}),{timeout:2000});
 fireEvent.click(view.getByRole('button',{name:'Timeline'}));fireEvent.click(view.getByRole('button',{name:'Tracks'}));
 expect(view.getByRole('button',{name:'Investigation · Resolved'})).toBeInTheDocument();
 expect(saveStory.mock.calls.at(-1)?.[1].events).toEqual([]);
});

it('keeps Show in List only and saves optional occurrence timing in the canonical Event form',async()=>{
 const screenplay=createScreenplay({projectId:'p',title:'Example',screenplayType:'feature'}),story=migrateStory(null,'p');
 story.events=[{id:'e',name:'Explosion',description:'',contextOverrides:[],occursInSceneId:screenplay.scenes[0].id}];
 story.scenes=[{sceneId:screenplay.scenes[0].id,screenplayId:screenplay.id,chronology:{day:14,time:'20:00',duration:5}}];
 const workspace:ProjectWorkspace={project:{id:'p',schemaVersion:3,documentFormat:'screenplay',projectType:'feature',title:'Example',createdAt:'',updatedAt:'',metadata:{description:''}},screenplays:[screenplay],story};
 const saveStory=vi.fn(async(_id,value)=>value);window.desktop={saveStory} as unknown as DesktopApi;
 const view=render(<StoryPanel workspace={workspace} screenplay={screenplay} open plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={vi.fn()}/>);
 expect(view.getByLabelText('Show')).toBeInTheDocument();fireEvent.change(view.getByLabelText('Show'),{target:{value:'major'}});fireEvent.click(view.getByRole('button',{name:'Tracks'}));expect(view.queryByLabelText('Show')).not.toBeInTheDocument();fireEvent.click(view.getByRole('button',{name:'List'}));expect(view.getByLabelText('Show')).toHaveValue('major');
 fireEvent.click(view.getByRole('button',{name:'Events'}));const picker=view.getByRole('group',{name:'Event'});fireEvent.click(within(picker).getByRole('button',{name:'+ Add'}));fireEvent.click(within(picker).getByRole('button',{name:'Explosion'}));
 expect(view.getByLabelText('Event time')).toHaveValue('inherit');expect(view.queryByLabelText('Calendar date')).not.toBeInTheDocument();
 fireEvent.change(view.getByLabelText('Event time'),{target:{value:'range'}});fireEvent.change(view.getByLabelText('Start time'),{target:{value:'22:00'}});fireEvent.change(view.getByLabelText('End time'),{target:{value:'02:00'}});
 await waitFor(()=>expect(saveStory.mock.calls.at(-1)?.[1].events[0].occurrenceTiming).toEqual({mode:'range',time:'22:00',endTime:'02:00'}),{timeout:2000});
 fireEvent.change(view.getByLabelText('Event time'),{target:{value:'inherit'}});await waitFor(()=>expect(saveStory.mock.calls.at(-1)?.[1].events[0].occurrenceTiming).toEqual({mode:'inherit'}),{timeout:2000});
 expect(JSON.stringify(screenplay)).toBe(JSON.stringify(workspace.screenplays[0]));
});

it('permanent World deletion clears metadata Undo without changing screenplay content',async()=>{
 const screenplay=createScreenplay({projectId:'p',title:'Example',screenplayType:'feature'}),story=migrateStory(null,'p'),world=createWorld('Universe');world.entities=[{id:'bell',kind:'object',name:'Bell',description:''}];story.worlds=[world];story.characters=[{id:'apple',name:'Apple',description:''}];const original=JSON.stringify(screenplay);
 const workspace:ProjectWorkspace={project:{schemaVersion:3,id:'p',documentFormat:'screenplay',projectType:'feature',title:'Example',createdAt:'',updatedAt:'',metadata:{description:''}},screenplays:[screenplay],story};let draft=story;window.desktop={saveStory:vi.fn(async(_id,value)=>value)} as unknown as DesktopApi;
 const view=render(<><div className="writing-header"/><div className="screenplay-statistics"/><StoryPanel workspace={workspace} screenplay={screenplay} open={false} plotTerm="Plot" onClose={vi.fn()} onState={vi.fn()} onSaved={vi.fn()} onDraft={s=>draft=s}/></>);
 fireEvent.click(within(view.container.querySelector('.writing-header')!).getByRole('button',{name:'Worlds'}));const w=within(view.getByRole('dialog',{name:'Worlds workspace'}));fireEvent.change(w.getByLabelText('Description'),{target:{value:'Populate Undo'}});fireEvent.click(w.getByRole('button',{name:'Objects'}));fireEvent.click(w.getByRole('button',{name:'Bell'}));fireEvent.click(w.getByRole('button',{name:'Delete…'}));fireEvent.click(view.getByRole('button',{name:'Delete Bell'}));await waitFor(()=>expect(view.queryByRole('alertdialog')).not.toBeInTheDocument());fireEvent.click(w.getByRole('button',{name:'Close Worlds'}));
 act(()=>window.dispatchEvent(new CustomEvent('open-story-profile',{detail:{type:'character',entityId:'apple',full:true}})));fireEvent.click(view.getByRole('button',{name:'Undo last change'}));expect(draft.worlds![0].entities).toEqual([]);expect(JSON.stringify(screenplay)).toBe(original);
});
