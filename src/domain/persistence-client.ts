import type { DesktopApi } from '../shared/models';
/** A save queued during another save uses our last acknowledged head, never a fresh remote head. */
export function withPersistenceClient(base: DesktopApi): DesktopApi {
    const revisions = new Map<string, string>(), queues = new Map<string, Promise<unknown>>();
    const serial = <T>(projectId: string, task: () => Promise<T>): Promise<T> => { const next = (queues.get(projectId) ?? Promise.resolve()).catch(() => { }).then(task); queues.set(projectId, next); return next; };
    const remember = (w: import('../shared/models').ProjectWorkspace) => { for (const d of w.screenplays)
        if (d.storageRevision)
            revisions.set(w.project.id + ':' + d.id, d.storageRevision); if (w.story?.storageRevision)
        revisions.set(w.project.id + ':story', w.story.storageRevision); return w; };
    const structural: Partial<DesktopApi> = {};
    for (const key of ['createEpisode', 'renameEpisode', 'createSeason', 'renameSeason', 'reorderSeason', 'moveEpisode'] as const)
        (structural as any)[key] = async (...args: any[]) => { await flushProjectEdits(); return serial(args[0], async () => remember(await (base[key] as any)(...args))); };
    return { ...base, ...structural, openWorkspace: async (id) => remember(await base.openWorkspace(id)), saveScreenplay: (id, record, context) => serial(id, async () => { const key = id + ':' + record.id; const saved = await base.saveScreenplay(id, record, { ...context, expectedRevision: context?.expectedRevision ?? revisions.get(key) ?? record.storageRevision }); if (saved.storageRevision)
            revisions.set(key, saved.storageRevision); window.dispatchEvent(new Event('project-history-updated')); return saved; }), saveStory: (id, record, context) => serial(id, async () => { const key = id + ':story'; const saved = await base.saveStory(id, record, { ...context, expectedRevision: context?.expectedRevision ?? revisions.get(key) ?? record.storageRevision }); if (saved.storageRevision)
            revisions.set(key, saved.storageRevision); window.dispatchEvent(new Event('project-history-updated')); return saved; }), projectHistory: (id, request) => serial(id, async () => { const result = await base.projectHistory(id, request); if (result.workspace)
            remember(result.workspace); if (!['query', 'entry', 'compareVersion', 'heartbeat'].includes(request.action))
            window.dispatchEvent(new Event('project-history-updated')); return result; }) };
}
export async function flushProjectEdits() { const pending: Promise<unknown>[] = []; window.dispatchEvent(new CustomEvent('project-flush', { detail: pending })); await Promise.all(pending); }
