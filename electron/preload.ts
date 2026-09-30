import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi } from '../src/shared/models';

const api: DesktopApi = {
  bootstrap: () => ipcRenderer.invoke('app:bootstrap'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (data) => ipcRenderer.invoke('clipboard:write', data),
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text'),
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard:write-text', text),
  chooseStorageFolder: () => ipcRenderer.invoke('storage:choose'),
  configureStorage: (path) => ipcRenderer.invoke('storage:configure', path),
  refreshStorage: () => ipcRenderer.invoke('storage:refresh'),
  createProject: (input) => ipcRenderer.invoke('projects:create', input),
  openProject: (id) => ipcRenderer.invoke('projects:open', id),
  openWorkspace: (projectId) => ipcRenderer.invoke('workspace:open', projectId),
  createSeason: (projectId, title) => ipcRenderer.invoke('seasons:create', { projectId, title }),
  renameSeason: (projectId, seasonId, title) => ipcRenderer.invoke('seasons:rename', { projectId, seasonId, title }),
  reorderSeason: (projectId, seasonId, targetIndex) => ipcRenderer.invoke('seasons:reorder', { projectId, seasonId, targetIndex }),
  createEpisode: (projectId, seasonId, title) => ipcRenderer.invoke('episodes:create', { projectId, seasonId, title }),
  renameEpisode: (projectId, episodeId, title) => ipcRenderer.invoke('episodes:rename', { projectId, episodeId, title }),
  moveEpisode: (projectId, episodeId, targetSeasonId, targetIndex) => ipcRenderer.invoke('episodes:move', { projectId, episodeId, targetSeasonId, targetIndex }),
  createCollection: (name) => ipcRenderer.invoke('collections:create', name),
  renameCollection: (id, name) => ipcRenderer.invoke('collections:rename', { id, name }),
  deleteCollection: (id) => ipcRenderer.invoke('collections:delete', id),
  setCollectionProject: (collectionId, projectId, included) => ipcRenderer.invoke('collections:set-project', { collectionId, projectId, included }),
  reorderCollectionProject: (collectionId, projectId, targetIndex) => ipcRenderer.invoke('collections:reorder-project', { collectionId, projectId, targetIndex }),
  saveScreenplay: (projectId, screenplay) => ipcRenderer.invoke('screenplays:save', { projectId, screenplay }),
  importProjectImage: (projectId, dataUrl) => ipcRenderer.invoke('assets:import-image', { projectId, dataUrl }),
  readProjectImage: (projectId, assetId) => ipcRenderer.invoke('assets:read-image', { projectId, assetId }),
  saveStory: (projectId, story) => ipcRenderer.invoke('story:save', { projectId, story }),
  saveOwnerConfig: (config) => ipcRenderer.invoke('config:owner:save', config),
  savePreferences: (preferences) => ipcRenderer.invoke('preferences:save', preferences)
};
contextBridge.exposeInMainWorld('desktop', api);

ipcRenderer.on('clipboard:paste-plain', () => window.dispatchEvent(new Event('screenplay-paste-plain')));
