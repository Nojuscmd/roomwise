import {
  Furniture,
  FURNITURE_TYPES,
  FurnitureType,
  Opening,
  RoomLayout,
  Wall,
  WALLS,
} from './types';

/** Shape of what the vision model is asked to return (see supabase/functions/analyze-room). */
export interface RoomAnalysis {
  layout: RoomLayout;
  /** Model-reported confidence 0..1. */
  confidence: number;
  notes: string;
}

export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisError';
  }
}

const MIN_ROOM_CM = 150;
const MAX_ROOM_CM = 2000;
const MIN_ITEM_CM = 20;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

function parseWall(v: unknown): Wall | null {
  return typeof v === 'string' && (WALLS as readonly string[]).includes(v.toUpperCase())
    ? (v.toUpperCase() as Wall)
    : null;
}

function parseType(v: unknown): FurnitureType {
  return typeof v === 'string' && (FURNITURE_TYPES as readonly string[]).includes(v)
    ? (v as FurnitureType)
    : 'other';
}

/**
 * Validate and sanitise untrusted model output into a RoomLayout.
 * Throws AnalysisError when the data is unusable; clamps or drops individual bad entries.
 */
export function parseRoomAnalysis(input: unknown): RoomAnalysis {
  if (!isRecord(input)) throw new AnalysisError('Analysis is not an object.');
  const roomRaw = input.room;
  if (!isRecord(roomRaw)) throw new AnalysisError('Analysis has no room dimensions.');
  const width = num(roomRaw.widthCm);
  const depth = num(roomRaw.depthCm);
  if (width === null || depth === null) throw new AnalysisError('Room dimensions are missing.');
  const room = {
    widthCm: clamp(width, MIN_ROOM_CM, MAX_ROOM_CM),
    depthCm: clamp(depth, MIN_ROOM_CM, MAX_ROOM_CM),
  };

  const openings: Opening[] = [];
  const openingsRaw = Array.isArray(input.openings) ? input.openings : [];
  openingsRaw.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const wall = parseWall(raw.wall);
    const kind = raw.kind === 'door' || raw.kind === 'window' ? raw.kind : null;
    const offset = num(raw.offsetCm);
    const w = num(raw.widthCm);
    if (!wall || !kind || offset === null || w === null || w <= 0) return;
    const wallLength = wall === 'N' || wall === 'S' ? room.widthCm : room.depthCm;
    const widthCm = clamp(w, 40, wallLength);
    openings.push({
      id: `o${index + 1}`,
      kind,
      wall,
      widthCm,
      offsetCm: clamp(offset, 0, wallLength - widthCm),
    });
  });

  const items: Furniture[] = [];
  const itemsRaw = Array.isArray(input.furniture) ? input.furniture : [];
  itemsRaw.forEach((raw, index) => {
    if (!isRecord(raw)) return;
    const wCm = num(raw.widthCm);
    const dCm = num(raw.depthCm);
    const facing = parseWall(raw.facing) ?? 'S';
    if (wCm === null || dCm === null || wCm < MIN_ITEM_CM || dCm < MIN_ITEM_CM) return;
    const widthCm = Math.min(wCm, MAX_ROOM_CM);
    const depthCm = Math.min(dCm, MAX_ROOM_CM);
    const swap = facing === 'E' || facing === 'W';
    const fw = swap ? depthCm : widthCm;
    const fh = swap ? widthCm : depthCm;
    if (fw > room.widthCm || fh > room.depthCm) return;
    const type = parseType(raw.type);
    items.push({
      id: `f${index + 1}`,
      type,
      label: typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : type,
      widthCm,
      depthCm,
      facing,
      xCm: clamp(num(raw.xCm) ?? 0, 0, room.widthCm - fw),
      yCm: clamp(num(raw.yCm) ?? 0, 0, room.depthCm - fh),
    });
  });

  return {
    layout: { room, openings, items },
    confidence: clamp(num(input.confidence) ?? 0.5, 0, 1),
    notes: typeof input.notes === 'string' ? input.notes.slice(0, 500) : '',
  };
}
