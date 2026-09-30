import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = await mkdtemp(join(tmpdir(), 'note-position-'));
let app;
try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${join(root, 'profile')}`] });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async storage => {
    await window.desktop.configureStorage(storage);
    const project = await window.desktop.createProject({ title: 'Note position verification', projectType: 'feature' });
    const workspace = await window.desktop.openWorkspace(project.id), screenplay = workspace.screenplays[0], groupId = crypto.randomUUID();
    const element = (type, content, order, dualDialogue) => ({ id: crypto.randomUUID(), type, content, order, ...(dualDialogue ? { dualDialogue } : {}) });
    const action = element('action', 'The room waits.', 1);
    const leftCharacter = element('character', 'APPLE', 2, { groupId, side: 'left', role: 'character' });
    const leftDialogue = element('dialogue', 'Left dialogue.', 3, { groupId, side: 'left', role: 'dialogue' });
    const rightCharacter = element('character', 'ZIDER', 4, { groupId, side: 'right', role: 'character' });
    const rightDialogue = element('dialogue', 'Right dialogue.', 5, { groupId, side: 'right', role: 'dialogue' });
    screenplay.scenes[0].elements = [element('scene_heading', 'INT. ROOM - DAY', 0), action, leftCharacter, leftDialogue, rightCharacter, rightDialogue];
    const now = new Date().toISOString();
    screenplay.notes = [
      { id: crypto.randomUUID(), sceneId: screenplay.scenes[0].id, from: { elementId: action.id, offset: 0 }, to: { elementId: action.id, offset: 3 }, selectedText: 'The', content: 'Action note', createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), sceneId: screenplay.scenes[0].id, from: { elementId: leftDialogue.id, offset: 0 }, to: { elementId: leftDialogue.id, offset: 4 }, selectedText: 'Left', content: 'Dual note', createdAt: now, updatedAt: now },
    ];
    await window.desktop.saveScreenplay(project.id, screenplay);
  }, join(root, 'storage'));
  await page.reload();
  await page.locator('.project-card').filter({ hasText: 'Note position verification' }).click();
  const verify = async mode => {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await page.locator('.screenplay-margin-note').first().waitFor();
    await page.waitForTimeout(100);
    const positions = await page.locator('.screenplay-margin-note').evaluateAll(notes => notes.map(note => {
      const noteBounds = note.getBoundingClientRect(), pageBounds = note.closest('.script-pages').getBoundingClientRect();
      return { noteCenter: noteBounds.left + noteBounds.width / 2, pageLeft: pageBounds.left };
    }));
    assert.equal(positions.length, 2);
    for (const position of positions) assert.ok(Math.abs(position.noteCenter - position.pageLeft) <= 1, `${mode}: note centre ${position.noteCenter} must stay on page edge ${position.pageLeft}`);
  };
  for (const mode of ['Scene', 'Screenplay', 'Continuous']) await verify(mode);
  console.log('Passed: normal and dual-dialogue notes remain centred on the page edge in all editor modes.');
} finally {
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
}
