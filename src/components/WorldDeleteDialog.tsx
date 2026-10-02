import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { StoryRecord } from '../shared/story';
import type { WorldRecord } from '../shared/worlds';
import { inspectWorldDeletion, type WorldDeleteTarget, type ChildDisposition } from '../domain/world-delete';

export function WorldDeleteDialog({ story, world, target, library, cancel, confirm }: { story: StoryRecord; world: WorldRecord; target: WorldDeleteTarget; library?: boolean; cancel(): void; confirm(choice?: ChildDisposition): Promise<void> | void }) {
  const [choice, setChoice] = useState<ChildDisposition>(), [typed, setTyped] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const plan = inspectWorldDeletion(story, world, target, choice);
  const organisation = target.kind === 'entity' && target.ref.kind === 'organisation';
  useEffect(() => { const prior = document.activeElement as HTMLElement; dialog.current?.querySelector<HTMLButtonElement>('button')?.focus(); return () => { prior?.focus({ preventScroll: true }); }; }, []);
  return createPortal(<div className="world-delete-backdrop"><section ref={dialog} className="world-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="world-delete-title" aria-describedby="world-delete-description" onKeyDown={e => {
    e.stopPropagation();
    if (e.key === 'Escape' && !busy) cancel();
    if (e.key === 'Tab') {
      const nodes = [...dialog.current?.querySelectorAll<HTMLElement>('button,input,select') ?? []].filter(n => !n.hasAttribute('disabled'));
      if (e.shiftKey && document.activeElement === nodes[0]) { e.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === nodes.at(-1)) { e.preventDefault(); nodes[0]?.focus(); }
    }
  }}><h2 id="world-delete-title">Delete {plan.name}?</h2><p id="world-delete-description">This will permanently delete {plan.name}. This cannot be undone.</p>
    {target.kind === 'world' && <><p>This World contains:</p><ul>{[['Organisations', world.entities.filter(e => e.kind === 'organisation').length], ['internal structures',world.entities.filter(e => e.kind === 'structure').length], ['People links',world.characterIds.length], ['Places links',world.locationIds.length], ['Objects',world.entities.filter(e => e.kind === 'object').length], ['Rules',world.entities.filter(e => e.kind === 'rule').length], ['other entries',world.entities.filter(e => !['organisation','structure','object','rule'].includes(e.kind)).length], ['diagrams',world.diagrams.length]].map(([label,count]) => <li key={label}>{count} {label}</li>)}</ul><p>All entries, relationships, history, diagrams, screenplay links and pins belonging to this World will be removed. Character and Location profiles remain in the project. Screenplay text remains unchanged.</p><p>{library ? 'Previously copied Project Worlds remain independent and will not be deleted.' : 'Its World Library source remains independent and will not be deleted.'}</p><label>Type “{world.name}” to confirm<input value={typed} onChange={e => setTyped(e.target.value)} /></label></>}
    {plan.linked.length > 0 && <><p>{plan.name} is linked to:</p><ul>{plan.linked.map(link => <li key={link}>{link}</li>)}</ul></>}
    {target.kind === 'entity' && <><p>These links, including historical relationships, will be removed. Linked Characters, Objects, Locations, Rules and separate child Organisations remain. Screenplay text remains unchanged.</p>{plan.canonical && <p>This is a shared {target.ref.kind}. This deletes its profile throughout {library ? 'this Library World' : 'the project'}, including scene and event details and links in other Project Worlds. Other profiles and screenplay text remain.</p>}</>}
    {plan.children.length > 0 && <fieldset><legend>Choose what happens to the units inside</legend><ul>{plan.children.map(e => <li key={e.id}>{e.name}</li>)}</ul><label><input type="radio" name="world-delete-children" checked={choice?.mode === 'move'} onChange={() => setChoice({ mode: 'move' })} />{organisation ? 'Keep structures in another Organisation' : 'Move children to parent'}</label>{organisation && choice?.mode === 'move' && <label>Surviving Organisation<select value={choice.organisationId ?? ''} onChange={e => setChoice({ mode: 'move', organisationId: e.target.value })}><option value="">Choose Organisation…</option>{world.entities.filter(e => e.kind === 'organisation' && target.kind === 'entity' && e.id !== target.ref.id).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}<label><input type="radio" name="world-delete-children" checked={choice?.mode === 'delete'} onChange={() => setChoice({ mode: 'delete' })} />Delete this entry and all listed child structures</label>{choice?.mode === 'delete' && <p>Will also permanently delete: {plan.children.map(e => e.name).join(', ')}. Other linked entries remain.</p>}</fieldset>}
    {target.kind === 'diagram' && <p>The saved diagram and its footer pins will be removed. All entries and relationships remain.</p>}
    {target.kind === 'relationship' && <p>This relationship period will be removed from current and historical views. Both linked entries remain.</p>}
    {error && <p role="alert">{error}</p>}<div className="world-toolbar"><button disabled={busy} onClick={cancel}>Cancel</button><button className="world-delete-button" disabled={busy || target.kind === 'world' && typed !== world.name || plan.children.length > 0 && (!choice || organisation && choice.mode === 'move' && !choice.organisationId)} onClick={async () => { setBusy(true); setError(''); try { await confirm(choice); } catch(e) { setError(String(e)); setBusy(false); } }}>Delete {plan.name}</button></div>
  </section></div>, document.body);
}
