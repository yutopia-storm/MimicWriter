import { RuleEditor } from './RuleEditor';
import { EntityRules } from './EntityRules';
import { ScreenplaySourceDetails } from './ScreenplayCaptureContext';
import { ScreenplayStoryActions } from './ScreenplayStoryActions';
import { rememberWorldOptions } from '../domain/world-form-options';
import { WorldConfiguredFields, CanonicalWorldFields } from './WorldConfiguredFields';
import { membershipReporterIds } from '../domain/world-memberships';
import { matchingCharacters } from '../domain/world-memberships';
import { WorldDeleteDialog } from './WorldDeleteDialog';
import { deleteWorldData, type WorldDeleteTarget } from '../domain/world-delete';
import { WorldOrganisationMembers } from './WorldOrganisationMembers';
import { WorldOrganisationFields } from './WorldOrganisationFields';
import { isOrganisation, migrateWorldModel, diagramChildren } from '../domain/world-structure';
import { PointFields, RelationshipEditor } from './WorldRelationshipEditor';
import { OrganisationStructure } from './OrganisationStructure';
import { WorldCustomFields } from './WorldCustomFields';
import { WorldQuickReference } from './WorldQuickReference';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { StoryRecord, StoryEntity } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import { WORLD_CATEGORIES, type WorldRecord, type WorldRef, type WorldEntity, type WorldPoint, type WorldRelationship, type WorldKind, type WorldPackage, type WorldLinkContext, type WorldDiagram } from '../shared/worlds';
import { createWorld, worldEntities, refKey, resolveWorldRef, searchWorld, relationshipAt, linkCanonicalScene, canonicalWorldUsages, validateWorld, packageWorld, copyWorld, parseWorldPackage } from '../domain/worlds';
import { nextPlotColor } from '../shared/story-config';
export function WorldWorkspace({ story, documents, change, navigateScene, status, error, retry, libraryOnly = false, onCloseLibrary }: {
    story: StoryRecord;
    documents: ScreenplayRecord[];
    change(story: StoryRecord): void;
    navigateScene(id: string): void;
    status: string;
    error: string;
    retry(): void;
    libraryOnly?: boolean;
    onCloseLibrary?(): void;
}) {
    const [open, setOpen] = useState(libraryOnly), [worldId, setWorldId] = useState(''), [tab, setTab] = useState('overview'), [selected, setSelected] = useState<WorldRef>(), [query, setQuery] = useState(''), [selectedDiagram, setSelectedDiagram] = useState<string>(), [sort, setSort] = useState('name'), [includeArchived, setIncludeArchived] = useState(false), [pinnedOnly, setPinnedOnly] = useState(false), [at, setAt] = useState<WorldPoint>(), [library, setLibrary] = useState<WorldPackage[]>([]), [libraryMode, setLibraryMode] = useState(libraryOnly), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [context, setContext] = useState<WorldLinkContext>(), [newName, setNewName] = useState('');
    const [mount, setMount] = useState<{
        header: Element | null;
        footer: Element | null;
    }>({ header: null, footer: null });
    const focus = useRef<HTMLElement | null>(null), scroll = useRef(0), dialog = useRef<HTMLElement>(null);
    const [deleting, setDeleting] = useState<WorldDeleteTarget>();
    const libraryQueue = useRef(Promise.resolve());
    const libraryPending = useRef(new Map<string, WorldPackage>());
    const worlds = libraryMode ? library.map(p => p.world) : story.worlds ?? [];
    const world = worlds.find(w => w.id === worldId) ?? worlds[0];
    const pack = libraryMode ? library.find(p => p.world.id === world?.id) : undefined;
    const viewStory: StoryRecord = pack ? { schemaVersion: 1, projectId: story.projectId, characters: pack.characters, locations: pack.locations, events: [], plots: [], scenes: [], worlds: [pack.world] } : story;
    useEffect(() => { setMount({ header: document.querySelector('.writing-header'), footer: document.querySelector('.screenplay-statistics') }); }, []);
    const capture = () => { focus.current = document.activeElement as HTMLElement; scroll.current = document.querySelector('.screenplay-scroll')?.scrollTop ?? 0; };
    const closeNow = () => { if (libraryOnly)
        onCloseLibrary?.(); setOpen(false); setContext(undefined); requestAnimationFrame(() => { const el = document.querySelector('.screenplay-scroll'); if (el)
        el.scrollTop = scroll.current; focus.current?.focus({ preventScroll: true }); }); };
    const close = () => { if (libraryMode || libraryPending.current.size) {
        void libraryQueue.current.then(() => { if (!libraryPending.current.size)
            closeNow();
        else
            setNotice('Library changes need to be saved before closing.'); }).catch(e => setNotice('Library save failed: ' + String(e)));
    }
    else
        closeNow(); };
    useEffect(() => { const protect = (e: BeforeUnloadEvent) => { if (libraryPending.current.size) {
        e.preventDefault();
        e.returnValue = '';
    } }; window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect); }, []);
    const saveLibrarySnapshot = async (snapshot: WorldPackage) => { libraryPending.current.set(snapshot.world.id, snapshot); setLibrary(items => items.map(p => p.world.id === snapshot.world.id ? snapshot : p)); setBusy(true); libraryQueue.current = libraryQueue.current.catch(() => { }).then(async () => { await window.desktop.saveLibraryWorld(snapshot); if (libraryPending.current.get(snapshot.world.id) === snapshot)
        libraryPending.current.delete(snapshot.world.id); }); try {
        await libraryQueue.current;
        setNotice('Library World saved');
    }
    catch (e) {
        setNotice('Library save failed: ' + String(e));
    }
    finally {
        setBusy(false);
    } };
    const show = (id?: string, ref?: WorldRef, diagramId?: string) => { capture(); setLibraryMode(false); if (id)
        setWorldId(id); setSelected(ref); setSelectedDiagram(diagramId); setTab(diagramId || ['organisation','structure'].includes(ref?.kind ?? '') ? 'diagrams' : 'overview'); setOpen(true); };
    useEffect(() => { const link = (e: Event) => { capture(); const c = (e as CustomEvent<WorldLinkContext>).detail; setContext(c); setLibraryMode(false); setQuery(''); }; window.addEventListener('world-link-context', link); return () => window.removeEventListener('world-link-context', link); }, []);
    useEffect(() => { const result = (e: Event) => setNotice((e as CustomEvent<string>).detail); window.addEventListener('world-insert-result', result); return () => window.removeEventListener('world-insert-result', result); }, []);
    useEffect(() => { const reference = (event: Event) => { const d = (event as CustomEvent<{
        worldId: string;
        entity: WorldRef;
    }>).detail; show(d.worldId, d.entity); }; window.addEventListener('open-world-reference', reference); return () => window.removeEventListener('open-world-reference', reference); }, []);
    const loadLibrary = async () => { try {
        await libraryQueue.current;
        if (libraryPending.current.size) { setNotice('Retry the pending Library saves first.'); return; }
        setLibrary(await window.desktop.listWorldLibrary());
        setLibraryMode(true);
        setWorldId('');
        setSelected(undefined);
        setNotice('');
    }
    catch (e) {
        setNotice(String(e));
    } };
    useEffect(() => { if (libraryOnly)
        void loadLibrary(); }, [libraryOnly]);
    const commit = async (next: StoryRecord) => { if (!libraryMode) {
        change(next);
        return;
    } if (!world || !pack)
        return; setBusy(true); try {
        const w = next.worlds?.find(w => w.id === world.id);
        if (!w)
            return;
        await saveLibrarySnapshot(packageWorld(w, next, pack.assets));
    }
    catch (e) {
        setNotice(String(e));
    }
    finally {
        setBusy(false);
    } };
    const patchWorld = (next: WorldRecord) => { try {
        const normalized = migrateWorldModel({ ...viewStory, worlds: (viewStory.worlds ?? []).map(w => w.id === next.id ? next : w) });
        validateWorld(normalized.worlds!.find(w=>w.id===next.id)!, normalized, documents);
        void commit(normalized);
    }
    catch (e) {
        setNotice(String(e));
    } };
    const create = async () => { if (!newName.trim())
        return; const w = createWorld(newName); if (libraryMode) {
        try {
            const p = await window.desktop.saveLibraryWorld(packageWorld(w, { ...story, characters: [], locations: [] }));
            setLibrary(items => [...items, p]);
        }
        catch (e) {
            setNotice(String(e));
            return;
        }
    }
    else
        change({ ...story, worlds: [...story.worlds ?? [], w] }); setWorldId(w.id); setNewName(''); setSelected(undefined); };
    const addEntity = (kind: WorldKind, name: string) => {
        if (kind === 'structure') { setNotice('Create internal structures inside their Organisation.'); return; }
        if ((!world && !['character', 'location', 'event', 'plot'].includes(kind)) || !name.trim())
            return;
        if (kind === 'character' && matchingCharacters(viewStory,name).length) { setNotice('This name belongs to an existing Character. Use Link existing character or select the existing Character to link it.'); return; }
        const id = crypto.randomUUID(), entity = { id, name: name.trim(), description: '' };
        let next = viewStory;
        let w = world;
        if (kind === 'character') {
            next = { ...next, characters: [...next.characters, entity] };
            if (w)
                w = { ...w, characterIds: [...w.characterIds, id] };
        }
        else if (kind === 'location') {
            next = { ...next, locations: [...next.locations, entity] };
            if (w)
                w = { ...w, locationIds: [...w.locationIds, id] };
        }
        else if (kind === 'event')
            next = { ...next, events: [...next.events, { ...entity, contextOverrides: [], ...(context ? { occursInSceneId: context.sceneId } : {}) }] };
        else if (kind === 'plot')
            next = { ...next, plots: [...next.plots, { ...entity, color: nextPlotColor(next.plots) }] };
        else if (w && kind !== 'scene' && kind !== 'world')
            w = { ...w, entities: [...w.entities, { ...entity, kind, fields: kind === 'lore' ? { Type: 'Saying' } : {} }] };
        next = { ...next, worlds: w ? (next.worlds ?? []).map(x => x.id === w!.id ? w! : x) : next.worlds };
        const ref = { kind, id };
        void commit(next);
        setSelected(ref);
        setNewName('');
    };
    const pin = (ref?: WorldRef, diagramId?: string) => { if (!world)
        return; const pins = story.worldUi?.pins ?? []; const matches = (p: typeof pins[number]) => p.worldId === world.id && (ref ? p.entity && refKey(p.entity) === refKey(ref) : !p.entity) && p.diagramId === diagramId; change({ ...story, worldUi: { ...story.worldUi, pins: pins.some(matches) ? pins.filter(p => !matches(p)) : [...pins, { worldId: world.id, entity: ref, diagramId }] } }); };
    const isPinned = (ref: WorldRef) => (story.worldUi?.pins ?? []).some(p => p.worldId === world?.id && p.entity && refKey(p.entity) === refKey(ref));
    const collectPackage = async () => { if (!world)
        throw Error('Choose a World'); const p = pack ?? packageWorld(world, story); if (!pack) {
        const ids = new Set([...world.entities.flatMap(e => e.imageIds ?? []), ...[...p.characters, ...p.locations].flatMap(e => e.profile?.images?.map(i => i.assetId) ?? [])]);
        for (const id of ids)
            p.assets[id] = await window.desktop.readProjectImage(story.projectId, id);
    } return p; };
    const saveMaster = async () => { setBusy(true); try {
        const p = await collectPackage();
        const copied = copyWorld(p, { ...story, worlds: [], characters: [], locations: [] });
        await window.desktop.saveLibraryWorld(packageWorld(copied.worlds![0], copied, p.assets));
        setNotice('Independent master saved in World Library');
    }
    catch (e) {
        setNotice(String(e));
    }
    finally {
        setBusy(false);
    } };
    const importProject = async (p: WorldPackage) => { setBusy(true); try {
        const assets: Record<string, string> = {};
        for (const [id, data] of Object.entries(p.assets))
            assets[id] = await window.desktop.importProjectImage(story.projectId, data);
        const next = copyWorld(p, story, assets);
        change(next);
        setLibraryMode(false);
        setWorldId(next.worlds!.at(-1)!.id);
        setSelected(undefined);
        setNotice('Independent Project World created');
    }
    catch (e) {
        setNotice(String(e));
    }
    finally {
        setBusy(false);
    } };
    const exportWorld = async () => { setBusy(true); try {
        const p = await collectPackage();
        const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = p.world.name + '.world.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    catch (e) {
        setNotice(String(e));
    }
    finally {
        setBusy(false);
    } };
    const entity = world && selected ? resolveWorldRef(world, viewStory, selected) : undefined;
    const patchEntity = (patch: Partial<StoryEntity & WorldEntity> & {
        fields?: Record<string, string>;
        imageIds?: string[];
        aliases?: string[];
    }) => { if (!world || !selected)
        return; if (selected.kind === 'character' || selected.kind === 'location') {
        const key = selected.kind === 'character' ? 'characters' : 'locations';
        const nextWorld=rememberWorldOptions(world,selected.kind,{'Place type':patch.profile?.locationType??''});
        void commit({ ...viewStory, worlds:viewStory.worlds?.map(w=>w.id===world.id?nextWorld:w), [key]: viewStory[key].map(e => e.id === selected.id ? { ...e, ...patch } : e) });
    }
    else
        patchWorld({ ...rememberWorldOptions(world,selected.kind,patch.fields), entities: world.entities.map(e => e.id === selected.id ? { ...e, ...patch } : e) }); };
    const openRef = (ref: WorldRef) => { if (!libraryMode && (ref.kind === 'character' || ref.kind === 'location')) {
        setOpen(false);
        window.dispatchEvent(new CustomEvent('open-story-profile', { detail: { type: ref.kind, entityId: ref.id } }));
    }
    else if (['event', 'plot', 'scene'].includes(ref.kind)) {
        setOpen(false);
        window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: { type: ref.kind, entityId: ref.id } }));
    }
    else if (ref.kind === 'world') {
        setSelected(undefined);
        setTab('overview');
    }
    else
        setSelected(ref); };
    const structureOrganisation = selected?.kind === 'organisation' ? world?.entities.find(e=>e.id===selected.id && isOrganisation(e)) : selected?.kind === 'structure' ? world?.entities.find(e=>e.id===world.entities.find(e=>e.id===selected.id)?.organisationId) : undefined;
    const footer = <div className="world-footer"><button onMouseDown={e => e.preventDefault()} onClick={() => show()}>Worlds</button>{(story.worldUi?.pins ?? []).map((p, i) => { const w = story.worlds?.find(w => w.id === p.worldId); if (!w)
        return null; const pinnedEntity = p.entity ? w.entities.find(e => e.id === p.entity!.id) : undefined; const name = p.entity ? pinnedEntity?.abbreviation?.trim() || resolveWorldRef(w, story, p.entity)?.name : p.diagramId ? w.diagrams.find(d => d.id === p.diagramId)?.name : w.name; return name ? <button title={p.entity ? resolveWorldRef(w, story, p.entity)?.name : name} key={i} onMouseDown={e => e.preventDefault()} onClick={() => show(w.id, p.entity, p.diagramId)}>{name}</button> : null; })}<label><input type="checkbox" checked={story.worldUi?.showLinks ?? false} onChange={e => change({ ...story, worldUi: { pins: story.worldUi?.pins ?? [], showLinks: e.target.checked } })}/>Show World links</label></div>;
    const performDelete = async (choice?: import('../domain/world-delete').ChildDisposition) => {
        if (!world || !deleting) return;
        const next = deleteWorldData(viewStory, world.id, deleting, choice);
        for (const w of next.worlds ?? []) validateWorld(w, next, documents);
        if (libraryMode && deleting.kind === 'world') {
            setBusy(true);
            try {
                await libraryQueue.current.catch(() => {});
                await window.desktop.deleteLibraryWorld(world.id);
                libraryPending.current.delete(world.id);
                setLibrary(items => items.filter(p => p.world.id !== world.id));
            } finally { setBusy(false); }
        } else if (libraryMode && pack) {
            const snapshot = packageWorld(next.worlds!.find(w => w.id === world.id)!, next, pack.assets);
            await saveLibrarySnapshot(snapshot);
            if (libraryPending.current.has(world.id)) throw new Error('Library deletion has not been saved. Retry the Library save.');
        } else {
            window.dispatchEvent(new Event('world-permanent-delete'));
            change(next);
        }
        setDeleting(undefined); setSelected(undefined); setSelectedDiagram(undefined);
        if (deleting.kind === 'world') setWorldId('');
    };
    return <>{deleting && world && <WorldDeleteDialog story={viewStory} world={world} target={deleting} library={libraryMode} cancel={() => setDeleting(undefined)} confirm={performDelete}/>}<WorldQuickReference story={story} documents={documents} hidden={open || Boolean(context)}/>{mount.header && createPortal(<button className="layout-button" onMouseDown={e => e.preventDefault()} onClick={() => show()}>Worlds</button>, mount.header)}{mount.footer && createPortal(footer, mount.footer)}
  {context && <ScreenplayStoryActions key={context.sceneId + context.x + context.y} story={story} documents={documents} context={context} currentWorldId={world?.id} change={change} close={close} open={show}/>}
  {open && <div className="world-backdrop"><section ref={dialog} className="world-workspace" role="dialog" aria-modal="true" aria-label="Worlds workspace" onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape')
            close(); if (e.key === 'Tab') {
            const nodes = [...dialog.current?.querySelectorAll<HTMLElement>('button,input,textarea,select,summary') ?? []].filter(n => !n.hasAttribute('disabled') && n.getClientRects().length);
            if (e.shiftKey && document.activeElement === nodes[0]) {
                e.preventDefault();
                nodes.at(-1)?.focus();
            }
            else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
                e.preventDefault();
                nodes[0]?.focus();
            }
        } }}>
    <header><div><h2>Worlds</h2><small>{libraryMode ? 'Reusable master Worlds' : 'Independent Project Worlds'} · {libraryMode ? (busy ? 'Saving…' : libraryPending.current.size ? 'Unsaved Library changes' : 'Library') : status}</small></div><button onClick={close}>Close Worlds</button></header>{(notice || error) && <p role={error ? 'alert' : 'status'}>{notice || error}{libraryPending.current.size > 0 && <button onClick={() => { for (const pending of libraryPending.current.values()) void saveLibrarySnapshot(pending); }}>Retry Library save</button>}{error && <button onClick={retry}>Retry save</button>}</p>}
    <div className="world-toolbar">{!libraryOnly && <button className={!libraryMode ? 'active' : ''} onClick={() => { setLibraryMode(false); setWorldId(''); setSelected(undefined); }}>Project Worlds</button>}<button className={libraryMode ? 'active' : ''} onClick={() => void loadLibrary()}>World Library</button><select aria-label="Current World" value={world?.id ?? ''} onChange={e => { setWorldId(e.target.value); setSelected(undefined); }}>{worlds.filter(w => !w.archived || includeArchived || w.id === world?.id).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><label><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)}/>Include archived Worlds</label><input aria-label="New World name" placeholder="New World name" value={newName} onChange={e => setNewName(e.target.value)}/><button disabled={busy || !newName.trim()} onClick={() => void create()}>Create World</button><label className="world-file">Import World file<input type="file" accept=".json" onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
            return; try {
            const p = parseWorldPackage(JSON.parse(await file.text()));
            if (libraryMode) {
                const cloned = copyWorld(p, { ...story, worlds: [], characters: [], locations: [] });
                await window.desktop.saveLibraryWorld(packageWorld(cloned.worlds![0], cloned, p.assets));
                await loadLibrary();
            }
            else
                await importProject(p);
        }
        catch (err) {
            setNotice(String(err));
        } e.target.value = ''; }}/></label></div>
    {!world ? <p>Create a World or copy a reusable master from World Library.</p> : <><nav className="world-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Overview</button>{WORLD_CATEGORIES.map(c => <button key={c.kind} className={tab === c.kind ? 'active' : ''} onClick={() => { setTab(c.kind); setSelected(undefined); }}>{c.label}</button>)}<button className={tab === 'diagrams' ? 'active' : ''} onClick={() => setTab('diagrams')}>Diagrams</button></nav>
    <div className="world-body"><div className="world-main">
    {tab === 'organisation' && structureOrganisation ? <><button onClick={()=>setSelected(undefined)}>← All Organisations</button><TemporalControl at={at} setAt={setAt} story={viewStory} documents={documents}/><OrganisationStructure key={'editor:'+structureOrganisation.id} world={world} story={viewStory} documents={documents} selected={{kind:'organisation',id:structureOrganisation.id}} at={at} patch={patchWorld} open={openRef} remove={ref=>setDeleting({kind:'entity',ref})}/></> : tab === 'overview' ? <><label>World name<input value={world.name} onChange={e => { if (e.target.value.trim())
                    patchWorld({ ...world, name: e.target.value }); }}/></label><label>Description<textarea value={world.description} onChange={e => patchWorld({ ...world, description: e.target.value })}/></label><p>{worldEntities(world, viewStory).filter(e => !e.archived).length} entries · {world.relationships.length} relationships</p><div className="world-toolbar">{libraryMode && !libraryOnly ? <button disabled={busy} onClick={() => pack && void importProject(pack)}>Copy into this project</button> : !libraryMode ? <><button disabled={busy} onClick={() => void saveMaster()}>Save independent master to Library</button><button onClick={() => pin()}>Pin World</button></> : null}<button disabled={busy} onClick={() => void exportWorld()}>Export World</button><button onClick={() => patchWorld({ ...world, archived: !world.archived })}>{world.archived ? 'Restore World' : 'Archive World (keep history)'}</button><button className="world-delete-button" disabled={busy} onClick={() => setDeleting({ kind: 'world' })}>Delete World…</button></div>{world.provenance && <small>This copy keeps a record of its source. Changes are not shared automatically.</small>}<h3>Find in this World</h3><input aria-label="Search World" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search names, aliases, descriptions, wording and meaning"/>{query && searchWorld(world, viewStory, query, includeArchived).map(e => <button className="world-result" key={e.id} onClick={() => setSelected({ kind: e.kind, id: e.id })}>{e.name}<small>{e.kind}</small></button>)}</> : tab === 'diagrams' ? <><TemporalControl at={at} setAt={setAt} story={viewStory} documents={documents}/><WorldDiagramView initialViewId={selectedDiagram} world={world} story={viewStory} documents={documents} at={at} selected={selected} open={openRef} patch={patchWorld} pin={id => pin(undefined, id)} remove={id => setDeleting({kind: 'diagram', id})}/></> : <>
    <div className="world-toolbar"><input aria-label="Search World entities" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search this category"/><select aria-label="Sort World entities" value={sort} onChange={e => setSort(e.target.value)}><option value="name">Name A–Z</option><option value="reverse">Name Z–A</option></select><label><input type="checkbox" checked={includeArchived} onChange={e => setIncludeArchived(e.target.checked)}/>Include archived</label><label><input type="checkbox" checked={pinnedOnly} onChange={e => setPinnedOnly(e.target.checked)}/>Pinned only</label></div>
    <div className="world-create"><input aria-label="New entity name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name"/><button disabled={!newName.trim()} onClick={() => addEntity(tab as WorldKind, newName)}>+ Create {WORLD_CATEGORIES.find(c => c.kind === tab)?.label}</button></div>
    {(tab === 'character' || tab === 'location') && <label>Link existing {tab}<select value="" onChange={e => { const id = e.target.value; if (id)
                    patchWorld(tab === 'character' ? { ...world, characterIds: [...world.characterIds, id] } : { ...world, locationIds: [...world.locationIds, id] }); }}><option value="">Choose existing…</option>{viewStory[tab === 'character' ? 'characters' : 'locations'].filter(e => !(tab === 'character' ? world.characterIds : world.locationIds).includes(e.id) && !e.archived).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}
    <div className="world-results">{searchWorld(world, viewStory, query, includeArchived).filter(e => (e.kind === tab || tab === 'organisation' && query.trim() && e.kind === 'structure') && (!pinnedOnly || isPinned(e))).sort((a, b) => (sort === 'reverse' ? -1 : 1) * a.name.localeCompare(b.name)).map(e => <div key={e.id} className="world-result"><button onClick={() => setSelected({ kind: e.kind, id: e.id })}><b>{e.name}</b><small>{e.kind === 'structure' ? (world.entities.find(x=>x.id===e.id)?.structureType ?? 'Unit') + ' · ' + (world.entities.find(x=>x.id===world.entities.find(x=>x.id===e.id)?.organisationId)?.name ?? 'Organisation unavailable') : e.description.slice(0, 150)}</small></button>{!libraryMode && <button onClick={() => pin(e)}>{isPinned(e) ? 'Unpin' : 'Pin'}</button>}</div>)}</div></>}
    </div>{entity && selected && <aside className="world-detail"><header><h3>{entity.name}</h3><button onClick={() => setSelected(undefined)}>×</button></header><small>{WORLD_CATEGORIES.find(c=>c.kind===selected.kind)?.label??(selected.kind==='structure'?'Internal unit':selected.kind==='rank'?'Rank':'Position')}</small><div className="world-toolbar"><button onClick={() => patchEntity({ archived: !entity.archived })}>{entity.archived ? 'Restore entry' : 'Archive entry (keep history)'}</button><button className="world-delete-button" disabled={busy} onClick={() => setDeleting({kind: 'entity', ref: selected})}>Delete…</button></div>{!libraryMode && <button onClick={() => pin(selected)}>{isPinned(selected) ? 'Unpin' : 'Pin to screenplay'}</button>}
    {(selected.kind === 'character' || selected.kind === 'location') && <button onClick={() => openRef(selected)}>Open existing {selected.kind} profile</button>}
    {selected.kind!=='rule'&&<><label>{selected.kind==='note'?'Title':selected.kind==='vehicle'?'Name / identifier':'Name'}<input value={entity.name} onChange={e => { if (e.target.value.trim())
                    patchEntity({ name: e.target.value }); }}/></label><label>{selected.kind === 'note' ? 'Note' : selected.kind==='character'?'Role / short description':selected.kind==='lore'?'Meaning / description':'Description'}<textarea value={entity.description} onChange={e => patchEntity({ description: e.target.value })}/></label></>}
    {selected.kind==='rule'&&<RuleEditor key={'rule:'+selected.id} story={viewStory} documents={documents} worldId={world.id} entity={world.entities.find(e=>e.id===selected.id)} at={at} change={next=>patchWorld(next.worlds!.find(w=>w.id===world.id)!)} done={()=>setSelected(undefined)}/>}
    {selected.kind!=='rule'&&world.entities.some(e=>e.id===selected.id) && <WorldOrganisationFields key={'organisation-fields:'+selected.id} entity={world.entities.find(e=>e.id===selected.id)!} world={world} story={viewStory} documents={documents} at={at} patch={patchEntity} patchWorld={patchWorld} open={openRef} convert={ownerId=>{const next={...world,entities:world.entities.map(e=>e.id===selected.id?{...e,kind:'structure' as const,organisationId:ownerId,structureType:'Unit',organisationRole:undefined}:e)};try{const normalized=migrateWorldModel({...viewStory,worlds:[next]}).worlds![0];validateWorld(normalized,viewStory,documents);patchWorld(normalized);setSelected({kind:'structure',id:selected.id});setTab('organisation');}catch(e){setNotice(String(e));}}}/>}
    {(selected.kind==='character'||selected.kind==='location')&&<><CanonicalWorldFields kind={selected.kind} entity={entity} story={viewStory} patch={patchEntity}/><details><summary>Reference images</summary><label>Reference images<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const data=await readImage(file);const id=pack?crypto.randomUUID():await window.desktop.importProjectImage(story.projectId,data);const profile={...entity.profile,images:[...entity.profile?.images??[],{id:crypto.randomUUID(),assetId:id,label:file.name,notes:''}]};if(pack){const key=selected.kind==='character'?'characters':'locations';await saveLibrarySnapshot(packageWorld(world,{...viewStory,[key]:viewStory[key].map(item=>item.id===entity.id?{...item,profile}:item)},{...pack.assets,[id]:data}));}else patchEntity({profile});}catch(reason){setNotice(String(reason));}}}/></label>{entity.profile?.images?.map(image=><div key={image.id}><WorldImage id={image.assetId} projectId={story.projectId} data={pack?.assets[image.assetId]}/><button onClick={()=>patchEntity({profile:{...entity.profile,images:entity.profile?.images?.filter(i=>i.id!==image.id)}})}>Remove image reference</button></div>)}</details></>}
    <WorldEntityFields at={at} key={"fields:" + selected.id} entity={world.entities.find(e => e.id === selected.id)} world={world} story={viewStory} documents={documents} patch={patchEntity} projectId={story.projectId} pack={pack} onImage={async (data) => { if (pack) {
                    const id = crypto.randomUUID();
                    const w = { ...world, entities: world.entities.map(x => x.id === entity.id ? { ...x, imageIds: [...x.imageIds ?? [], id] } : x) };
                    const p = packageWorld(w, viewStory, { ...pack.assets, [id]: data });
                    await saveLibrarySnapshot(p);
                }
                else {
                    const id = await window.desktop.importProjectImage(story.projectId, data);
                    patchEntity({ imageIds: [...world.entities.find(e => e.id === entity.id)?.imageIds ?? [], id] });
                } }} insert={libraryMode ? undefined : (text, type) => window.dispatchEvent(new CustomEvent('world-insert-text', { detail: { text, type } }))}/>
    {['organisation','structure'].includes(selected.kind) && <><button onClick={e=>{const aside=e.currentTarget.closest('aside'), members=aside?.querySelector('.organisation-members');if(aside&&members)aside.scrollTop+=members.getBoundingClientRect().top-aside.getBoundingClientRect().top;}}>People / Members</button><button onClick={()=>setTab('organisation')}>Open Structure</button><button onClick={()=>{setTab('diagrams');setSelectedDiagram(undefined);}}>Show Organisation diagram</button></>}
    {['organisation','structure'].includes(selected.kind) && <WorldOrganisationMembers key={world.id+selected.id} story={viewStory} world={world} documents={documents} selected={selected} at={at} change={next=>void commit(next)} patch={patchWorld} open={openRef} remove={id=>setDeleting({kind:'relationship',id})} library={libraryMode}/>}
    {selected.kind!=='rule'&&<EntityRules story={viewStory} documents={documents} entity={selected} at={at} change={next=>patchWorld(next.worlds!.find(w=>w.id===world.id)!)}/>}
    <RelationshipEditor world={world} story={viewStory} documents={documents} selected={selected} at={at} patch={patchWorld} open={openRef} remove={id => setDeleting({kind: 'relationship',id})}/>
    {!libraryMode && <><h4>Screenplay references</h4>{canonicalWorldUsages(story, selected, documents).map(usage => { const d = documents.find(d => d.id === usage.screenplayId), index = d?.scenes.findIndex(s => s.id === usage.sceneId) ?? -1; return <div key={'canonical:' + usage.sceneId}><button disabled={index < 0} onClick={() => { close(); navigateScene(usage.sceneId); }}>{d?.title ?? 'Removed screenplay'} · {index >= 0 ? 'Scene ' + (index + 1) : 'Removed scene'} · Story link</button><button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent('edit-story-entity', { detail: { type: selected.kind === 'event' ? 'event' : 'scene', entityId: selected.kind === 'event' ? selected.id : usage.sceneId } })); }}>Edit story link</button></div>; })}{(story.worldOccurrences ?? []).filter(o => o.worldId === world.id && refKey(o.entity) === refKey(selected)).map(o => { const d = documents.find(d => d.id === o.screenplayId), s = d?.scenes.find(s => s.id === o.sceneId); return <div key={o.id}><button disabled={!s} onClick={() => { close(); navigateScene(o.sceneId); if (o.from)
                    setTimeout(() => window.dispatchEvent(new CustomEvent('world-navigate-occurrence', { detail: o })), 100); }}>{d?.title ?? 'Removed screenplay'} · {s ? `Scene ${(d?.scenes.indexOf(s) ?? 0) + 1}` : 'Removed scene'} · {o.source ? 'Established here' : o.scope === 'text' ? 'Selected text' + (o.needsReview ? ' · anchor needs review' : '') : 'Scene link'}<small>{o.selectedText}</small><ScreenplaySourceDetails source={o.source} story={story}/></button><button onClick={() => change({ ...story, worldOccurrences: story.worldOccurrences?.filter(x => x.id !== o.id) })}>{o.source?'Remove source reference':'Unlink'}</button></div>; })}</>}
    </aside>}</div></>}
  </section></div>}</>;
}
function TemporalControl({ at, setAt, story, documents }: {
    at?: WorldPoint;
    setAt(p?: WorldPoint): void;
    story: StoryRecord;
    documents: ScreenplayRecord[];
}) { return <PointFields label="View story point" mode="view" value={at} onChange={setAt} documents={documents} story={story}/>; }
function WorldDiagramView({ world, story, documents, at, selected, open, patch, pin, initialViewId, remove }: {
    world: WorldRecord;
    story: StoryRecord;
    documents: ScreenplayRecord[];
    at?: WorldPoint;
    selected?: WorldRef;
    open(r: WorldRef): void;
    patch(w: WorldRecord): void;
    pin(id: string): void;
    remove(id: string): void;
    initialViewId?: string;
}) {
    const [viewId, setViewId] = useState(initialViewId ?? ''), [collapsed, setCollapsed] = useState<Set<string>>(new Set()), [zoom, setZoom] = useState(1), [kind, setKind] = useState('all'), [rootId, setRootId] = useState(''), [viewName, setViewName] = useState('Organisation');
    const canvas = useRef<HTMLDivElement>(null);
    const pan = useRef<{
        x: number;
        y: number;
        left: number;
        top: number;
    } | undefined>(undefined);
    const view = world.diagrams.find(d => d.id === viewId);
    useEffect(() => { setViewName(view?.name ?? 'Organisation'); setCollapsed(new Set(view?.collapsedIds ?? [])); setRootId(view?.root && ['organisation','structure'].includes(view.root.kind) ? view.root.id : (selected && ['organisation','structure'].includes(selected.kind) ? selected.id : '')); setKind(view?.kinds?.[0] ?? 'all'); }, [viewId, world.id, world.diagrams]);
    const all = worldEntities(world, story).filter(e => !e.archived);
    const relationships = world.relationships.filter(r => relationshipAt(r, at, story, documents) === 'active' && (!view?.relationshipTypes?.length || view.relationshipTypes.includes(r.type)));
    const organisations = all.filter(e => e.kind === 'organisation');
    const hierarchy = relationships.filter(r => r.type === 'part of' && r.from.kind === 'organisation' && r.to.kind === 'organisation');
    const roots = rootId ? all.filter(e => e.id === rootId && ['organisation','structure'].includes(e.kind)) : organisations.filter(e => !hierarchy.some(r => r.from.id === e.id));
    const command = viewId === '__command' || view?.mode === 'command';
    const children = (ref: WorldRef) => diagramChildren(world,story,documents,at,ref,command,kind,view?.relationshipTypes);
    const node = (ref: WorldRef, path: Set<string>, relation?: WorldRelationship): ReactNode => { const key = refKey(ref); if (path.has(key))
        return null; const e = resolveWorldRef(world, story, ref); if (!e || e.archived)
        return null; const next = new Set(path); next.add(key); const branches = children(ref).filter(x => !next.has(refKey(x.ref))); return <li key={relation?.id ?? key}><div className="world-diagram-node" data-world-key={key}><button aria-label={`${collapsed.has(key) ? 'Expand' : 'Collapse'} ${e.name}`} disabled={!branches.length} onClick={() => setCollapsed(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })}>{branches.length ? (collapsed.has(key) ? '▸' : '▾') : '·'}</button><button onClick={() => open(ref)}><b>{e.name}</b><small>{ref.kind === 'structure' ? (world.entities.find(x=>x.id===ref.id)?.structureType ?? 'Unit') : ref.kind}{relation?.rankId ? ' · ' + world.entities.find(e => e.id === relation.rankId)?.name : ''}{relation?.positionId ? ' · ' + world.entities.find(e => e.id === relation.positionId)?.name : ''}{relation && membershipReporterIds(world,story,relation,documents,at).length ? ' · Reports to ' + membershipReporterIds(world,story,relation,documents,at).map(id=>story.characters.find(e=>e.id===id)?.name).filter(Boolean).join(', ') : ''}</small></button></div>{!collapsed.has(key) && branches.length > 0 && [...new Set(branches.map(x=>x.ref.kind==='structure' ? world.entities.find(e=>e.id===x.ref.id)?.hierarchyLevel ?? 'peers' : 'other'))].map(group=><ul key={group} data-structure-level={group}>{branches.filter(x=>(x.ref.kind==='structure' ? world.entities.find(e=>e.id===x.ref.id)?.hierarchyLevel ?? 'peers' : 'other')===group).map(x => node(x.ref, next, x.r))}</ul>)}</li>; };
    const save = () => { const name = viewName; if (!name.trim())
        return; const d: WorldDiagram = { id: view?.id ?? crypto.randomUUID(), name: name.trim(), mode: command ? 'command' : 'organisation', root: rootId ? { kind: all.find(e=>e.id===rootId)?.kind ?? 'organisation', id: rootId } : undefined, kinds: kind === 'all' ? undefined : [kind as WorldKind], collapsedIds: [...collapsed] }; patch({ ...world, diagrams: [...world.diagrams.filter(x => x.id !== d.id), d] }); setViewId(d.id); };
    return <><div className="world-toolbar"><select aria-label="Diagram view" value={viewId} onChange={e => setViewId(e.target.value)}><option value="">Full Organisation</option><option value="__command">Command Hierarchy</option>{world.diagrams.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select><select aria-label="Diagram root" value={rootId} onChange={e => setRootId(e.target.value)}><option value="">All organisations</option>{all.filter(e=>['organisation','structure'].includes(e.kind)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select><select aria-label="Diagram filter" value={kind} onChange={e => setKind(e.target.value)}><option value="all">Full Organisation</option><option value="organisation">Departments / Teams</option>{WORLD_CATEGORIES.filter(c => c.kind !== 'organisation').map(c => <option key={c.kind} value={c.kind}>{c.label}</option>)}</select><button onClick={() => setCollapsed(new Set(all.map(refKey)))}>Collapse all</button><button onClick={() => setCollapsed(new Set())}>Expand all</button><button onClick={() => setZoom(z => Math.max(.5, z - .1))}>−</button><button onClick={() => setZoom(z => Math.min(2, z + .1))}>+</button><button onClick={() => { const c = canvas.current; if (c) {
        setZoom(Math.max(.5, Math.min(1, c.clientWidth / (c.scrollWidth / zoom))));
        c.scrollLeft = 0;
        c.scrollTop = 0;
    } }}>Fit to screen</button><button onClick={() => { const c = canvas.current; const item = c?.querySelector<HTMLElement>('[data-world-key="' + (selected ? refKey(selected) : '') + '"]'); if (c && item) {
        c.scrollTop += item.getBoundingClientRect().top - c.getBoundingClientRect().top - c.clientHeight / 2;
        c.scrollLeft += item.getBoundingClientRect().left - c.getBoundingClientRect().left - c.clientWidth / 2;
    } }}>Centre selected</button><label>Diagram view name<input value={viewName} onChange={e => setViewName(e.target.value)}/></label><button disabled={!viewName.trim()} onClick={save}>Save view</button>{view && <><button onClick={() => pin(view.id)}>Pin diagram</button><button className="world-delete-button" onClick={() => remove(view.id)}>Delete diagram…</button></>}</div><div ref={canvas} className="world-diagram-canvas" onPointerDown={e => { if ((e.target as HTMLElement).closest('button'))
        return; pan.current = { x: e.clientX, y: e.clientY, left: e.currentTarget.scrollLeft, top: e.currentTarget.scrollTop }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!pan.current)
        return; e.currentTarget.scrollLeft = pan.current.left + pan.current.x - e.clientX; e.currentTarget.scrollTop = pan.current.top + pan.current.y - e.clientY; }} onPointerUp={() => { pan.current = undefined; }}><ul style={{ zoom }}>{roots.map(e => node(e, new Set()))}</ul>{!roots.length && <p>Create an Organisation, then link child units with “part of”.</p>}</div>{relationships.length < world.relationships.filter(r => !r.archived).length && <small>Only relationships active at the selected story point are shown. You can view past relationships in each entry’s details.</small>}</>;
}
function readImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
}
function WorldEntityFields({ entity, world, story, documents, patch, projectId, pack, onImage, insert, at }: {
    entity?: WorldRecord['entities'][number];
    world: WorldRecord;
    story: StoryRecord;
    documents: ScreenplayRecord[];
    at?: WorldPoint;
    patch(p: Partial<WorldRecord['entities'][number]>): void;
    projectId: string;
    pack?: WorldPackage;
    onImage(data: string): Promise<void>;
    insert?(text: string, type: string): void;
}) {
    const [error, setError] = useState('');
    if (!entity)
        return null;

    return <>{!['rule','note'].includes(entity.kind)&&<label>Abbreviation<input value={entity.abbreviation ?? ''} onChange={e => patch({ abbreviation: e.target.value })}/></label>}{entity.kind === 'rank' && <><label>Hierarchy position<input type="number" min="1" step="1" value={entity.rankLevel ?? ''} onChange={e => patch({ rankLevel: e.target.value === '' ? undefined : Number(e.target.value) })}/></label><small>Level 1 is the most senior. Higher numbers are more junior; equal positions are peers. Configure the Organisation’s ranks to enable automatic reporting.</small></>}{entity.kind!=='rule'&&<WorldConfiguredFields entity={entity} patch={patch} story={story} documents={documents} at={at}/>}<WorldCustomFields entity={entity} world={world} story={story} documents={documents} patch={patch} permanent={() => { if (!pack) window.dispatchEvent(new Event('world-permanent-delete')); }}/><label>Reference images<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (e) => { const file = e.target.files?.[0]; if (!file)
        return; try {
        const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
        await onImage(data);
        setError('');
    }
    catch (err) {
        setError(String(err));
    } }}/></label>{error && <p role="alert">{error}</p>}{entity.imageIds?.map(id => <div key={id}><WorldImage id={id} projectId={projectId} data={pack?.assets[id]}/><button onClick={() => patch({ imageIds: entity.imageIds?.filter(i => i !== id) })}>Remove image reference</button></div>)}{entity.kind === 'lore' && entity.fields?.['Exact wording'] && insert && <div className="world-toolbar">{(['dialogue', 'action', 'parenthetical', 'scene_heading'] as const).map(type => <button key={type} onClick={() => insert(entity.fields!['Exact wording'], type)}>{type === 'dialogue' ? 'Add to dialogue' : `Insert into ${type.replace('_', ' ')}`}</button>)}</div>}</>;
}
function WorldImage({ id, projectId, data }: {
    id: string;
    projectId: string;
    data?: string;
}) { const [url, setUrl] = useState(data ?? ''); useEffect(() => { if (data) {
    setUrl(data);
    return;
} let active = true; void window.desktop.readProjectImage(projectId, id).then(u => { if (active)
    setUrl(u); }).catch(() => { }); return () => { active = false; }; }, [id, projectId, data]); return url ? <img className="world-image" src={url} alt="World reference"/> : <small>Image unavailable</small>; }
