import { footprint, insideRoom, intersects } from '../geometry';
import { evaluateLayout } from '../rules';
import { suggestArrangement } from '../solver';
import { Mode } from '../types';
import { bed, desk, makeLayout, wardrobe } from './fixtures';

const messy = () =>
  makeLayout([
    // Feet toward the door, in line with it, under nothing: a classic feng shui problem.
    bed({ xCm: 0, yCm: 100, facing: 'S' }),
    // Facing the window and slightly blocking the door side.
    desk({ xCm: 150, yCm: 0, facing: 'N' }),
    // Standing in front of the window.
    wardrobe({ xCm: 250, yCm: 0, facing: 'S' }),
  ]);

describe.each<Mode>(['ergonomic', 'feng_shui'])('suggestArrangement (%s)', (mode) => {
  it('never makes the layout worse', () => {
    const result = suggestArrangement(messy(), mode);
    expect(result.scoreAfter).toBeGreaterThanOrEqual(result.scoreBefore);
  });

  it('returns a valid layout: inside the room, no overlaps', () => {
    const layout = messy();
    const { items } = suggestArrangement(layout, mode);
    expect(items).toHaveLength(layout.items.length);
    items.forEach((a, i) => {
      expect(insideRoom(footprint(a), layout.room)).toBe(true);
      items.slice(i + 1).forEach((b) => expect(intersects(footprint(a), footprint(b))).toBe(false));
    });
  });

  it('keeps the doorway clear', () => {
    const layout = messy();
    const { items } = suggestArrangement(layout, mode);
    const { results } = evaluateLayout({ ...layout, items }, mode);
    results.filter((r) => r.ruleId === 'door_clearance').forEach((r) => expect(r.score).toBe(1));
  });

  it('is deterministic', () => {
    expect(suggestArrangement(messy(), mode)).toEqual(suggestArrangement(messy(), mode));
  });

  it('explains each move with at least one reason', () => {
    const { moves } = suggestArrangement(messy(), mode);
    expect(moves.length).toBeGreaterThan(0);
    moves.forEach((m) => expect(m.reasons.length).toBeGreaterThan(0));
  });

  it('does not mutate its input', () => {
    const layout = messy();
    const snapshot = JSON.parse(JSON.stringify(layout));
    suggestArrangement(layout, mode);
    expect(layout).toEqual(snapshot);
  });
});

describe('suggestArrangement outcomes', () => {
  it('fixes the coffin position in feng shui mode', () => {
    const { items } = suggestArrangement(messy(), 'feng_shui');
    const { results } = evaluateLayout({ ...messy(), items }, 'feng_shui');
    expect(results.find((r) => r.ruleId === 'bed_door_line')?.score).toBe(1);
    expect(results.find((r) => r.ruleId === 'bed_headboard')?.score).toBe(1);
  });

  it('turns the desk sideways to the window in ergonomic mode', () => {
    const { items } = suggestArrangement(messy(), 'ergonomic');
    const { results } = evaluateLayout({ ...messy(), items }, 'ergonomic');
    expect(results.find((r) => r.ruleId === 'window_glare')?.score).toBe(1);
    expect(results.find((r) => r.ruleId === 'window_blocked')?.score).toBe(1);
  });

  it('cites door clearance when it moves an item out of the doorway', () => {
    const { moves } = suggestArrangement(messy(), 'ergonomic');
    const bedMove = moves.find((m) => m.itemId === 'bed');
    expect(bedMove?.reasons.some((r) => r.includes('door'))).toBe(true);
  });

  it('leaves a room alone when it is already good', () => {
    const good = makeLayout([bed({ xCm: 100, yCm: 0 }), desk({ xCm: 340, yCm: 120, facing: 'W' })]);
    const result = suggestArrangement(good, 'ergonomic');
    expect(result.scoreBefore).toBeGreaterThan(0.95);
    expect(result.moves).toEqual([]);
    expect(result.items).toEqual(good.items);
  });

  it('only keeps moves that gain more than the minimum improvement (3 points)', () => {
    const { moves, scoreBefore, scoreAfter } = suggestArrangement(messy(), 'ergonomic');
    expect(moves.length).toBeGreaterThan(0);
    expect(scoreAfter - scoreBefore).toBeGreaterThan(0.03);
  });

  it('handles an empty room', () => {
    const result = suggestArrangement(makeLayout([]), 'ergonomic');
    expect(result.items).toEqual([]);
    expect(result.moves).toEqual([]);
  });

  it('keeps an item that cannot fit anywhere where it was', () => {
    const huge = wardrobe({ id: 'huge', widthCm: 900, depthCm: 900, xCm: 0, yCm: 0 });
    const result = suggestArrangement(makeLayout([huge]), 'ergonomic');
    expect(result.items[0]).toEqual(huge);
  });
});
