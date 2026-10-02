import {
  center,
  directionVector,
  footprint,
  intersects,
  isHorizontalWall,
  openingZone,
} from '../geometry';
import { Rule } from '../types';
import { makeResult } from './result';

/** Ergonomics-specific rules (comfort, glare, viewing distance). */

const TALL_TYPES = new Set(['wardrobe', 'shelf']);

export const windowGlare: Rule = {
  id: 'window_glare',
  modes: ['ergonomic'],
  evaluate: ({ openings, items }) => {
    const windows = openings.filter((o) => o.kind === 'window');
    if (windows.length === 0) return [];
    return items
      .filter((i) => i.type === 'desk')
      .map((desk) => {
        const sameAxis = windows.some(
          (w) => isHorizontalWall(w.wall) === isHorizontalWall(desk.facing),
        );
        return makeResult(
          'window_glare',
          [desk.id],
          sameAxis ? 0.4 : 1,
          2,
          'Turn the desk so your screen sits sideways to the window; a window in front or behind you causes glare.',
        );
      });
  },
};

export const windowBlocked: Rule = {
  id: 'window_blocked',
  modes: ['ergonomic'],
  evaluate: ({ room, openings, items }) =>
    items
      .filter((i) => TALL_TYPES.has(i.type))
      .flatMap((item) =>
        openings
          .filter((o) => o.kind === 'window')
          .map((win) => {
            const blocked = intersects(footprint(item), openingZone(win, room, 40));
            return makeResult(
              'window_blocked',
              [item.id],
              blocked ? 0 : 1,
              1,
              `Don't block the window with the ${item.label}; keep daylight and ventilation unobstructed.`,
            );
          }),
      ),
};

const IDEAL_TV_MIN_CM = 180;
const IDEAL_TV_MAX_CM = 350;

export const tvViewing: Rule = {
  id: 'tv_viewing',
  modes: ['ergonomic'],
  evaluate: ({ items }) => {
    const sofa = items.find((i) => i.type === 'sofa');
    const tv = items.find((i) => i.type === 'tv_unit');
    if (!sofa || !tv) return [];
    const a = center(footprint(sofa));
    const b = center(footprint(tv));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const distScore =
      dist < IDEAL_TV_MIN_CM
        ? dist / IDEAL_TV_MIN_CM
        : dist > IDEAL_TV_MAX_CM
          ? Math.max(0, 1 - (dist - IDEAL_TV_MAX_CM) / 200)
          : 1;
    const dir = directionVector(sofa.facing);
    const facingScore = dir.x * dx + dir.y * dy > 0 ? 1 : 0.3;
    return [
      makeResult(
        'tv_viewing',
        [sofa.id, tv.id],
        distScore * facingScore,
        1,
        'Face the sofa toward the TV, roughly 1.8 to 3.5 m away, for comfortable viewing.',
      ),
    ];
  },
};
