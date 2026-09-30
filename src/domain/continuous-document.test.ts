import { describe, expect, it } from 'vitest';
import { createElement, createScreenplay, insertScene } from './screenplay';
import { makeDualDialogue } from './screenplay-editing';
import { continuousDocumentToScreenplay, screenplayToContinuousDocument } from './continuous-document';

describe('continuous document adapter', () => {
  it('round-trips identities, scenes, formatting, alignment, locks and metadata without touching timestamps', () => {
    let screenplay = insertScene(createScreenplay({ projectId: crypto.randomUUID(), title: 'Parity', screenplayType: 'feature' }, '2026-01-01T00:00:00.000Z'));
    screenplay.scenes[0].locked = true; screenplay.scenes[0].elements[0].content = 'INT. ROOM - NIGHT';
    screenplay.scenes[0].elements[1] = { ...screenplay.scenes[0].elements[1], content: 'A red lamp.', alignment: 'justify', formatting: [{ start: 2, end: 5, bold: true, italic: true, color: '#ff0000', backgroundColor: '#ffff00' }] };
    screenplay.scenes[1].elements = [createElement('character', 'MARA (V.O.)', 0), createElement('dialogue', 'Stop.', 1), createElement('character', 'JUNE', 2), createElement('parenthetical', '(overlapping)', 3), createElement('dialogue', 'No.', 4)];
    screenplay.scenes[1] = makeDualDialogue(screenplay.scenes[1], [screenplay.scenes[1].elements[0].id, screenplay.scenes[1].elements[2].id], 'dual-fixed');
    const result = continuousDocumentToScreenplay(screenplay, screenplayToContinuousDocument(screenplay));
    expect(result).toEqual(screenplay);
  });

  it('can project one scene without deleting unprojected scenes on conversion', () => {
    const screenplay = insertScene(createScreenplay({ projectId: crypto.randomUUID(), title: 'Scene', screenplayType: 'feature' })); const second = screenplay.scenes[1];
    const result = continuousDocumentToScreenplay(screenplay, screenplayToContinuousDocument(screenplay, second.id));
    expect(result.scenes).toEqual(screenplay.scenes);
  });

  it('preserves trailing and internal soft line breaks as plain-text newlines', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Line breaks', screenplayType: 'feature' });
    screenplay.scenes[0].elements[1].content = 'First\nSecond\n';

    const document = screenplayToContinuousDocument(screenplay);
    const result = continuousDocumentToScreenplay(screenplay, document);

    expect(result.scenes[0].elements[1].content).toBe('First\nSecond\n');
  });

  it('turns an additional continuous heading into a real scene', () => {
    const screenplay = createScreenplay({ projectId: crypto.randomUUID(), title: 'Continuous', screenplayType: 'feature' });
    screenplay.scenes[0].elements = [
      createElement('scene_heading', 'INT. ROOM - DAY', 0),
      createElement('action', 'First.', 1),
      createElement('scene_heading', 'EXT. ROAD - NIGHT', 2),
      createElement('action', 'Second.', 3),
    ];
    const result = continuousDocumentToScreenplay(screenplay, screenplayToContinuousDocument(screenplay));
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[1].elements[0]).toMatchObject({ type: 'scene_heading', content: 'EXT. ROAD - NIGHT' });
  });
});
