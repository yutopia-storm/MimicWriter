import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'story-defaults-ui-'));
const profile = join(root, 'profile');
let app, page;
async function launch() {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`] });
  page = await app.firstWindow(); await page.waitForLoadState('domcontentloaded');
}
async function saved() { await page.locator('.story-panel [role=status]').filter({ hasText: /^Saved$/ }).waitFor(); }
try {
  await launch();
  const ids = await page.evaluate(async root => {
    await window.desktop.configureStorage(root);
    const project = await window.desktop.createProject({ title: 'Scene defaults verification', projectType: 'feature' });
    const workspace = await window.desktop.openWorkspace(project.id);
    const script = workspace.screenplays[0];
    script.scenes[0].elements = [
      ['scene_heading', 'INT. HOSPITAL - EARLY MORNING'],
      ['action', 'ZIDER walks towards the window.'],
      ['character', 'APPLE'], ['dialogue', 'Sara told me to find you.'],
      ['character', 'SARA (V.O.)'], ['dialogue', 'Listen carefully.'],
    ].map(([type, content], order) => ({ id: crypto.randomUUID(), type, content, order }));
    const second = structuredClone(script.scenes[0]); second.id = crypto.randomUUID(); second.order = 1;
    second.elements.forEach(element => { element.id = crypto.randomUUID(); });
    second.elements[0].content = 'EXT. HOUSE - DAY'; script.scenes.push(second);
    await window.desktop.saveScreenplay(project.id, script);
    return { project: project.id, scene: script.scenes[0].id, second: second.id, text: JSON.stringify(script.scenes) };
  }, join(root, 'storage'));
  await page.reload();
  await page.locator('.project-card').filter({ hasText: 'Scene defaults verification' }).first().click();
  const clock = page.getByRole('button', { name: 'Story details for scene 1' });
  assert.equal(await clock.innerText(), ''); assert.equal(await clock.locator('svg').count(), 1);
  await clock.click();
  await page.waitForFunction(() => document.querySelector('select[aria-label="Time of day"]')?.value === 'early_morning');
  assert.ok(await page.getByRole('group', { name: 'Characters present' }).getByLabel('APPLE', { exact: true }).isChecked());
  assert.ok(await page.getByRole('group', { name: 'Characters present' }).getByLabel('ZIDER', { exact: true }).isChecked());
  assert.equal(await page.getByRole('group', { name: 'Characters present' }).getByLabel('SARA', { exact: true }).isChecked(), false);
  assert.ok(await page.getByRole('group', { name: 'Characters involved' }).getByLabel('SARA', { exact: true }).isChecked());
  assert.equal(await page.getByLabel('Location', { exact: true }).locator('option:checked').innerText(), 'HOSPITAL');
  const seconds = Number(await page.getByLabel('Duration (seconds)', { exact: true }).inputValue());
  assert.ok(seconds > 0);
  await page.getByLabel('Scene', { exact: true }).selectOption(ids.second);
  assert.equal(await page.getByLabel('Time of day', { exact: true }).inputValue(), 'afternoon');
  await page.getByLabel('Scene', { exact: true }).selectOption(ids.scene);
  await page.getByLabel('Time of day', { exact: true }).selectOption('evening');
  await page.getByLabel('Time', { exact: true }).fill('19:15');
  await page.getByLabel('Duration (minutes)', { exact: true }).fill('0');
  await page.getByLabel('Duration (seconds)', { exact: true }).fill('10');
  await saved();
  await mkdir('.artifacts', { recursive: true });
  await page.screenshot({ path: '.artifacts/story-defaults-modal.png' });
  await page.getByRole('button', { name: 'Events', exact: true }).click();
  await page.getByRole('button', { name: 'Add event', exact: true }).click();
  await page.getByLabel('Event name', { exact: true }).fill('A small discovery');
  assert.equal(await page.getByLabel('Event importance', { exact: true }).inputValue(), 'minor');
  await page.getByLabel('Event importance', { exact: true }).selectOption('major'); await saved();
  await page.getByLabel('Event importance', { exact: true }).selectOption('minor'); await saved();
  await page.getByRole('button', { name: 'Close story timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  await page.getByRole('button', { name: 'Story details for scene 1' }).click();
  assert.equal(await page.getByLabel('Time of day', { exact: true }).inputValue(), 'evening');
  await saved();
  await page.close(); await app.close(); await launch();
  await page.locator('.project-card').filter({ hasText: 'Scene defaults verification' }).first().click();
  await page.getByRole('button', { name: 'Story details for scene 1' }).click();
  assert.equal(await page.getByLabel('Duration (seconds)', { exact: true }).inputValue(), '10');
  assert.equal(await page.getByLabel('Time of day', { exact: true }).inputValue(), 'evening');
  await saved();
  const workspace = await page.evaluate(id => window.desktop.openWorkspace(id), ids.project);
  assert.equal(workspace.story.characters.length, 3);
  assert.equal(workspace.story.locations.length, 2);
  assert.equal(workspace.story.events[0].major, false);
  assert.equal(JSON.stringify(workspace.screenplays[0].scenes), ids.text);
  console.log('Passed: clock icon in both modes; automatic character records/presence, voice-over separation, location, early morning and DAY defaults; page duration; seconds and exact time; Major/Minor selection; manual override persistence after restart; unchanged screenplay.');
} catch (error) {
  if (page && !page.isClosed()) { await mkdir('.artifacts', { recursive: true }); await page.screenshot({ path: '.artifacts/story-defaults-error.png' }); }
  throw error;
} finally {
  if (page && !page.isClosed()) await page.close({ runBeforeUnload: false });
  if (app) await app.close();
}
