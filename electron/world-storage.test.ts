import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { FileProjectRepository, initializeStorageRoot } from './storage';
import { createWorld, packageWorld, copyWorld } from '../src/domain/worlds';
it('persists Library and independent Project Worlds across restart with separate recovery snapshots', async () => { const root = await mkdtemp(join(tmpdir(), 'world-storage-')); try {
    await initializeStorageRoot(root);
    const repo = new FileProjectRepository(root);
    const p = await repo.create('World test', 'feature');
    const workspace = await repo.openWorkspace(p.id);
    const master = packageWorld(createWorld('Master'), workspace.story!);
    await repo.saveLibraryWorld(master);
    const story = copyWorld(master, workspace.story!);
    story.worlds![0].name = 'Project version';
    await repo.saveStory(p.id, story);
    const restarted = new FileProjectRepository(root);
    expect((await restarted.listWorldLibrary())[0].world.name).toBe('Master');
    expect((await restarted.openWorkspace(p.id)).story?.worlds?.[0].name).toBe('Project version');
    expect(await readdir(join(root, 'Backups', 'Worlds'))).toHaveLength(1);
    expect(await readdir(join(root, 'Backups', p.id))).not.toHaveLength(0);
    await expect(repo.saveLibraryWorld({ ...master, format: 'invalid' } as never)).rejects.toThrow();
    expect((await restarted.listWorldLibrary())[0]).toEqual(master);
}
finally {
    await rm(root, { recursive: true, force: true });
} });
it('serializes concurrent Library writes from separate repository instances', async () => { const root = await mkdtemp(join(tmpdir(), 'world-concurrency-')); try {
    await initializeStorageRoot(root);
    const repo = new FileProjectRepository(root);
    const p = await repo.create('Test', 'feature');
    const story = (await repo.openWorkspace(p.id)).story!;
    const a = packageWorld(createWorld('A'), story), b = packageWorld(createWorld('B'), story);
    await Promise.all([repo.saveLibraryWorld(a), new FileProjectRepository(root).saveLibraryWorld(b)]);
    expect((await repo.listWorldLibrary()).map(p => p.world.name).sort()).toEqual(['A', 'B']);
}
finally {
    await rm(root, { recursive: true, force: true });
} });

it('Library deletion is serialized, persists on restart, and preserves independent Project copies', async()=>{
 const root=await mkdtemp(join(tmpdir(),'world-delete-'));try{
 await initializeStorageRoot(root);const repo=new FileProjectRepository(root), project=await repo.create('Deletion','feature'), story=(await repo.openWorkspace(project.id)).story!;
 const master=packageWorld(createWorld('Master'),story), other=packageWorld(createWorld('Other'),story);await repo.saveLibraryWorld(master);await repo.saveStory(project.id,copyWorld(master,story));
 await Promise.all([repo.deleteLibraryWorld(master.world.id),new FileProjectRepository(root).saveLibraryWorld(other)]);
 const restarted=new FileProjectRepository(root);expect((await restarted.listWorldLibrary()).map(p=>p.world.name)).toEqual(['Other']);expect((await restarted.openWorkspace(project.id)).story!.worlds![0].name).toBe('Master');expect(await readdir(join(root,'Backups','Worlds'))).toHaveLength(3);
 }finally{await rm(root,{recursive:true,force:true});}
});
