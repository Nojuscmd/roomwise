import { Furniture, Opening, Room, Wall } from './types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const opposite = (wall: Wall): Wall => ({ N: 'S', S: 'N', E: 'W', W: 'E' })[wall] as Wall;

/** True for walls that run along the x axis (N and S). */
export const isHorizontalWall = (wall: Wall): boolean => wall === 'N' || wall === 'S';

/** Unit vector for a direction (y grows downward). */
export const directionVector = (wall: Wall): { x: number; y: number } =>
  ({ N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } })[wall];

export function footprint(f: Furniture): Rect {
  const swap = f.facing === 'E' || f.facing === 'W';
  return { x: f.xCm, y: f.yCm, w: swap ? f.depthCm : f.widthCm, h: swap ? f.widthCm : f.depthCm };
}

export const area = (r: Rect): number => Math.max(0, r.w) * Math.max(0, r.h);

export const center = (r: Rect): { x: number; y: number } => ({
  x: r.x + r.w / 2,
  y: r.y + r.h / 2,
});

export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Shortest distance between two rectangles (0 if they touch or overlap). */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

export const intersects = (a: Rect, b: Rect): boolean => overlapArea(a, b) > 0;

export const roomRect = (room: Room): Rect => ({ x: 0, y: 0, w: room.widthCm, h: room.depthCm });

export function insideRoom(r: Rect, room: Room, tolerance = 0.5): boolean {
  return (
    r.x >= -tolerance &&
    r.y >= -tolerance &&
    r.x + r.w <= room.widthCm + tolerance &&
    r.y + r.h <= room.depthCm + tolerance
  );
}

/** Strip directly in front of an item, as wide as the item. */
export function frontZone(f: Furniture, depth: number): Rect {
  const fp = footprint(f);
  switch (f.facing) {
    case 'N':
      return { x: fp.x, y: fp.y - depth, w: fp.w, h: depth };
    case 'S':
      return { x: fp.x, y: fp.y + fp.h, w: fp.w, h: depth };
    case 'E':
      return { x: fp.x + fp.w, y: fp.y, w: depth, h: fp.h };
    case 'W':
      return { x: fp.x - depth, y: fp.y, w: depth, h: fp.h };
  }
}

/** The two strips to the left and right of an item's long axis (relative to where it faces). */
export function sideZones(f: Furniture, depth: number): [Rect, Rect] {
  const fp = footprint(f);
  if (f.facing === 'N' || f.facing === 'S') {
    return [
      { x: fp.x - depth, y: fp.y, w: depth, h: fp.h },
      { x: fp.x + fp.w, y: fp.y, w: depth, h: fp.h },
    ];
  }
  return [
    { x: fp.x, y: fp.y - depth, w: fp.w, h: depth },
    { x: fp.x, y: fp.y + fp.h, w: fp.w, h: depth },
  ];
}

/** Strip along the wall in front of an opening, `depth` cm into the room. */
export function openingZone(o: Opening, room: Room, depth: number): Rect {
  switch (o.wall) {
    case 'N':
      return { x: o.offsetCm, y: 0, w: o.widthCm, h: depth };
    case 'S':
      return { x: o.offsetCm, y: room.depthCm - depth, w: o.widthCm, h: depth };
    case 'W':
      return { x: 0, y: o.offsetCm, w: depth, h: o.widthCm };
    case 'E':
      return { x: room.widthCm - depth, y: o.offsetCm, w: depth, h: o.widthCm };
  }
}

/** The line of sight straight through an opening, across the whole room. */
export function openingStrip(o: Opening, room: Room): Rect {
  return openingZone(o, room, isHorizontalWall(o.wall) ? room.depthCm : room.widthCm);
}

/** Gap in cm between an item's back and the wall it faces away from. */
export function gapToBackWall(f: Furniture, room: Room): number {
  const fp = footprint(f);
  switch (f.facing) {
    case 'N':
      return room.depthCm - (fp.y + fp.h);
    case 'S':
      return fp.y;
    case 'E':
      return fp.x;
    case 'W':
      return room.widthCm - (fp.x + fp.w);
  }
}

/**
 * Fraction (0..1) of `zone` that lies inside the room and is not covered by `others`.
 * Overlap among `others` is not de-duplicated, which can only make the result more pessimistic.
 */
export function freeFraction(zone: Rect, room: Room, others: Rect[]): number {
  const total = area(zone);
  if (total === 0) return 1;
  const inside = overlapArea(zone, roomRect(room));
  const blocked = others.reduce((sum, o) => sum + overlapArea(zone, o), 0);
  return Math.max(0, Math.min(1, (inside - blocked) / total));
}
