import type { ScreenplayElementType } from './models';

export type PaperSize = 'a4' | 'letter';
export interface HorizontalBounds { leftMm: number; rightMm: number; }
export interface DualDialogueGeometry { left: HorizontalBounds; right: HorizontalBounds; gapMm: number; characterInsetMm: number; parentheticalInsetMm: number; }
export interface ScreenplayLayout {
  preset: 'a4-professional' | 'letter-professional'; paperSize: PaperSize;
  pageWidthMm: number; pageHeightMm: number; topMarginMm: number; bottomMarginMm: number; leftMarginMm: number; rightMarginMm: number;
  headerTopMm: number; footerBottomMm: number; fontFamily: string; fontSizePt: number; lineHeight: number;
  elements: Record<ScreenplayElementType, HorizontalBounds & { spaceBeforeLines: number; spaceAfterLines: number }>;
  dualDialogue: DualDialogueGeometry;
}

const element = (leftMm: number, rightMm: number, spaceBeforeLines: number, spaceAfterLines: number) => ({ leftMm, rightMm, spaceBeforeLines, spaceAfterLines });

// Measurements are stored in millimetres. Letter values derived from inch-based
// professional screenplay conventions retain their exact metric conversions.
export const PROFESSIONAL_LAYOUTS: Record<PaperSize, Readonly<ScreenplayLayout>> = {
  a4: {
    preset: 'a4-professional', paperSize: 'a4', pageWidthMm: 210, pageHeightMm: 297,
    topMarginMm: 25.4, bottomMarginMm: 25.4, leftMarginMm: 38.1, rightMarginMm: 25.4,
    headerTopMm: 12.7, footerBottomMm: 12.7, fontFamily: '"Courier New", Courier, monospace', fontSizePt: 12, lineHeight: 1,
    elements: {
      scene_heading: element(38.1, 184.6, 2, 1), action: element(38.1, 184.6, 1, 1),
      character: element(93.98, 165.1, 1, 0), dialogue: element(63.5, 152.4, 0, 1),
      parenthetical: element(78.74, 139.7, 0, 0), transition: element(139.7, 184.6, 1, 1),
      lyrics: element(63.5, 152.4, 1, 1),
      shot: element(38.1, 184.6, 1, 1),
      page_break: element(38.1, 184.6, 1, 1)
    },
    dualDialogue: { left: { leftMm: 44.45, rightMm: 108.4 }, right: { leftMm: 114.75, rightMm: 178.7 }, gapMm: 6.35, characterInsetMm: 19.05, parentheticalInsetMm: 6.35 }
  },
  letter: {
    preset: 'letter-professional', paperSize: 'letter', pageWidthMm: 215.9, pageHeightMm: 279.4,
    topMarginMm: 25.4, bottomMarginMm: 25.4, leftMarginMm: 38.1, rightMarginMm: 25.4,
    headerTopMm: 12.7, footerBottomMm: 12.7, fontFamily: '"Courier New", Courier, monospace', fontSizePt: 12, lineHeight: 1,
    elements: {
      scene_heading: element(38.1, 190.5, 2, 1), action: element(38.1, 190.5, 1, 1),
      character: element(93.98, 171.45, 1, 0), dialogue: element(63.5, 152.4, 0, 1),
      parenthetical: element(78.74, 139.7, 0, 0), transition: element(146.05, 190.5, 1, 1),
      lyrics: element(63.5, 152.4, 1, 1),
      shot: element(38.1, 190.5, 1, 1),
      page_break: element(38.1, 190.5, 1, 1)
    },
    dualDialogue: { left: { leftMm: 44.45, rightMm: 111.12 }, right: { leftMm: 117.47, rightMm: 184.15 }, gapMm: 6.35, characterInsetMm: 19.05, parentheticalInsetMm: 6.35 }
  }
};

export function professionalLayout(size: PaperSize): ScreenplayLayout { return structuredClone(PROFESSIONAL_LAYOUTS[size]); }
export function resolveLayout(layout?: ScreenplayLayout, locale: 'en-GB' | 'en-US' = 'en-GB'): ScreenplayLayout {
  const fallback = professionalLayout(layout?.paperSize ?? (locale === 'en-US' ? 'letter' : 'a4'));
  const resolved = layout ? { ...structuredClone(layout), elements: { ...fallback.elements, ...structuredClone(layout.elements) } } : fallback;
  return resolved;
}
export function validateLayout(layout: ScreenplayLayout): string[] {
  const errors: string[] = []; const writingRight = layout.pageWidthMm - layout.rightMarginMm;
  if (layout.leftMarginMm + layout.rightMarginMm >= layout.pageWidthMm - 30) errors.push('Left and right page margins leave no usable writing area.');
  if (layout.topMarginMm + layout.bottomMarginMm >= layout.pageHeightMm - 50) errors.push('Top and bottom margins leave no usable page height.');
  if (layout.headerTopMm >= layout.topMarginMm) errors.push('Header position must be above the writing area.');
  if (layout.footerBottomMm >= layout.bottomMarginMm) errors.push('Page number position must be below the writing area.');
  for (const [name, bounds] of Object.entries(layout.elements)) if (bounds.leftMm < layout.leftMarginMm - .01 || bounds.rightMm > writingRight + .01 || bounds.rightMm - bounds.leftMm < 20) errors.push(`${name.replace('_', ' ')} must remain usable and inside the writing area.`);
  const dual = layout.dualDialogue; if (dual.left.leftMm < layout.leftMarginMm || dual.right.rightMm > writingRight || dual.left.rightMm + dual.gapMm > dual.right.leftMm || dual.left.rightMm <= dual.left.leftMm || dual.right.rightMm <= dual.right.leftMm) errors.push('Dual Dialogue columns must be usable, separated and inside the writing area.');
  return errors;
}

export function layoutCss(layout: ScreenplayLayout) {
  const variables: Record<string, string | number> = {
    '--page-width': `${layout.pageWidthMm}mm`, '--page-height': `${layout.pageHeightMm}mm`, '--page-top': `${layout.topMarginMm}mm`, '--page-bottom': `${layout.bottomMarginMm}mm`, '--page-left': `${layout.leftMarginMm}mm`, '--page-right': `${layout.rightMarginMm}mm`, '--header-top': `${layout.headerTopMm}mm`, '--footer-bottom': `${layout.footerBottomMm}mm`, '--script-font': layout.fontFamily, '--script-size': `${layout.fontSizePt}pt`, '--script-leading': layout.lineHeight,
    '--writing-width': `${layout.pageWidthMm - layout.leftMarginMm - layout.rightMarginMm}mm`, '--dual-left': `${layout.dualDialogue.left.leftMm - layout.leftMarginMm}mm`, '--dual-left-width': `${layout.dualDialogue.left.rightMm - layout.dualDialogue.left.leftMm}mm`, '--dual-right': `${layout.dualDialogue.right.leftMm - layout.leftMarginMm}mm`, '--dual-right-width': `${layout.dualDialogue.right.rightMm - layout.dualDialogue.right.leftMm}mm`, '--dual-gap': `${layout.dualDialogue.gapMm}mm`
  };
  for (const [type, bounds] of Object.entries(layout.elements)) { variables[`--${type}-left`] = `${bounds.leftMm - layout.leftMarginMm}mm`; variables[`--${type}-width`] = `${bounds.rightMm - bounds.leftMm}mm`; variables[`--${type}-before`] = `${bounds.spaceBeforeLines}em`; variables[`--${type}-after`] = `${bounds.spaceAfterLines}em`; }
  return variables;
}
