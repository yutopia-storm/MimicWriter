import { useEffect, useState } from 'react';
import { Archive, ArrowLeft, BookOpen, Check, ChevronRight, CircleAlert, Folder, FolderCog, LayoutGrid, Plus, RefreshCw, Settings, ShieldCheck, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import type { BootstrapData, OwnerConfig, ProjectCollection, ProjectRecord, ProjectType, ProjectWorkspace, UserPreferences } from './shared/models';
import { ScreenplayWorkspaceView } from './components/ScreenplayWorkspace';

type View = 'library' | 'settings' | 'admin' | 'project';

function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [view, setView] = useState<View>('library');
  const [activeWorkspace, setActiveWorkspace] = useState<ProjectWorkspace | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { window.desktop.bootstrap().then(setData).catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (data) document.documentElement.style.setProperty('--accent', data.ownerConfig.brand.accentColor); }, [data]);
  if (!data) return <div className="loading"><div className="brand-mark">S</div><span>{error || 'Preparing your workspace…'}</span></div>;
  if (!data.appState.setupCompleted || !data.storageHealth.writable) return <Onboarding data={data} onReady={setData} error={error} setError={setError}/>;

  const term = (key: string) => data.ownerConfig.terminology[key] ?? key;
  const navigate = (next: View) => { setView(next); setActiveWorkspace(null); };
  return <div className="app-shell">
    <aside className="sidebar">
      <button className="wordmark" onClick={() => navigate('library')}><span className="brand-mark">{data.ownerConfig.brand.shortName.slice(0, 2)}</span><span><b>{data.ownerConfig.brand.productName}</b><small>STORY WORKSPACE</small></span></button>
      <nav>
        <NavButton active={view === 'library'} icon={<LayoutGrid/>} label={`${term('project')} Library`} onClick={() => navigate('library')}/>
        <div className="nav-spacer"/>
        <NavButton active={view === 'settings'} icon={<Settings/>} label="Settings" onClick={() => navigate('settings')}/>
        <NavButton active={view === 'admin'} icon={<SlidersHorizontal/>} label="Owner Admin" onClick={() => navigate('admin')}/>
      </nav>
      <div className="sidebar-foot"><span className="status-dot"/>Local workspace<br/><small>{data.storageHealth.writable ? 'Storage connected' : 'Storage unavailable'}</small></div>
    </aside>
    <main className="main-panel">
      {error && <Toast message={error} onClose={() => setError('')}/>} 
      {view === 'library' && <Library data={data} term={term} onData={setData} onOpen={async (project) => { try { setActiveWorkspace(await window.desktop.openWorkspace(project.id)); setView('project'); } catch (e) { setError((e as Error).message); } }} setError={setError}/>} 
      {view === 'settings' && <WriterSettings data={data} onData={setData} setError={setError}/>} 
      {view === 'admin' && <Admin data={data} onData={setData} setError={setError}/>} 
      {view === 'project' && activeWorkspace && <ScreenplayWorkspaceView initialWorkspace={activeWorkspace} term={term} onWorkspace={setActiveWorkspace} onBack={() => navigate('library')}/>} 
    </main>
  </div>;
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick(): void }) {
  return <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function Onboarding({ data, onReady, error, setError }: { data: BootstrapData; onReady(v: BootstrapData): void; error: string; setError(v: string): void }) {
  const [folder, setFolder] = useState(data.appState.storageRoot ?? ''); const [busy, setBusy] = useState(false);
  const choose = async () => { const selected = await window.desktop.chooseStorageFolder(); if (selected) setFolder(selected); };
  const complete = async () => { setBusy(true); setError(''); try { onReady(await window.desktop.configureStorage(folder)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  return <div className="onboarding">
    <div className="onboarding-brand"><span className="brand-mark">{data.ownerConfig.brand.shortName.slice(0, 2)}</span><b>{data.ownerConfig.brand.productName}</b></div>
    <div className="setup-card">
      <div className="eyebrow">FIRST-RUN SETUP · 1 OF 1</div>
      <h1>Your stories.<br/><em>Your location.</em></h1>
      <p className="lead">Choose where your projects live. Your work stays in a folder you control—local, external, or already synced by a service you trust.</p>
      <div className="principles"><span><ShieldCheck/>Private by default</span><span><FolderCog/>Changeable later</span><span><Sparkles/>No cloud account</span></div>
      <label className="folder-picker"><span><Folder/>PROJECT STORAGE FOLDER</span><div><input value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Choose a folder…"/><button onClick={choose}>Browse</button></div></label>
      {error && <div className="inline-error"><CircleAlert/>{error}</div>}
      <div className="setup-note">We’ll create <b>Projects</b>, <b>Backups</b>, <b>Exports</b>, and <b>References</b> inside this folder. We never switch storage locations silently.</div>
      <button className="primary wide" disabled={!folder || busy} onClick={complete}>{busy ? 'Checking folder…' : 'Use this folder'}<ChevronRight/></button>
    </div>
  </div>;
}

function Library({ data, term, onData, onOpen, setError }: { data: BootstrapData; term(k: string): string; onData(v: BootstrapData): void; onOpen(p: ProjectRecord): void; setError(v: string): void }) {
  const [creating, setCreating] = useState(false); const [collectionId, setCollectionId] = useState<string | undefined>(); const [collectionCreating, setCollectionCreating] = useState(false); const [collectionName, setCollectionName] = useState('');
  const refresh = async () => { try { const result = await window.desktop.refreshStorage(); onData({ ...data, storageHealth: result.health, projects: result.projects, collections: result.collections }); } catch (e) { setError((e as Error).message); } };
  const createCollection = async () => { if (!collectionName.trim()) return; onData({ ...data, collections: await window.desktop.createCollection(collectionName) }); setCollectionName(''); setCollectionCreating(false); };
  return <section className="page">
    <header className="page-header"><div><div className="eyebrow">WRITING DESK</div><h1>{term('project')} Library</h1><p>Your stories, held locally and ready when you are.</p></div><div className="header-actions"><button className="secondary" onClick={() => setCollectionCreating(true)}><Plus/>New {term('collection')}</button><button className="icon-button" aria-label="Refresh" onClick={refresh}><RefreshCw/></button>{data.ownerConfig.featureFlags.project_creation && <button className="primary" onClick={() => { setCollectionId(undefined); setCreating(true); }}><Plus/>New {term('project')}</button>}</div></header>
    <div className="storage-strip"><span className="status-dot"/><div><b>Storage connected</b><small>{data.storageHealth.path}</small></div><ShieldCheck/></div>
    {data.collections.map((collection) => <CollectionSection key={collection.id} collection={collection} data={data} term={term} onData={onData} onOpen={onOpen} onCreate={() => { setCollectionId(collection.id); setCreating(true); }}/>) }
    {data.projects.length === 0 ? <div className="empty-state"><div className="empty-icon"><BookOpen/></div><h2>The first page is yours.</h2><p>Create a Feature or Series project. We’ll keep its identity stable and its files in the folder you chose.</p>{data.ownerConfig.featureFlags.project_creation && <button className="secondary" onClick={() => setCreating(true)}><Plus/>Create your first {term('project').toLowerCase()}</button>}</div> : <div className={data.preferences.compactLibrary ? 'project-list compact' : 'project-list'}>{data.projects.map((project) => <button className="project-card" key={project.id} onClick={() => onOpen(project)}><div className={`project-art ${project.projectType}`}><span>{project.projectType === 'feature' ? 'FEAT.' : 'SERIES'}</span></div><div className="project-info"><span className="pill">{project.projectType}</span><h2>{project.title}</h2><p>Updated {new Date(project.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</p></div><ChevronRight/></button>)}</div>}
    {creating && <CreateProject config={data.ownerConfig} collectionId={collectionId} onClose={() => setCreating(false)} onCreated={async () => { const refreshed = await window.desktop.refreshStorage(); onData({ ...data, projects: refreshed.projects, collections: refreshed.collections }); setCreating(false); }} setError={setError}/>} 
    {collectionCreating && <div className="modal-backdrop"><div className="modal"><button className="close-button" onClick={() => setCollectionCreating(false)}><X/></button><div className="eyebrow">NEW {term('collection').toUpperCase()}</div><h2>Group related projects</h2><label>Name<input autoFocus value={collectionName} onChange={(event) => setCollectionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createCollection(); }} placeholder="Collection name"/></label><button className="primary wide" disabled={!collectionName.trim()} onClick={() => void createCollection()}>Create {term('collection')}</button></div></div>}
  </section>;
}

function ProjectCard({ project, onOpen }: { project: ProjectRecord; onOpen(project: ProjectRecord): void }) { return <button className="project-card" onClick={() => onOpen(project)}><div className={`project-art ${project.projectType}`}><span>{project.projectType === 'feature' ? 'FEAT.' : project.projectType === 'short' ? 'SHORT' : 'SERIES'}</span></div><div className="project-info"><span className="pill">{project.projectType}</span><h2>{project.title}</h2><p>{project.documentFormat} · Updated {new Date(project.updatedAt).toLocaleDateString()}</p></div><ChevronRight/></button>; }

function CollectionSection({ collection, data, term, onData, onOpen, onCreate }: { collection: ProjectCollection; data: BootstrapData; term(k: string): string; onData(data: BootstrapData): void; onOpen(project: ProjectRecord): void; onCreate(): void }) {
  const projects = collection.projectIds.map((id) => data.projects.find((project) => project.id === id)).filter((project): project is ProjectRecord => !!project); const available = data.projects.filter((project) => !collection.projectIds.includes(project.id));
  const update = (collections: ProjectCollection[]) => onData({ ...data, collections });
  return <section className="collection-card"><header><div><span className="eyebrow">{term('collection')}</span><h2>{collection.name}</h2></div><div><button onClick={onCreate}><Plus/>New project</button><button onClick={async () => { const name = window.prompt(`Rename ${term('collection')}`, collection.name); if (name?.trim()) update(await window.desktop.renameCollection(collection.id, name)); }}>Rename</button><button onClick={async () => { if (window.confirm(`Delete ${collection.name}? Projects will remain available.`)) update(await window.desktop.deleteCollection(collection.id)); }}>Delete collection</button></div></header><div className="collection-add"><select aria-label={`Add project to ${collection.name}`} defaultValue=""><option value="">Add existing project…</option>{available.map((project) => <option key={project.id} value={project.id}>{project.title} ({project.projectType})</option>)}</select><button onClick={async (event) => { const select = event.currentTarget.previousElementSibling as HTMLSelectElement; if (select.value) update(await window.desktop.setCollectionProject(collection.id, select.value, true)); }}>Add</button></div><div className="project-list compact">{projects.map((project, index) => <div className="collection-project" key={project.id}><ProjectCard project={project} onOpen={onOpen}/><div><button aria-label={`Move ${project.title} up`} onClick={async () => update(await window.desktop.reorderCollectionProject(collection.id, project.id, index - 1))}>↑</button><button aria-label={`Move ${project.title} down`} onClick={async () => update(await window.desktop.reorderCollectionProject(collection.id, project.id, index + 1))}>↓</button><button onClick={async () => update(await window.desktop.setCollectionProject(collection.id, project.id, false))}>Remove from collection</button></div></div>)}</div></section>;
}

function CreateProject({ config, collectionId, onClose, onCreated, setError }: { config: OwnerConfig; collectionId?: string; onClose(): void; onCreated(p: ProjectRecord): void | Promise<void>; setError(v: string): void }) {
  const [title, setTitle] = useState(''); const [type, setType] = useState<ProjectType>(config.defaults.projectType === 'series' && !config.featureFlags.series_projects ? 'feature' : config.defaults.projectType); const [busy, setBusy] = useState(false);
  const create = async () => { setBusy(true); try { await onCreated(await window.desktop.createProject({ title, projectType: type, collectionId })); } catch (e) { setError((e as Error).message); setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><div className="modal"><button className="close-button" onClick={onClose}><X/></button><div className="eyebrow">NEW PROJECT</div><h2>What are you beginning?</h2><label>Title<input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled story" maxLength={160}/></label><div className="type-grid"><button className={type === 'feature' ? 'selected' : ''} onClick={() => setType('feature')}><BookOpen/><b>Feature</b><span>A single feature screenplay.</span>{type === 'feature' && <Check/>}</button><button className={type === 'short' ? 'selected' : ''} onClick={() => setType('short')}><BookOpen/><b>Short</b><span>A short film screenplay.</span>{type === 'short' && <Check/>}</button>{config.featureFlags.series_projects && <button className={type === 'series' ? 'selected' : ''} onClick={() => setType('series')}><Archive/><b>Series</b><span>Series, Episodes and screenplays.</span>{type === 'series' && <Check/>}</button>}</div><button className="primary wide" disabled={!title.trim() || busy} onClick={create}>{busy ? 'Creating…' : 'Create project'}<ChevronRight/></button></div></div>;
}

function WriterSettings({ data, onData, setError }: { data: BootstrapData; onData(v: BootstrapData): void; setError(v: string): void }) {
  const [preferences, setPreferences] = useState<UserPreferences>(data.preferences); const [saved, setSaved] = useState(false);
  const changeStorage = async () => { const folder = await window.desktop.chooseStorageFolder(); if (!folder) return; try { onData(await window.desktop.configureStorage(folder)); } catch (e) { setError((e as Error).message); } };
  const save = async () => { try { const value = await window.desktop.savePreferences(preferences); onData({ ...data, preferences: value }); setSaved(true); setTimeout(() => setSaved(false), 1800); } catch (e) { setError((e as Error).message); } };
  return <section className="page narrow"><header className="page-header"><div><div className="eyebrow">WRITER PREFERENCES</div><h1>Settings</h1><p>Control your workspace. Product configuration remains separate.</p></div></header><SettingsCard title="Project storage" description="The application will never fall back to another folder silently."><div className="path-box"><Folder/><span>{data.storageHealth.path}</span><b className="healthy"><Check/>Available</b></div><button className="secondary" onClick={changeStorage}>Choose a different folder</button></SettingsCard><SettingsCard title="Writing preferences" description="Local editor behaviour for this writer."><label>Spelling language<select value={preferences.spellingLanguage ?? 'en-GB'} onChange={(e) => setPreferences({ ...preferences, spellingLanguage: e.target.value as 'en-GB'|'en-US' })}><option value="en-GB">British English</option><option value="en-US">American English</option></select></label><label className="toggle-row"><span><b>Compact project list</b><small>Show less artwork and fit more projects on screen.</small></span><input type="checkbox" checked={preferences.compactLibrary} onChange={(e) => setPreferences({ ...preferences, compactLibrary: e.target.checked })}/></label><button className="primary" onClick={save}>{saved ? <><Check/>Saved</> : 'Save preferences'}</button></SettingsCard></section>;
}

function SettingsCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <div className="settings-card"><div><h2>{title}</h2><p>{description}</p></div><div>{children}</div></div>; }

function Admin({ data, onData, setError }: { data: BootstrapData; onData(v: BootstrapData): void; setError(v: string): void }) {
  const [config, setConfig] = useState<OwnerConfig>(() => structuredClone(data.ownerConfig)); const [tab, setTab] = useState<'brand'|'terms'|'features'|'defaults'>('brand'); const [saved, setSaved] = useState(false);
  const save = async () => { try { const value = await window.desktop.saveOwnerConfig(config); onData({ ...data, ownerConfig: value }); setSaved(true); setTimeout(() => setSaved(false), 1800); } catch (e) { setError((e as Error).message); } };
  return <section className="page"><header className="page-header"><div><div className="eyebrow">OWNER CONFIGURATION</div><h1>Admin</h1><p>Change the product presentation without changing domain identifiers or writer data.</p></div><button className="primary" onClick={save}>{saved ? <><Check/>Saved</> : 'Save changes'}</button></header><div className="admin-layout"><div className="admin-tabs">{(['brand','terms','features','defaults'] as const).map((item) => <button className={tab === item ? 'active' : ''} onClick={() => setTab(item)} key={item}>{item === 'terms' ? 'Terminology' : item[0].toUpperCase()+item.slice(1)}<ChevronRight/></button>)}</div><div className="admin-content">
    {tab === 'brand' && <><h2>Brand</h2><p className="section-copy">Display values only. Internal project formats remain brand-neutral.</p><div className="form-grid"><Field label="Product name" value={config.brand.productName} onChange={(v) => setConfig({...config, brand:{...config.brand, productName:v}})}/><Field label="Short name" value={config.brand.shortName} onChange={(v) => setConfig({...config, brand:{...config.brand, shortName:v}})}/><Field label="Developer / company" value={config.brand.developerName} onChange={(v) => setConfig({...config, brand:{...config.brand, developerName:v}})}/><Field label="Tagline" value={config.brand.tagline} onChange={(v) => setConfig({...config, brand:{...config.brand, tagline:v}})}/><label className="full">Description<textarea value={config.brand.description} onChange={(e) => setConfig({...config, brand:{...config.brand, description:e.target.value}})}/></label><label>Accent colour<input type="color" value={config.brand.accentColor} onChange={(e) => setConfig({...config, brand:{...config.brand, accentColor:e.target.value}})}/></label></div></>}
    {tab === 'terms' && <><h2>Terminology</h2><p className="section-copy">Labels may change; the stable keys on the left never do.</p>{Object.entries(config.terminology).map(([key,value]) => <div className="term-row" key={key}><code>{key}</code><input value={value} onChange={(e) => setConfig({...config, terminology:{...config.terminology,[key]:e.target.value}})}/></div>)}</>}
    {tab === 'features' && <><h2>Implemented features</h2><p className="section-copy">Flags control only features available in this build.</p>{Object.entries(config.featureFlags).map(([key,value]) => <label className="toggle-row feature-row" key={key}><span><b>{key.replaceAll('_',' ')}</b><small>Stable flag: {key}</small></span><input type="checkbox" checked={value} onChange={(e) => setConfig({...config, featureFlags:{...config.featureFlags,[key]:e.target.checked}})}/></label>)}</>}
    {tab === 'defaults' && <><h2>Defaults</h2><p className="section-copy">Starting choices for new projects.</p><label>Default project type<select value={config.defaults.projectType} onChange={(e) => setConfig({...config,defaults:{projectType:e.target.value as ProjectType}})}><option value="feature">Feature</option><option value="short">Short</option><option value="series">Series</option></select></label></>}
  </div></div></section>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) { return <label>{label}<input value={value} onChange={(e) => onChange(e.target.value)}/></label>; }

function ProjectView({ project, term, onBack }: { project: ProjectRecord; term(k: string): string; onBack(): void }) {
  return <section className="page project-view"><button className="back-button" onClick={onBack}><ArrowLeft/>Back to library</button><div className="project-hero"><div><span className="pill">{project.projectType}</span><h1>{project.title}</h1><p>{project.projectType === 'series' ? 'Series foundation ready for future episodes.' : 'Feature foundation ready for the screenplay core.'}</p></div><div className="identity-card"><small>STABLE PROJECT ID</small><code>{project.id}</code><span><ShieldCheck/>Stored locally · Schema v{project.schemaVersion}</span></div></div><div className="deferred-panel"><BookOpen/><div><h2>Your {term('project').toLowerCase()} is ready.</h2><p>Screenplay writing arrives in the next build. This foundation already preserves a stable identity, type, timestamps, and versioned metadata.</p></div></div></section>;
}

function Toast({ message, onClose }: { message: string; onClose(): void }) { return <div className="toast"><CircleAlert/><span>{message}</span><button onClick={onClose}><X/></button></div>; }

export default App;
