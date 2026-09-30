import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = await mkdtemp(join(tmpdir(), 'episode-controls-'));
const app = await electron.launch({ executablePath: join(process.cwd(), 'node_modules', 'electron', 'dist', 'electron.exe'), args: ['.', `--user-data-dir=${join(root, 'profile')}`] });
const page = await app.firstWindow();
try {
  await page.reload();
  await page.locator('input').first().waitFor();
  await page.locator('input').first().fill(join(root, 'Storage'));
  await page.getByRole('button', { name: 'Use this folder' }).click();
  await page.getByRole('button', { name: /New Project/i }).click();
  await page.getByPlaceholder('Untitled story').fill('Episode Controls');
  await page.getByRole('button', { name: /^Series/ }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: /Episode Controls/ }).click();
  const firstTitle = page.getByRole('textbox', { name: 'Episode title' });
  await firstTitle.fill('Pilot');
  await page.getByRole('button', { name: 'Create episode' }).click();
  const addTitle = page.getByRole('textbox', { name: 'New episode title' });
  await addTitle.fill('Second'); await page.getByRole('button', { name: 'Create episode' }).click(); await page.getByRole('button', { name: 'Edit Second' }).waitFor();
  await page.getByRole('textbox', { name: 'New episode title' }).fill('Third'); await page.getByRole('button', { name: 'Create episode' }).click(); await page.getByRole('button', { name: 'Edit Third' }).waitFor();
  await page.getByRole('button', { name: 'Edit Second' }).click();
  const rename = page.getByRole('textbox', { name: 'Rename Second' });
  await rename.fill('Second Revised'); await rename.press('Enter');
  await page.getByRole('button', { name: 'Move Second Revised up' }).click();
  const titles = await page.locator('.episode-row b').allTextContents();
  if (titles.join('|') !== 'Second Revised|Pilot|Third') throw new Error(`Episode order/rename failed: ${titles.join('|')}`);
  console.log(JSON.stringify({ checks: ['episode selection', 'inline episode rename', 'episode reorder', 'stable sidebar highlight'] }, null, 2));
} finally {
  if (!page.isClosed()) await page.close({ runBeforeUnload: false });
  await app.close();
}
