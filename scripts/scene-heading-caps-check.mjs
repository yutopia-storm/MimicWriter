import { _electron as electron } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'heading-caps-'));
const storage = join(root, 'storage');
const app = await electron.launch({ args: ['.', `--user-data-dir=${join(root, 'profile')}`] });
const page = await app.firstWindow();
try {
  await page.waitForLoadState('domcontentloaded');
  const fixture = await page.evaluate(async root => {
    await window.desktop.configureStorage(root);
    const project = await window.desktop.createProject({ title: 'Heading case verification', projectType: 'feature' });
    const workspace = await window.desktop.openWorkspace(project.id);
    const script = workspace.screenplays[0];
    script.scenes[0].elements[0].content = 'int. kitchen - morning';
    script.scenes[0].elements[1].content = 'Keep this action in sentence case.';
    return { project, script };
  }, storage);
  // Simulate an existing project written by an older build, before case normalization.
  await writeFile(join(storage, 'Projects', fixture.project.id, 'Screenplays', `${fixture.script.id}.json`), JSON.stringify(fixture.script));
  await page.reload();
  await page.locator('.project-card').filter({ hasText: 'Heading case verification' }).first().click();
  const heading = page.locator('.continuous-block.scene_heading .continuous-block-content').first();
  await heading.waitFor();
  assert.equal(await heading.innerText(), 'INT. KITCHEN - MORNING');
  for (const [mode, text] of [['Screenplay', 'ext. road - night'], ['Scene', 'int. office - day'], ['Continuous', 'ext. park - evening']]) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await heading.fill('');
    await page.locator('.continuous-block.scene_heading').first().click({ position: { x: 3, y: 7 } });
    await page.keyboard.type(text, { delay: 40 });
    assert.equal(await heading.innerText(), text.toUpperCase());
    assert.equal(await page.locator('.continuous-block.action .continuous-block-content').first().innerText(), 'Keep this action in sentence case.');
  }
  await page.getByRole('button', { name: 'Story Timeline', exact: true }).click();
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  assert.match(await page.getByLabel('Scene', { exact: true }).locator('option:checked').innerText(), /EXT\. PARK - EVENING/);
  await page.getByRole('button', { name: 'Close story timeline', exact: true }).click();
  await page.locator('.save-state.saved').waitFor();
  const reopened = await page.evaluate(id => window.desktop.openWorkspace(id), fixture.project.id);
  assert.equal(reopened.screenplays[0].scenes[0].elements[0].content, 'EXT. PARK - EVENING');
  assert.equal(reopened.screenplays[0].scenes[0].id, fixture.script.scenes[0].id);
  console.log('Passed: existing lowercase headings autocorrect; lowercase typing stays uppercase with caret continuity in all three modes; metadata labels and persisted content uppercase; action text and scene IDs preserved.');
} catch (error) { if (!page.isClosed()) console.log(await page.locator('.ProseMirror').innerText()); throw error; } finally {
  if (!page.isClosed()) await page.close({ runBeforeUnload: false });
  await app.close();
}
