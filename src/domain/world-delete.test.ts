import { expect, it } from 'vitest';
import { migrateStory } from './story';
import { createWorld, packageWorld, parseWorldPackage } from './worlds';
import { deleteWorldData, inspectWorldDeletion } from './world-delete';

function fixture() {
 const story=migrateStory(null,'p'), world=createWorld('The Altered');
 story.characters=[{id:'apple',name:'Apple',description:''}]; story.locations=[{id:'floor',name:'Floor 3',description:''}];
 world.characterIds=['apple']; world.locationIds=['floor'];
 world.entities=[{id:'police',kind:'organisation',name:'Police Scotland',description:''},{id:'scu',kind:'organisation',name:'SCU',description:''},{id:'team',kind:'structure',organisationId:'scu',name:'Team 4',description:''},{id:'child',kind:'structure',organisationId:'scu',name:'Forensic Team',description:''},{id:'bell',kind:'object',name:'Attention Bell',description:'Keep text',fields:{Team:'Team 4'},fieldLinks:{Team:{kind:'structure',id:'team'}}},{id:'rule',kind:'rule',name:'No nuts',description:''},{id:'dc',kind:'rank',organisationId:'scu',name:'Detective Constable',abbreviation:'DC',description:''}];
 world.relationships=[{id:'parent',from:{kind:'organisation',id:'scu'},to:{kind:'organisation',id:'police'},type:'part of'},{id:'childlink',from:{kind:'structure',id:'child'},to:{kind:'structure',id:'team'},type:'reports to'},{id:'member',from:{kind:'character',id:'apple'},to:{kind:'organisation',id:'scu'},unitId:'team',rankId:'dc',type:'member of',untilPoint:{chronology:{day:2}}},{id:'belllink',from:{kind:'object',id:'bell'},to:{kind:'structure',id:'team'},type:'belongs to',archived:true},{id:'floorlink',from:{kind:'structure',id:'team'},to:{kind:'location',id:'floor'},type:'located at'},{id:'rulelink',from:{kind:'rule',id:'rule'},to:{kind:'structure',id:'team'},type:'applies to'}];
 world.diagrams=[{id:'chart',name:'SCU Organisation Chart',mode:'organisation',root:{kind:'structure',id:'team'},collapsedIds:['structure:team']}];
 story.worlds=[world]; story.worldUi={pins:[{worldId:world.id,entity:{kind:'structure',id:'team'}},{worldId:world.id,diagramId:'chart'}]}; story.worldOccurrences=[{id:'text',worldId:world.id,entity:{kind:'structure',id:'team'},screenplayId:'d',sceneId:'s',scope:'text',selectedText:'Gates rings the bell.'}];
 return {story,world};
}
it('deletes current and historical links while retaining independent entities and text field values',()=>{
 const {story,world}=fixture(), target={kind:'entity' as const,ref:{kind:'structure' as const,id:'team'}};
 expect(inspectWorldDeletion(story,world,target).linked.join(' ')).toContain('Apple');
 expect(()=>deleteWorldData(story,world.id,target)).toThrow('child structures');
 const next=deleteWorldData(story,world.id,target,{mode:'move'}), w=next.worlds![0];
 expect(w.entities.map(e=>e.id)).toEqual(['police','scu','child','bell','rule','dc']); expect(next.characters).toEqual(story.characters); expect(next.locations).toEqual(story.locations);
 expect(w.relationships.map(r=>r.id)).toEqual(['parent','childlink']); expect(w.relationships[1].to).toEqual({kind:'organisation',id:'scu'});
 expect(w.entities.find(e=>e.id==='bell')).toMatchObject({fields:{Team:'Team 4'},fieldLinks:{}}); expect(next.worldOccurrences).toEqual([]); expect(next.worldUi!.pins).toHaveLength(1); expect(w.diagrams[0]).toMatchObject({root:undefined,collapsedIds:[]}); expect(()=>parseWorldPackage(packageWorld(w,next))).not.toThrow();
});
it('only deletes structural descendants when explicitly requested',()=>{
 const {story,world}=fixture(); const next=deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'structure',id:'team'}},{mode:'delete'});
 expect(next.worlds![0].entities.some(e=>['team','child'].includes(e.id))).toBe(false); expect(next.characters).toHaveLength(1); expect(next.worlds![0].entities.find(e=>e.id==='bell')).toBeDefined();
});
it('keeps separate child Organisations and requires explicit disposition for owned structures',()=>{
 const {story,world}=fixture(); const first=deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'organisation',id:'police'}});
 expect(first.worlds![0].entities.find(e=>e.id==='scu')).toBeDefined(); expect(first.worlds![0].relationships.find(r=>r.id==='parent')).toBeUndefined();
 expect(()=>deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'organisation',id:'scu'}})).toThrow();
 const moved=deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'organisation',id:'scu'}},{mode:'move',organisationId:'police'});
 expect(moved.worlds![0].entities.find(e=>e.id==='child')!.organisationId).toBe('police'); expect(moved.worlds![0].entities.find(e=>e.id==='dc')!.organisationId).toBeUndefined(); expect(moved.worlds![0].relationships.find(r=>r.id==='member')).toBeUndefined();
});
it('removes role assignments without deleting Organisation memberships',()=>{
 const {story,world}=fixture(); const next=deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'rank',id:'dc'}});
 expect(next.worlds![0].relationships.find(r=>r.id==='member')).toMatchObject({unitId:'team',rankId:undefined});
});
it('deletes World and diagram pins without deleting canonical project entities or independent Worlds',()=>{
 const {story,world}=fixture(); story.worlds!.push(createWorld('Independent copy'));
 const diagram=deleteWorldData(story,world.id,{kind:'diagram',id:'chart'}); expect(diagram.worldUi!.pins).toHaveLength(1); expect(diagram.worlds![0].entities).toEqual(world.entities);
 const next=deleteWorldData(story,world.id,{kind:'world'}); expect(next.worlds!.map(w=>w.name)).toEqual(['Independent copy']); expect(next.characters).toEqual(story.characters); expect(next.locations).toEqual(story.locations); expect(next.worldOccurrences).toEqual([]); expect(next.worldUi!.pins).toEqual([]);
});
it('canonical profile deletion cleans all Worlds and prevents identity separation resurrection',()=>{
 const {story,world}=fixture(); story.identityMerges=[{kind:'characters',targetId:'apple',source:{id:'old-apple',name:'Old Apple',description:''},links:[]}];
 const next=deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'character',id:'apple'}}); expect(next.characters).toEqual([]); expect(next.identityMerges).toEqual([]); expect(next.worlds![0].characterIds).toEqual([]); expect(next.worlds![0].entities.find(e=>e.id==='bell')).toBeDefined();
});
