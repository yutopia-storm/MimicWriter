import { _electron as electron } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const executablePath = join(process.cwd(), 'release', 'win-unpacked', 'MimicWriter.exe');
const profile = await mkdtemp(join(tmpdir(), 'screenplay-desktop-package-'));
const packagedApp = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`] });
try {
  const page = await packagedApp.firstWindow();
  await page.getByRole('heading', { name: 'Your stories. Your location.' }).waitFor({ timeout: 15_000 });
  console.log(`Packaged application launched successfully: ${executablePath}`);
} finally {
  await packagedApp.close();
}
