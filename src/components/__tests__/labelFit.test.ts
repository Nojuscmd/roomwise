import { fitLabel, fitLabelBesideMarker } from '../labelFit';

describe('fitLabel', () => {
  it('keeps a short name on one line at normal size when it fits', () => {
    expect(fitLabel('Desk', 120, 60)).toEqual({ lines: ['Desk'], fontSize: 11 });
  });

  it('shrinks the text before breaking it up', () => {
    const fit = fitLabel('Side table', 64, 24);
    expect(fit?.fontSize).toBe(9);
    expect(fit?.lines).toEqual(['Side table']);
  });

  it('wraps a long name over two lines in a narrow item', () => {
    const fit = fitLabel('Chest of drawers', 70, 60);
    expect(fit?.lines.length).toBe(2);
    expect(fit?.lines.join(' ')).toBe('Chest of drawers');
  });

  it('uses the small size and two lines for a narrow item', () => {
    const fit = fitLabel('Tall cabinet', 44, 110);
    expect(fit?.fontSize).toBe(9);
    expect(fit?.lines).toEqual(['Tall', 'cabinet']);
  });

  it('shortens the name with an ellipsis as a last resort', () => {
    const fit = fitLabel('Extra long bookshelf', 52, 20);
    expect(fit?.lines[0]?.endsWith('…')).toBe(true);
  });

  it('shows nothing when no text is readable', () => {
    expect(fitLabel('Side table', 14, 14)).toBeNull();
    expect(fitLabel('   ', 100, 100)).toBeNull();
  });
});

describe('fitLabelBesideMarker', () => {
  it('keeps room for the marker when the name still fits', () => {
    const result = fitLabelBesideMarker('Dresser', 90, 100, 10);
    expect(result.reserved).toBe(true);
    expect(result.fit?.lines).toEqual(['Dresser']);
  });

  it('uses the full width rather than shorten the name', () => {
    const result = fitLabelBesideMarker('Shelf', 38, 100, 10);
    expect(result.reserved).toBe(false);
    expect(result.fit?.lines).toEqual(['Shelf']);
  });

  it('does nothing special for items without a side marker', () => {
    expect(fitLabelBesideMarker('Desk', 120, 60, 0)).toEqual({
      fit: { lines: ['Desk'], fontSize: 11 },
      reserved: false,
    });
  });
});
