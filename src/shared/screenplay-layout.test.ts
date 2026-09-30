import { describe, expect, it } from 'vitest';
import { PROFESSIONAL_LAYOUTS, professionalLayout, resolveLayout, validateLayout } from './screenplay-layout';

describe('professional screenplay layouts', () => {
  it('uses physical A4 and US Letter dimensions with valid geometry', () => {
    expect(PROFESSIONAL_LAYOUTS.a4.pageWidthMm).toBe(210); expect(PROFESSIONAL_LAYOUTS.a4.pageHeightMm).toBe(297);
    expect(PROFESSIONAL_LAYOUTS.letter.pageWidthMm).toBe(215.9); expect(PROFESSIONAL_LAYOUTS.letter.pageHeightMm).toBe(279.4);
    expect(validateLayout(professionalLayout('a4'))).toEqual([]); expect(validateLayout(professionalLayout('letter'))).toEqual([]);
  });
  it('returns mutable copies and rejects impossible geometry', () => {
    const custom = professionalLayout('a4'); custom.leftMarginMm = 190;
    expect(PROFESSIONAL_LAYOUTS.a4.leftMarginMm).toBe(38.1); expect(validateLayout(custom).length).toBeGreaterThan(0);
  });
  it('always derives parenthetical horizontal bounds from the dialogue field', () => {
    const custom = professionalLayout('a4');
    custom.elements.dialogue.leftMm = 60;
    custom.elements.dialogue.rightMm = 150;
    custom.elements.parenthetical.leftMm = 130;
    custom.elements.parenthetical.rightMm = 180;
    const resolved = resolveLayout(custom);
    expect(resolved.elements.parenthetical.leftMm).toBe(53);
    expect(resolved.elements.parenthetical.rightMm).toBe(143);
  });
});
