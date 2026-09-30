import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = await mkdtemp(join(tmpdir(), 'editor-corrections-'));
const app = await electron.launch({ args: ['.', `--user-data-dir=${join(root, 'profile')}`] });
const page = await app.firstWindow();
const artifacts = join(process.cwd(), '.artifacts'); await mkdir(artifacts, { recursive: true });
const editor = (label, index = 0) => page.locator(`.element-editor[aria-label="${label}"]`).nth(index);
const caret = (locator) => locator.evaluate((node) => { const selection = getSelection(); return { offset: selection?.anchorOffset, length: node.textContent?.length, inside: node.contains(selection?.anchorNode ?? null) }; });
try {
  await page.locator('input').first().fill(join(root, 'storage')); await page.getByRole('button', { name: 'Use this folder' }).click();
  await page.getByRole('button', { name: /New Project/i }).click(); await page.getByPlaceholder('Untitled story').fill('Corrections'); await page.getByRole('button', { name: /^Feature/ }).click(); await page.getByRole('button', { name: 'Create project' }).click(); await page.getByRole('button', { name: /Corrections/ }).click();

  await editor('Scene heading').fill('INT. HOUSE - NIGHT'); await editor('Scene heading').press('Enter');
  await editor('Action').fill('Rain at the windows.'); await editor('Action').press('Enter'); await editor('Action', 1).waitFor({ timeout: 3000 }).catch(async () => { throw new Error(`Action Enter state: ${JSON.stringify(await page.locator('.element-editor').evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('aria-label'), node.textContent])))} active=${await page.evaluate(() => document.activeElement?.className)}`); }); await editor('Action', 1).press('Tab');
  await editor('Character').fill('ZIDER'); await editor('Character').press('Enter'); await editor('Dialogue').fill('First line.'); await editor('Dialogue').press('Enter');
  await editor('Action', 1).press('Tab'); await editor('Character', 1).waitFor({ timeout: 3000 }).catch(async () => { throw new Error(`Tab state: ${JSON.stringify(await page.locator('.element-editor').evaluateAll((nodes) => nodes.map((node) => [node.getAttribute('aria-label'), node.textContent])))}`); }); await editor('Character', 1).fill('ZI'); await page.getByRole('option', { name: 'ZIDER' }).waitFor(); await editor('Character', 1).press('Tab');
  const characterCaret = await caret(editor('Character', 1)); if (!characterCaret.inside || characterCaret.offset !== characterCaret.length) throw new Error(`Character autocomplete caret is not at end: ${JSON.stringify(characterCaret)}`);
  await editor('Character', 1).press('Enter'); await editor('Dialogue', 1).waitFor();

  await editor('Dialogue', 1).press('Enter'); await editor('Action', 1).press('Control+4');
  const parenthetical = editor('Parenthetical'); if ((await parenthetical.innerText()) !== '()') throw new Error('Parenthetical did not create both parentheses.');
  const parentheticalCaret = await caret(parenthetical); if (parentheticalCaret.offset !== 1) throw new Error('Parenthetical caret is not between parentheses.');
  if ((await parenthetical.evaluate((node) => getComputedStyle(node).fontStyle)) === 'italic') throw new Error('Parenthetical is automatically italicised.');
  await parenthetical.press('Control+7'); await editor('Shot').waitFor();
  await editor('Shot').press('Control+2'); await page.locator('.element-editor[aria-label="Action"]').last().press('Enter'); await page.locator('.element-editor[aria-label="Action"]').last().press('Enter'); await page.getByRole('menu', { name: 'Screenplay element menu' }).waitFor(); await page.keyboard.press('7'); await editor('Shot').waitFor();

  await page.getByRole('button', { name: 'New Scene' }).first().click(); if (await page.locator('.screenplay-view .screenplay-scene').count() !== 2) throw new Error('Screenplay Mode does not show all scene cards.');
  const heights = await page.locator('.screenplay-view .screenplay-scene').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height)); if (heights.some((height) => height > 900)) throw new Error(`Scene cards appear page-forced: ${heights}`);
  await page.getByRole('button', { name: 'Scene', exact: true }).click(); if (await page.locator('.scene-view .screenplay-scene').count() !== 1) throw new Error('Scene Mode does not show exactly one scene.');
  await editor('Scene heading').press('Control+a'); const sceneSelection = await page.evaluate(() => getSelection()?.toString() ?? ''); if (!sceneSelection.length) throw new Error('Scene Ctrl+A made no selection.');
  await page.getByRole('button', { name: 'Continuous', exact: true }).click(); await editor('Scene heading').first().press('Control+a'); const continuousSelection = await page.evaluate(() => getSelection()?.toString() ?? ''); if (!continuousSelection.includes('Rain at the windows.')) throw new Error('Continuous Ctrl+A did not span screenplay content.');

  await page.getByRole('button', { name: 'Screenplay', exact: true }).click();
  await page.screenshot({ path: join(artifacts, 'editor-corrections.png'), fullPage: true });
  console.log(JSON.stringify({ checks: ['autocomplete caret end', 'Return after autocomplete', 'Parenthetical parentheses/caret/typography', 'Ctrl+7 Shot', 'double-Return element menu', 'Screenplay scene cards/New Scene', 'Scene single content-height block', 'Scene and Continuous Ctrl+A'], screenshot: '.artifacts/editor-corrections.png' }, null, 2));
} finally { if (!page.isClosed()) await page.close({ runBeforeUnload: false }); await app.close(); }
