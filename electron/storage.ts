import { parseWorldPackage } from '../src/domain/worlds';
import type { WorldPackage } from '../src/shared/worlds';
import { validateProfileImage } from '../src/shared/profile-assets';
import { z } from 'zod';
import { access, mkdir, readdir, rm, writeFile, readFile, copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { EpisodeRecord, ProjectCollection, ProjectRecord, ProjectType, ProjectWorkspace, ScreenplayRecord, SeasonRecord, StorageHealth } from '../src/shared/models';
import { allEpisodes, migrateProject, normalizeSeries, type StoredProjectRecord } from '../src/domain/project';
import { createScreenplay, validateScreenplay, normalizeSceneHeadings } from '../src/domain/screenplay';
import { readJson, writeJsonAtomic } from './json-store';
import { migrateStory } from '../src/domain/story';
import type { StoryRecord } from '../src/shared/story';

const worldLibraryWrites = new Map<string, Promise<unknown>>();

export const MANAGED_FOLDERS = ['Projects', 'Collections', 'Backups', 'Exports', 'References'] as const;

export async function validateStorageRoot(root: string | null): Promise<StorageHealth> {
  if (!root) return { configured: false, available: false, writable: false, path: null, message: 'Choose a folder to begin.' };
  try {
    await mkdir(root, { recursive: true });
    await access(root, constants.R_OK | constants.W_OK);
    const probe = join(root, `.write-test-${randomUUID()}`);
    await writeFile(probe, 'storage validation', { flag: 'wx' });
    await rm(probe);
    return { configured: true, available: true, writable: true, path: root, message: 'Storage is available and writable.' };
  } catch {
    return { configured: true, available: false, writable: false, path: root, message: 'The selected folder is unavailable or not writable.' };
  }
}

export async function initializeStorageRoot(root: string): Promise<StorageHealth> {
  const health = await validateStorageRoot(root);
  if (!health.writable) return health;
  for (const folder of MANAGED_FOLDERS) await mkdir(join(root, folder), { recursive: true });
  return health;
}

export class FileProjectRepository {
  constructor(private readonly root: string) {}
  private projectDir(id: string) { return join(this.root, 'Projects', id); }
  private projectFile(id: string) { return join(this.projectDir(id), 'project.json'); }
  private screenplaysDir(projectId: string) { return join(this.projectDir(projectId), 'Screenplays'); }
  private screenplayFile(projectId: string, screenplayId: string) { return join(this.screenplaysDir(projectId), `${screenplayId}.json`); }
  private revisionsDir(projectId: string, screenplayId: string) { return join(this.projectDir(projectId), 'Revisions', screenplayId); }
  private collectionsFile() { return join(this.root, 'Collections', 'collections.json'); }

  private async readAndMigrate(id: string): Promise<ProjectRecord> {
    const stored = await readJson<StoredProjectRecord | null>(this.projectFile(id), null);
    if (!stored) throw new Error('Project could not be found.');
    const migration = migrateProject(stored);
    if (!migration.migrated) return migration.project;
    const backupPath = join(this.root, 'Backups', id, `${new Date().toISOString().replace(/[:.]/g, '-')}-schema-v${migration.fromVersion}.json`);
    await writeJsonAtomic(backupPath, { backupType: 'pre_migration', createdAt: new Date().toISOString(), project: stored });
    for (const screenplay of migration.createdScreenplays) {
      await mkdir(this.screenplaysDir(id), { recursive: true });
      await writeJsonAtomic(this.screenplayFile(id, screenplay.id), screenplay);
      await this.writeInitialRevision(id, screenplay);
    }
    await writeJsonAtomic(this.projectFile(id), migration.project);
    return migration.project;
  }

  private async writeInitialRevision(projectId: string, screenplay: ScreenplayRecord) {
    const directory = this.revisionsDir(projectId, screenplay.id); await mkdir(directory, { recursive: true });
    await writeJsonAtomic(join(directory, `${screenplay.revision.currentRevisionId}.json`), {
      schemaVersion: 1, id: screenplay.revision.currentRevisionId, screenplayId: screenplay.id,
      parentRevisionId: null, origin: 'created', createdAt: screenplay.createdAt, contentSnapshot: screenplay
    });
  }

  async list(): Promise<ProjectRecord[]> {
    const projectsRoot = join(this.root, 'Projects');
    await mkdir(projectsRoot, { recursive: true });
    const entries = await readdir(projectsRoot, { withFileTypes: true });
    const projects = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
      try { return await this.readAndMigrate(entry.name); }
      catch { return null; }
    }));
    return projects.filter((project): project is ProjectRecord => project !== null).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<ProjectRecord> {
    return this.readAndMigrate(id);
  }

  async create(title: string, projectType: ProjectType): Promise<ProjectRecord> {
    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const screenplay = projectType !== 'series' ? createScreenplay({ projectId: id, title: title.trim(), screenplayType: projectType }, timestamp) : null;
    const season: SeasonRecord = { id: randomUUID(), order: 0, title: '', episodes: [], createdAt: timestamp, updatedAt: timestamp };
    const project: ProjectRecord = {
      schemaVersion: 3, id, projectType, documentFormat: 'screenplay', title: title.trim(), createdAt: timestamp, updatedAt: timestamp, metadata: { description: '' },
      ...(screenplay ? { screenplayId: screenplay.id } : { series: { id: randomUUID(), title: title.trim(), seasons: [season] } })
    };
    await mkdir(this.projectDir(id), { recursive: false });
    await mkdir(this.screenplaysDir(id), { recursive: true });
    if (screenplay) {
      await mkdir(this.screenplaysDir(id), { recursive: true });
      await writeJsonAtomic(this.screenplayFile(id, screenplay.id), screenplay);
      await this.writeInitialRevision(id, screenplay);
    }
    await writeJsonAtomic(this.projectFile(id), project);
    await this.snapshot(project, 'created');
    return project;
  }

  async openWorkspace(projectId: string): Promise<ProjectWorkspace> {
    const project = await this.get(projectId);
    const ids = project.projectType !== 'series' ? [project.screenplayId!] : allEpisodes(project).map((episode) => episode.screenplayId);
    const screenplays = await Promise.all(ids.map(async (id) => {
      const screenplay = await readJson<ScreenplayRecord | null>(this.screenplayFile(projectId, id), null);
      if (!screenplay) throw new Error(`Screenplay ${id} could not be found.`);
      const errors = validateScreenplay(screenplay); if (errors.length) throw new Error(`Screenplay data is invalid: ${errors.join(' ')}`);
      return screenplay;
    }));
    const file = join(this.projectDir(projectId), 'story.json');
    const stored = await readJson<StoryRecord | null>(file, null);
    const story = migrateStory(stored, projectId);
    if (!stored) await writeJsonAtomic(file, story);
    return { project, screenplays, story };
  }

  async createEpisode(projectId: string, seasonId: string, title: string): Promise<ProjectWorkspace> {
    const project = await this.get(projectId);
    if (project.projectType !== 'series' || !project.series) throw new Error('Episodes can only be added to Series projects.');
    const timestamp = new Date().toISOString(); const episodeId = randomUUID();
    const screenplay = createScreenplay({ projectId, title: title.trim(), screenplayType: 'episode', episodeId }, timestamp);
    const season = project.series.seasons.find((item) => item.id === seasonId); if (!season) throw new Error('Series/Season could not be found.');
    const episode: EpisodeRecord = { id: episodeId, title: title.trim(), order: season.episodes.length, screenplayId: screenplay.id, createdAt: timestamp, updatedAt: timestamp };
    await mkdir(this.screenplaysDir(projectId), { recursive: true });
    await writeJsonAtomic(this.screenplayFile(projectId, screenplay.id), screenplay);
    await this.writeInitialRevision(projectId, screenplay);
    const updated: ProjectRecord = { ...project, updatedAt: timestamp, series: { ...project.series, seasons: project.series.seasons.map((item) => item.id === seasonId ? { ...item, updatedAt: timestamp, episodes: [...item.episodes, episode] } : item) } };
    await writeJsonAtomic(this.projectFile(projectId), updated);
    return { ...(await this.openWorkspace(projectId)), project: updated };
  }

  async renameEpisode(projectId: string, episodeId: string, title: string): Promise<ProjectWorkspace> {
    const project = await this.get(projectId); const episode = allEpisodes(project).find((item) => item.id === episodeId);
    if (!project.series || !episode || !title.trim()) throw new Error('Episode could not be found or its title is empty.');
    const now = new Date().toISOString(); const screenplay = await readJson<ScreenplayRecord | null>(this.screenplayFile(projectId, episode.screenplayId), null);
    if (!screenplay) throw new Error('Episode screenplay could not be found.');
    await writeJsonAtomic(this.screenplayFile(projectId, screenplay.id), { ...screenplay, title: title.trim(), updatedAt: now });
    return this.writeProject({ ...project, updatedAt: now, series: { ...project.series, seasons: project.series.seasons.map((season) => ({ ...season, episodes: season.episodes.map((item) => item.id === episodeId ? { ...item, title: title.trim(), updatedAt: now } : item) })) } });
  }

  private async writeProject(project: ProjectRecord) { await writeJsonAtomic(this.projectFile(project.id), normalizeSeries(project)); return this.openWorkspace(project.id); }
  async createSeason(projectId: string, title = ''): Promise<ProjectWorkspace> { const project = await this.get(projectId); if (!project.series) throw new Error('Series/Seasons can only be added to Series projects.'); const now = new Date().toISOString(); const season: SeasonRecord = { id: randomUUID(), order: project.series.seasons.length, title: title.trim(), episodes: [], createdAt: now, updatedAt: now }; return this.writeProject({ ...project, updatedAt: now, series: { ...project.series, seasons: [...project.series.seasons, season] } }); }
  async renameSeason(projectId: string, seasonId: string, title: string): Promise<ProjectWorkspace> { const project = await this.get(projectId); if (!project.series?.seasons.some((season) => season.id === seasonId)) throw new Error('Series/Season could not be found.'); const now = new Date().toISOString(); return this.writeProject({ ...project, updatedAt: now, series: { ...project.series, seasons: project.series.seasons.map((season) => season.id === seasonId ? { ...season, title: title.trim(), updatedAt: now } : season) } }); }
  async reorderSeason(projectId: string, seasonId: string, targetIndex: number): Promise<ProjectWorkspace> { const project = await this.get(projectId); if (!project.series) throw new Error('Series project structure is missing.'); const seasons = [...project.series.seasons]; const source = seasons.findIndex((season) => season.id === seasonId); if (source < 0) throw new Error('Series/Season could not be found.'); const [season] = seasons.splice(source, 1); seasons.splice(Math.max(0, Math.min(targetIndex, seasons.length)), 0, season); return this.writeProject({ ...project, updatedAt: new Date().toISOString(), series: { ...project.series, seasons } }); }
  async moveEpisode(projectId: string, episodeId: string, targetSeasonId: string, targetIndex: number): Promise<ProjectWorkspace> { const project = await this.get(projectId); if (!project.series) throw new Error('Series project structure is missing.'); const sourceSeason = project.series.seasons.find((season) => season.episodes.some((episode) => episode.id === episodeId)); const targetSeason = project.series.seasons.find((season) => season.id === targetSeasonId); const episode = sourceSeason?.episodes.find((item) => item.id === episodeId); if (!sourceSeason || !targetSeason || !episode) throw new Error('Episode or target Series/Season could not be found.'); const seasons = project.series.seasons.map((season) => ({ ...season, episodes: season.episodes.filter((item) => item.id !== episodeId) })); const target = seasons.find((season) => season.id === targetSeasonId)!; target.episodes.splice(Math.max(0, Math.min(targetIndex, target.episodes.length)), 0, episode); return this.writeProject({ ...project, updatedAt: new Date().toISOString(), series: { ...project.series, seasons } }); }

  async deleteLibraryWorld(id: string): Promise<void> {
    if (typeof id !== 'string' || !id) throw new Error('World identifier is required.');
    const write = (worldLibraryWrites.get(this.root) ?? Promise.resolve()).catch(() => {}).then(async () => {
      const previous = await this.listWorldLibrary();
      await mkdir(join(this.root, 'Backups', 'Worlds'), { recursive: true });
      await writeJsonAtomic(join(this.root, 'Backups', 'Worlds', Date.now() + '-' + randomUUID() + '.json'), previous);
      await writeJsonAtomic(join(this.root, 'References', 'world-library.json'), previous.filter(p => p.world.id !== id));
    });
    worldLibraryWrites.set(this.root, write);
    try { await write; } finally { if (worldLibraryWrites.get(this.root) === write) worldLibraryWrites.delete(this.root); }
  }
  async listWorldLibrary(): Promise<WorldPackage[]> { return (await readJson<WorldPackage[]>(join(this.root, 'References', 'world-library.json'), [])).map(parseWorldPackage); }
  async saveLibraryWorld(value: WorldPackage): Promise<WorldPackage> {
    const p = parseWorldPackage(value);
    const write = (worldLibraryWrites.get(this.root) ?? Promise.resolve()).catch(() => {}).then(async () => {
      const previous = await this.listWorldLibrary();
      await mkdir(join(this.root, 'Backups', 'Worlds'), { recursive: true });
      await writeJsonAtomic(join(this.root, 'Backups', 'Worlds', Date.now() + '-' + randomUUID() + '.json'), previous);
      await writeJsonAtomic(join(this.root, 'References', 'world-library.json'), [...previous.filter(x => x.world.id !== p.world.id), p]);
      return p;
    });
    worldLibraryWrites.set(this.root, write);
    try { return await write; } finally { if (worldLibraryWrites.get(this.root) === write) worldLibraryWrites.delete(this.root); }
  }
  async listCollections(): Promise<ProjectCollection[]> { return readJson<ProjectCollection[]>(this.collectionsFile(), []); }
  private async saveCollections(collections: ProjectCollection[]) { await writeJsonAtomic(this.collectionsFile(), collections); return collections; }
  async createCollection(name: string) { const collections = await this.listCollections(); const now = new Date().toISOString(); return this.saveCollections([...collections, { schemaVersion: 1, id: randomUUID(), name: name.trim(), projectIds: [], createdAt: now, updatedAt: now }]); }
  async renameCollection(id: string, name: string) { const now = new Date().toISOString(); const collections = await this.listCollections(); if (!collections.some((item) => item.id === id)) throw new Error('Collection could not be found.'); return this.saveCollections(collections.map((item) => item.id === id ? { ...item, name: name.trim(), updatedAt: now } : item)); }
  async deleteCollection(id: string) { return this.saveCollections((await this.listCollections()).filter((item) => item.id !== id)); }
  async setCollectionProject(collectionId: string, projectId: string, included: boolean) { await this.get(projectId); const now = new Date().toISOString(); const collections = await this.listCollections(); return this.saveCollections(collections.map((item) => item.id !== collectionId ? item : { ...item, updatedAt: now, projectIds: included ? [...item.projectIds.filter((id) => id !== projectId), projectId] : item.projectIds.filter((id) => id !== projectId) })); }
  async reorderCollectionProject(collectionId: string, projectId: string, targetIndex: number) { const collections = await this.listCollections(); return this.saveCollections(collections.map((item) => { if (item.id !== collectionId) return item; const ids = item.projectIds.filter((id) => id !== projectId); ids.splice(Math.max(0, Math.min(targetIndex, ids.length)), 0, projectId); return { ...item, projectIds: ids, updatedAt: new Date().toISOString() }; })); }

  async saveScreenplay(projectId: string, screenplay: ScreenplayRecord): Promise<ScreenplayRecord> {
    const project = await this.get(projectId);
    const allowed = project.projectType !== 'series' ? project.screenplayId === screenplay.id : allEpisodes(project).some((episode) => episode.screenplayId === screenplay.id);
    if (!allowed || screenplay.projectId !== projectId) throw new Error('Screenplay does not belong to this project.');
    const normalized: ScreenplayRecord = { ...normalizeSceneHeadings(screenplay), updatedAt: new Date().toISOString() };
    const errors = validateScreenplay(normalized); if (errors.length) throw new Error(`Screenplay was not saved: ${errors.join(' ')}`);
    await writeJsonAtomic(this.screenplayFile(projectId, screenplay.id), normalized);
    await writeJsonAtomic(this.projectFile(projectId), { ...project, updatedAt: normalized.updatedAt });
    return normalized;
  }

  async snapshot(project: ProjectRecord, reason: string): Promise<void> {
    const directory = join(this.root, 'Backups', project.id);
    await mkdir(directory, { recursive: true });
    const file = join(directory, `${project.updatedAt.replace(/[:.]/g, '-')}-${reason}.json`);
    const story = migrateStory(await readJson(join(this.projectDir(project.id), 'story.json'), null), project.id);
    const assets = join(this.projectDir(project.id), 'assets');
    const backupAssets = join(this.root, 'Backups', project.id, 'assets');
    const assetFiles = await readdir(assets).catch(() => [] as string[]);
    if (assetFiles.length) { await mkdir(backupAssets, { recursive: true }); for (const name of assetFiles) await copyFile(join(assets, name), join(backupAssets, name)); }
    await writeJsonAtomic(file, { backupType: 'metadata_snapshot', reason, createdAt: new Date().toISOString(), project, story });
  }

  async importProjectImage(projectId: string, dataUrl: string): Promise<string> {
    await this.get(projectId);
    const image = validateProfileImage(dataUrl), assetId = randomUUID();
    const directory = join(this.projectDir(projectId), 'assets');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, assetId + '.bin'), image.bytes, { flag: 'wx' });
    await writeJsonAtomic(join(directory, assetId + '.json'), { mime: image.mime });
    return assetId;
  }
  async readProjectImage(projectId: string, assetId: string): Promise<string> {
    await this.get(projectId); z.string().uuid().parse(assetId);
    const directory = join(this.projectDir(projectId), 'assets');
    const metadata = await readJson<{ mime: string } | null>(join(directory, assetId + '.json'), null);
    if (!metadata) throw new Error('Image unavailable.');
    return 'data:' + metadata.mime + ';base64,' + (await readFile(join(directory, assetId + '.bin'))).toString('base64');
  }

  async saveStory(projectId: string, value: StoryRecord): Promise<StoryRecord> {
    await this.get(projectId);
    const story = migrateStory(value, projectId);
    const file = join(this.projectDir(projectId), 'story.json');
    const previous = await readJson<StoryRecord | null>(file, null);
    if (previous) {
      const directory = join(this.root, 'Backups', projectId);
      await mkdir(directory, { recursive: true });
      await writeJsonAtomic(join(directory, `${Date.now()}-${randomUUID()}-story.json`), { backupType: 'story_snapshot', story: previous });
    }
    await writeJsonAtomic(file, story);
    return story;
  }
}
