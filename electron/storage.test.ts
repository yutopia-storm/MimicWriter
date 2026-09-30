import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { FileProjectRepository, MANAGED_FOLDERS, initializeStorageRoot, validateStorageRoot } from './storage';

const roots: string[] = [];
async function temporaryRoot() { const path = await mkdtemp(join(tmpdir(), 'story-desktop-')); roots.push(path); return path; }
afterEach(async () => { await Promise.all(roots.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('desktop storage', () => {
  it('creates and validates the application-managed structure', async () => {
    const root = await temporaryRoot();
    const health = await initializeStorageRoot(root);
    expect(health).toMatchObject({ configured: true, available: true, writable: true });
    for (const folder of MANAGED_FOLDERS) expect((await validateStorageRoot(join(root, folder))).writable).toBe(true);
  });

  it('rejects a path that cannot be used as a directory', async () => {
    const root = await temporaryRoot(); const file = join(root, 'ordinary-file'); await writeFile(file, 'not a directory');
    expect((await validateStorageRoot(file)).writable).toBe(false);
  });

  it('persists Feature and Series projects with stable unique identities', async () => {
    const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root);
    const feature = await repository.create('The Last Signal', 'feature');
    const series = await repository.create('Northbound', 'series');
    const reopened = await new FileProjectRepository(root).list();
    expect(feature.id).not.toBe(series.id);
    expect(reopened.map((project) => project.id)).toEqual(expect.arrayContaining([feature.id, series.id]));
    expect(await new FileProjectRepository(root).get(feature.id)).toEqual(feature);
    expect(series.series?.id).toBeTruthy();
    expect(feature.schemaVersion).toBe(3);
    expect(feature.screenplayId).toBeTruthy();
    expect(series.series?.seasons).toHaveLength(1); expect(series.series?.seasons[0].episodes).toEqual([]);
    expect((await repository.openWorkspace(feature.id)).screenplays).toHaveLength(1);
    const revisionFiles = await (await import('node:fs/promises')).readdir(join(root, 'Projects', feature.id, 'Revisions', feature.screenplayId!));
    expect(revisionFiles).toHaveLength(1);
  });

  it('creates independent episode screenplays and persists screenplay edits', async () => {
    const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root);
    const series = await repository.create('Northbound', 'series');
    const seasonId = series.series!.seasons[0].id; await repository.createEpisode(series.id, seasonId, 'Pilot'); await repository.createEpisode(series.id, seasonId, 'Second Light');
    const workspace = await repository.openWorkspace(series.id);
    expect(workspace.project.series?.seasons[0].episodes.map((episode) => episode.title)).toEqual(['Pilot', 'Second Light']);
    expect(workspace.screenplays).toHaveLength(2);
    expect(workspace.screenplays[0].id).not.toBe(workspace.screenplays[1].id);
    const edited = { ...workspace.screenplays[0], scenes: workspace.screenplays[0].scenes.map((scene, index) => index ? scene : { ...scene, elements: scene.elements.map((element, elementIndex) => elementIndex ? element : { ...element, content: 'INT. STATION - NIGHT' }) }) };
    await repository.saveScreenplay(series.id, edited);
    expect((await new FileProjectRepository(root).openWorkspace(series.id)).screenplays[0].scenes[0].elements[0].content).toBe('INT. STATION - NIGHT');
    expect(workspace.screenplays[1].scenes[0].elements[0].content).toBe('');
  });

  it('migrates a Build 001 Feature project with a recoverable backup', async () => {
    const root = await temporaryRoot(); await initializeStorageRoot(root); const projectId = '11111111-1111-4111-8111-111111111111';
    const { mkdir } = await import('node:fs/promises'); await mkdir(join(root, 'Projects', projectId), { recursive: true });
    await writeFile(join(root, 'Projects', projectId, 'project.json'), JSON.stringify({ schemaVersion: 1, id: projectId, projectType: 'feature', title: 'Legacy Draft', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', metadata: { description: '' } }));
    const workspace = await new FileProjectRepository(root).openWorkspace(projectId);
    expect(workspace.project.schemaVersion).toBe(3);
    expect(workspace.screenplays).toHaveLength(1);
    const backups = await (await import('node:fs/promises')).readdir(join(root, 'Backups', projectId));
    expect(backups.some((file) => file.endsWith('-schema-v1.json'))).toBe(true);
  });

  it('rejects invalid screenplay saves without replacing valid persisted content', async () => {
    const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root);
    const project = await repository.create('Protected Draft', 'feature'); const workspace = await repository.openWorkspace(project.id);
    const original = workspace.screenplays[0];
    const invalid = { ...original, scenes: [{ ...original.scenes[0], order: 4 }] };
    await expect(repository.saveScreenplay(project.id, invalid)).rejects.toThrow(/not saved/);
    expect(await new FileProjectRepository(root).openWorkspace(project.id)).toEqual(workspace);
  });

  it('writes a separate initial metadata snapshot', async () => {
    const root = await temporaryRoot(); await initializeStorageRoot(root); const project = await new FileProjectRepository(root).create('Safe Draft', 'feature');
    const backupFolder = join(root, 'Backups', project.id);
    const { readdir } = await import('node:fs/promises'); const files = await readdir(backupFolder);
    expect(files).toHaveLength(1);
    expect(JSON.parse(await readFile(join(backupFolder, files[0]), 'utf8'))).toMatchObject({ backupType: 'metadata_snapshot', project: { id: project.id } });
  });

  it('creates Short projects as screenplay documents and reopens their content', async () => { const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root); const project = await repository.create('Small Hours', 'short'); expect(project).toMatchObject({ projectType: 'short', documentFormat: 'screenplay' }); const workspace = await repository.openWorkspace(project.id); expect(workspace.screenplays[0].screenplayType).toBe('short'); workspace.screenplays[0].scenes[0].elements[0].content = 'EXT. ROAD - NIGHT'; await repository.saveScreenplay(project.id, workspace.screenplays[0]); expect((await new FileProjectRepository(root).openWorkspace(project.id)).screenplays[0].scenes[0].elements[0].content).toBe('EXT. ROAD - NIGHT'); });

  it('reorders Series/Seasons and moves Episodes without changing identities or screenplay content', async () => { const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root); const project = await repository.create('Long Arc', 'series'); const firstSeasonId = project.series!.seasons[0].id; let workspace = await repository.createEpisode(project.id, firstSeasonId, 'Pilot'); const episode = workspace.project.series!.seasons[0].episodes[0]; const screenplay = workspace.screenplays[0]; screenplay.scenes[0].elements[0].content = 'INT. ARCHIVE - NIGHT'; await repository.saveScreenplay(project.id, screenplay); workspace = await repository.createSeason(project.id, 'Aftermath'); const secondSeasonId = workspace.project.series!.seasons[1].id; workspace = await repository.moveEpisode(project.id, episode.id, secondSeasonId, 0); expect(workspace.project.series!.seasons[1].episodes[0].id).toBe(episode.id); expect(workspace.screenplays.find((item) => item.id === screenplay.id)!.scenes[0].elements[0].content).toBe('INT. ARCHIVE - NIGHT'); const sceneId = screenplay.scenes[0].id; const elementId = screenplay.scenes[0].elements[0].id; workspace = await repository.reorderSeason(project.id, secondSeasonId, 0); expect(workspace.project.series!.seasons[0].id).toBe(secondSeasonId); expect(workspace.screenplays.find((item) => item.id === screenplay.id)!.scenes[0].id).toBe(sceneId); expect(workspace.screenplays.find((item) => item.id === screenplay.id)!.scenes[0].elements[0].id).toBe(elementId); });

  it('persists safe mixed project collections without owning projects', async () => { const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root); const feature = await repository.create('Film One', 'feature'); const short = await repository.create('Origins', 'short'); const series = await repository.create('Stories', 'series'); let collections = await repository.createCollection('Example Universe'); const id = collections[0].id; collections = await repository.setCollectionProject(id, feature.id, true); collections = await repository.setCollectionProject(id, short.id, true); collections = await repository.setCollectionProject(id, series.id, true); expect(collections[0].projectIds).toEqual([feature.id, short.id, series.id]); collections = await repository.reorderCollectionProject(id, series.id, 0); expect(collections[0].projectIds[0]).toBe(series.id); collections = await repository.setCollectionProject(id, feature.id, false); expect(await repository.get(feature.id)).toMatchObject({ id: feature.id }); await repository.deleteCollection(id); expect(await new FileProjectRepository(root).listCollections()).toEqual([]); expect((await repository.list()).map((project) => project.id)).toEqual(expect.arrayContaining([feature.id, short.id, series.id])); });

  it('migrates flat Build 002 Series deterministically into Series 1', async () => { const root = await temporaryRoot(); await initializeStorageRoot(root); const repository = new FileProjectRepository(root); const created = await repository.create('Legacy Series', 'series'); const projectId = created.id; const now = new Date().toISOString(); const episodeId = crypto.randomUUID(); const screenplay = (await import('../src/domain/screenplay')).createScreenplay({ projectId, title: 'Legacy Episode', screenplayType: 'episode', episodeId }, now); await writeFile(join(root, 'Projects', projectId, 'Screenplays', `${screenplay.id}.json`), JSON.stringify(screenplay)); await writeFile(join(root, 'Projects', projectId, 'project.json'), JSON.stringify({ schemaVersion: 2, id: projectId, projectType: 'series', title: 'Legacy Series', createdAt: now, updatedAt: now, metadata: { description: '' }, series: { id: created.series!.id, title: 'Legacy Series', episodes: [{ id: episodeId, title: 'Legacy Episode', order: 0, screenplayId: screenplay.id, createdAt: now, updatedAt: now }] } })); const first = await repository.openWorkspace(projectId); const seasonId = first.project.series!.seasons[0].id; const second = await new FileProjectRepository(root).openWorkspace(projectId); expect(second.project.series!.seasons[0].id).toBe(seasonId); expect(second.project.series!.seasons[0].episodes[0].id).toBe(episodeId); expect(second.screenplays[0].id).toBe(screenplay.id); expect(second.screenplays[0].scenes[0].id).toBe(screenplay.scenes[0].id); });
});
