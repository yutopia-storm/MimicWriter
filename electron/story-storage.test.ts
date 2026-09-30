import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { FileProjectRepository, initializeStorageRoot } from './storage';

it('migrates pre-story projects additively, persists across restart and snapshots all story relationships', async () => {
  const root = await mkdtemp(join(tmpdir(), 'story-model-'));
  try {
    await initializeStorageRoot(root);
    const repository = new FileProjectRepository(root);
    const project = await repository.create('Existing project', 'feature');
    const projectPath = join(root, 'Projects', project.id, 'project.json');
    const original = await readFile(projectPath, 'utf8');
    const workspace = await repository.openWorkspace(project.id);
    expect(await readFile(projectPath, 'utf8')).toBe(original);
    const story = workspace.story!;
    story.characters.push({ id: 'apple', name: 'Apple', description: '' });
    story.plots.push({ id: 'a', name: 'A', description: '', color: 'accent' });
    story.scenes.push({ sceneId: workspace.screenplays[0].scenes[0].id, screenplayId: workspace.screenplays[0].id, plotIds: ['a'], presentIds: ['apple'], chronology: { day: 3 } });
    story.events.push({ id: 'event', name: 'Disappears', description: '', occursInSceneId: workspace.screenplays[0].scenes[0].id });
    await repository.saveStory(project.id, story);
    await repository.saveScreenplay(project.id, workspace.screenplays[0]);
    const reopened = await new FileProjectRepository(root).openWorkspace(project.id);
    expect(reopened.story).toEqual(story);
    expect(reopened.screenplays[0]).toMatchObject({ scenes: workspace.screenplays[0].scenes });
    await repository.snapshot(project, 'story-test');
    const files = await readdir(join(root, 'Backups', project.id));
    const snapshot = JSON.parse(await readFile(join(root, 'Backups', project.id, files.find(name => name.endsWith('story-test.json'))!), 'utf8'));
    expect(snapshot.story).toEqual(story);
    expect(files.some(name => name.endsWith('-story.json'))).toBe(true);
    await expect(repository.saveStory(project.id, { ...story, projectId: 'wrong' })).rejects.toThrow();
    expect((await repository.openWorkspace(project.id)).story).toEqual(story);
  } finally { await rm(root, { recursive: true, force: true }); }
});
