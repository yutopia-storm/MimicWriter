import { rememberWorldOptions } from './world-form-options';
import { expect, it } from 'vitest';
import { migrateStory } from './story';
import { createWorld, copyWorld, packageWorld, parseWorldPackage } from './worlds';
import { saveWorldState, worldStateAt } from './world-history';
import { deleteWorldData } from './world-delete';
import { saveMembership } from './world-memberships';
import type { WorldEntity } from '../shared/worlds';

it('preserves original condition and closes ongoing history at each new story boundary',()=>{
 const story=migrateStory(null,'p');let car:WorldEntity={id:'car',kind:'vehicle',name:'Mondeo',description:'Original bodywork',fields:{Condition:'Pristine',Colour:'Silver'}};
 car={...car,history:saveWorldState(car,{id:'crack',fromPoint:{chronology:{day:4}},fields:{Condition:'Cracked screen'}},story,[])};
 car={...car,history:saveWorldState(car,{id:'blood',fromPoint:{chronology:{day:18}},fields:{Condition:'Bloodstained'}},story,[])};
 expect(car.history![0].untilPoint).toEqual({chronology:{day:18}});
 expect(worldStateAt(car,story,[],{chronology:{day:3}}).Condition).toBe('Pristine');
 expect(worldStateAt(car,story,[],{chronology:{day:4}}).Condition).toBe('Cracked screen');
 expect(worldStateAt(car,story,[],{chronology:{day:18}})).toMatchObject({Condition:'Bloodstained',Colour:'Silver'});
 expect(worldStateAt(car,story,[]).Condition).toBe('Bloodstained');expect(car.fields!.Condition).toBe('Pristine');
 expect(()=>saveWorldState(car,{id:'bad',fromPoint:{chronology:{day:20}},untilPoint:{chronology:{day:19}},fields:{}},story,[])).toThrow('end must be after');
});
it('round-trips and independently copies position constraints, state history and custom relationship choices',()=>{
 const story=migrateStory(null,'p'),world=createWorld('World');world.entities=[{id:'org',kind:'organisation',name:'Police',description:''},{id:'unit',kind:'structure',organisationId:'org',name:'Team',description:''},{id:'dc',kind:'rank',organisationId:'org',name:'DC',description:'',rankLevel:2},{id:'position',kind:'position',organisationId:'org',name:'Detective',description:'',allowedRankIds:['dc'],unitIds:['unit']},{id:'car',kind:'vehicle',name:'Car',description:'',history:[{id:'damage',fromPoint:{chronology:{day:2}},fields:{Condition:'Scraped'}}]}];
 world.relationshipOptions=[{sourceKind:'vehicle',targetKind:'character',label:'Restorer'}];story.worlds=[world];
 const pack=parseWorldPackage(packageWorld(world,story)),copied=copyWorld(pack,migrateStory(null,'next')),next=copied.worlds![0],position=next.entities.find(e=>e.kind==='position')!;
 expect(position.allowedRankIds).toEqual([next.entities.find(e=>e.kind==='rank')!.id]);expect(position.unitIds).toEqual([next.entities.find(e=>e.kind==='structure')!.id]);expect(next.entities.find(e=>e.kind==='vehicle')!.history![0]).toMatchObject({fields:{Condition:'Scraped'},fromPoint:{chronology:{day:2}}});expect(next.entities.find(e=>e.kind==='vehicle')!.history![0].id).not.toBe('damage');expect(next.relationshipOptions).toEqual(world.relationshipOptions);
 const deleted=deleteWorldData(story,world.id,{kind:'entity',ref:{kind:'rank',id:'dc'}});expect(deleted.worlds![0].entities.find(e=>e.id==='position')!.allowedRankIds).toEqual([]);
});
it('enforces organisational position rank and unit restrictions without mixing rank with position',()=>{
 const story=migrateStory(null,'p'),world=createWorld('World');story.characters=[{id:'apple',name:'Apple',description:''}];
 world.entities=[{id:'org',kind:'organisation',name:'Police',description:''},{id:'unit',kind:'structure',organisationId:'org',name:'Team',description:''},{id:'dc',kind:'rank',organisationId:'org',name:'DC',description:'',rankLevel:2},{id:'ds',kind:'rank',organisationId:'org',name:'DS',description:'',rankLevel:1},{id:'role',kind:'position',organisationId:'org',name:'Detective',description:'',allowedRankIds:['dc'],unitIds:['unit']}];
 const member={id:'m',type:'member of',from:{kind:'character' as const,id:'apple'},to:{kind:'organisation' as const,id:'org'},unitId:'unit',positionId:'role',rankId:'dc'};
 expect(saveMembership(world,story,member,[]).relationships[0]).toMatchObject({positionId:'role',rankId:'dc'});
 expect(()=>saveMembership(world,story,{...member,unitId:undefined},[])).toThrow();expect(()=>saveMembership(world,story,{...member,rankId:'ds'},[])).toThrow();
});

it('remembers custom selector values after the last record changes its selection',()=>{
 let world=createWorld('World');world=rememberWorldOptions(world,'vehicle',{Type:'Submarine'});world=rememberWorldOptions(world,'vehicle',{Type:'Car'});world=rememberWorldOptions(world,'vehicle',{Type:'Submarine'});expect(world.fieldOptions?.['vehicle:Type']).toEqual(['Submarine']);world=rememberWorldOptions(world,'location',{'Place type':'Moon base'});expect(parseWorldPackage(packageWorld(world,migrateStory(null,'p'))).world.fieldOptions?.['location:Place type']).toEqual(['Moon base']);
});
