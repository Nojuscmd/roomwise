import { evaluateLayout } from '../rules';
import { bed, desk, makeLayout, wardrobe } from './fixtures';

const find = (results: ReturnType<typeof evaluateLayout>['results'], ruleId: string) =>
  results.filter((r) => r.ruleId === ruleId);

describe('common rules', () => {
  it('flags overlapping items', () => {
    const layout = makeLayout([
      bed({ xCm: 200, yCm: 0 }),
      desk({ xCm: 200, yCm: 50, facing: 'N' }),
    ]);
    const r = find(evaluateLayout(layout, 'ergonomic').results, 'no_overlap');
    expect(r.every((x) => x.score < 1)).toBe(true);
  });

  it('flags a blocked door zone', () => {
    const layout = makeLayout([wardrobe({ xCm: 40, yCm: 270, facing: 'N' })]);
    const [r] = find(evaluateLayout(layout, 'ergonomic').results, 'door_clearance');
    expect(r?.score).toBeLessThan(0.7);
  });

  it('is happy with a clear door and enough space beside the bed', () => {
    const layout = makeLayout([bed({ xCm: 200, yCm: 0 })]);
    const results = evaluateLayout(layout, 'ergonomic').results;
    expect(find(results, 'door_clearance')[0]?.score).toBe(1);
    expect(find(results, 'bed_side_clearance')[0]?.score).toBe(1);
  });

  it('penalises a bed wedged between walls with no side room', () => {
    const layout = makeLayout([
      bed({ xCm: 0, yCm: 0, widthCm: 160 }),
      wardrobe({ xCm: 160, yCm: 0, facing: 'W', widthCm: 100 }),
    ]);
    const [r] = find(evaluateLayout(layout, 'ergonomic').results, 'bed_side_clearance');
    expect(r?.score).toBeLessThan(1);
  });
});

describe('ergonomic rules', () => {
  it('penalises a desk facing the window and accepts one sideways to it', () => {
    const facingWindow = makeLayout([desk({ facing: 'N' })]);
    const sideways = makeLayout([desk({ facing: 'W' })]);
    expect(find(evaluateLayout(facingWindow, 'ergonomic').results, 'window_glare')[0]?.score).toBe(
      0.4,
    );
    expect(find(evaluateLayout(sideways, 'ergonomic').results, 'window_glare')[0]?.score).toBe(1);
  });

  it('flags a wardrobe in front of the window', () => {
    const layout = makeLayout([wardrobe({ xCm: 150, yCm: 0, facing: 'S' })]);
    const [r] = find(evaluateLayout(layout, 'ergonomic').results, 'window_blocked');
    expect(r?.score).toBe(0);
  });

  it('does not apply feng shui rules in ergonomic mode', () => {
    const results = evaluateLayout(makeLayout([bed()]), 'ergonomic').results;
    expect(find(results, 'bed_headboard')).toHaveLength(0);
  });
});

describe('feng shui rules', () => {
  it('flags the coffin position (feet toward the door, in line with it)', () => {
    // Door on the south wall at x 40-130; bed feet point south and sit in that strip.
    const layout = makeLayout([bed({ xCm: 0, yCm: 100, facing: 'S' })]);
    const [r] = find(evaluateLayout(layout, 'feng_shui').results, 'bed_door_line');
    expect(r?.score).toBe(0);
  });

  it('does not flag a bed that is off the door line', () => {
    const layout = makeLayout([bed({ xCm: 200, yCm: 0, facing: 'S' })]);
    const [r] = find(evaluateLayout(layout, 'feng_shui').results, 'bed_door_line');
    expect(r?.score).toBe(1);
  });

  it('prefers a headboard against a wall that has no window', () => {
    const underWindow = makeLayout([bed({ xCm: 130, yCm: 0, facing: 'S' })]);
    const solidWall = makeLayout([bed({ xCm: 0, yCm: 100, facing: 'E' })]);
    const a =
      find(evaluateLayout(underWindow, 'feng_shui').results, 'bed_headboard')[0]?.score ?? 0;
    const b = find(evaluateLayout(solidWall, 'feng_shui').results, 'bed_headboard')[0]?.score ?? 0;
    expect(a).toBe(0.5);
    expect(b).toBe(1);
  });

  it('scores a desk with its back to a solid wall higher than a floating one', () => {
    const wall = makeLayout([desk({ facing: 'W', xCm: 340, yCm: 120 })]);
    const floating = makeLayout([desk({ facing: 'W', xCm: 150, yCm: 120 })]);
    const a = find(evaluateLayout(wall, 'feng_shui').results, 'command_position')[0]?.score ?? 0;
    const b =
      find(evaluateLayout(floating, 'feng_shui').results, 'command_position')[0]?.score ?? 0;
    expect(a).toBeGreaterThan(b);
  });
});
