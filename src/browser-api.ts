import { importProjectImage, readProjectImage } from './profile-assets-browser';
import { migrateStory } from './domain/story';
import type { StoryRecord } from './shared/story';
import { SCREENPLAY_CLIPBOARD_MIME } from './shared/clipboard';
import { DEFAULT_APP_STATE, DEFAULT_OWNER_CONFIG, DEFAULT_PREFERENCES } from './shared/defaults';
import type { AppState, BootstrapData, DesktopApi, OwnerConfig, ProjectCollection, ProjectRecord, ProjectWorkspace, ScreenplayRecord, SeasonRecord, UserPreferences } from './shared/models';
import { allEpisodes, migrateProject, normalizeSeries, type StoredProjectRecord } from './domain/project';
import { createScreenplay, normalizeSceneHeadings } from './domain/screenplay';

const KEYS = {
  state: 'screenplay-desktop.preview.state',
  owner: 'screenplay-desktop.preview.owner',
  preferences: 'screenplay-desktop.preview.preferences',
  projects: 'screenplay-desktop.preview.projects',
  screenplays: 'screenplay-desktop.preview.screenplays', collections: 'screenplay-desktop.preview.collections'
};

function read<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) as T : structuredClone(fallback);
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bootstrap(): BootstrapData {
  const appState = read<AppState>(KEYS.state, DEFAULT_APP_STATE);
  const storedProjects = read<StoredProjectRecord[]>(KEYS.projects, []);
  const screenplays = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {});
  const projects = storedProjects.map((stored) => {
    const result = migrateProject(stored);
    for (const screenplay of result.createdScreenplays) screenplays[screenplay.id] = screenplay;
    return result.project;
  });
  if (projects.some((project, index) => project !== storedProjects[index])) { write(KEYS.projects, projects); write(KEYS.screenplays, screenplays); }
  return {
    appState,
    ownerConfig: read<OwnerConfig>(KEYS.owner, DEFAULT_OWNER_CONFIG),
    preferences: read<UserPreferences>(KEYS.preferences, DEFAULT_PREFERENCES),
    storageHealth: {
      configured: appState.setupCompleted,
      available: appState.setupCompleted,
      writable: appState.setupCompleted,
      path: appState.storageRoot,
      message: appState.setupCompleted ? 'Browser preview storage is available.' : 'Choose a preview folder to begin.'
    },
    projects, collections: read<ProjectCollection[]>(KEYS.collections, [])
  };
}

function workspace(project: ProjectRecord): ProjectWorkspace { const stored = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {}); const ids = project.projectType !== 'series' ? [project.screenplayId!] : allEpisodes(project).map((episode) => episode.screenplayId); return { project, screenplays: ids.map((id) => stored[id]).filter(Boolean), story: readStory(project.id) }; }
function updateProject(projectId: string, updater: (project: ProjectRecord) => ProjectRecord): ProjectWorkspace { const projects = read<ProjectRecord[]>(KEYS.projects, []); const index = projects.findIndex((project) => project.id === projectId); if (index < 0) throw new Error('Project could not be found.'); const updated = { ...updater(projects[index]), updatedAt: new Date().toISOString() }; projects[index] = updated; write(KEYS.projects, projects); return workspace(updated); }
function updateCollections(updater: (collections: ProjectCollection[]) => ProjectCollection[]) { const next = updater(read<ProjectCollection[]>(KEYS.collections, [])); write(KEYS.collections, next); return Promise.resolve(next); }

function readStory(projectId: string): StoryRecord {
  const key = 'screenplay-desktop.preview.story:' + projectId;
  const previous = read<StoryRecord | null>(key, null);
  const story = migrateStory(previous, projectId);
  if (!previous) write(key, story);
  return story;
}
let browserClipboard = '';

export const browserPreviewApi: DesktopApi = {
  preferClipboardEvents: true,
  async bootstrap() { return bootstrap(); },
  async readClipboard() {
    try { const items = await navigator.clipboard.read(); const data: import('./shared/clipboard').ClipboardRepresentations = { text: '' }; for (const item of items) { if (item.types.includes('text/plain')) data.text = await (await item.getType('text/plain')).text(); if (item.types.includes('text/html')) data.html = await (await item.getType('text/html')).text(); if(item.types.includes('web ' + SCREENPLAY_CLIPBOARD_MIME)) data.structured = await (await item.getType('web ' + SCREENPLAY_CLIPBOARD_MIME)).text(); } return data; }
    catch { throw new Error('Clipboard reading is unavailable; use the browser paste event.'); }
  },
  async writeClipboard(data) {
    browserClipboard = data.text;
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([data.text], {type:'text/plain'}), ...(data.html ? {'text/html': new Blob([data.html], {type:'text/html'})} : {}), ...(data.structured ? {['web ' + SCREENPLAY_CLIPBOARD_MIME]: new Blob([data.structured], {type:SCREENPLAY_CLIPBOARD_MIME})} : {}) })]); }
    catch { /* Native clipboard events still provide the standard representations. */ }
  },
  async readClipboardText() { try { return await navigator.clipboard.readText(); } catch { return browserClipboard; } },
  async writeClipboardText(text) { browserClipboard = text; try { await navigator.clipboard.writeText(text); } catch { /* Keep the browser-preview fallback in memory. */ } },
  async chooseStorageFolder() { return 'Browser preview storage'; },
  async configureStorage(path) {
    const state: AppState = { schemaVersion: 1, setupCompleted: true, storageRoot: path || 'Browser preview storage' };
    write(KEYS.state, state);
    return bootstrap();
  },
  async refreshStorage() {
    const data = bootstrap();
    return { health: data.storageHealth, projects: data.projects, collections: data.collections };
  },
  async createProject(input) {
    const projects = read<ProjectRecord[]>(KEYS.projects, []);
    const screenplays = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {});
    const timestamp = new Date().toISOString();
    const projectId = crypto.randomUUID();
    const screenplay = input.projectType !== 'series' ? createScreenplay({ projectId, title: input.title.trim(), screenplayType: input.projectType }, timestamp) : null; const season: SeasonRecord = { id: crypto.randomUUID(), order: 0, title: '', episodes: [], createdAt: timestamp, updatedAt: timestamp };
    const project: ProjectRecord = {
      schemaVersion: 3, documentFormat: 'screenplay',
      id: projectId,
      projectType: input.projectType,
      title: input.title.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      metadata: { description: '' },
      ...(screenplay ? { screenplayId: screenplay.id } : { series: { id: crypto.randomUUID(), title: input.title.trim(), seasons: [season] } })
    };
    if (screenplay) { screenplays[screenplay.id] = screenplay; write(KEYS.screenplays, screenplays); }
    write(KEYS.projects, [project, ...projects]); if (input.collectionId) await browserPreviewApi.setCollectionProject(input.collectionId, project.id, true);
    return project;
  },
  async openProject(id) {
    const project = read<ProjectRecord[]>(KEYS.projects, []).find((item) => item.id === id);
    if (!project) throw new Error('Project could not be found.');
    return project;
  },
  async openWorkspace(projectId) {
    const project = read<ProjectRecord[]>(KEYS.projects, []).find((item) => item.id === projectId);
    if (!project) throw new Error('Project could not be found.');
    const stored = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {});
    const ids = project.projectType !== 'series' ? [project.screenplayId!] : allEpisodes(project).map((episode) => episode.screenplayId);
    return { project, screenplays: ids.map((id) => stored[id]).filter(Boolean), story: readStory(project.id) };
  },
  async createEpisode(projectId, seasonId, title) {
    const projects = read<ProjectRecord[]>(KEYS.projects, []); const index = projects.findIndex((item) => item.id === projectId);
    const project = projects[index]; if (!project?.series) throw new Error('Series project could not be found.');
    const timestamp = new Date().toISOString(); const episodeId = crypto.randomUUID();
    const screenplay = createScreenplay({ projectId, title: title.trim(), screenplayType: 'episode', episodeId }, timestamp);
    const season = project.series.seasons.find((item) => item.id === seasonId); if (!season) throw new Error('Series/Season could not be found.'); const updated: ProjectRecord = { ...project, updatedAt: timestamp, series: { ...project.series, seasons: project.series.seasons.map((item) => item.id === seasonId ? { ...item, episodes: [...item.episodes, { id: episodeId, title: title.trim(), order: item.episodes.length, screenplayId: screenplay.id, createdAt: timestamp, updatedAt: timestamp }] } : item) } };
    projects[index] = updated; const screenplays = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {}); screenplays[screenplay.id] = screenplay;
    write(KEYS.projects, projects); write(KEYS.screenplays, screenplays);
    return { project: updated, story: readStory(projectId), screenplays: allEpisodes(updated).map((episode) => screenplays[episode.screenplayId]).filter(Boolean) } as ProjectWorkspace;
  },
  async renameEpisode(projectId, episodeId, title) {
    const next = await updateProject(projectId, (project) => ({ ...project, series: project.series && { ...project.series, seasons: project.series.seasons.map((season) => ({ ...season, episodes: season.episodes.map((episode) => episode.id === episodeId ? { ...episode, title: title.trim(), updatedAt: new Date().toISOString() } : episode) })) } }));
    const episode = allEpisodes(next.project).find((item) => item.id === episodeId); const screenplays = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {});
    if (episode && screenplays[episode.screenplayId]) { screenplays[episode.screenplayId] = { ...screenplays[episode.screenplayId], title: title.trim(), updatedAt: new Date().toISOString() }; write(KEYS.screenplays, screenplays); }
    return { ...next, screenplays: allEpisodes(next.project).map((item) => screenplays[item.screenplayId]).filter(Boolean) };
  },
  async createSeason(projectId, title = '') { return updateProject(projectId, (project) => { if (!project.series) throw new Error('Series project could not be found.'); const now = new Date().toISOString(); return { ...project, series: { ...project.series, seasons: [...project.series.seasons, { id: crypto.randomUUID(), order: project.series.seasons.length, title: title.trim(), episodes: [], createdAt: now, updatedAt: now }] } }; }); },
  async renameSeason(projectId, seasonId, title) { return updateProject(projectId, (project) => ({ ...project, series: project.series && { ...project.series, seasons: project.series.seasons.map((season) => season.id === seasonId ? { ...season, title: title.trim() } : season) } })); },
  async reorderSeason(projectId, seasonId, targetIndex) { return updateProject(projectId, (project) => { const seasons = [...project.series!.seasons]; const source = seasons.findIndex((season) => season.id === seasonId); const [season] = seasons.splice(source, 1); seasons.splice(Math.max(0, Math.min(targetIndex, seasons.length)), 0, season); return normalizeSeries({ ...project, series: { ...project.series!, seasons } }); }); },
  async moveEpisode(projectId, episodeId, targetSeasonId, targetIndex) { return updateProject(projectId, (project) => { const episode = allEpisodes(project).find((item) => item.id === episodeId); if (!episode) throw new Error('Episode could not be found.'); const seasons = project.series!.seasons.map((season) => ({ ...season, episodes: season.episodes.filter((item) => item.id !== episodeId) })); const target = seasons.find((season) => season.id === targetSeasonId); if (!target) throw new Error('Series/Season could not be found.'); target.episodes.splice(Math.max(0, Math.min(targetIndex, target.episodes.length)), 0, episode); return normalizeSeries({ ...project, series: { ...project.series!, seasons } }); }); },
  async createCollection(name) { const values = read<ProjectCollection[]>(KEYS.collections, []); const now = new Date().toISOString(); const next = [...values, { schemaVersion: 1 as const, id: crypto.randomUUID(), name: name.trim(), projectIds: [], createdAt: now, updatedAt: now }]; write(KEYS.collections, next); return next; },
  async renameCollection(id, name) { return updateCollections((values) => values.map((item) => item.id === id ? { ...item, name: name.trim(), updatedAt: new Date().toISOString() } : item)); },
  async deleteCollection(id) { return updateCollections((values) => values.filter((item) => item.id !== id)); },
  async setCollectionProject(collectionId, projectId, included) { return updateCollections((values) => values.map((item) => item.id !== collectionId ? item : { ...item, projectIds: included ? [...item.projectIds.filter((id) => id !== projectId), projectId] : item.projectIds.filter((id) => id !== projectId), updatedAt: new Date().toISOString() })); },
  async reorderCollectionProject(collectionId, projectId, targetIndex) { return updateCollections((values) => values.map((item) => { if (item.id !== collectionId) return item; const ids = item.projectIds.filter((id) => id !== projectId); ids.splice(Math.max(0, Math.min(targetIndex, ids.length)), 0, projectId); return { ...item, projectIds: ids }; })); },
  importProjectImage, readProjectImage,
  async saveStory(projectId, value) {
    await browserPreviewApi.openProject(projectId);
    const story = migrateStory(value, projectId);
    const key = 'screenplay-desktop.preview.story:' + projectId;
    write(key + ':backup', readStory(projectId));
    write(key, story);
    return story;
  },
  async saveScreenplay(projectId, screenplay) {
    if (screenplay.projectId !== projectId) throw new Error('Screenplay does not belong to this project.');
    const screenplays = read<Record<string, ScreenplayRecord>>(KEYS.screenplays, {}); const saved = { ...normalizeSceneHeadings(screenplay), updatedAt: new Date().toISOString() };
    screenplays[saved.id] = saved; write(KEYS.screenplays, screenplays); return saved;
  },
  async saveOwnerConfig(config) { write(KEYS.owner, config); return config; },
  async savePreferences(preferences) { write(KEYS.preferences, preferences); return preferences; }
};
