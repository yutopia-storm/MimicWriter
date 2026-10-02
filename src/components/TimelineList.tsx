import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { elapsedTimeLabel, groupTimeline, type TimelineActivity, type TimelineOrder } from '../domain/timeline-view';
import type { Chronology } from '../shared/story';

export type TimelineDensity = 'compact' | 'standard' | 'expanded';
export interface LocateRequest { key: string; sequence: number; }
export function TimelineList({ items, order, density, compactComparison = false, collapseCommand, locate, paneRef, selectedKey, hoverId, onHover, header, plots, secondary }: {
  items: TimelineActivity[]; order: TimelineOrder; density: TimelineDensity; compactComparison?: boolean;
  collapseCommand: { sequence: number; collapsed: boolean }; locate?: LocateRequest;
  paneRef?: React.RefObject<HTMLDivElement | null>; selectedKey?: string; hoverId?: string;
  onHover?(id?: string): void; header(item: TimelineActivity): ReactNode;
  plots(item: TimelineActivity): ReactNode; secondary(item: TimelineActivity, expanded: boolean): ReactNode;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [allClosed, setAllClosed] = useState(false);
  const [pending, setPending] = useState<LocateRequest>();
  const nodes = useRef(new Map<string, HTMLElement>());
  const groups = groupTimeline(items);
  const collapsed = (key: string) => closed[key] ?? allClosed;
  const toggle = (key: string) => setClosed(state => ({ ...state, [key]: !collapsed(key) }));
  useEffect(() => { setClosed({}); setAllClosed(collapseCommand.collapsed); }, [collapseCommand.sequence]);
  useEffect(() => { if (density === 'expanded') { setClosed({}); setAllClosed(false); } }, [density]);
  useEffect(() => {
    if (!locate) return;
    const open: Record<string, boolean> = {};
    for (const group of groups) for (const period of group.periods) for (const item of period.items) {
      if (item.key === locate.key || item.events.some(e => e.key === locate.key)) {
        open[group.key] = false; open[period.key] = false; open[item.key] = false;
      }
    }
    setClosed(state => ({ ...state, ...open }));
    setPending(locate);
  }, [locate]);
  useLayoutEffect(() => {
    if (!pending) return;
    const target = nodes.current.get(pending.key), pane = paneRef?.current;
    if (target && pane) {
      const top = target.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - (pane.clientHeight - target.getBoundingClientRect().height) / 2;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      // Only this pane moves. scrollIntoView would also move shared ancestors.
      pane.scrollTo({ top: Math.max(0, Math.min(top, pane.scrollHeight - pane.clientHeight)), behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    setPending(undefined);
  }, [pending, paneRef]);
  const nodeProps = (item: TimelineActivity) => ({
    ref: (node: HTMLElement | null) => { if (node) nodes.current.set(item.key, node); else nodes.current.delete(item.key); },
    'data-timeline-key': item.key, 'data-match-id': item.matchId,
    className: 'timeline-activity' + (selectedKey === item.key ? ' timeline-selected' : '') + (hoverId === item.matchId ? ' timeline-hover' : ''),
    onMouseEnter: () => onHover?.(item.matchId), onMouseLeave: () => onHover?.(),
    onFocus: () => onHover?.(item.matchId), onBlur: () => onHover?.(),
  });
  const secondaryContent = (item: TimelineActivity) => {
    const content = secondary(item, density === 'expanded');
    if (!content) return null;
    return compactComparison || density === 'compact'
      ? <details className="timeline-secondary"><summary>Characters and location</summary>{content}</details>
      : <div className="timeline-secondary">{content}</div>;
  };
  const event = (item: TimelineActivity, previous?: Chronology) => <div key={item.key} {...nodeProps(item)}>
    {order === 'story' && previous && elapsedTimeLabel(previous, item.chronology) && <p className="timeline-gap">{elapsedTimeLabel(previous, item.chronology)}</p>}
    {header(item)}
    <div className="timeline-children">{plots(item)}{!compactComparison && secondaryContent(item)}</div>
  </div>;
  const activity = (item: TimelineActivity, previous?: Chronology) => <article key={item.key} className={'timeline-entry' + (item.missingScene && item.kind === 'scene' ? ' removed' : '')}>
    {order === 'story' && previous && elapsedTimeLabel(previous, item.chronology) && <p className="timeline-gap">{elapsedTimeLabel(previous, item.chronology)}</p>}
    {item.kind === 'scene' ? <>
      <div {...nodeProps(item)} className={nodeProps(item).className + ' timeline-scene-header'}>
        <button className="timeline-fold" aria-label={(collapsed(item.key) ? 'Expand ' : 'Collapse ') + item.name} aria-expanded={!collapsed(item.key)} onClick={() => toggle(item.key)}><span aria-hidden="true">{collapsed(item.key) ? '▸' : '▾'}</span></button>
        {header(item)}
      </div>
      {collapsed(item.key) && <small>{item.events.length} {item.events.length === 1 ? 'Event' : 'Events'} · {item.plotIds?.length ?? 0} Plots</small>}
      {!collapsed(item.key) && <div className="timeline-children">
        {item.events.map((e, i) => event(e, i ? item.events[i - 1].chronology : undefined))}
        {plots(item)}{secondaryContent(item)}
      </div>}
    </> : event(item)}
  </article>;
  return <div className={'timeline-groups timeline-density-' + density}>
    {order === 'story' ? groups.map((group, groupIndex) => <section key={group.key}>
      {groupIndex > 0 && elapsedTimeLabel(groups[groupIndex - 1].periods.at(-1)?.items.at(-1)?.chronology, group.chronology) && <p className="timeline-gap">{elapsedTimeLabel(groups[groupIndex - 1].periods.at(-1)?.items.at(-1)?.chronology, group.chronology)}</p>}
      <h3><button className="timeline-group-toggle" aria-expanded={!collapsed(group.key)} onClick={() => toggle(group.key)}><span aria-hidden="true">{collapsed(group.key) ? '▸ ' : '▾ '}</span>{group.label}</button></h3>
      {!collapsed(group.key) && group.periods.map((period, periodIndex) => <section key={period.key}>
        {period.label && <h4><button className="timeline-group-toggle" aria-expanded={!collapsed(period.key)} onClick={() => toggle(period.key)}><span aria-hidden="true">{collapsed(period.key) ? '▸ ' : '▾ '}</span>{period.label}</button></h4>}
        {(!period.label || !collapsed(period.key)) && period.items.map((item, index) => activity(item, index ? period.items[index - 1].chronology : periodIndex ? group.periods[periodIndex - 1].items.at(-1)?.chronology : undefined))}
      </section>)}
    </section>) : items.map(item => activity(item))}
    {!items.length && <p>No matching story activity.</p>}
  </div>;
}
