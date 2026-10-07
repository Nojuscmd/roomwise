/** Average glyph width as a fraction of the font size (good enough for the plan labels). */
const CHAR_W = 0.54;
const LINE_H = 1.15;
const PADDING = 6;

export interface LabelFit {
  lines: string[];
  fontSize: number;
}

function wrapTwoLines(label: string, maxChars: number): string[] | null {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  // Try every split point and keep the one with the shortest longer line.
  let best: string[] | null = null;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    if (a.length > maxChars || b.length > maxChars) continue;
    if (
      !best ||
      Math.max(a.length, b.length) < Math.max(best[0]?.length ?? 0, best[1]?.length ?? 0)
    ) {
      best = [a, b];
    }
  }
  return best;
}

function tryFit(
  label: string,
  availW: number,
  availH: number,
  fontSize: number,
  allowTwoLines: boolean,
): string[] | null {
  const maxChars = Math.floor((availW - PADDING) / (fontSize * CHAR_W));
  if (maxChars < 3) return null;
  const lineHeight = fontSize * LINE_H;
  if (label.length <= maxChars) {
    return lineHeight <= availH - 6 ? [label] : null;
  }
  if (!allowTwoLines || 2 * lineHeight > availH - 6) return null;
  return wrapTwoLines(label, maxChars);
}

/**
 * Decide how to write an item's name inside its footprint (w and h in pixels): normal size,
 * smaller, over two lines, or shortened with an ellipsis. Returns
 * null when nothing readable fits, in which case the plan simply shows no text for that item.
 */
export function fitLabel(label: string, w: number, h: number): LabelFit | null {
  const text = label.trim();
  if (!text) return null;

  const sizes = [11, 9];
  for (const fontSize of sizes) {
    const single = tryFit(text, w, h, fontSize, false);
    if (single) return { lines: single, fontSize };
    const two = tryFit(text, w, h, fontSize, true);
    if (two) return { lines: two, fontSize };
  }

  const fontSize = 9;
  const maxChars = Math.floor((w - PADDING) / (fontSize * CHAR_W));
  if (maxChars >= 4 && fontSize * LINE_H <= h - 6) {
    return { lines: [`${text.slice(0, maxChars - 1).trimEnd()}…`], fontSize };
  }
  return null;
}

const isShortened = (fit: LabelFit | null): boolean =>
  fit !== null && fit.lines.some((line) => line.endsWith('…'));

/**
 * Like `fitLabel`, but first tries to keep `markerSpace` pixels free for the facing marker. If that
 * would shorten or hide the name, the name may use the full width instead (`reserved` is false).
 */
export function fitLabelBesideMarker(
  label: string,
  w: number,
  h: number,
  markerSpace: number,
): { fit: LabelFit | null; reserved: boolean } {
  if (markerSpace <= 0) return { fit: fitLabel(label, w, h), reserved: false };
  const narrow = fitLabel(label, w - markerSpace, h);
  if (narrow && !isShortened(narrow)) return { fit: narrow, reserved: true };
  const full = fitLabel(label, w, h);
  if (full && (!isShortened(full) || !narrow)) return { fit: full, reserved: false };
  return { fit: narrow ?? full, reserved: narrow !== null };
}
