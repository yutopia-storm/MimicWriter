import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'relationship-workflow-'));
let app;
try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${join(root, 'profile')}`] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  page.on('pageerror', error => console.error('Page error:', error));
  const projectId = await page.evaluate(async storage => {
    await window.desktop.configureStorage(storage);
    const project = await window.desktop.createProject({ title: 'Relationship verification', projectType: 'feature' });
    const workspace = await window.desktop.openWorkspace(project.id), screenplay = workspace.screenplays[0];
    screenplay.scenes[0].elements = [['scene_heading','INT. HOME - DAY'],['character','ALEX'],['dialogue','Hello.'],['character','SAM'],['dialogue','Hi.']].map(([type, content], order) => ({ id: crypto.randomUUID(), type, content, order }));
    await window.desktop.saveScreenplay(project.id, screenplay);
    return project.id;
  }, join(root, 'storage'));
  await page.reload();
  await page.locator('.project-card').filter({ hasText: 'Relationship verification' }).click();
  await page.waitForTimeout(900);
  await page.locator('.continuous-block.character').filter({ hasText: 'ALEX' }).hover();
  await page.getByRole('button', { name: 'Open character inspector', exact: true }).hover();
  await page.getByRole('dialog', { name: 'character quick card', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open full profile', exact: true }).click();
  let profile = page.getByRole('dialog', { name: 'character profile', exact: true });
  await profile.getByLabel('Date of birth', { exact: true }).fill('1990-04-12');
  await profile.getByRole('button', { name: 'Relationships', exact: true }).click();
  await profile.getByRole('button', { name: 'Add relationship', exact: true }).click();
  const type = profile.locator('label').filter({ hasText: /^Relationship type/ }).locator('select');
  await type.waitFor();
  const choices = await type.evaluate(select => [...select.options].map(option => option.textContent?.trim()));
  assert.ok(choices.includes('Friend'));
  assert.ok(choices.includes('Family friend'));
  assert.ok(choices.includes('Acquaintance'));
  await type.selectOption('Family friend');
  await profile.getByRole('status').filter({ hasText: /^Saved$/ }).waitFor();
  await page.waitForTimeout(600);
  await profile.getByRole('button', { name: 'Close profile', exact: true }).click();
  const stored = await page.evaluate(id => window.desktop.openWorkspace(id), projectId);
  assert.equal(stored.story.characters.find(character => character.name === 'ALEX').profile.dateOfBirth, '1990-04-12');
  assert.equal(stored.story.relationships[0].type, 'Family friend');
  await page.locator('.continuous-block.character').filter({ hasText: 'SAM' }).hover();
  await page.getByRole('button', { name: 'Open character inspector', exact: true }).hover();
  await page.getByRole('dialog', { name: 'character quick card', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Open full profile', exact: true }).click();
  profile = page.getByRole('dialog', { name: 'character profile', exact: true });
  await profile.getByRole('button', { name: 'Relationships', exact: true }).click();
  assert.match(await profile.innerText(), /Automatic reciprocal connections[\s\S]*Family friend/i);
  console.log('Passed: date of birth, relationship choices, persistence, and reciprocal connection.');
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
