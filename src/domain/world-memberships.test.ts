import { expect, it } from 'vitest';
import { createScreenplay } from './screenplay';
import { migrateStory } from './story';
import { createWorld } from './worlds';
import { characterMemberships, membershipPeriod, reportingCharacters, saveMembership, hierarchyReporters, membershipReporterIds } from './world-memberships';
import { diagramChildren } from './world-structure';
import type { WorldRelationship } from '../shared/worlds';

export function membershipFixture() {
 const story=migrateStory(null,'p'),world=createWorld('The Altered'),documents=Array.from({length:7},(_,i)=>createScreenplay({projectId:'p',title:`Episode ${i+1}`,screenplayType:'episode'}));
 story.characters=['apple','gates','lee','outsider'].map(id=>({id,name:id.toUpperCase(),description:''}));
 world.entities=[{id:'scu',kind:'organisation',name:'Specialist Crime Unit',abbreviation:'SCU',description:'',fields:{'Rank terminology':'Grade','Position terminology':'Appointment'}},{id:'university',kind:'organisation',name:'University',description:''},{id:'t4',kind:'structure',name:'Team 4',description:'',organisationId:'scu'},{id:'t5',kind:'structure',name:'Team 5',description:'',organisationId:'scu'},{id:'school',kind:'structure',name:'Medical School',description:'',organisationId:'university'},{id:'dc',kind:'rank',name:'Detective Constable',abbreviation:'DC',description:'',organisationId:'scu'},{id:'ds',kind:'rank',name:'Detective Sergeant',abbreviation:'DS',description:'',organisationId:'scu'},{id:'sio',kind:'position',name:'Senior Investigating Officer',abbreviation:'SIO',description:'',organisationId:'scu'}];
 world.relationships=['gates','lee'].map(id=>({id:'member-'+id,type:'member of',from:{kind:'character',id},to:{kind:'organisation',id:'scu'}}));story.worlds=[world]; return {story,world,documents};
}
it('uses one canonical membership for card and diagram projections at every episode boundary',()=>{
 const {story,world,documents}=membershipFixture(); const original:WorldRelationship={id:'old',type:'member of',from:{kind:'character',id:'apple'},to:{kind:'organisation',id:'scu'},unitId:'t4',rankId:'dc',positionId:'sio',reportsToId:'gates',fromPoint:{screenplayId:documents[0].id}};
 story.worlds=[saveMembership(world,story,original,documents)];
 const transfer={...original,id:'new',unitId:'t5',reportsToId:'lee',fromPoint:{screenplayId:documents[4].id}};story.worlds=[saveMembership(story.worlds[0],story,transfer,documents,'old')];
 expect(characterMemberships(story,'apple',documents,{sceneId:documents[2].scenes[0].id}).map(m=>m.relationship.unitId)).toEqual(['t4']);expect(characterMemberships(story,'apple',documents,{sceneId:documents[6].scenes[0].id}).map(m=>m.relationship.unitId)).toEqual(['t5']);
 expect(characterMemberships(story,'apple',documents,undefined,true)).toHaveLength(2);expect(membershipPeriod(story.worlds[0].relationships.find(r=>r.id==='old')!,story,documents)).toBe('Episode 1 → Episode 4');
 for(const [index,unit] of [[2,'t4'],[6,'t5']] as const) expect(diagramChildren(story.worlds[0],story,documents,{screenplayId:documents[index].id},{kind:'structure',id:unit}).some(n=>n.ref.id==='apple')).toBe(true);
 expect(story.characters.find(c=>c.id==='apple')).toEqual({id:'apple',name:'APPLE',description:''});
});
it('supports simultaneous Organisations and promotion history within the same unit',()=>{
 const {story,world,documents}=membershipFixture(), r:WorldRelationship={id:'dc-apple',type:'member of',from:{kind:'character',id:'apple'},to:{kind:'organisation',id:'scu'},unitId:'t5',rankId:'dc',fromPoint:{screenplayId:documents[0].id}};
 story.worlds=[saveMembership(world,story,r,documents)];story.worlds=[saveMembership(story.worlds[0],story,{...r,id:'uni-apple',to:{kind:'organisation',id:'university'},unitId:'school',rankId:undefined},documents)];story.worlds=[saveMembership(story.worlds[0],story,{...r,id:'ds-apple',rankId:'ds',fromPoint:{screenplayId:documents[6].id}},documents,'dc-apple')];
 expect(characterMemberships(story,'apple',documents)).toHaveLength(2);expect(characterMemberships(story,'apple',documents,{screenplayId:documents[5].id}).find(m=>m.relationship.to.id==='scu')!.relationship.rankId).toBe('dc');expect(characterMemberships(story,'apple',documents,{screenplayId:documents[6].id}).find(m=>m.relationship.to.id==='scu')!.relationship.rankId).toBe('ds');
});
it('rejects cross-Organisation units/roles, inappropriate reporting, self-reporting and backwards transfers',()=>{
 const {story,world,documents}=membershipFixture(), r:WorldRelationship={id:'m',type:'member of',from:{kind:'character',id:'apple'},to:{kind:'organisation',id:'scu'},fromPoint:{screenplayId:documents[2].id}};
 expect(reportingCharacters(world,story,'apple','scu',documents).map(c=>c.id)).toEqual(['gates','lee']);expect(()=>saveMembership(world,story,{...r,unitId:'school'},documents)).toThrow('unit');expect(()=>saveMembership(world,story,{...r,to:{kind:'organisation',id:'university'},rankId:'dc'},documents)).toThrow('rank');expect(()=>saveMembership(world,story,{...r,reportsToId:'outsider'},documents)).toThrow('reporting');expect(()=>saveMembership(world,story,{...r,reportsToId:'apple'},documents)).toThrow('reporting');
 const saved=saveMembership(world,story,r,documents);expect(()=>saveMembership(saved,story,{...r,id:'new',fromPoint:{screenplayId:documents[0].id}},documents,'m')).toThrow('after');expect(saved.relationships.find(x=>x.id==='m')!.untilPoint).toBeUndefined();
});

it('autofills all peers at the nearest senior rank only within the same unit and Organisation',()=>{
 const {story,world,documents}=membershipFixture();world.entities.find(e=>e.id==='dc')!.rankLevel=3;world.entities.find(e=>e.id==='ds')!.rankLevel=2;world.entities.push({id:'di',kind:'rank',organisationId:'scu',name:'Inspector',description:'',rankLevel:1});
 const r:WorldRelationship={id:'apple-member',type:'member of',from:{kind:'character',id:'apple'},to:{kind:'organisation',id:'scu'},unitId:'t4',rankId:'dc'};
 world.relationships=world.relationships.map(m=>({...m,unitId:'t4',rankId:'ds'}));world.relationships.push({...r,id:'senior',from:{kind:'character',id:'outsider'},rankId:'di'});
 expect(hierarchyReporters(world,story,r,documents)).toEqual(['gates','lee']);expect(membershipReporterIds(world,story,r,documents)).toEqual(['gates','lee']);
 expect(membershipReporterIds(world,story,{...r,reportsToIds:['gates']},documents)).toEqual(['gates']);expect(membershipReporterIds(world,story,{...r,reportsToIds:[]},documents)).toEqual([]);
 expect(hierarchyReporters(world,story,{...r,unitId:'t5'},documents)).toEqual([]);expect(hierarchyReporters(world,story,{...r,to:{kind:'organisation',id:'university'}},documents)).toEqual([]);
 expect(hierarchyReporters(world,story,{...r,rankId:'ds'},documents)).toEqual(['outsider']);expect(hierarchyReporters(world,story,{...r,rankId:'di'},documents)).toEqual([]);
 world.relationships[0].untilPoint={screenplayId:documents[3].id};expect(membershipReporterIds(world,story,{...r,reportsToIds:['gates']},documents,{screenplayId:documents[3].id})).toEqual([]);expect(hierarchyReporters(world,story,r,documents,{screenplayId:documents[2].id})).toEqual(['gates','lee']);expect(hierarchyReporters(world,story,r,documents,{screenplayId:documents[3].id})).toEqual(['lee']);
});
it('stores explicit reporting subsets and displays automatic members under every manager in diagrams',()=>{
 const {story,world,documents}=membershipFixture();world.entities.find(e=>e.id==='dc')!.rankLevel=3;world.entities.find(e=>e.id==='ds')!.rankLevel=2;world.relationships=world.relationships.map(m=>({...m,unitId:'t4',rankId:'ds'}));
 const r:WorldRelationship={id:'m',type:'member of',from:{kind:'character',id:'apple'},to:{kind:'organisation',id:'scu'},unitId:'t4',rankId:'dc'};
 const saved=saveMembership(world,story,r,documents);for(const id of ['gates','lee'])expect(diagramChildren(saved,story,documents,undefined,{kind:'character',id}).some(n=>n.ref.id==='apple')).toBe(true);
 const manual=saveMembership(saved,story,{...r,reportsToIds:['lee']},documents);expect(manual.relationships.find(m=>m.id==='m')!.reportsToIds).toEqual(['lee']);expect(diagramChildren(manual,story,documents,undefined,{kind:'character',id:'gates'}).some(n=>n.ref.id==='apple')).toBe(false);
 expect(()=>saveMembership(world,story,{...r,reportsToIds:['outsider']},documents)).toThrow('reporting');expect(()=>saveMembership(world,story,{...r,reportsToIds:['apple']},documents)).toThrow('reporting');
});
