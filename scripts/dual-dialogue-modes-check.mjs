import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const root = await mkdtemp(join(tmpdir(), 'dual-modes-')); const app = await electron.launch({ args: ['.', `--user-data-dir=${join(root, 'profile')}`] }); const page = await app.firstWindow();
const e = (name, index = 0) => page.locator(`.element-editor[aria-label="${name}"]`).nth(index);
async function addSpeech(name, line) { await page.locator('.element-editor[aria-label="Action"]').last().press('Tab'); await page.locator('.element-editor[aria-label="Character"]').last().fill(name); await page.locator('.element-editor[aria-label="Character"]').last().press('Enter'); await page.locator('.element-editor[aria-label="Dialogue"]').last().fill(line); await page.locator('.element-editor[aria-label="Dialogue"]').last().press('Enter'); }
async function selectPair(a, b) { await page.locator('.speech-selector').nth(a).evaluate((node) => node.click()); await page.locator('.speech-selector').nth(b).evaluate((node) => node.click()); await page.getByRole('button', { name: 'Make Dual Dialogue' }).click(); }
try {
  await page.locator('input').first().fill(join(root, 'storage')); await page.getByRole('button', { name: 'Use this folder' }).click(); await page.getByRole('button', { name: /New Project/i }).click(); await page.getByPlaceholder('Untitled story').fill('Dual Modes'); await page.getByRole('button', { name: /^Feature/ }).click(); await page.getByRole('button', { name: 'Create project' }).click(); await page.getByRole('button', { name: /Dual Modes/ }).click();
  await e('Scene heading').fill('INT. ROOM - DAY'); await e('Scene heading').press('Enter'); await e('Action').fill('Four voices overlap.'); await e('Action').press('Enter');
  await addSpeech('ZIDER', 'Left one.'); await addSpeech('APPLE', 'Right one.'); await addSpeech('HARVEY', 'Left two.'); await addSpeech('GATES', 'Right two.');
  await selectPair(0, 1); await selectPair(2, 3); if (await page.locator('.screenplay-view [data-dual-dialogue-id]').count() !== 2) throw new Error('Screenplay Mode did not create two Dual Dialogue blocks.');
  const boxes = await page.locator('.screenplay-view [data-dual-dialogue-id]').evaluateAll((nodes) => nodes.map((node) => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; })); if (boxes[1].top - boxes[0].bottom < 15) throw new Error(`Consecutive Dual Dialogue spacing is too small: ${boxes[1].top - boxes[0].bottom}px`);
  await page.getByRole('button', { name: 'Scene', exact: true }).click(); if (await page.locator('.scene-view [data-dual-dialogue-id]').count() !== 2) throw new Error('Scene Mode lost Dual Dialogue.'); await page.getByRole('button', { name: 'Remove Dual Dialogue' }).first().click(); await selectPair(0, 1);
  await page.getByRole('button', { name: 'Continuous', exact: true }).click(); if (await page.locator('.continuous-view [data-dual-dialogue-id]').count() !== 2) throw new Error('Continuous Mode lost Dual Dialogue.'); await page.getByRole('button', { name: 'Remove Dual Dialogue' }).first().click(); await selectPair(0, 1);
  console.log(JSON.stringify({ checks: ['create/edit Dual Dialogue in Screenplay Mode', 'create/edit Dual Dialogue in Scene Mode', 'create/edit Dual Dialogue in Continuous Mode', 'consecutive Dual Dialogue separation'], gapPx: boxes[1].top - boxes[0].bottom }, null, 2));
} finally { if (!page.isClosed()) await page.close({ runBeforeUnload: false }); await app.close(); }
