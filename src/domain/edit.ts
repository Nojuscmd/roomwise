import { footprint, insideRoom, intersects } from './geometry';
import { Furniture, FurnitureType, Opening, RoomLayout, Wall, WALLS } from './types';

/** Pure helpers for correcting what the vision model detected. Every function returns a new layout. */

export const MIN_ROOM_CM = 150;
export const MAX_ROOM_CM = 2000;
export const MIN_ITEM_CM = 20;
export const MAX_ITEM_CM = 400;
export const NUDGE_CM = 10;

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

/** Typical footprint (width x depth, cm) used when the user adds a missing item. */
export const DEFAULT_SIZES: Record<FurnitureType, { widthCm: number; depthCm: number }> = {
  bed: { widthCm: 140, depthCm: 200 },
  desk: { widthCm: 120, depthCm: 60 },
  sofa: { widthCm: 200, depthCm: 90 },
  wardrobe: { widthCm: 100, depthCm: 55 },
  table: { widthCm: 120, depthCm: 80 },
  shelf: { widthCm: 80, depthCm: 30 },
  tv_unit: { widthCm: 140, depthCm: 40 },
  other: { widthCm: 50, depthCm: 50 },
};

export const TYPE_LABELS: Record<FurnitureType, string> = {
  bed: 'Bed',
  desk: 'Desk',
  sofa: 'Sofa',
  wardrobe: 'Wardrobe',
  table: 'Table',
  shelf: 'Shelf',
  tv_unit: 'TV unit',
  other: 'Other',
};

/** Keep an item's footprint inside the room by moving it (never resizing it). */
function keepInside(item: Furniture, layout: RoomLayout): Furniture {
  const fp = footprint(item);
  const maxX = Math.max(0, layout.room.widthCm - fp.w);
  const maxY = Math.max(0, layout.room.depthCm - fp.h);
  return {
    ...item,
    xCm: Math.round(clamp(item.xCm, 0, maxX)),
    yCm: Math.round(clamp(item.yCm, 0, maxY)),
  };
}

function updateItem(
  layout: RoomLayout,
  id: string,
  change: (item: Furniture) => Furniture,
): RoomLayout {
  return {
    ...layout,
    items: layout.items.map((item) => (item.id === id ? keepInside(change(item), layout) : item)),
  };
}

export function moveItem(layout: RoomLayout, id: string, dxCm: number, dyCm: number): RoomLayout {
  return updateItem(layout, id, (i) => ({ ...i, xCm: i.xCm + dxCm, yCm: i.yCm + dyCm }));
}

/** Turn an item a quarter turn clockwise. Does nothing if it would no longer fit the room. */
export function rotateItem(layout: RoomLayout, id: string): RoomLayout {
  const order = ['N', 'E', 'S', 'W'] as const;
  const item = layout.items.find((i) => i.id === id);
  if (!item) return layout;
  const facing = order[(order.indexOf(item.facing) + 1) % 4] as Wall;
  const next = { ...item, facing };
  const fp = footprint(next);
  if (fp.w > layout.room.widthCm || fp.h > layout.room.depthCm) return layout;
  return updateItem(layout, id, () => next);
}

export function resizeItem(
  layout: RoomLayout,
  id: string,
  dWidthCm: number,
  dDepthCm: number,
): RoomLayout {
  return updateItem(layout, id, (i) => {
    const resized = {
      ...i,
      widthCm: clamp(i.widthCm + dWidthCm, MIN_ITEM_CM, MAX_ITEM_CM),
      depthCm: clamp(i.depthCm + dDepthCm, MIN_ITEM_CM, MAX_ITEM_CM),
    };
    const fp = footprint(resized);
    // Never let an item outgrow the room.
    return fp.w > layout.room.widthCm || fp.h > layout.room.depthCm ? i : resized;
  });
}

export function renameItem(layout: RoomLayout, id: string, label: string): RoomLayout {
  return updateItem(layout, id, (i) => ({ ...i, label: label.slice(0, 40) }));
}

export function setItemType(layout: RoomLayout, id: string, type: FurnitureType): RoomLayout {
  return updateItem(layout, id, (i) => ({ ...i, type }));
}

export function removeItem(layout: RoomLayout, id: string): RoomLayout {
  return { ...layout, items: layout.items.filter((i) => i.id !== id) };
}

function nextId(prefix: string, ids: string[]): string {
  let n = ids.length + 1;
  while (ids.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Add an item of the given type in the first free spot (or the corner if the room is full). */
export function addItem(
  layout: RoomLayout,
  type: FurnitureType,
): { layout: RoomLayout; id: string } {
  const size = DEFAULT_SIZES[type];
  const base: Furniture = {
    id: nextId(
      'f',
      layout.items.map((i) => i.id),
    ),
    type,
    label: TYPE_LABELS[type],
    ...size,
    xCm: 0,
    yCm: 0,
    facing: 'S',
  };
  const step = 20;
  let placed = keepInside(base, layout);
  search: for (let y = 0; y <= layout.room.depthCm - base.depthCm; y += step) {
    for (let x = 0; x <= layout.room.widthCm - base.widthCm; x += step) {
      const candidate = { ...base, xCm: x, yCm: y };
      const fp = footprint(candidate);
      if (insideRoom(fp, layout.room) && !layout.items.some((o) => intersects(fp, footprint(o)))) {
        placed = candidate;
        break search;
      }
    }
  }
  return { layout: { ...layout, items: [...layout.items, placed] }, id: placed.id };
}

export function setRoomSize(layout: RoomLayout, widthCm: number, depthCm: number): RoomLayout {
  const room = {
    widthCm: Math.round(clamp(widthCm, MIN_ROOM_CM, MAX_ROOM_CM)),
    depthCm: Math.round(clamp(depthCm, MIN_ROOM_CM, MAX_ROOM_CM)),
  };
  const resized: RoomLayout = { ...layout, room };
  const wallLength = (wall: Wall) => (wall === 'N' || wall === 'S' ? room.widthCm : room.depthCm);
  return {
    ...resized,
    openings: layout.openings.map((o) => {
      const widthCm = Math.min(o.widthCm, wallLength(o.wall));
      return { ...o, widthCm, offsetCm: clamp(o.offsetCm, 0, wallLength(o.wall) - widthCm) };
    }),
    items: layout.items.map((i) => keepInside(i, resized)),
  };
}

const OPENING_DEFAULT_WIDTH = { door: 90, window: 120 } as const;

export function addOpening(
  layout: RoomLayout,
  kind: Opening['kind'],
  wall: Wall = 'S',
): { layout: RoomLayout; id: string } {
  const length = wall === 'N' || wall === 'S' ? layout.room.widthCm : layout.room.depthCm;
  const widthCm = Math.min(OPENING_DEFAULT_WIDTH[kind], length);
  const id = nextId(
    'o',
    layout.openings.map((o) => o.id),
  );
  const opening: Opening = {
    id,
    kind,
    wall,
    widthCm,
    offsetCm: Math.round((length - widthCm) / 2),
  };
  return { layout: { ...layout, openings: [...layout.openings, opening] }, id };
}

export function removeOpening(layout: RoomLayout, id: string): RoomLayout {
  return { ...layout, openings: layout.openings.filter((o) => o.id !== id) };
}

export function moveOpening(layout: RoomLayout, id: string, deltaCm: number): RoomLayout {
  return {
    ...layout,
    openings: layout.openings.map((o) => {
      if (o.id !== id) return o;
      const length = o.wall === 'N' || o.wall === 'S' ? layout.room.widthCm : layout.room.depthCm;
      return { ...o, offsetCm: clamp(o.offsetCm + deltaCm, 0, length - o.widthCm) };
    }),
  };
}

/** Put an opening on the next wall clockwise, centred on it. */
export function cycleOpeningWall(layout: RoomLayout, id: string): RoomLayout {
  return {
    ...layout,
    openings: layout.openings.map((o) => {
      if (o.id !== id) return o;
      const wall = WALLS[(WALLS.indexOf(o.wall) + 1) % WALLS.length] as Wall;
      const length = wall === 'N' || wall === 'S' ? layout.room.widthCm : layout.room.depthCm;
      const widthCm = Math.min(o.widthCm, length);
      return { ...o, wall, widthCm, offsetCm: Math.round((length - widthCm) / 2) };
    }),
  };
}

/** Shape stored in rooms.analysis_json: the same JSON the vision model returns. */
export function layoutToAnalysisJson(layout: RoomLayout, notes: string): Record<string, unknown> {
  return {
    room: { widthCm: layout.room.widthCm, depthCm: layout.room.depthCm },
    openings: layout.openings.map((o) => ({
      kind: o.kind,
      wall: o.wall,
      offsetCm: o.offsetCm,
      widthCm: o.widthCm,
    })),
    furniture: layout.items.map((i) => ({
      type: i.type,
      label: i.label,
      xCm: i.xCm,
      yCm: i.yCm,
      widthCm: i.widthCm,
      depthCm: i.depthCm,
      facing: i.facing,
    })),
    // The user has checked and corrected this layout, so it is no longer a rough estimate.
    confidence: 1,
    notes,
    edited: true,
  };
}
