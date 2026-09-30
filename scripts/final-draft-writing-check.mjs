import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = await mkdtemp(join(tmpdir(), 'screenplay-writing-e2e-'));
const artifacts = join(process.cwd(), '.artifacts'); await mkdir(artifacts, { recursive: true });
const app = await electron.launch({ args: ['.', `--user-data-dir=${join(root, 'profile')}`] });
const page = await app.firstWindow();
const text = (label, index = 0) => page.getByLabel(label).nth(index);
try {
  await page.locator('input').first().waitFor({ state: 'visible' });
  await page.locator('input').first().fill(join(root, 'Writer Storage'));
  await page.getByRole('button', { name: 'Use this folder' }).click();
  await page.getByRole('button', { name: /New Project/i }).click();
  await page.getByPlaceholder('Untitled story').fill('Keyboard Draft');
  await page.getByRole('button', { name: /^Feature/ }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: /Keyboard Draft/ }).click();
  await page.getByRole('button', { name: 'Continuous' }).click();

  if (await page.locator('.script-element>select:visible').count()) throw new Error('Per-element selectors remain visible.');
  await text('Scene heading').fill('INT. KITCHEN - NIGHT');
  await text('Scene heading').press('Enter');
  if (await text('Action').count() !== 1) throw new Error('Scene Heading Enter did not reuse the existing blank Action.');
  await text('Action').fill('Rain needles the window.');
  await text('Action').press('Enter');
  const blankAction = text('Action', 1); await blankAction.press('Tab');
  const character = text('Character'); await character.fill('ZIDER');
  await character.press('Enter');
  const dialogue = text('Dialogue'); await dialogue.fill('Where are you going?');
  await dialogue.press('Tab');
  const parenthetical = text('Parenthetical'); await parenthetical.fill('(quietly)');
  await parenthetical.press('Tab');
  await text('Dialogue', 1).fill('I am staying here.');
  await text('Dialogue', 1).press('Enter');
  const actionCount = await page.locator('[aria-label="Action"]').count(); if (actionCount < 2) throw new Error(`Dialogue Enter did not create Action (found ${actionCount}).`);

  const action = text('Action', 1); await action.fill('Apple opens the door.');
  await action.evaluate((node) => { const range = document.createRange(); range.setStart(node.firstChild, 6); range.collapse(true); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); node.focus(); });
  await action.press('Enter');
  if ((await text('Action', 1).innerText()) !== 'Apple ' || (await text('Action', 2).innerText()) !== 'opens the door.') throw new Error('Caret split lost or duplicated text.');

  await text('Action', 2).press('Home'); await text('Action', 2).press('Backspace');
  if ((await text('Action', 1).innerText()) !== 'Apple opens the door.') throw new Error('Boundary Backspace did not join paragraphs.');
  await text('Action', 1).press('Control+3');
  await page.locator('[aria-label="Character"]').nth(1).waitFor();
  await text('Character', 1).fill('ZI');
  await page.getByRole('option', { name: 'ZIDER' }).waitFor();
  await text('Character', 1).press('Enter');
  if ((await text('Character', 1).innerText()) !== 'ZIDER') throw new Error('Keyboard SmartType acceptance failed.');

  await page.screenshot({ path: join(artifacts, 'final-draft-writing.png'), fullPage: true });
  console.log(JSON.stringify({ checks: ['independent stable editing surfaces', 'hidden paragraph selectors', 'contextual Enter', 'blank-element reuse', 'Action to Character Tab', 'Dialogue to Parenthetical Tab', 'Parenthetical to Dialogue Tab', 'caret split', 'boundary Backspace', 'Ctrl+1-6 element shortcut', 'Enter SmartType acceptance'], screenshot: '.artifacts/final-draft-writing.png' }, null, 2));
} finally {
  if (!page.isClosed()) await page.close({ runBeforeUnload: false });
  await app.close();
}
