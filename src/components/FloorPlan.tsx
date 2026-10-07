import React from 'react';
import Svg, { Defs, G, Line, Marker, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Furniture, Move, Opening, RoomLayout, center, footprint, openingZone } from '@/domain';
import { colors, furnitureColors } from '@/theme/theme';
import { FurnitureIcon } from './FurnitureIcon';
import { fitLabelBesideMarker } from './labelFit';

interface Props {
  layout: Pick<RoomLayout, 'room' | 'openings'>;
  items: Furniture[];
  /** Draw arrows from each item's previous position to its new one. */
  moves?: Move[];
  /** Total width of the drawing in pixels, including the space for the measurements. */
  width: number;
  /**
   * `full` draws the plan on grid paper with the room's measurements. `thumb` is a bare miniature
   * for lists: no grid, text or icons.
   */
  variant?: 'full' | 'thumb';
  /** Highlight this item and report taps on items (used by the correction screen). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

/** Horizontal space kept free for the facing marker on items that face east or west. */
const MARKER_SPACE = 10;

const MARGINS = {
  full: { left: 44, top: 26, right: 6, bottom: 6, wall: 3 },
  thumb: { left: 2, top: 2, right: 2, bottom: 2, wall: 2 },
} as const;

const meters = (cm: number): string => `${(cm / 100).toFixed(2)} m`;

function OpeningMark({
  o,
  room,
  scale,
  wall,
}: {
  o: Opening;
  room: RoomLayout['room'];
  scale: number;
  wall: number;
}) {
  const z = openingZone(o, room, 6);
  const isDoor = o.kind === 'door';
  // Cover the wall line with a coloured segment so doors and windows read at a glance.
  return (
    <Rect
      x={z.x * scale - (o.wall === 'W' ? wall : 0)}
      y={z.y * scale - (o.wall === 'N' ? wall : 0)}
      width={Math.max(z.w * scale, wall * 2)}
      height={Math.max(z.h * scale, wall * 2)}
      fill={isDoor ? colors.tape : '#9DBCF2'}
      stroke={colors.ink}
      strokeOpacity={0.6}
      strokeWidth={1}
    />
  );
}

/** Faint grid paper: a line every 50 cm, a slightly stronger one every metre. */
function Grid({ room, scale }: { room: RoomLayout['room']; scale: number }) {
  const step = scale * 50 < 9 ? 100 : 50;
  const lines: React.ReactNode[] = [];
  const w = room.widthCm * scale;
  const h = room.depthCm * scale;
  for (let cm = step; cm < room.widthCm; cm += step) {
    lines.push(
      <Line
        key={`v${cm}`}
        x1={cm * scale}
        y1={0}
        x2={cm * scale}
        y2={h}
        stroke={colors.ink}
        strokeOpacity={cm % 100 === 0 ? 0.1 : 0.045}
        strokeWidth={1}
      />,
    );
  }
  for (let cm = step; cm < room.depthCm; cm += step) {
    lines.push(
      <Line
        key={`h${cm}`}
        x1={0}
        y1={cm * scale}
        x2={w}
        y2={cm * scale}
        stroke={colors.ink}
        strokeOpacity={cm % 100 === 0 ? 0.1 : 0.045}
        strokeWidth={1}
      />,
    );
  }
  return <G>{lines}</G>;
}

/** Dimension lines like on a technical drawing: width above the room, depth to its left. */
function Dimensions({ room, scale }: { room: RoomLayout['room']; scale: number }) {
  const w = room.widthCm * scale;
  const h = room.depthCm * scale;
  const line = { stroke: colors.ink, strokeOpacity: 0.55, strokeWidth: 1 } as const;
  return (
    <G>
      <Line x1={0} y1={-6} x2={w} y2={-6} {...line} />
      <Line x1={0} y1={-9} x2={0} y2={-3} {...line} />
      <Line x1={w} y1={-9} x2={w} y2={-3} {...line} />
      <SvgText
        x={w / 2}
        y={-12}
        fontSize={11}
        fill={colors.ink}
        fillOpacity={0.8}
        textAnchor="middle"
      >
        {meters(room.widthCm)}
      </SvgText>

      <Line x1={-6} y1={0} x2={-6} y2={h} {...line} />
      <Line x1={-9} y1={0} x2={-3} y2={0} {...line} />
      <Line x1={-9} y1={h} x2={-3} y2={h} {...line} />
      <SvgText
        x={-24}
        y={h / 2 + 4}
        fontSize={11}
        fill={colors.ink}
        fillOpacity={0.8}
        textAnchor="middle"
      >
        {meters(room.depthCm)}
      </SvgText>
    </G>
  );
}

/** Front-edge marker: a small triangle showing which way an item faces. */
function FacingMarker({ item, scale }: { item: Furniture; scale: number }) {
  const fp = footprint(item);
  const s = 5;
  const cx = (fp.x + fp.w / 2) * scale;
  const cy = (fp.y + fp.h / 2) * scale;
  const pts: Record<Furniture['facing'], string> = {
    N: `${cx - s},${fp.y * scale + s + 2} ${cx + s},${fp.y * scale + s + 2} ${cx},${fp.y * scale + 2}`,
    S: `${cx - s},${(fp.y + fp.h) * scale - s - 2} ${cx + s},${(fp.y + fp.h) * scale - s - 2} ${cx},${(fp.y + fp.h) * scale - 2}`,
    W: `${fp.x * scale + s + 2},${cy - s} ${fp.x * scale + s + 2},${cy + s} ${fp.x * scale + 2},${cy}`,
    E: `${(fp.x + fp.w) * scale - s - 2},${cy - s} ${(fp.x + fp.w) * scale - s - 2},${cy + s} ${(fp.x + fp.w) * scale - 2},${cy}`,
  };
  return <Polygon points={pts[item.facing]} fill={colors.ink} opacity={0.35} />;
}

export function FloorPlan({
  layout,
  items,
  moves = [],
  width,
  variant = 'full',
  selectedId,
  onSelect,
}: Props) {
  const { room, openings } = layout;
  const full = variant === 'full';
  const m = MARGINS[variant];
  const drawWidth = width - m.left - m.right;
  const scale = drawWidth / room.widthCm;
  const drawHeight = room.depthCm * scale;
  const totalHeight = drawHeight + m.top + m.bottom;

  return (
    <Svg
      width={width}
      height={totalHeight}
      viewBox={`${-m.left} ${-m.top} ${width} ${totalHeight}`}
      accessibilityLabel="Top-down floor plan of the room"
    >
      <Defs>
        <Marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <Path d="M0,0 L8,4 L0,8 Z" fill={colors.accent} />
        </Marker>
      </Defs>

      <Rect x={0} y={0} width={drawWidth} height={drawHeight} fill={colors.surface} />
      {full ? <Grid room={room} scale={scale} /> : null}
      {full ? <Dimensions room={room} scale={scale} /> : null}
      <Rect
        x={0}
        y={0}
        width={drawWidth}
        height={drawHeight}
        fill="none"
        stroke={colors.ink}
        strokeWidth={m.wall}
        rx={1}
      />

      {openings.map((o) => (
        <OpeningMark key={o.id} o={o} room={room} scale={scale} wall={m.wall} />
      ))}

      {items.map((item) => {
        const fp = footprint(item);
        const w = fp.w * scale;
        const h = fp.h * scale;
        const selected = item.id === selectedId;

        if (!full) {
          return (
            <Rect
              key={item.id}
              x={fp.x * scale}
              y={fp.y * scale}
              width={w}
              height={h}
              rx={2}
              fill={furnitureColors[item.type]}
              stroke={colors.ink}
              strokeOpacity={0.45}
              strokeWidth={1}
            />
          );
        }

        const markerSpace = item.facing === 'E' || item.facing === 'W' ? MARKER_SPACE : 0;
        const { fit: label, reserved } = fitLabelBesideMarker(item.label, w, h, markerSpace);
        // Shift the text away from the facing marker so the two never touch.
        const shift = reserved ? markerSpace / 2 : 0;
        const cx =
          (fp.x + fp.w / 2) * scale +
          (item.facing === 'W' ? shift : 0) -
          (item.facing === 'E' ? shift : 0);
        const cy = (fp.y + fp.h / 2) * scale;

        return (
          <G key={item.id} onPress={onSelect ? () => onSelect(item.id) : undefined}>
            <Rect
              x={fp.x * scale}
              y={fp.y * scale}
              width={w}
              height={h}
              rx={4}
              fill={furnitureColors[item.type]}
              stroke={selected ? colors.accent : colors.ink}
              strokeOpacity={selected ? 1 : 0.55}
              strokeWidth={selected ? 3 : 1.4}
            />
            <FurnitureIcon item={item} scale={scale} />
            <FacingMarker item={item} scale={scale} />
            {label ? (
              <G>
                {label.lines.map((line, index) => (
                  <SvgText
                    key={`${index}-${line}`}
                    x={cx}
                    y={
                      cy +
                      label.fontSize * 0.35 +
                      (index - (label.lines.length - 1) / 2) * label.fontSize * 1.15
                    }
                    fontSize={label.fontSize}
                    fill={colors.ink}
                    textAnchor="middle"
                  >
                    {line}
                  </SvgText>
                ))}
              </G>
            ) : null}
          </G>
        );
      })}

      {full
        ? moves.map((mv) => {
            const item = items.find((i) => i.id === mv.itemId);
            if (!item) return null;
            const to = center(footprint(item));
            const fromItem: Furniture = { ...item, ...mv.from };
            const from = center(footprint(fromItem));
            return (
              <Line
                key={mv.itemId}
                x1={from.x * scale}
                y1={from.y * scale}
                x2={to.x * scale}
                y2={to.y * scale}
                stroke={colors.accent}
                strokeWidth={2.5}
                strokeDasharray="5 4"
                markerEnd="url(#arrow)"
              />
            );
          })
        : null}
    </Svg>
  );
}
