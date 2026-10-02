// Central Plot palette; theme roles and existing custom colours remain compatible.
export const STORY_COLORS = ['accent', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#dc2626', '#0891b2', '#db2777'] as const;
export const STORY_TIME_PERIODS = [
  { value: 'early_morning', label: 'Early Morning', sortMinute: 300, headings: ['EARLY MORNING', 'DAWN', 'SUNRISE'] },
  { value: 'morning', label: 'Morning', sortMinute: 540, headings: ['MORNING'] },
  { value: 'midday', label: 'Midday', sortMinute: 720, headings: ['MIDDAY', 'NOON'] },
  { value: 'afternoon', label: 'Afternoon', sortMinute: 900, headings: ['AFTERNOON', 'DAY', 'DAYTIME'] },
  { value: 'evening', label: 'Evening', sortMinute: 1080, headings: ['EVENING', 'DUSK', 'SUNSET'] },
  { value: 'night', label: 'Night', sortMinute: 1260, headings: ['NIGHT', 'NIGHTTIME'] },
  { value: 'late_night', label: 'Late night', sortMinute: 1380, headings: ['LATE NIGHT'] },
] as const;
export const SCENE_POSITIONS = ['present', 'past', 'future', 'flashback', 'flashforward'] as const;
export const PLOT_STATUSES = ['planned', 'active', 'resolved', 'unresolved'] as const;
export function periodFromTime(time: string) {
  const minute = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  if (minute < 300 || minute >= 1380) return 'late_night' as const;
  if (minute < 480) return 'early_morning' as const;
  if (minute < 720) return 'morning' as const;
  if (minute < 780) return 'midday' as const;
  if (minute < 1080) return 'afternoon' as const;
  if (minute < 1260) return 'evening' as const;
  return 'night' as const;
}
export const STORY_SECONDS_PER_PAGE = 60;
export function storyColor(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : `var(--${[...STORY_COLORS, 'text', 'muted', 'danger'].includes(color) ? color : 'accent'})`;
}

export const EVENT_RELATIONSHIPS = { occurs: 'Occurs', revealed: 'Revealed', referenced: 'Referenced', investigated: 'Investigated', new_evidence: 'New evidence', reinterpreted: 'Reinterpreted' } as const;
export const PLOT_RELATIONSHIPS = ['Introduced', 'Developed', 'Complicated', 'Revealed', 'Resolved'] as const;
export const CHARACTER_RELATIONSHIPS = ['First appearance', 'Appears', 'Mentioned', 'Last appearance'] as const;
export const LOCATION_RELATIONSHIPS = ['First appearance', 'Appears', 'Referenced'] as const;

export function nextPlotColor(plots: { color: string }[]) { return STORY_COLORS.find(color => !plots.some(plot => plot.color === color)) ?? STORY_COLORS[plots.length % STORY_COLORS.length]; }
