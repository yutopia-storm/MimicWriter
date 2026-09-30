import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import { z } from 'zod';
import { DEFAULT_APP_STATE, DEFAULT_OWNER_CONFIG, DEFAULT_PREFERENCES } from '../src/shared/defaults';
import type { AppState, BootstrapData, OwnerConfig, ProjectType, ScreenplayRecord, UserPreferences } from '../src/shared/models';
import { readJson, writeJsonAtomic } from './json-store';
import { FileProjectRepository, initializeStorageRoot, validateStorageRoot } from './storage';

import { readScreenplayClipboard, writeScreenplayClipboard } from './clipboard';

let mainWindow: BrowserWindow | null = null;
const configPath = (name: string) => join(app.getPath('userData'), name);
const projectInput = z.object({ title: z.string().trim().min(1).max(160), projectType: z.enum(['feature', 'short', 'series']), collectionId: z.string().uuid().optional() });
const episodeInput = z.object({ projectId: z.string().uuid(), seasonId: z.string().min(1), title: z.string().trim().min(1).max(160) });

async function getAppState() { return readJson<AppState>(configPath('app-state.json'), DEFAULT_APP_STATE); }
async function getOwnerConfig() { return readJson<OwnerConfig>(configPath('owner-config.json'), DEFAULT_OWNER_CONFIG); }
async function getPreferences() { return readJson<UserPreferences>(configPath('preferences.json'), DEFAULT_PREFERENCES); }

async function bootstrap(): Promise<BootstrapData> {
  const [appState, ownerConfig, preferences] = await Promise.all([getAppState(), getOwnerConfig(), getPreferences()]);
  const storageHealth = await validateStorageRoot(appState.storageRoot);
  const repository = storageHealth.writable && appState.storageRoot ? new FileProjectRepository(appState.storageRoot) : null; const projects = repository ? await repository.list() : []; const collections = repository ? await repository.listCollections() : [];
  return { appState, ownerConfig, preferences, storageHealth, projects, collections };
}

async function requireRepository() {
  const state = await getAppState();
  const health = await validateStorageRoot(state.storageRoot);
  if (!state.storageRoot || !health.writable) throw new Error('Project storage is unavailable. Reconnect it or choose a valid folder in Settings.');
  return new FileProjectRepository(state.storageRoot);
}

function registerIpc() {
  ipcMain.handle('app:bootstrap', bootstrap);
  ipcMain.handle('clipboard:read', readScreenplayClipboard);
  ipcMain.handle('clipboard:write', (_event, value: unknown) => writeScreenplayClipboard(value));
  ipcMain.handle('clipboard:read-text', () => clipboard.readText());
  ipcMain.handle('clipboard:write-text', async (_event, value: unknown) => { if (typeof value !== 'string') throw new Error('Clipboard text must be a string.'); await clipboard.writeText(value); });
  ipcMain.handle('storage:choose', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory', 'createDirectory'], title: 'Choose where your projects will be stored' });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('storage:configure', async (_event, root: unknown) => {
    if (typeof root !== 'string' || !root.trim()) throw new Error('Choose a valid storage folder.');
    const health = await initializeStorageRoot(root);
    if (!health.writable) throw new Error(health.message);
    const previous = await getAppState();
    if (previous.setupCompleted && previous.storageRoot && previous.storageRoot !== root) {
      const confirmation = await dialog.showMessageBox(mainWindow!, {
        type: 'warning', buttons: ['Keep current folder', 'Change folder'], defaultId: 0, cancelId: 0,
        title: 'Change project storage?',
        message: 'Existing projects will stay in the current folder.',
        detail: 'This changes where new projects are created. It does not move or delete existing projects.'
      });
      if (confirmation.response !== 1) return bootstrap();
    }
    const state: AppState = { schemaVersion: 1, storageRoot: root, setupCompleted: true };
    await writeJsonAtomic(configPath('app-state.json'), state);
    return bootstrap();
  });
  ipcMain.handle('storage:refresh', async () => {
    const state = await getAppState(); const health = await validateStorageRoot(state.storageRoot);
    const repository = health.writable && state.storageRoot ? new FileProjectRepository(state.storageRoot) : null; return { health, projects: repository ? await repository.list() : [], collections: repository ? await repository.listCollections() : [] };
  });
  ipcMain.handle('projects:create', async (_event, value: unknown) => {
    const input = projectInput.parse(value) as { title: string; projectType: ProjectType; collectionId?: string };
    const flags = (await getOwnerConfig()).featureFlags;
    if (!flags.project_creation) throw new Error('Project creation is currently disabled.');
    if (input.projectType === 'series' && !flags.series_projects) throw new Error('Series projects are currently disabled.');
    const repository = await requireRepository(); const project = await repository.create(input.title, input.projectType); if (input.collectionId) await repository.setCollectionProject(input.collectionId, project.id, true); return project;
  });
  ipcMain.handle('projects:open', async (_event, id: unknown) => {
    if (typeof id !== 'string') throw new Error('Invalid project identifier.');
    return (await requireRepository()).get(id);
  });
  ipcMain.handle('workspace:open', async (_event, projectId: unknown) => {
    if (typeof projectId !== 'string') throw new Error('Invalid project identifier.');
    return (await requireRepository()).openWorkspace(projectId);
  });
  ipcMain.handle('episodes:create', async (_event, value: unknown) => {
    const input = episodeInput.parse(value);
    return (await requireRepository()).createEpisode(input.projectId, input.seasonId, input.title);
  });
  ipcMain.handle('episodes:rename', async (_event, value: any) => (await requireRepository()).renameEpisode(value.projectId, value.episodeId, value.title));
  ipcMain.handle('seasons:create', async (_event, value: any) => (await requireRepository()).createSeason(value.projectId, value.title));
  ipcMain.handle('seasons:rename', async (_event, value: any) => (await requireRepository()).renameSeason(value.projectId, value.seasonId, value.title));
  ipcMain.handle('seasons:reorder', async (_event, value: any) => (await requireRepository()).reorderSeason(value.projectId, value.seasonId, value.targetIndex));
  ipcMain.handle('episodes:move', async (_event, value: any) => (await requireRepository()).moveEpisode(value.projectId, value.episodeId, value.targetSeasonId, value.targetIndex));
  ipcMain.handle('collections:create', async (_event, name: string) => (await requireRepository()).createCollection(name));
  ipcMain.handle('collections:rename', async (_event, value: any) => (await requireRepository()).renameCollection(value.id, value.name));
  ipcMain.handle('collections:delete', async (_event, id: string) => (await requireRepository()).deleteCollection(id));
  ipcMain.handle('collections:set-project', async (_event, value: any) => (await requireRepository()).setCollectionProject(value.collectionId, value.projectId, value.included));
  ipcMain.handle('collections:reorder-project', async (_event, value: any) => (await requireRepository()).reorderCollectionProject(value.collectionId, value.projectId, value.targetIndex));
  ipcMain.handle('assets:import-image', async (_event, value: { projectId: string; dataUrl: string }) => (await requireRepository()).importProjectImage(z.string().uuid().parse(value.projectId), z.string().parse(value.dataUrl)));
  ipcMain.handle('assets:read-image', async (_event, value: { projectId: string; assetId: string }) => (await requireRepository()).readProjectImage(z.string().uuid().parse(value.projectId), z.string().uuid().parse(value.assetId)));
  ipcMain.handle('story:save', async (_event, value: any) => {
    const projectId = z.string().uuid().parse(value?.projectId);
    return (await requireRepository()).saveStory(projectId, value.story);
  });
  ipcMain.handle('screenplays:save', async (_event, value: unknown) => {
    const input = value as { projectId?: unknown; screenplay?: unknown };
    if (typeof input?.projectId !== 'string' || !input.screenplay || typeof input.screenplay !== 'object') throw new Error('Invalid screenplay save request.');
    return (await requireRepository()).saveScreenplay(input.projectId, input.screenplay as ScreenplayRecord);
  });
  ipcMain.handle('config:owner:save', async (_event, value: OwnerConfig) => {
    const config = { ...value, schemaVersion: 1 as const };
    await writeJsonAtomic(configPath('owner-config.json'), config); return config;
  });
  ipcMain.handle('preferences:save', async (_event, value: UserPreferences) => {
    const preferences = { ...value, schemaVersion: 1 as const };
    await writeJsonAtomic(configPath('preferences.json'), preferences);
    mainWindow?.webContents.session.setSpellCheckerLanguages([preferences.spellingLanguage ?? 'en-GB']); return preferences;
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380, height: 900, minWidth: 980, minHeight: 680, backgroundColor: '#11100f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  if (process.env.VITE_DEV_SERVER_URL) await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else await mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  const preferences = await getPreferences(); mainWindow.webContents.session.setSpellCheckerLanguages([preferences.spellingLanguage ?? 'en-GB']);
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const template: Electron.MenuItemConstructorOptions[] = [];
    if (params.misspelledWord) {
      for (const suggestion of params.dictionarySuggestions.slice(0, 5)) template.push({ label: suggestion, click: () => mainWindow?.webContents.replaceMisspelling(suggestion) });
      if (params.dictionarySuggestions.length) template.push({ type: 'separator' });
      template.push({ label: 'Ignore once', click: () => mainWindow?.webContents.replaceMisspelling(params.misspelledWord) }, { label: 'Add to dictionary', click: () => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) }, { type: 'separator' });
    }
    if (params.isEditable) template.push({ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { label: 'Paste as Plain Text', accelerator: 'CmdOrCtrl+Shift+V', click: () => mainWindow?.webContents.send('clipboard:paste-plain') });
    else if (params.selectionText) template.push({ role: 'copy' });
    if (template.length) Menu.buildFromTemplate(template).popup({ window: mainWindow! });
  });
  console.log('Desktop window ready.');
}

app.whenReady().then(() => { registerIpc(); return createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
