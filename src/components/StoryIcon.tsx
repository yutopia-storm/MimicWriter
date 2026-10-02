import { Clapperboard, Diamond, Star, Spool, Users, MapPin } from 'lucide-react';

export type StoryIconKind = 'scene' | 'event' | 'plot' | 'character' | 'location';
export function StoryIcon({ kind, major = false }: { kind: StoryIconKind; major?: boolean }) {
  const Icon = kind === 'scene' ? Clapperboard : kind === 'event' ? major ? Star : Diamond : kind === 'plot' ? Spool : kind === 'character' ? Users : MapPin;
  return <Icon size={16} aria-hidden="true" />;
}
