import {
  footprint,
  frontZone,
  freeFraction,
  gapToBackWall,
  insideRoom,
  intersects,
  openingStrip,
  openingZone,
  opposite,
  overlapArea,
  sideZones,
} from '../geometry';
import { bed, desk, makeLayout } from './fixtures';

describe('geometry', () => {
  it('swaps footprint dimensions when facing east or west', () => {
    expect(footprint(desk({ facing: 'N' }))).toMatchObject({ w: 120, h: 60 });
    expect(footprint(desk({ facing: 'E' }))).toMatchObject({ w: 60, h: 120 });
  });

  it('computes overlap area and intersection', () => {
    const a = { x: 0, y: 0, w: 100, h: 100 };
    const b = { x: 50, y: 50, w: 100, h: 100 };
    expect(overlapArea(a, b)).toBe(2500);
    expect(intersects(a, { x: 100, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('opposite() maps each wall to the other side', () => {
    expect(opposite('N')).toBe('S');
    expect(opposite('E')).toBe('W');
  });

  it('places the front zone on the side the item faces', () => {
    const d = desk({ facing: 'N', xCm: 100, yCm: 200 });
    expect(frontZone(d, 90)).toEqual({ x: 100, y: 110, w: 120, h: 90 });
    const e = desk({ facing: 'E', xCm: 100, yCm: 100 });
    expect(frontZone(e, 90)).toEqual({ x: 160, y: 100, w: 90, h: 120 });
  });

  it('returns side zones on both long sides of a bed', () => {
    const [left, right] = sideZones(bed({ xCm: 100, yCm: 0 }), 60);
    expect(left).toEqual({ x: 40, y: 0, w: 60, h: 200 });
    expect(right).toEqual({ x: 260, y: 0, w: 60, h: 200 });
  });

  it('measures the gap to the back wall for each facing', () => {
    const room = makeLayout([]).room;
    expect(gapToBackWall(bed({ facing: 'S', yCm: 0 }), room)).toBe(0);
    expect(gapToBackWall(desk({ facing: 'W', xCm: 300 }), room)).toBe(400 - (300 + 60));
  });

  it('builds opening zones and strips', () => {
    const { room, openings } = makeLayout([]);
    const door = openings[0]!;
    expect(openingZone(door, room, 90)).toEqual({ x: 40, y: 260, w: 90, h: 90 });
    expect(openingStrip(door, room)).toEqual({ x: 40, y: 0, w: 90, h: 350 });
  });

  it('reports free fraction accounting for blockers and room bounds', () => {
    const room = makeLayout([]).room;
    const zone = { x: 0, y: 0, w: 100, h: 100 };
    expect(freeFraction(zone, room, [])).toBe(1);
    expect(freeFraction(zone, room, [{ x: 0, y: 0, w: 50, h: 100 }])).toBe(0.5);
    expect(freeFraction({ x: -50, y: 0, w: 100, h: 100 }, room, [])).toBe(0.5);
  });

  it('insideRoom detects items that stick out', () => {
    const room = makeLayout([]).room;
    expect(insideRoom({ x: 0, y: 0, w: 400, h: 350 }, room)).toBe(true);
    expect(insideRoom({ x: 300, y: 0, w: 150, h: 10 }, room)).toBe(false);
  });
});
