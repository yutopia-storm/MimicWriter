import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile, rm, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './json-store';
import { ProjectHistory, stateRevision } from '../src/domain/project-history';
import { HISTORY_DEFAULTS, type HistoryPort, type WriterIdentity } from '../src/shared/project-history';
const queues = new Map<string, Promise<unknown>>(), sessionId = randomUUID();
export const FALLBACK_WRITER: WriterIdentity = { id: randomUUID(), deviceId: randomUUID(), displayName: 'You', color: '#e1a35f' };
export async function projectWrite<T>(directory: string, actor: WriterIdentity, task: () => Promise<T>): Promise<T> {
    const pending = (queues.get(directory) ?? Promise.resolve()).catch(() => { }).then(async () => {
        await mkdir(directory, { recursive: true });
        const members = await readJson<any>(join(directory, 'collaborators.json'), null);
        const control = members ?? await readJson<any>(join(directory, 'history', 'control.json'), null);
        if (control?.collaborators && !control.collaborators.some((c: any) => c.id === actor.id))
            throw Error('This project is read-only for this writer. Ask its owner for edit access.');
        const leaseFile = join(directory, 'editing-lease.json');
        const lease = { id: sessionId, actorId: actor.id, deviceId: actor.deviceId, displayName: actor.displayName, expiresAt: Date.now() + HISTORY_DEFAULTS.leaseMs };
        try {
            await writeFile(leaseFile, JSON.stringify(lease), { flag: 'wx' });
        }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
                throw error;
            const previous = await readJson<any>(leaseFile, null);
            if (previous && (previous.id !== sessionId || previous.actorId !== actor.id) && previous.expiresAt > Date.now())
                throw Error(previous.displayName + ' is editing this project. Your work remains open; try again after they finish.');
            if ((previous?.id !== sessionId || previous?.actorId !== actor.id)) {
                const recheck = await readJson<any>(leaseFile, null);
                if (recheck?.id !== previous?.id || recheck?.expiresAt !== previous?.expiresAt)
                    throw Error('The editing lease changed. Try again.');
                await rm(leaseFile, { force: true });
                try {
                    await writeFile(leaseFile, JSON.stringify(lease), { flag: 'wx' });
                }
                catch {
                    throw Error('Another writer acquired this project. Your work remains open.');
                }
            }
            else
                await writeJsonAtomic(leaseFile, lease);
        }
        return task();
    });
    queues.set(directory, pending);
    return pending;
}
export async function releaseProject(directory: string) {
    const file = join(directory, 'editing-lease.json'), lease = await readJson<any>(file, null);
    if (lease?.id === sessionId)
        await rm(file, { force: true });
}
export async function ensureExpected(directory: string, actor: WriterIdentity, previous: unknown, incoming: unknown, expected?: string) {
    if (expected && expected !== await stateRevision(previous)) {
        const id = randomUUID();
        await writeJsonAtomic(join(directory, 'conflicts', id + '.json'), { schemaVersion: 1, id, actorId: actor.id, createdAt: new Date().toISOString(), expectedRevision: expected, currentRevision: await stateRevision(previous), incoming, current: previous });
        throw Error('This project changed in another copy. Your edits were preserved in the project’s conflicts folder. Keep this view open and compare the copies before continuing.');
    }
}
const histories = new Map<string, ProjectHistory>();
export function fileHistory(directory: string, actor: WriterIdentity, projectId: string, workspace: HistoryPort['workspace'], apply: HistoryPort['apply']) {
    const key = directory + ':' + actor.id;
    let history = histories.get(key);
    if (!history) {
        history = new ProjectHistory({ read: (key, fallback) => {
                if (!/^(control|entries\/[A-Za-z0-9-]+|versions\/[A-Za-z0-9-]+|baselines\/[A-Za-z0-9-]+)$/.test(key))
                    throw Error('Invalid History reference.');
                return readJson(join(directory, 'history', key + '.json'), fallback);
            }, write: async (key, value) => {
                if (!/^(control|entries\/[A-Za-z0-9-]+|versions\/[A-Za-z0-9-]+|baselines\/[A-Za-z0-9-]+)$/.test(key))
                    throw Error('Invalid History reference.');
                if (key === 'control')
                    await writeJsonAtomic(join(directory, 'collaborators.json'), { schemaVersion: 1, collaborators: (value as any).collaborators });
                return writeJsonAtomic(join(directory, 'history', key + '.json'), value);
            }, workspace, apply }, actor, projectId);
        histories.set(key, history);
    }
    return history;
}
export async function historySafe(history: ProjectHistory, task: () => Promise<void>) {
    try {
        await task();
        history.warning = '';
    }
    catch {
        history.warning = 'Your current work is saved, but History could not be recorded. Keep the project open and check its storage.';
    }
}
export async function periodicProjectBackup(directory: string, workspace: unknown) {
    const stamp = await readJson<{
        createdAt: number;
    } | null>(join(directory, 'backups', 'latest.json'), null);
    if (stamp && Date.now() - stamp.createdAt < HISTORY_DEFAULTS.backupIntervalMs)
        return;
    const now = Date.now(), target = join(directory, 'backups', new Date(now).toISOString().replace(/[:.]/g, '-'));
    await mkdir(target, { recursive: true });
    await writeJsonAtomic(join(target, 'workspace.json'), workspace);
    const collaborators = await readJson(join(directory, 'collaborators.json'), null);
    if (collaborators)
        await writeJsonAtomic(join(target, 'collaborators.json'), collaborators);
    for (const part of ['assets', 'history', 'Versions', 'Revisions', 'conflicts'])
        if ((await readdir(join(directory, part)).catch(() => [])).length)
            await cp(join(directory, part), join(target, part), { recursive: true, errorOnExist: true });
    await writeJsonAtomic(join(directory, 'backups', 'latest.json'), { createdAt: now });
}
