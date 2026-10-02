import { useEffect, useRef, useState } from 'react';
import type { UserPreferences } from '../shared/models';

type Preferences = Required<Pick<UserPreferences, 'timelineDisplay' | 'timelineOrder' | 'timelineDensity'>>;
export function useTimelinePreferences(initialOrder: Preferences['timelineOrder'] = 'story') {
  const [values, setValues] = useState<Preferences>({ timelineDisplay: 'icons_names', timelineOrder: initialOrder, timelineDensity: 'standard' });
  const latest = useRef(values), touched = useRef(new Set<keyof Preferences>()), queue = useRef(Promise.resolve());
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (window.desktop.bootstrap) void window.desktop.bootstrap().then(data => {
      if (!active) return;
      const saved: Preferences = {
        timelineDisplay: data.preferences.timelineDisplay === 'names' ? 'names' : 'icons_names',
        timelineOrder: ['story', 'screenplay', 'compare'].includes(data.preferences.timelineOrder ?? '') ? data.preferences.timelineOrder! : initialOrder,
        timelineDensity: ['compact', 'standard', 'expanded'].includes(data.preferences.timelineDensity ?? '') ? data.preferences.timelineDensity! : 'standard',
      };
      const next = { ...latest.current };
      for (const key of Object.keys(saved) as (keyof Preferences)[]) if (!touched.current.has(key)) Object.assign(next, { [key]: saved[key] });
      latest.current = next; setValues(next);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const update = (patch: Partial<Preferences>) => {
    for (const key of Object.keys(patch) as (keyof Preferences)[]) touched.current.add(key);
    latest.current = { ...latest.current, ...patch }; setValues(latest.current);
    const snapshot = Object.fromEntries([...touched.current].map(key=>[key,latest.current[key]]));
    queue.current = queue.current.catch(() => {}).then(async () => {
      try { const data = await window.desktop.bootstrap(); await window.desktop.savePreferences({ ...data.preferences, ...snapshot }); setError(''); }
      catch { setError('Timeline preferences could not be saved.'); }
    });
  };
  return { ...values, update, error };
}
