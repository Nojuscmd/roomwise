import {
  footprint,
  frontZone,
  freeFraction,
  overlapArea,
  area,
  openingZone,
  sideZones,
  roomRect,
} from '../geometry';
import { FurnitureType, Rule } from '../types';
import { makeResult } from './result';

/** Rules that apply regardless of mode. */

const FRONT_CLEARANCE_CM: Partial<Record<FurnitureType, number>> = {
  desk: 90,
  sofa: 60,
  wardrobe: 80,
  shelf: 60,
};

export const DOOR_CLEARANCE_CM = 90;
export const BED_SIDE_CLEARANCE_CM = 60;

export const noOverlap: Rule = {
  id: 'no_overlap',
  modes: ['ergonomic', 'feng_shui'],
  evaluate: ({ room, items }) =>
    items.map((item) => {
      const fp = footprint(item);
      const total = area(fp);
      const outside = total - overlapArea(fp, roomRect(room));
      const overlapping = items
        .filter((o) => o.id !== item.id)
        .reduce((sum, o) => sum + overlapArea(fp, footprint(o)), 0);
      const score = total === 0 ? 1 : 1 - Math.min(1, (outside + overlapping) / total);
      return makeResult(
        'no_overlap',
        [item.id],
        score,
        3,
        `The ${item.label} overlaps another item or the wall; it needs its own space.`,
      );
    }),
};

export const frontClearance: Rule = {
  id: 'front_clearance',
  modes: ['ergonomic', 'feng_shui'],
  evaluate: ({ room, items }) =>
    items.flatMap((item) => {
      const depth = FRONT_CLEARANCE_CM[item.type];
      if (!depth) return [];
      const others = items.filter((o) => o.id !== item.id).map(footprint);
      const free = freeFraction(frontZone(item, depth), room, others);
      return [
        makeResult(
          'front_clearance',
          [item.id],
          free,
          2,
          `Keep about ${depth} cm free in front of the ${item.label} so you can use it comfortably.`,
        ),
      ];
    }),
};

export const bedSideClearance: Rule = {
  id: 'bed_side_clearance',
  modes: ['ergonomic', 'feng_shui'],
  evaluate: ({ room, items }) =>
    items
      .filter((i) => i.type === 'bed')
      .map((bed) => {
        const others = items.filter((o) => o.id !== bed.id).map(footprint);
        const [a, b] = sideZones(bed, BED_SIDE_CLEARANCE_CM);
        const best = Math.max(freeFraction(a, room, others), freeFraction(b, room, others));
        return makeResult(
          'bed_side_clearance',
          [bed.id],
          best,
          2,
          `Leave at least ${BED_SIDE_CLEARANCE_CM} cm free beside the bed so you can get in and out easily.`,
        );
      }),
};

export const doorClearance: Rule = {
  id: 'door_clearance',
  modes: ['ergonomic', 'feng_shui'],
  evaluate: ({ room, openings, items }) =>
    openings
      .filter((o) => o.kind === 'door')
      .map((door) => {
        const zone = openingZone(door, room, DOOR_CLEARANCE_CM);
        const free = freeFraction(zone, room, items.map(footprint));
        return makeResult(
          'door_clearance',
          items.filter((i) => overlapArea(zone, footprint(i)) > 0).map((i) => i.id),
          free,
          3,
          `Keep the area inside the door (about ${DOOR_CLEARANCE_CM} cm) clear so it opens fully and the entry feels open.`,
        );
      }),
};
