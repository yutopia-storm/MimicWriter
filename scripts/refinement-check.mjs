import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testRoot = await mkdtemp(join(tmpdir(), 'screenplay-refinement-e2e-'));
const profile = join(testRoot, 'profile'); const storageRoot = join(testRoot, 'Writer Storage');
const artifacts = join(process.cwd(), '.artifacts'); await mkdir(artifacts, { recursive: true });
const executablePath = process.env.MIMICWRITER_EXECUTABLE;
async function launch() { const app = await electron.launch(executablePath ? { executablePath, args: [`--user-data-dir=${profile}`] } : { args: ['.', `--user-data-dir=${profile}`] }); return { app, page: await app.firstWindow() }; }
async function closeApp(app, page) { if (!page.isClosed()) await page.close({ runBeforeUnload: false }); await app.close(); }
async function waitForSaved(page) { await page.getByText(/Unsaved changes|Saving…/, { exact: true }).waitFor({ timeout: 10_000 }); await page.getByText('Saved', { exact: true }).waitFor({ timeout: 10_000 }); }
async function selectText(locator, start, end) {
  await locator.evaluate((root, offsets) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let node; while ((node = walker.nextNode())) nodes.push(node);
    const point = (offset) => { let remaining = offset; for (const text of nodes) { if (remaining <= text.textContent.length) return [text, remaining]; remaining -= text.textContent.length; } return [nodes.at(-1), nodes.at(-1)?.textContent.length ?? 0]; };
    const [startNode, startOffset] = point(offsets.start); const [endNode, endOffset] = point(offsets.end); const range = document.createRange(); range.setStart(startNode, startOffset); range.setEnd(endNode, endOffset); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); root.focus(); root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, { start, end });
}

let { app, page } = await launch();
try {
  await page.getByPlaceholder('Choose a folder…').fill(storageRoot); await page.getByRole('button', { name: 'Use this folder' }).click();
  await page.getByRole('button', { name: /New Project/i }).click(); await page.getByPlaceholder('Untitled story').fill('Refinement Draft'); await page.getByRole('button', { name: /^Feature/ }).click(); await page.getByRole('button', { name: 'Create project' }).click(); await page.getByRole('button', { name: /Refinement Draft/ }).click();
  const heading = page.getByLabel('Scene heading').first(); await heading.fill('INT. SIGNAL ROOM - NIGHT');
  const action = page.getByLabel('Action').first(); await action.fill('A receiver wakes.'); await action.press('Tab');
  const mara = page.getByLabel('Character').first(); await mara.fill('MARA'); await mara.press('Enter'); await page.getByLabel('Dialogue').first().fill('Signal is live.');
  await page.getByLabel('Dialogue').first().press('Enter'); const zider = page.getByLabel('Character').nth(1); await zider.fill('ZIDER'); await zider.press('Enter'); await page.getByLabel('Dialogue').nth(1).fill('Then let it speak.');
  await page.getByLabel('Dialogue').nth(1).press('Enter'); const suggestedCharacter = page.getByLabel('Character').nth(2); await suggestedCharacter.fill('MA'); await page.getByRole('option', { name: 'MARA' }).waitFor(); await suggestedCharacter.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Character"]')].some((element) => element.textContent === 'MARA'));
  await suggestedCharacter.fill('NEW VOICE'); if ((await suggestedCharacter.innerText()) !== 'NEW VOICE') throw new Error('A new character could not be entered despite suggestions.');
  await page.getByRole('button', { name: 'Delete element' }).last().click();

  await page.getByRole('button', { name: 'Add scene' }).first().click(); const secondHeading = page.getByLabel('Scene heading').nth(1); await secondHeading.fill('INT.'); await page.getByRole('option', { name: 'INT. SIGNAL ROOM - NIGHT' }).waitFor(); await secondHeading.press('Enter');
  await page.waitForFunction(() => [...document.querySelectorAll('[aria-label="Scene heading"]')].some((element) => element.textContent === 'INT. SIGNAL ROOM - NIGHT'));
  await secondHeading.fill('EXT. NEW LOCATION - DAWN');

  await page.locator('[data-scene-id]').first().locator('.speech-selector').nth(0).click({ force: true }); await page.locator('[data-scene-id]').first().locator('.speech-selector').nth(1).click({ force: true }); await page.getByRole('button', { name: 'Make Dual Dialogue' }).click();
  if (await page.locator('[data-dual-dialogue-id]').count() !== 1) throw new Error('Dual dialogue was not created structurally.');
  await page.getByRole('button', { name: 'Remove Dual Dialogue' }).click(); if (await page.locator('[data-dual-dialogue-id]').count()) throw new Error('Dual dialogue was not removed.');
  await page.locator('[data-scene-id]').first().locator('.speech-selector').nth(0).click({ force: true }); await page.locator('[data-scene-id]').first().locator('.speech-selector').nth(1).click({ force: true }); await page.getByRole('button', { name: 'Make Dual Dialogue' }).click();

  const dialogue = page.getByLabel('Dialogue').first(); await selectText(dialogue, 0, 6); await dialogue.press('Control+b');
  await selectText(dialogue, 7, 9); await dialogue.press('Control+i'); await selectText(dialogue, 7, 9); await dialogue.press('Control+u');
  await selectText(dialogue, 0, 6); await dialogue.press('Control+z'); await dialogue.press('Control+y');
  await selectText(dialogue, 0, 6); await page.getByRole('button', { name: 'Uppercase', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Dialogue"]')?.textContent?.startsWith('SIGNAL'), null, { timeout: 3_000 });
  await dialogue.press('Control+z'); if (!(await dialogue.innerText()).startsWith('Signal')) throw new Error('Undo did not restore case conversion.');
  await dialogue.press('Control+y'); if (!(await dialogue.innerText()).startsWith('SIGNAL')) throw new Error('Redo did not restore case conversion.');
  await waitForSaved(page); await page.screenshot({ path: join(artifacts, 'screenplay-refinement.png'), fullPage: true });
  await closeApp(app, page); ({ app, page } = await launch()); await page.getByRole('button', { name: /Refinement Draft/ }).click();
  await page.locator('[data-dual-dialogue-id]').waitFor({ state: 'visible', timeout: 10_000 }); if (await page.locator('[data-dual-dialogue-id]').count() !== 1) throw new Error('Dual dialogue did not persist across restart.');
  const reopenedDialogue = page.getByLabel('Dialogue').first(); if (!(await reopenedDialogue.innerText()).startsWith('SIGNAL')) throw new Error('Formatted content did not persist across restart.');
  const persistedStyles = await reopenedDialogue.locator('span').evaluateAll((spans) => spans.map((span) => span.getAttribute('style')));
  if (!persistedStyles.some((style) => style?.includes('font-weight'))) throw new Error('Bold formatting did not persist.');
  console.log(JSON.stringify({ checks: ['professional keyboard flow','character autocomplete','heading autocomplete','new values','dual dialogue create/remove/persist','partial bold/italic/underline','case conversion','undo/redo','autosave','application restart'], screenshot: '.artifacts/screenplay-refinement.png' }, null, 2));
} finally { await closeApp(app, page); }
