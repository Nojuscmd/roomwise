import React from 'react';
import { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { Furniture, footprint } from '@/domain';
import { colors } from '@/theme/theme';

/** Degrees to turn the icon (drawn with its front at the bottom) so the front points the right way. */
const ROTATION: Record<Furniture['facing'], number> = { S: 0, W: 90, N: 180, E: 270 };

/** Below this size (px) an icon is just clutter. */
const MIN_ICON_PX = 26;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

const STROKE = {
  stroke: colors.ink,
  strokeOpacity: 0.32,
  strokeWidth: 1.2,
  fill: 'none',
} as const;

interface Shape {
  /** Drawn first, so the item colour shows through everywhere except these spots. */
  underlay?: React.ReactNode;
  lines: React.ReactNode;
}

/**
 * Minimal outline of the piece, drawn in a local box where the item's back is at the top and its
 * front at the bottom. lw is the width across the front, ld the depth, both in pixels.
 */
function shapeFor(item: Furniture, lw: number, ld: number): Shape | null {
  const m = 4;
  switch (item.type) {
    case 'bed': {
      const pw = (lw - m * 3) / 2;
      const ph = clamp(ld * 0.16, 6, 16);
      return {
        lines: (
          <>
            <Rect x={m} y={m} width={pw} height={ph} rx={3} {...STROKE} />
            <Rect x={m * 2 + pw} y={m} width={pw} height={ph} rx={3} {...STROKE} />
            <Line x1={m} y1={ld * 0.42} x2={lw - m} y2={ld * 0.42} {...STROKE} />
          </>
        ),
      };
    }
    case 'sofa': {
      if (item.chaise) {
        const cw = clamp(lw * 0.34, 14, lw * 0.5);
        const sd = clamp(ld * 0.52, 14, ld - 8);
        // Sitting facing the front, the sitter's left is the right-hand side of this local box.
        const chaiseRight = item.chaise === 'left';
        const notch = chaiseRight
          ? { x: 0, y: sd, w: lw - cw, h: ld - sd }
          : { x: cw, y: sd, w: lw - cw, h: ld - sd };
        const outline = chaiseRight
          ? `M${m},${m} H${lw - m} V${ld - m} H${lw - cw} V${sd} H${m} Z`
          : `M${m},${m} H${lw - m} V${sd} H${cw} V${ld - m} H${m} Z`;
        const back = clamp(sd * 0.28, 5, 12);
        return {
          underlay: (
            <Rect x={notch.x} y={notch.y} width={notch.w} height={notch.h} fill={colors.surface} />
          ),
          lines: (
            <>
              <Path d={outline} strokeLinejoin="round" {...STROKE} />
              <Line x1={m} y1={m + back} x2={lw - m} y2={m + back} {...STROKE} />
            </>
          ),
        };
      }
      const back = clamp(ld * 0.28, 5, 12);
      const arm = clamp(lw * 0.1, 5, 12);
      return {
        lines: (
          <>
            <Rect x={m} y={m} width={lw - m * 2} height={back} rx={3} {...STROKE} />
            <Rect x={m} y={m} width={arm} height={ld - m * 2} rx={3} {...STROKE} />
            <Rect x={lw - m - arm} y={m} width={arm} height={ld - m * 2} rx={3} {...STROKE} />
          </>
        ),
      };
    }
    case 'desk':
      return {
        lines: (
          <>
            <Rect
              x={lw / 2 - clamp(lw * 0.2, 8, 24)}
              y={m + 2}
              width={clamp(lw * 0.4, 16, 48)}
              height={4}
              rx={1.5}
              {...STROKE}
            />
            <Line x1={m} y1={ld * 0.62} x2={lw - m} y2={ld * 0.62} {...STROKE} />
          </>
        ),
      };
    case 'wardrobe':
      return {
        lines: (
          <>
            <Line x1={lw / 2} y1={m} x2={lw / 2} y2={ld - m} {...STROKE} />
            <Circle cx={lw / 2 - 5} cy={ld * 0.7} r={1.6} {...STROKE} />
            <Circle cx={lw / 2 + 5} cy={ld * 0.7} r={1.6} {...STROKE} />
          </>
        ),
      };
    case 'table': {
      const inset = clamp(Math.min(lw, ld) * 0.16, 5, 14);
      return {
        lines: (
          <Rect
            x={inset}
            y={inset}
            width={lw - inset * 2}
            height={ld - inset * 2}
            rx={4}
            {...STROKE}
          />
        ),
      };
    }
    case 'shelf':
      return {
        lines: (
          <>
            {[0.28, 0.5, 0.72].map((f) => (
              <Line key={f} x1={m} y1={ld * f} x2={lw - m} y2={ld * f} {...STROKE} />
            ))}
          </>
        ),
      };
    case 'tv_unit':
      return {
        lines: (
          <>
            <Rect
              x={lw / 2 - clamp(lw * 0.25, 10, 40)}
              y={m + 1}
              width={clamp(lw * 0.5, 20, 80)}
              height={3.5}
              rx={1.5}
              {...STROKE}
            />
            <Line x1={lw / 3} y1={ld * 0.4} x2={lw / 3} y2={ld - m} {...STROKE} />
            <Line x1={(lw * 2) / 3} y1={ld * 0.4} x2={(lw * 2) / 3} y2={ld - m} {...STROKE} />
          </>
        ),
      };
    default:
      return null;
  }
}

/** A subtle outline icon inside an item's footprint, turned to match its facing. */
export function FurnitureIcon({ item, scale }: { item: Furniture; scale: number }) {
  const lw = item.widthCm * scale;
  const ld = item.depthCm * scale;
  if (Math.min(lw, ld) < MIN_ICON_PX) return null;
  const shape = shapeFor(item, lw, ld);
  if (!shape) return null;

  const fp = footprint(item);
  const cx = (fp.x + fp.w / 2) * scale;
  const cy = (fp.y + fp.h / 2) * scale;
  return (
    <G
      pointerEvents="none"
      transform={`translate(${cx} ${cy}) rotate(${ROTATION[item.facing]}) translate(${-lw / 2} ${-ld / 2})`}
    >
      {shape.underlay}
      {shape.lines}
    </G>
  );
}
