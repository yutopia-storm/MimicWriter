import type { ScreenplayElementType, TextAlignment } from './models';

export const SCREENPLAY_FORMAT = {
  sceneGapEm: 2.2,
  element: {
    scene_heading: { alignment: 'left' }, action: { alignment: 'left' }, character: { alignment: 'left' },
    parenthetical: { alignment: 'left' }, dialogue: { alignment: 'left' }, transition: { alignment: 'right' }, lyrics: { alignment: 'left' }, shot: { alignment: 'left' }, page_break: { alignment: 'center' }
  } satisfies Record<ScreenplayElementType, { alignment: TextAlignment }>
} as const;
