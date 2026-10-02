// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { createWorld } from '../domain/worlds';
import { migrateStory } from '../domain/story';
import type { StoryRecord } from '../shared/story';
import { WorldDeleteDialog } from './WorldDeleteDialog';
import { WorldWorkspace } from './WorldWorkspace';
afterEach(cleanup);
it('requires an explicit child decision and starts focus on Cancel',()=>{
 const story=migrateStory(null,'p'), world=createWorld('Universe'); story.worlds=[world]; world.entities=[{id:'scu',kind:'organisation',name:'SCU',description:''},{id:'team',kind:'structure',name:'Team 4',description:'',organisationId:'scu'},{id:'child',kind:'structure',name:'Forensics',description:'',organisationId:'scu'}]; world.relationships=[{id:'c',type:'part of',from:{kind:'structure',id:'child'},to:{kind:'structure',id:'team'}}]; const confirm=vi.fn(), cancel=vi.fn();
 const view=render(<WorldDeleteDialog story={story} world={world} target={{kind:'entity',ref:{kind:'structure',id:'team'}}} confirm={confirm} cancel={cancel}/>);
 expect(view.getByRole('button',{name:'Cancel'})).toHaveFocus(); expect(view.getByRole('button',{name:'Delete Team 4'})).toBeDisabled();
 fireEvent.click(view.getByRole('radio',{name:'Move children to parent'})); fireEvent.click(view.getByRole('button',{name:'Delete Team 4'})); expect(confirm).toHaveBeenCalledWith({mode:'move'});
});
it('requires the World name and explains Library independence',()=>{
 const story=migrateStory(null,'p'), world=createWorld('The Altered'); const confirm=vi.fn();
 const view=render(<WorldDeleteDialog story={story} world={world} target={{kind:'world'}} confirm={confirm} cancel={vi.fn()}/>);
 expect(view.getByText(/World Library source remains/)).toBeVisible(); expect(view.getByRole('button',{name:'Delete The Altered'})).toBeDisabled(); fireEvent.change(view.getByLabelText('Type “The Altered” to confirm'),{target:{value:'The Altered'}}); fireEvent.click(view.getByRole('button',{name:'Delete The Altered'})); expect(confirm).toHaveBeenCalledOnce();
});
it('entity Delete is discoverable, Cancel retains it, confirmed deletion removes links and footer pins', async()=>{
 const initial=migrateStory(null,'p'), world=createWorld('Universe'); world.entities=[{id:'bell',kind:'object',name:'Attention Bell',description:''}]; initial.worlds=[world]; initial.worldUi={pins:[{worldId:world.id,entity:{kind:'object',id:'bell'}}]}; let latest=initial;
 function Harness(){const [story,setStory]=useState<StoryRecord>(initial);return <><div className="writing-header"/><div className="screenplay-statistics"/><WorldWorkspace story={story} documents={[]} change={s=>{latest=s;setStory(s);}} navigateScene={vi.fn()} status="Saved" error="" retry={vi.fn()}/></>;}
 const view=render(<Harness/>);fireEvent.click(within(view.container.querySelector('.writing-header')!).getByRole('button',{name:'Worlds'}));const workspace=within(view.getByRole('dialog',{name:'Worlds workspace'}));fireEvent.click(workspace.getByRole('button',{name:'Objects'}));fireEvent.click(workspace.getByRole('button',{name:'Attention Bell'}));fireEvent.click(workspace.getByRole('button',{name:'Delete…'}));fireEvent.click(view.getByRole('button',{name:'Cancel'}));expect(latest.worlds![0].entities).toHaveLength(1);
 fireEvent.click(workspace.getByRole('button',{name:'Delete…'}));fireEvent.click(view.getByRole('button',{name:'Delete Attention Bell'}));await waitFor(()=>expect(view.queryByRole('alertdialog')).not.toBeInTheDocument());expect(latest.worlds![0].entities).toEqual([]);expect(latest.worldUi!.pins).toEqual([]);
});
