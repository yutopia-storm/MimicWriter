import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'story-timeline-ui-'));
const profile = join(root, 'profile');
let app, page;
async function launch() {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`] });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
}
async function saved() { await page.locator('.story-panel [role=status]').filter({ hasText: /^Saved$/ }).waitFor(); }
try {
  await launch();
  const ids = await page.evaluate(async root => {
    await window.desktop.configureStorage(root);
    const project = await window.desktop.createProject({ title: 'Timeline verification', projectType: 'feature' });
    const workspace = await window.desktop.openWorkspace(project.id);
    const script = workspace.screenplays[0];
    script.scenes[0].elements[0].content = 'INT. HOSPITAL - DAY';
    const second = structuredClone(script.scenes[0]); second.id = crypto.randomUUID(); second.order = 1;
    second.elements.forEach(element => { element.id = crypto.randomUUID(); });
    second.elements[0].content = 'EXT. HOUSE - NIGHT'; script.scenes.push(second);
    await window.desktop.saveScreenplay(project.id, script);
    return { project: project.id, screenplay: script.id, scene: script.scenes[0].id, second: second.id };
  }, join(root, 'storage'));
  await page.reload();
  await page.locator('.project-card').filter({ hasText: 'Timeline verification' }).first().click();
  const card = page.locator('.continuous-scene').first();
  await card.getByRole('button', { name: 'Story details for scene 1' }).click();
  await page.getByRole('dialog', { name: 'Story Timeline' }).waitFor();
  await page.getByRole('button', { name: 'Plots', exact: true }).click();
  for (const name of ['Disappearance', 'Investigation']) {
    await page.getByRole('button', { name: 'Add Plot', exact: true }).click();
    await page.getByRole('textbox', { name: 'Plot name', exact: true }).last().fill(name);
  }
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  for (const name of ['Apple', 'Zider', 'Sara']) {
    await page.getByRole('button', { name: 'Add character', exact: true }).click();
    await page.getByRole('textbox', { name: 'character name', exact: true }).last().fill(name);
  }
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Story day', exact: true }).fill('4');
  await page.getByLabel('Time', { exact: true }).fill('14:30');
  await page.getByRole('group', { name: 'Plot membership' }).getByLabel('Disappearance').check();
  await page.getByRole('group', { name: 'Plot membership' }).getByLabel('Investigation').check();
  await page.getByRole('group', { name: 'Characters present' }).getByLabel('Apple').check();
  await page.getByRole('group', { name: 'Characters present' }).getByLabel('Zider').check();
  await page.getByRole('group', { name: 'Characters referenced' }).getByLabel('Sara').check();
  await page.getByRole('button', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Add event', exact: true }).click();
  await page.getByRole('textbox', { name: 'Event name', exact: true }).fill('Peter dies');
  await page.getByRole('spinbutton', { name: 'Story day', exact: true }).fill('2');
  await page.getByLabel('Event importance', { exact: true }).selectOption('major');
  await page.getByLabel('Occurs in scene', { exact: true }).selectOption(ids.scene);
  await saved();
  await page.getByRole('button', { name: 'Timeline', exact: true }).click();
  await page.getByLabel('View', { exact: true }).selectOption('Plot');
  assert.equal(await page.locator('.story-timeline tbody tr').count(), 3);
  assert.match(await page.locator('.story-timeline tbody tr').first().innerText(), /Peter dies/);
  assert.equal(await page.locator('.story-intersection').count(), 1);
  await page.getByLabel('View', { exact: true }).selectOption('Character');
  await page.getByRole('group', { name: 'Characters', exact: true }).getByLabel('Apple').check();
  await page.getByRole('group', { name: 'Characters', exact: true }).getByLabel('Zider').check();
  assert.equal(await page.locator('.story-timeline tbody tr').count(), 1);
  assert.match(await page.locator('.story-intersection').innerText(), /2 characters present/);
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: '.artifacts/story-timeline.png' });
  await page.getByRole('button', { name: 'Close story timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  await page.getByRole('button', { name: 'Story details for scene 1' }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Story day', exact: true }).inputValue(), '4');
  await page.screenshot({ path: '.artifacts/story-scene-modal.png' });
  await page.getByRole('button', { name: 'Close story timeline', exact: true }).click();
  await page.close(); await app.close();
  await launch();
  const reopened = await page.evaluate(id => window.desktop.openWorkspace(id), ids.project);
  assert.equal(reopened.story.scenes[0].chronology.day, 4);
  assert.equal(reopened.story.events[0].name, 'Peter dies');
  assert.equal(reopened.story.characters.length, 3);
  assert.equal(reopened.screenplays[0].scenes[0].elements[0].content, 'INT. HOSPITAL - DAY');
  console.log('Passed: scene headers in both modes, modal CRUD inputs, autosave, independent events, chronology, plot and character intersections, restart persistence, unchanged screenplay text.');
} catch(error) {
  if(page && !page.isClosed()) { console.log((await page.locator('.story-panel').innerText()).slice(-2500)); await page.screenshot({path:'.artifacts/story-error.png'}); }
  throw error;
} finally {
  if (page && !page.isClosed()) await page.close({ runBeforeUnload: false });
  if (app) await app.close();
}
