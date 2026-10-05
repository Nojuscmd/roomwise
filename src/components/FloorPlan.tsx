import React from 'react';
import Svg, { Defs, G, Line, Marker, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { Furniture, Move, Opening, RoomLayout, center, footprint, openingZone } from '@/domain';
import { colors, furnitureColors } from '@/theme/theme';
import { FurnitureIcon } from './FurnitureIcon';

interface Props {
  layout: Pick<RoomLayout, 'room' | 'openings'>;
  items: Furniture[];
  /** Draw arrows from each item's previous position to its new one. */
  moves?: Move[];
  width: number;
  /** Highlight this item and report taps on items (used by the correction screen). */
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

const WALL_PX = 3;

function OpeningMark({ o, room, scale }: { o: Opening; room: RoomLayout['room']; scale: number }) {
  const z = openingZone(o, room, 6);
  const isDoor = o.kind === 'door';
  const color = isDoor ? colors.accent : '#7FA8C4';
  // Cover the wall line with a coloured segment so doors and windows read at a glance.
  return (
    <Rect
      x={z.x * scale - (o.wall === 'W' ? WALL_PX : 0)}
      y={z.y * scale - (o.wall === 'N' ? WALL_PX : 0)}
      width={Math.max(z.w * scale, WALL_PX * 2)}
      height={Math.max(z.h * scale, WALL_PX * 2)}
      fill={color}
      opacity={isDoor ? 1 : 0.8}
    />
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

export function FloorPlan({ layout, items, moves = [], width, selectedId, onSelect }: Props) {
  const { room, openings } = layout;
  const scale = width / room.widthCm;
  const height = room.depthCm * scale;
  const pad = WALL_PX;

  return (
    <Svg
      width={width + pad * 2}
      height={height + pad * 2}
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
      accessibilityLabel="Top-down floor plan of the room"
    >
      <Defs>
        <Marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <Path d="M0,0 L8,4 L0,8 Z" fill={colors.accent} />
        </Marker>
      </Defs>

      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={colors.surface}
        stroke={colors.ink}
        strokeWidth={WALL_PX}
        rx={2}
      />

      {openings.map((o) => (
        <OpeningMark key={o.id} o={o} room={room} scale={scale} />
      ))}

      {items.map((item) => {
        const fp = footprint(item);
        const w = fp.w * scale;
        const h = fp.h * scale;
        const fits = w > 44 && h > 22;
        return (
          <G key={item.id} onPress={onSelect ? () => onSelect(item.id) : undefined}>
            <Rect
              x={fp.x * scale}
              y={fp.y * scale}
              width={w}
              height={h}
              rx={5}
              fill={furnitureColors[item.type]}
              stroke={item.id === selectedId ? colors.accent : colors.ink}
              strokeOpacity={item.id === selectedId ? 1 : 0.25}
              strokeWidth={item.id === selectedId ? 3 : 1}
            />
            <FurnitureIcon item={item} scale={scale} />
            <FacingMarker item={item} scale={scale} />
            {fits ? (
              <SvgText
                x={(fp.x + fp.w / 2) * scale}
                y={(fp.y + fp.h / 2) * scale + 4}
                fontSize={11}
                fill={colors.ink}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            ) : null}
          </G>
        );
      })}

      {moves.map((m) => {
        const item = items.find((i) => i.id === m.itemId);
        if (!item) return null;
        const to = center(footprint(item));
        const fromItem: Furniture = { ...item, ...m.from };
        const from = center(footprint(fromItem));
        return (
          <Line
            key={m.itemId}
            x1={from.x * scale}
            y1={from.y * scale}
            x2={to.x * scale}
            y2={to.y * scale}
            stroke={colors.accent}
            strokeWidth={2}
            strokeDasharray="5 4"
            markerEnd="url(#arrow)"
          />
        );
      })}
    </Svg>
  );
}
