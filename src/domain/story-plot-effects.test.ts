import { expect, it } from 'vitest';
import { assignEventPlots, deleteStoryEntity, getEventsForScene, getPlotEffectsForScene, migrateStory } from './story';
function fixture() {
 const story=migrateStory(null,'p');
 story.plots=['a','b'].map(id=>({id,name:id,description:'',color:'accent'}));
 story.scenes=[{sceneId:'s',screenplayId:'script',plotIds:['a'],plotRoles:{a:'Resolved',b:'Introduced'}}];
 story.events=[{id:'e',name:'Bail',description:'',plotIds:['a','b'],plotEffects:{a:'Developed',b:'Complicated'},occursInSceneId:'s',revealedInSceneIds:['s','later'],referencedInSceneIds:['reference']}];
 return story;
}
it('round-trips independent effects for each assigned Plot and projects only owning canonical sources',()=>{
 const story=migrateStory(JSON.parse(JSON.stringify(fixture())),'p');
 expect(getPlotEffectsForScene(story,'s')).toEqual([
 {plotId:'a',effect:'Resolved',source:'scene',sourceId:'s'},
 {plotId:'a',effect:'Developed',source:'event',sourceId:'e'},
 {plotId:'b',effect:'Complicated',source:'event',sourceId:'e'},
 ]);
 expect(getPlotEffectsForScene(story,'reference').map(effect=>effect.effect)).toEqual(['Developed','Complicated']);
});
it('removes effects with membership or Plot deletion and does not modify the original records',()=>{
 const story=fixture();const before=JSON.stringify(story);
 expect(assignEventPlots(story.events[0],['b']).plotEffects).toEqual({b:'Complicated'});
 const clean=deleteStoryEntity(story,'plots','a');
 expect(clean.events[0].plotEffects).toEqual({b:'Complicated'});
 expect(()=>migrateStory(clean,'p')).not.toThrow();expect(JSON.stringify(story)).toBe(before);
});
it('rejects effects on unassigned plots and accepts older stories with no effects',()=>{
 const story=fixture();story.events[0].plotIds=['b'];
 expect(()=>migrateStory(story,'p')).toThrow('Plot effect requires an assigned plot');
 delete story.events[0].plotEffects;expect(()=>migrateStory(story,'p')).not.toThrow();
});
it('prefers Occurs over same-scene Revealed without losing later revelation or stored recovery links',()=>{
 const story=fixture();const scene=getEventsForScene(story,'s');
 expect(scene.occurs.map(link=>link.event.id)).toEqual(['e']);expect(scene.revealed).toEqual([]);
 expect(getEventsForScene(story,'later').revealed.map(link=>link.event.id)).toEqual(['e']);
 expect(story.events[0].revealedInSceneIds).toEqual(['s','later']);
});
