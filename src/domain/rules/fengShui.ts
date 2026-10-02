import {
  area,
  center,
  footprint,
  gapToBackWall,
  intersects,
  openingStrip,
  openingZone,
  opposite,
} from '../geometry';
import { Rule } from '../types';
import { makeResult } from './result';

/** Feng shui rules, based on the widely taught "command position" principles. */

const TOUCH_CM = 15;

function wallContactScore(gap: number): number {
  return gap <= TOUCH_CM ? 1 : Math.max(0.2, 1 - gap / 150);
}

export const bedHeadboard: Rule = {
  id: 'bed_headboard',
  modes: ['feng_shui'],
  evaluate: ({ room, openings, items }) =>
    items
      .filter((i) => i.type === 'bed')
      .map((bed) => {
        const backWall = opposite(bed.facing);
        let score = wallContactScore(gapToBackWall(bed, room));
        const underWindow = openings.some(
          (o) =>
            o.kind === 'window' &&
            o.wall === backWall &&
            intersects(footprint(bed), openingZone(o, room, 30)),
        );
        if (underWindow) score *= 0.5;
        return makeResult(
          'bed_headboard',
          [bed.id],
          score,
          3,
          'Place the bed with its headboard against a solid wall, not under a window, for a sense of support.',
        );
      }),
};

export const bedDoorLine: Rule = {
  id: 'bed_door_line',
  modes: ['feng_shui'],
  evaluate: ({ room, openings, items }) =>
    items
      .filter((i) => i.type === 'bed')
      .map((bed) => {
        const doors = openings.filter((o) => o.kind === 'door');
        let score = 1;
        for (const door of doors) {
          const inLine = intersects(footprint(bed), openingStrip(door, room));
          if (inLine && bed.facing === door.wall) score = Math.min(score, 0);
          else if (inLine) score = Math.min(score, 0.85);
        }
        return makeResult(
          'bed_door_line',
          [bed.id],
          score,
          3,
          'Avoid having the bed\'s feet point straight at the door (the "coffin position").',
        );
      }),
};

export const commandPosition: Rule = {
  id: 'command_position',
  modes: ['feng_shui'],
  evaluate: ({ room, openings, items }) =>
    items
      .filter((i) => i.type === 'desk')
      .map((desk) => {
        const backWall = opposite(desk.facing);
        const fp = footprint(desk);
        const doors = openings.filter((o) => o.kind === 'door');
        const wallScore = 0.5 * wallContactScore(gapToBackWall(desk, room));
        const openingBehind = openings.some(
          (o) => intersects(fp, openingZone(o, room, 30)) && o.wall === backWall,
        );
        const solidScore = openingBehind ? 0 : 0.25;
        const seesDoor = doors.length === 0 || doors.some((d) => d.wall !== backWall);
        const viewScore = seesDoor ? 0.25 : 0;
        let score = wallScore + solidScore + viewScore;
        if (doors.some((d) => intersects(fp, openingStrip(d, room)))) score *= 0.6;
        return makeResult(
          'command_position',
          [desk.id],
          score,
          2,
          'Put the desk in the "command position": solid wall behind you, a view of the door, but not directly in line with it.',
        );
      }),
};

export const balance: Rule = {
  id: 'balance',
  modes: ['feng_shui'],
  evaluate: ({ room, items }) => {
    if (items.length < 3) return [];
    let totalArea = 0;
    let cx = 0;
    let cy = 0;
    for (const item of items) {
      const fp = footprint(item);
      const a = area(fp);
      const c = center(fp);
      totalArea += a;
      cx += c.x * a;
      cy += c.y * a;
    }
    if (totalArea === 0) return [];
    const dx = (cx / totalArea - room.widthCm / 2) / (room.widthCm / 2);
    const dy = (cy / totalArea - room.depthCm / 2) / (room.depthCm / 2);
    const offset = Math.hypot(dx, dy);
    const score = offset <= 0.25 ? 1 : Math.max(0.3, 1 - (offset - 0.25) * 1.5);
    return [
      makeResult(
        'balance',
        items.map((i) => i.id),
        score,
        1,
        'Spread furniture more evenly so no side of the room feels heavy and energy can flow.',
      ),
    ];
  },
};
