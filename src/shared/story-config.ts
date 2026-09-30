// Theme roles are the default palette; writers may choose a custom colour per plot.
export const STORY_COLORS = ['accent', 'text', 'muted', 'danger'] as const;
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
  return /^#[0-9a-f]{6}$/i.test(color) ? color : `var(--${STORY_COLORS.includes(color as typeof STORY_COLORS[number]) ? color : 'accent'})`;
}
