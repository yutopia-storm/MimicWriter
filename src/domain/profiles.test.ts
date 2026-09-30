import { describe, expect, it } from 'vitest';
import { createElement, createScene, createScreenplay } from './screenplay';
import { migrateStory, queryTimeline, deleteStoryEntity } from './story';
import { synchronizeSceneDefaults } from './story-extraction';
import { addScreenplayIdentity, mergeIdentity, separateIdentity } from './story-identities';
import { ageFromDateOfBirth, appearanceForScene, characterStatistics, cueCharacter, dateOfBirthLabel, effectiveRelationships, locationFamily, profileActivity, relationshipDisplayName, relationshipVisibleAt } from './profiles';
import { RELATIONSHIP_TYPES } from '../shared/profiles';

function fixture() {
  const screenplay = createScreenplay({ projectId: 'p', title: 'Pilot', screenplayType: 'episode' });
  screenplay.scenes.push(createScene(1), createScene(2));
  screenplay.scenes.forEach((scene, index) => { scene.elements = [createElement('scene_heading', 'INT. COURT - DAY', 0), createElement('character', ['SOLICITOR','MARSHA (V.O.)','APPLE'][index], 1), createElement('dialogue', 'One two three.', 2)]; });
  const story = synchronizeSceneDefaults(migrateStory(null,'p'),[screenplay]);
  story.scenes.forEach((scene,index) => scene.chronology = { day: index + 1, time: '13:00' });
  return { story, screenplay };
}
describe('canonical profiles', () => {
  it('shows the calculated age beside a valid date of birth', () => {
    const today = new Date(2026, 8, 30);
    expect(ageFromDateOfBirth('1990-04-12', today)).toBe(36);
    expect(dateOfBirthLabel('1990-04-12', today)).toBe('12 . Apr . 1990 (36)');
    expect(ageFromDateOfBirth('not-a-date', today)).toBeUndefined();
  });
  it('combines dialogue through canonical identities while preserving remote vs physical presence', () => {
    const { story, screenplay } = fixture(), text = JSON.stringify(screenplay);
    const [solicitor, marsha] = story.characters;
    const merged = mergeIdentity(story,'characters',solicitor.id,marsha.id);
    expect(characterStatistics(merged,[screenplay],marsha.id)).toMatchObject({ words: 6, blocks: 2, sceneCount: 1 });
    expect(cueCharacter(merged, 'SOLICITOR (CONT’D)')?.id).toBe(marsha.id);
    const solicitorCueId = screenplay.scenes[0].elements[1].id;
    expect(cueCharacter(merged, 'UNKNOWN CUE', solicitorCueId)?.id).toBe(marsha.id);
    const legacyMerge = { ...merged, characters: merged.characters.map(character => character.id === marsha.id ? { ...character, sourceNames: ['MARSHA'], sourceElementIds: [] } : character) };
    expect(cueCharacter(legacyMerge, 'SOLICITOR')?.id).toBe(marsha.id);
    expect(JSON.stringify(screenplay)).toBe(text);
    marsha.profile = { aliases: ['Maz'] };
    expect(cueCharacter(story,'Maz')).toBeUndefined();
  });
  it('links a previously removed screenplay cue to an existing canonical character', () => {
    const { story, screenplay } = fixture(), [solicitor, marsha] = story.characters;
    const removed = deleteStoryEntity(story, 'characters', solicitor.id);
    expect(removed.ignoredCharacterNames).toContain('SOLICITOR');
    const linked = addScreenplayIdentity(removed, 'characters', marsha.id, 'Solicitor', [screenplay]);
    expect(linked.characters.find(item => item.id === marsha.id)?.sourceNames).toContain('SOLICITOR');
    expect(linked.characters.find(item => item.id === marsha.id)?.sourceElementIds).toContain(screenplay.scenes[0].elements[1].id);
    expect(linked.ignoredCharacterNames).not.toContain('SOLICITOR');
    expect(cueCharacter(linked, 'SOLICITOR')?.id).toBe(marsha.id);
  });
  it('prioritizes explicit scenes and specific event ranges, and flags equally ranked conflicts', () => {
    const { story, screenplay } = fixture(), character = story.characters[0];
    story.events.push({ id: 'attack', name: 'Attack', description: '', chronology: { day: 2 } });
    character.profile = { appearances: [
      { id: 'default', name: 'Usual', isDefault: true },
      { id: 'broad', name: 'Coat', from: { chronology: { day: 1 } }, until: { chronology: { day: 3 } } },
      { id: 'specific', name: 'Injured', from: { eventId: 'attack' }, until: { chronology: { day: 3 } } },
      { id: 'scene', name: 'Hospital', sceneIds: [screenplay.scenes[2].id] },
    ] };
    expect(appearanceForScene(story,character).appearance?.id).toBe('default');
    expect(appearanceForScene(story,character,screenplay.scenes[0].id).appearance?.id).toBe('broad');
    expect(appearanceForScene(story,character,screenplay.scenes[1].id).appearance?.id).toBe('specific');
    expect(appearanceForScene(story,character,screenplay.scenes[2].id).appearance?.id).toBe('scene');
    character.profile.appearances!.push({ id: 'conflict', name: 'Conflict', sceneIds: [screenplay.scenes[2].id] });
    expect(appearanceForScene(story,character,screenplay.scenes[2].id).conflicts).toHaveLength(2);
    expect(appearanceForScene(story,character,screenplay.scenes[2].id).appearance).toBeUndefined();
  });
  it('round-trips every profile field and keeps optional timeline layers out of normal events', () => {
    const { story, screenplay } = fixture();
    story.characters[0].profile = { dateOfBirth: '1990-04-12', age: '30s', occupation: 'Lawyer', biography: 'History', aliases: ['S'], skills: [{ id: 'skill', name: 'Law', note: 'Criminal' }], images: [{ id: 'image', assetId: crypto.randomUUID(), label: 'Reference' }], appearances: [{ id: 'appearance', name: 'Court', from: { chronology: { day: 1 } }, clothing: 'Suit' }], customFields: [{ id: 'field', name: 'Car', value: 'Red' }] };
    story.relationships = [{ id: 'r', fromId: story.characters[0].id, toId: story.characters[2].id, label: 'Protects', directional: true, from: { chronology: { day: 2 } } }];
    expect(migrateStory(JSON.parse(JSON.stringify(story)), 'p')).toEqual(JSON.parse(JSON.stringify(story)));
    expect(queryTimeline(story,[screenplay],{ kind: 'event' })).toHaveLength(0);
    expect(queryTimeline(story,[screenplay],{ appearanceChanges: true, relationshipChanges: true }).filter(item => item.layer)).toHaveLength(2);
    expect(story.events).toHaveLength(0);
  });
  it('merges and restores profile assets, relationship endpoints and nested identities', () => {
    const { story, screenplay } = fixture(), [a,b,c] = story.characters;
    a.profile = { skills: [{ id: 'skill', name: 'Law' }], notes: 'Source notes' };
    b.profile = { notes: 'Target notes' };
    story.relationships = [{ id: 'r', fromId: a.id, toId: c.id, label: 'Trusts' }];
    const first = mergeIdentity(story,'characters',a.id,b.id);
    expect(first.relationships?.[0].fromId).toBe(b.id);
    expect(first.characters.find(item => item.id === b.id)?.profile?.skills).toHaveLength(1);
    const nested = mergeIdentity(first,'characters',b.id,c.id);
    expect(() => separateIdentity(nested,'characters',c.id,a.name,[screenplay])).toThrow('Separate');
    const back = separateIdentity(nested,'characters',c.id,b.name,[screenplay]);
    const restored = separateIdentity(back,'characters',b.id,a.name,[screenplay]);
    expect(restored.relationships).toEqual(story.relationships);
    expect(restored.characters.find(item => item.id === a.id)?.profile).toEqual(a.profile);
    expect(deleteStoryEntity(restored,'characters',a.id).relationships).toEqual([]);
  });
  it('derives parent and child activity without duplicates and rejects cycles', () => {
    const { story, screenplay } = fixture();
    const court = story.locations[0];
    story.locations.push({ id:'city', name:'City', description:'' },{ id:'room',name:'Room',description:'',parentId:court.id });
    court.parentId = 'city'; story.scenes[1].locationId = 'room';
    expect(locationFamily(story,'city')).toHaveLength(3);
    expect(profileActivity(story,[screenplay],'location',court.id)).toHaveLength(2);
    expect(profileActivity(story,[screenplay],'location',court.id,true)).toHaveLength(3);
    expect(() => mergeIdentity(story,'locations','city','room')).toThrow();
    story.locations.find(item => item.id === 'city')!.parentId = 'room';
    expect(() => migrateStory(story,'p')).toThrow('Circular');
  });
  it('derives reciprocal and in-law family connections and carries discoveries forward', () => {
    const { story } = fixture(), [alex, wife, brother] = story.characters;
    alex.profile = { pronouns: 'he/him' }; wife.profile = { pronouns: 'she/her' }; brother.profile = { pronouns: 'he/him' };
    story.relationships = [
      { id: 'marriage', fromId: alex.id, toId: wife.id, type: 'Wife', label: 'Wife' },
      { id: 'siblings', fromId: wife.id, toId: brother.id, type: 'Brother', label: 'Brother', audienceDiscoversAt: { chronology: { day: 2 } } },
    ];
    const connections = effectiveRelationships(story);
    expect(connections.find(item => item.fromId === wife.id && item.toId === alex.id)?.type).toBe('Husband');
    const inLaw = connections.find(item => item.fromId === alex.id && item.toId === brother.id)!;
    expect(relationshipDisplayName(inLaw)).toBe('Brother in-law');
    expect(relationshipVisibleAt(story, inLaw, { day: 1 })).toBe(false);
    expect(relationshipVisibleAt(story, inLaw, { day: 2 })).toBe(true);
    expect(RELATIONSHIP_TYPES).toEqual(expect.arrayContaining(['Friend', 'Family friend', 'Acquaintance']));
  });
});
