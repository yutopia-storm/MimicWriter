import { _electron as electron } from 'playwright';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const testRoot = await mkdtemp(join(tmpdir(), 'screenplay-desktop-e2e-'));
const storageRoot = join(testRoot, 'Writer Storage');
const artifactRoot = join(process.cwd(), '.artifacts');
await mkdir(artifactRoot, { recursive: true });
const electronApp = await electron.launch({ args: ['.', `--user-data-dir=${join(testRoot, 'profile')}`] });
try {
  const page = await electronApp.firstWindow();
  await page.waitForSelector('text=Your stories.');
  await page.screenshot({ path: join(artifactRoot, 'onboarding.png'), fullPage: true });
  await page.getByPlaceholder('Choose a folder…').fill(storageRoot);
  await page.getByRole('button', { name: 'Use this folder' }).click();
  await page.getByRole('heading', { name: 'Project Library' }).waitFor();

  for (const project of [{ title: 'The Last Signal', type: 'Feature' }, { title: 'Northbound', type: 'Series' }]) {
    await page.getByRole('button', { name: /New Project/i }).click();
    await page.getByPlaceholder('Untitled story').fill(project.title);
    await page.getByRole('button', { name: new RegExp(`^${project.type}`) }).click();
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.getByRole('heading', { name: project.title }).waitFor();
  }

  await page.reload();
  await page.getByRole('heading', { name: 'Project Library' }).waitFor();
  await page.getByRole('heading', { name: 'The Last Signal' }).waitFor();
  await page.getByRole('heading', { name: 'Northbound' }).waitFor();
  await page.screenshot({ path: join(artifactRoot, 'project-library.png'), fullPage: true });

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
  await page.getByText(storageRoot, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Choose a different folder' }).waitFor();

  await page.getByRole('button', { name: 'Owner Admin' }).click();
  await page.getByLabel('Product name').fill('Story Foundry');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByText('Story Foundry', { exact: true }).waitFor();
  await page.screenshot({ path: join(artifactRoot, 'admin.png'), fullPage: true });

  console.log(JSON.stringify({ storageRoot, checks: ['onboarding', 'storage selection', 'feature creation', 'series creation', 'project library', 'restart persistence', 'settings', 'admin', 'brand configuration'], screenshots: ['.artifacts/onboarding.png', '.artifacts/project-library.png', '.artifacts/admin.png'] }, null, 2));
} finally {
  await electronApp.close();
}
