import { AnalysisError, parseRoomAnalysis } from '../validate';

const valid = {
  room: { widthCm: 400, depthCm: 350 },
  openings: [{ kind: 'door', wall: 'S', offsetCm: 40, widthCm: 90 }],
  furniture: [
    { type: 'bed', label: 'Double bed', xCm: 100, yCm: 0, widthCm: 160, depthCm: 200, facing: 'S' },
  ],
  confidence: 0.8,
  notes: 'ok',
};

describe('parseRoomAnalysis', () => {
  it('accepts well-formed analysis', () => {
    const r = parseRoomAnalysis(valid);
    expect(r.layout.items).toHaveLength(1);
    expect(r.layout.openings[0]?.kind).toBe('door');
    expect(r.confidence).toBe(0.8);
  });

  it.each([null, 'text', 42, [], {}, { room: {} }, { room: { widthCm: 'a', depthCm: 3 } }])(
    'rejects unusable input %p',
    (input) => {
      expect(() => parseRoomAnalysis(input)).toThrow(AnalysisError);
    },
  );

  it('clamps absurd room sizes', () => {
    const r = parseRoomAnalysis({ ...valid, room: { widthCm: 99999, depthCm: 5 } });
    expect(r.layout.room).toEqual({ widthCm: 2000, depthCm: 150 });
  });

  it('maps unknown furniture types to "other" and drops invalid entries', () => {
    const r = parseRoomAnalysis({
      ...valid,
      furniture: [
        { type: 'hammock', widthCm: 100, depthCm: 50, facing: 'N' },
        { type: 'bed', widthCm: -5, depthCm: 50, facing: 'N' },
        'garbage',
        { type: 'bed', widthCm: 5000, depthCm: 5000, facing: 'N' },
      ],
    });
    expect(r.layout.items).toHaveLength(1);
    expect(r.layout.items[0]?.type).toBe('other');
  });

  it('pulls items back inside the room and normalises facing case', () => {
    const r = parseRoomAnalysis({
      ...valid,
      furniture: [{ type: 'desk', xCm: 9999, yCm: -50, widthCm: 120, depthCm: 60, facing: 'w' }],
    });
    const item = r.layout.items[0]!;
    expect(item.facing).toBe('W');
    expect(item.xCm).toBe(400 - 60);
    expect(item.yCm).toBe(0);
  });

  it('defaults confidence and ignores malformed openings', () => {
    const r = parseRoomAnalysis({
      ...valid,
      confidence: 'high',
      openings: [{ kind: 'portal', wall: 'N' }, null],
    });
    expect(r.confidence).toBe(0.5);
    expect(r.layout.openings).toEqual([]);
  });
});
