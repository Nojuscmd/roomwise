import {
  footprint,
  frontZone,
  freeFraction,
  gapToBackWall,
  overlapArea,
  area,
  openingZone,
  sideZones,
  rectGap,
  roomRect,
} from '../geometry';
import { Furniture, FurnitureType, Rule } from '../types';
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

/** Small tables that belong beside a sofa or bed: "Side table", "Nightstand", "End table"... */
const SIDE_TABLE_PATTERN = /side table|end table|bedside|night ?stand/i;
export const isSideTable = (item: Furniture): boolean =>
  (item.type === 'other' || item.type === 'table') && SIDE_TABLE_PATTERN.test(item.label);
/** The furniture a side table serves. */
export const SERVED_TYPES: ReadonlySet<FurnitureType> = new Set(['sofa', 'bed']);

const SIDE_TABLE_NEAR_CM = 10;
const SIDE_TABLE_FAR_CM = 120;

export const sideTablePlacement: Rule = {
  id: 'side_table_placement',
  modes: ['ergonomic', 'feng_shui'],
  evaluate: ({ items }) => {
    const served = items.filter((i) => SERVED_TYPES.has(i.type));
    if (served.length === 0) return [];
    return items.filter(isSideTable).map((table) => {
      const gap = Math.min(...served.map((s) => rectGap(footprint(table), footprint(s))));
      const score =
        gap <= SIDE_TABLE_NEAR_CM
          ? 1
          : Math.max(
              0.3,
              1 - (0.7 * (gap - SIDE_TABLE_NEAR_CM)) / (SIDE_TABLE_FAR_CM - SIDE_TABLE_NEAR_CM),
            );
      return makeResult(
        'side_table_placement',
        [table.id],
        score,
        1,
        `Keep the ${table.label} right beside the sofa or bed it belongs to, within arm's reach.`,
      );
    });
  },
};

const ANCHORED_TYPES = new Set<FurnitureType>(['sofa', 'tv_unit', 'shelf', 'wardrobe', 'bed']);
const ANCHOR_TOLERANCE_CM = 15;

/** Large pieces look and feel calmer with their back (a bed: back or long side) against a wall. */
export const wallAnchoring: Rule = {
  id: 'wall_anchoring',
  modes: ['ergonomic', 'feng_shui'],
  evaluate: ({ room, items }) =>
    items
      .filter((i) => ANCHORED_TYPES.has(i.type) || isSideTable(i))
      .map((item) => {
        const fp = footprint(item);
        const gap =
          item.type === 'bed'
            ? Math.min(fp.x, fp.y, room.widthCm - (fp.x + fp.w), room.depthCm - (fp.y + fp.h))
            : gapToBackWall(item, room);
        return makeResult(
          'wall_anchoring',
          [item.id],
          gap <= ANCHOR_TOLERANCE_CM ? 1 : 0.4,
          2,
          `Put the ${item.label} against a wall instead of floating in the room; it feels more stable and frees floor space.`,
        );
      }),
};
