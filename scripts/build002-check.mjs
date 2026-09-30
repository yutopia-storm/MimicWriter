import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testRoot = await mkdtemp(join(tmpdir(), 'screenplay-core-e2e-'));
const profile = join(testRoot, 'profile'); const storageRoot = join(testRoot, 'Writer Storage');
const artifacts = join(process.cwd(), '.artifacts'); await mkdir(artifacts, { recursive: true });

async function launch() {
  const executablePath = process.env.MIMICWRITER_EXECUTABLE;
  const app = await electron.launch(executablePath
    ? { executablePath, args: [`--user-data-dir=${profile}`] }
    : { args: ['.', `--user-data-dir=${profile}`] });
  return { app, page: await app.firstWindow() };
}
async function waitForValue(page, value) {
  await page.waitForFunction((expected) => [...document.querySelectorAll('[data-element-id]')].some((element) => element.textContent === expected), value);
}
async function waitForSaved(page) {
  await page.getByText(/Unsaved changes|Saving…/, { exact: true }).waitFor({ timeout: 10_000 });
  await page.getByText('Saved', { exact: true }).waitFor({ timeout: 10_000 });
}
async function closeApp(app, page) {
  if (!page.isClosed()) await page.close({ runBeforeUnload: false });
  await app.close();
}

let { app, page } = await launch();
try {
  console.log('E2E: feature setup');
  await page.getByPlaceholder('Choose a folder…').fill(storageRoot);
  await page.getByRole('button', { name: 'Use this folder' }).click();
  await page.getByRole('button', { name: /New Project/i }).click();
  await page.getByPlaceholder('Untitled story').fill('The Last Signal');
  await page.getByRole('button', { name: /^Feature/ }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: /The Last Signal/ }).click();

  await page.getByLabel('Scene heading').first().fill('INT. SIGNAL ROOM - NIGHT');
  await page.getByLabel('Action').first().fill('Rain needles the dark windows.');
  await page.getByLabel('Action').first().press('Enter');
  const newAction = page.getByLabel('Action').nth(1);
  await newAction.fill('Mara steadies the receiver.');
  await newAction.press('Alt+3');
  await page.getByLabel('Character').fill('MARA');
  await page.getByLabel('Character').press('Enter');
  await page.getByLabel('Dialogue').fill('There you are.');

  await page.getByRole('button', { name: 'Add scene' }).first().click();
  await page.getByLabel('Scene heading').nth(1).fill('EXT. RELAY TOWER - CONTINUOUS');
  await page.getByLabel('Action').nth(1).fill('The tower burns against the storm.');
  await waitForSaved(page);
  const idsBefore = await page.locator('[data-scene-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-scene-id')));
  await page.locator('[data-scene-id]').nth(1).getByTitle('Move scene up').click();
  await waitForSaved(page);
  const idsAfter = await page.locator('[data-scene-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-scene-id')));
  if (idsAfter[0] !== idsBefore[1] || idsAfter[1] !== idsBefore[0]) throw new Error('Scene IDs were not preserved during reorder.');
  await page.locator('.scene-navigator>button').nth(1).click();
  await page.waitForTimeout(500);
  const navigation = await page.locator(`[data-scene-id="${idsBefore[0]}"]`).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = element.closest('.screenplay-scroll')?.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, viewportTop: viewport?.top ?? 0, viewportBottom: viewport?.bottom ?? 0 };
  });
  if (navigation.bottom <= navigation.viewportTop || navigation.top >= navigation.viewportBottom) throw new Error('Scene navigation did not reveal the selected scene.');

  await page.locator('[data-scene-id]').first().getByTitle('Lock scene').click();
  if ((await page.locator('[data-scene-id]').first().getByLabel('Scene heading').getAttribute('contenteditable')) !== 'false') throw new Error('Locked scene remained editable.');
  await page.locator('[data-scene-id]').first().getByTitle('Unlock scene').click();
  await page.getByRole('button', { name: 'Add scene' }).first().click();
  await page.locator('[data-scene-id]').nth(2).getByTitle('Delete scene').click();
  await page.getByRole('button', { name: 'Delete scene permanently' }).click();
  await waitForSaved(page);
  await page.screenshot({ path: join(artifacts, 'screenplay-workspace.png'), fullPage: true });

  console.log('E2E: feature renderer reload');
  await page.reload();
  await page.getByRole('button', { name: /The Last Signal/ }).click();
  await waitForValue(page, 'INT. SIGNAL ROOM - NIGHT');
  const reopenedIds = await page.locator('[data-scene-id]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-scene-id')));
  if (!idsBefore.every((id) => reopenedIds.includes(id))) throw new Error('Stable scene IDs did not survive renderer restart.');
  console.log('E2E: feature app close'); await closeApp(app, page);

  ({ app, page } = await launch());
  console.log('E2E: feature app reopen');
  await page.getByRole('button', { name: /The Last Signal/ }).click();
  await waitForValue(page, 'There you are.');
  await page.getByRole('button', { name: 'Library', exact: true }).click();

  await page.getByRole('button', { name: /New Project/i }).click();
  await page.getByPlaceholder('Untitled story').fill('Northbound');
  await page.getByRole('button', { name: /^Series/ }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: /Northbound/ }).click();
  await page.getByLabel('Episode title').fill('Pilot');
  await page.getByRole('button', { name: 'Create episode' }).click();
  await page.getByLabel('Scene heading').fill('INT. NIGHT TRAIN - NIGHT');
  await waitForSaved(page);
  await page.getByLabel('New episode title').fill('Second Light');
  await page.getByRole('button', { name: 'Create episode' }).click();
  await page.locator('.episode-tabs button.active', { hasText: 'Second Light' }).waitFor();
  await page.getByLabel('Scene heading').fill('EXT. COASTAL PLATFORM - DAWN');
  await waitForSaved(page);
  await page.getByRole('button', { name: 'Pilot' }).click();
  await waitForValue(page, 'INT. NIGHT TRAIN - NIGHT');
  console.log('E2E: series app close'); await closeApp(app, page);

  ({ app, page } = await launch());
  console.log('E2E: series app reopen');
  await page.getByRole('button', { name: /Northbound/ }).click();
  await page.getByRole('button', { name: 'Second Light' }).click();
  await waitForValue(page, 'EXT. COASTAL PLATFORM - DAWN');
  console.log(JSON.stringify({ checks: ['Feature screenplay', 'typed elements', 'keyboard element flow', 'continuous scenes', 'navigation', 'stable IDs', 'reorder', 'safe delete confirmation', 'lock/unlock', 'autosave', 'application restart', 'Series episodes', 'episode independence'], screenshot: '.artifacts/screenplay-workspace.png' }, null, 2));
} finally {
  await closeApp(app, page);
}
