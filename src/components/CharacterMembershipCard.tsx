import type { StoryRecord } from '../shared/story';
import type { ScreenplayRecord } from '../shared/models';
import type { WorldPoint } from '../shared/worlds';
import { characterMemberships, membershipDetails } from '../domain/world-memberships';
import { DEFAULT_CHARACTER_WORLD_FIELDS } from '../shared/profiles';

export function CharacterMembershipCard({story,documents,characterId,at,fields=DEFAULT_CHARACTER_WORLD_FIELDS,open}:{story:StoryRecord;documents:ScreenplayRecord[];characterId:string;at?:WorldPoint;fields?:string[];open():void}) {
 const memberships=characterMemberships(story,characterId,documents,at);
 return <>{memberships.map(({world,relationship:r})=>{
  const {organisation,unit,rank,position}=membershipDetails(world,story,r);
  const roles=[fields.includes('rank')&&rank?.name, fields.includes('position')&&(position?.abbreviation||position?.name)].filter(Boolean).join(' · ');
  const placement=[fields.includes('unit')&&unit?.name,fields.includes('organisation')&&(organisation?.abbreviation||organisation?.name)].filter(Boolean).join(' · ');
  return roles||placement ? <button className="character-membership-card" key={r.id} title={world.name+' · '+(organisation?.name ?? 'Organisation unavailable')} onClick={open}>{roles&&<strong>{roles}</strong>}{placement&&<span>{placement}</span>}</button> : null;
 })}</>;
}
