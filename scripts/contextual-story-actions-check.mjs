import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root=await mkdtemp(join(tmpdir(),'contextual-story-actions-'));
let app;
try {
 app=await electron.launch({args:['.',`--user-data-dir=${join(root,'profile')}`]});
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const seeded=await page.evaluate(async storage=>{
  await window.desktop.configureStorage(storage);
  const project=await window.desktop.createProject({title:'Context actions verification',projectType:'feature'});
  const workspace=await window.desktop.openWorkspace(project.id),document=workspace.screenplays[0],scene=document.scenes[0];
  scene.elements=[['scene_heading','EXT. ROAD - DAY'],['action','Apple crashes through the barrier.'],['character','APPLE'],['dialogue','Be bound.']].map(([type,content],order)=>({id:crypto.randomUUID(),type,content,order}));
  await window.desktop.saveScreenplay(project.id,document);
  const characterId=crypto.randomUUID(),worldId=crypto.randomUUID(),spellId=crypto.randomUUID();
  await window.desktop.saveStory(project.id,{schemaVersion:1,projectId:project.id,characters:[{id:characterId,name:'Apple Lennox',sourceNames:['APPLE'],description:''}],locations:[],events:[],plots:[],scenes:[{sceneId:scene.id,screenplayId:document.id,chronology:{day:6}}],worlds:[{schemaVersion:1,structureModelVersion:1,id:worldId,name:'Universe',description:'',characterIds:[characterId],locationIds:[],relationships:[],diagrams:[],entities:[{id:spellId,kind:'lore',name:'Binding Spell',description:'',fields:{Type:'Spell','Exact wording':'Vara kel’then.','Literal translation':'Be bound'}}]}]});
  return {projectId:project.id,sceneId:scene.id,spellId};
 },join(root,'storage'));
 await page.reload();await page.locator('.project-card').filter({hasText:'Context actions verification'}).click();
 const action=page.locator('.continuous-block.action').filter({hasText:'Apple crashes'});await action.click();await page.keyboard.press('Home');await page.keyboard.press('Shift+End');await action.click({button:'right'});
 let dialog=page.getByRole('dialog',{name:'Story and World actions'});await dialog.waitFor();assert.equal(await dialog.getByRole('button',{name:'Structure',exact:true}).count(),0);assert.equal(await dialog.getByRole('button',{name:'Link to Scene',exact:true}).count(),0);
 await dialog.getByRole('button',{name:/Add \/ Update Event/}).click();await dialog.getByLabel('Name',{exact:true}).fill('Barrier crash');await dialog.getByRole('button',{name:'Save Event and choose Plot'}).click();await dialog.getByLabel('Name',{exact:true}).fill('Investigation');await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const cue=page.locator('.continuous-block.character').filter({hasText:'APPLE'});await cue.click();await cue.click({button:'right'});dialog=page.getByRole('dialog',{name:'Story and World actions'});await dialog.getByRole('button',{name:/Update Character Profile/}).click();assert.ok((await dialog.getByText('Subject Character: Apple Lennox').textContent()).includes('Apple Lennox'));assert.equal(await dialog.getByLabel('Character',{exact:true}).count(),0);await dialog.getByRole('button',{name:'Close',exact:true}).click();
 await cue.click();await cue.click({button:'right'});dialog=page.getByRole('dialog',{name:'Story and World actions'});assert.equal(await dialog.getByRole('button',{name:/Language & Lore/}).count(),0);assert.equal(await dialog.getByRole('button',{name:/Add \/ Update Event/}).count(),0);await dialog.getByRole('button',{name:/Assign Object \/ Vehicle/}).click();await dialog.getByLabel('Entry type').selectOption('vehicle');await dialog.getByLabel('Name',{exact:true}).fill('Apple’s Volvo');await dialog.getByLabel('Relationship 1',{exact:true}).selectOption('owned by');await dialog.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await cue.click();await cue.click({button:'right'});dialog=page.getByRole('dialog',{name:'Story and World actions'});await dialog.getByRole('button',{name:'Open Character Profile',exact:true}).click();const profile=page.getByRole('dialog',{name:'character profile',exact:true});await profile.getByRole('button',{name:'Worlds',exact:true}).click();assert.ok((await profile.locator('.world-relationship').allTextContents()).some(text=>text.includes('Apple’s Volvo')));await profile.getByRole('button',{name:'Close profile',exact:true}).click();
 await page.locator('.world-footer').getByRole('button',{name:'Worlds',exact:true}).click();const world=page.getByRole('dialog',{name:'Worlds workspace'});await world.getByRole('button',{name:'Vehicles',exact:true}).click();await world.getByRole('button',{name:/Apple’s Volvo/}).first().click();assert.ok((await world.locator('.world-detail .world-relationship').allTextContents()).some(text=>text.includes('Apple Lennox')));await world.getByRole('button',{name:'Close Worlds',exact:true}).click();
 const dialogue=page.locator('.continuous-block.dialogue').filter({hasText:'Be bound.'});await dialogue.click();await page.keyboard.press('End');await dialogue.click({button:'right'});dialog=page.getByRole('dialog',{name:'Story and World actions'});await dialog.getByRole('button',{name:/Language & Lore/}).click();await dialog.getByLabel('Create or update').selectOption(seeded.spellId);await dialog.getByRole('button',{name:'Insert canonical wording into dialogue'}).click();await page.waitForTimeout(1200);
 const saved=await page.evaluate(id=>window.desktop.openWorkspace(id),seeded.projectId);
 assert.equal(saved.story.events.length,1);assert.equal(saved.story.events[0].occursInSceneId,seeded.sceneId);assert.deepEqual(saved.story.events[0].plotIds,[saved.story.plots[0].id]);assert.equal(saved.story.scenes.find(s=>s.sceneId===seeded.sceneId).plotIds?.length??0,0);
 assert.equal(saved.screenplays[0].scenes[0].elements.find(e=>e.type==='action').content,'Apple crashes through the barrier.');assert.ok(saved.screenplays[0].scenes[0].elements.find(e=>e.type==='dialogue').content.includes('Vara kel’then.'));assert.equal(saved.story.worlds[0].entities.length,2);const car=saved.story.worlds[0].entities.find(e=>e.name==='Apple’s Volvo');assert.ok(saved.story.worlds[0].relationships.some(r=>r.from.id===car.id&&r.type==='owned by'));assert.deepEqual(errors,[]);
 console.log('Context actions desktop workflow passed: selective menus, Character Vehicle assignment reflected on both endpoints, Event + Plot, Lore insertion, persistence and screenplay preservation.');
} finally {await app?.close();}

