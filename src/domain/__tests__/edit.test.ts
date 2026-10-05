import { footprint, insideRoom, intersects } from '../geometry';
import {
  addItem,
  addOpening,
  cycleOpeningWall,
  layoutToAnalysisJson,
  moveItem,
  moveOpening,
  removeItem,
  removeOpening,
  resizeOpening,
  isRefused,
  renameItem,
  resizeItem,
  rotateItem,
  setItemType,
  setRoomSize,
} from '../edit';
import { parseRoomAnalysis } from '../validate';
import { bed, desk, makeLayout } from './fixtures';

const layout = () => makeLayout([bed(), desk()]);
const find = (l: ReturnType<typeof layout>, id: string) => l.items.find((i) => i.id === id)!;

describe('item edits', () => {
  it('moves an item and keeps it inside the room', () => {
    const moved = moveItem(layout(), 'bed', 10, 20);
    expect(find(moved, 'bed')).toMatchObject({ xCm: 140, yCm: 20 });
    const far = moveItem(layout(), 'bed', 5000, 5000);
    expect(insideRoom(footprint(find(far, 'bed')), far.room)).toBe(true);
    const negative = moveItem(layout(), 'bed', -5000, -5000);
    expect(find(negative, 'bed')).toMatchObject({ xCm: 0, yCm: 0 });
  });

  it('does not mutate its input', () => {
    const l = layout();
    const snapshot = JSON.parse(JSON.stringify(l));
    moveItem(l, 'bed', 10, 10);
    rotateItem(l, 'bed');
    addItem(l, 'sofa');
    expect(l).toEqual(snapshot);
  });

  it('rotates a quarter turn clockwise and stays inside the room', () => {
    const open = makeLayout([bed(), desk({ yCm: 250 })]);
    const turned = rotateItem(open, 'desk');
    expect(find(turned, 'desk').facing).toBe('N');
    expect(insideRoom(footprint(find(turned, 'desk')), turned.room)).toBe(true);
    let spun = open;
    for (let i = 0; i < 4; i++) spun = rotateItem(spun, 'desk');
    expect(find(spun, 'desk').facing).toBe('W');
  });

  it('refuses to rotate an item that would no longer fit', () => {
    const tight = {
      ...makeLayout([bed({ facing: 'S', xCm: 0, yCm: 0, widthCm: 380, depthCm: 100 })]),
    };
    const turned = rotateItem(tight, 'bed');
    expect(find(turned, 'bed').facing).toBe('S');
  });

  it('resizes within limits and never outgrows the room', () => {
    expect(find(resizeItem(layout(), 'bed', 10, -10), 'bed')).toMatchObject({
      widthCm: 170,
      depthCm: 190,
    });
    expect(find(resizeItem(layout(), 'bed', -1000, -1000), 'bed')).toMatchObject({
      widthCm: 20,
      depthCm: 20,
    });
    const huge = resizeItem(layout(), 'bed', 1000, 1000);
    expect(insideRoom(footprint(find(huge, 'bed')), huge.room)).toBe(true);
  });

  it('renames, retypes and removes', () => {
    expect(find(renameItem(layout(), 'bed', 'Guest bed'), 'bed').label).toBe('Guest bed');
    expect(find(setItemType(layout(), 'desk', 'table'), 'desk').type).toBe('table');
    expect(removeItem(layout(), 'bed').items.map((i) => i.id)).toEqual(['desk']);
  });

  it('adds an item in free space with a fresh id', () => {
    const { layout: next, id } = addItem(layout(), 'sofa');
    expect(next.items).toHaveLength(3);
    expect(new Set(next.items.map((i) => i.id)).size).toBe(3);
    const added = find(next, id);
    expect(added.label).toBe('Sofa');
    expect(insideRoom(footprint(added), next.room)).toBe(true);
    next.items
      .filter((i) => i.id !== id)
      .forEach((o) => expect(intersects(footprint(added), footprint(o))).toBe(false));
  });

  it('still adds an item when the room is full', () => {
    const full = makeLayout([bed({ widthCm: 400, depthCm: 350, xCm: 0, yCm: 0 })]);
    const { layout: next } = addItem(full, 'other');
    expect(next.items).toHaveLength(2);
  });
});

describe('room and openings', () => {
  it('resizes the room and pulls items and openings back inside', () => {
    const smaller = setRoomSize(layout(), 300, 250);
    expect(smaller.room).toEqual({ widthCm: 300, depthCm: 250 });
    smaller.items.forEach((i) => expect(insideRoom(footprint(i), smaller.room)).toBe(true));
    smaller.openings.forEach((o) => {
      const length = o.wall === 'N' || o.wall === 'S' ? 300 : 250;
      expect(o.offsetCm + o.widthCm).toBeLessThanOrEqual(length);
    });
    expect(setRoomSize(layout(), 5, 99999).room).toEqual({ widthCm: 150, depthCm: 2000 });
  });

  it('adds, moves, re-walls and removes openings', () => {
    const { layout: withDoor, id } = addOpening(makeLayout([]), 'door', 'N');
    const door = withDoor.openings.find((o) => o.id === id)!;
    expect(door).toMatchObject({ kind: 'door', wall: 'N', widthCm: 90 });
    expect(new Set(withDoor.openings.map((o) => o.id)).size).toBe(withDoor.openings.length);

    const moved = moveOpening(withDoor, id, 100000);
    const m = moved.openings.find((o) => o.id === id)!;
    expect(m.offsetCm + m.widthCm).toBe(400);

    const walled = cycleOpeningWall(withDoor, id);
    expect(walled.openings.find((o) => o.id === id)!.wall).toBe('E');
    expect(removeOpening(withDoor, id).openings.find((o) => o.id === id)).toBe(undefined);
  });
});

describe('layoutToAnalysisJson', () => {
  it('round-trips through the validator', () => {
    const edited = rotateItem(moveItem(layout(), 'bed', 20, 0), 'desk');
    const json = layoutToAnalysisJson(edited, 'Checked by me.');
    const parsed = parseRoomAnalysis(json);
    expect(parsed.confidence).toBe(1);
    expect(parsed.notes).toBe('Checked by me.');
    expect(parsed.layout.room).toEqual(edited.room);
    expect(parsed.layout.items.map((i) => ({ ...i, id: '' }))).toEqual(
      edited.items.map((i) => ({ ...i, id: '' })),
    );
    expect(parsed.layout.openings).toHaveLength(edited.openings.length);
  });
});

describe('collisions', () => {
  // bed fills x 130-290, y 0-200; a second bed-sized item sits to its right at x 300.
  const crowded = () => makeLayout([bed(), desk({ xCm: 300, yCm: 0, facing: 'W' })]);

  it('refuses a move that would stack one item on another', () => {
    const l = crowded();
    // The desk starts 10 cm from the bed, so a 50 cm push left slides to touching, not overlapping.
    const slid = moveItem(l, 'desk', -50, 0);
    expect(find(slid, 'desk').xCm).toBe(290);
    // Now it touches the bed, so there is nowhere left to go.
    expect(isRefused(slid, moveItem(slid, 'desk', -10, 0))).toBe(true);
  });

  it('slides to touch a neighbour when the gap is smaller than one step', () => {
    const l = makeLayout([bed(), desk({ xCm: 297, yCm: 0, facing: 'W' })]);
    const result = moveItem(l, 'desk', -10, 0);
    expect(find(result, 'desk').xCm).toBe(290);
  });

  it('allows moves into free space', () => {
    const l = crowded();
    const result = moveItem(l, 'desk', 0, 100);
    expect(isRefused(l, result)).toBe(false);
    expect(find(result, 'desk').yCm).toBe(100);
  });

  it('refuses to rotate or resize into a neighbour', () => {
    const l = makeLayout([bed(), desk({ xCm: 292, yCm: 0, facing: 'W' })]);
    expect(isRefused(l, resizeItem(l, 'bed', 20, 0))).toBe(true);
    const tight = makeLayout([bed({ xCm: 0, yCm: 0 }), desk({ xCm: 170, yCm: 100, facing: 'W' })]);
    expect(isRefused(tight, rotateItem(tight, 'bed'))).toBe(true);
  });

  it('lets the user move an item out of an existing overlap, but not into another', () => {
    const l = makeLayout([bed(), desk({ xCm: 250, yCm: 0, facing: 'W' })]);
    const out = moveItem(l, 'desk', 100, 0);
    expect(isRefused(l, out)).toBe(false);
    expect(find(out, 'desk').xCm).toBe(340);
  });
});

describe('opening size', () => {
  it('widens and narrows within limits and stays on the wall', () => {
    const l = makeLayout([]);
    const wider = resizeOpening(l, 'door', 30);
    expect(wider.openings.find((o) => o.id === 'door')?.widthCm).toBe(120);
    const tiny = resizeOpening(l, 'door', -1000);
    expect(tiny.openings.find((o) => o.id === 'door')?.widthCm).toBe(40);
    const huge = resizeOpening(l, 'door', 5000);
    const door = huge.openings.find((o) => o.id === 'door')!;
    expect(door.widthCm).toBe(400);
    expect(door.offsetCm).toBe(0);
  });
});
