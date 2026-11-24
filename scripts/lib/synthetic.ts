/**
 * Synthetic room generator for Roomwise. Everything here is made up by a seeded random number
 * generator: it is NOT real photographed data. Size ranges are our own assumptions (typical
 * European apartment rooms and furniture), documented in docs/RESULTS.md.
 * Same seed => same rooms, so results are reproducible.
 */
import type { Furniture, FurnitureType, Opening, RoomLayout, Wall } from '../../src/domain';

export type RoomType = 'bedroom' | 'living';

export interface SyntheticRoom {
  id: string;
  roomType: RoomType;
  layout: RoomLayout;
}

/** Small, fast, deterministic PRNG (mulberry32). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const WALL_LIST: Wall[] = ['N', 'E', 'S', 'W'];
const between = (rng: Rng, lo: number, hi: number, step = 5): number =>
  Math.round((lo + rng() * (hi - lo)) / step) * step;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)] as T;

interface Spec {
  type: FurnitureType;
  label: string;
  w: [number, number];
  d: [number, number];
  /** Probability the item is present in a room of this type. */
  p: number;
}

const CATALOG: Record<RoomType, Spec[]> = {
  bedroom: [
    { type: 'bed', label: 'Bed', w: [140, 180], d: [190, 210], p: 1 },
    { type: 'wardrobe', label: 'Wardrobe', w: [80, 200], d: [50, 60], p: 0.9 },
    { type: 'desk', label: 'Desk', w: [100, 140], d: [50, 70], p: 0.6 },
    { type: 'table', label: 'Bedside table', w: [35, 50], d: [35, 45], p: 0.7 },
    { type: 'shelf', label: 'Shelf', w: [60, 100], d: [25, 40], p: 0.4 },
  ],
  living: [
    { type: 'sofa', label: 'Sofa', w: [160, 240], d: [80, 100], p: 1 },
    { type: 'tv_unit', label: 'TV unit', w: [120, 180], d: [35, 50], p: 0.9 },
    { type: 'table', label: 'Coffee table', w: [80, 130], d: [50, 80], p: 0.8 },
    { type: 'shelf', label: 'Shelf', w: [60, 120], d: [25, 40], p: 0.6 },
    { type: 'desk', label: 'Desk', w: [100, 140], d: [50, 70], p: 0.3 },
  ],
};

function makeOpenings(rng: Rng, widthCm: number, depthCm: number): Opening[] {
  const len = (wall: Wall): number => (wall === 'N' || wall === 'S' ? widthCm : depthCm);
  const place = (id: string, kind: 'door' | 'window', wall: Wall, w: number): Opening => {
    const slack = Math.max(0, len(wall) - w);
    return { id, kind, wall, widthCm: w, offsetCm: Math.round((rng() * slack) / 5) * 5 };
  };
  const doorWall = pick(rng, WALL_LIST);
  const openings = [place('door', 'door', doorWall, between(rng, 80, 100, 5))];
  const others = WALL_LIST.filter((w) => w !== doorWall);
  const nWindows = rng() < 0.7 ? 1 : 2;
  for (let i = 0; i < nWindows; i++) {
    const wall = others.splice(Math.floor(rng() * others.length), 1)[0] as Wall;
    openings.push(place(`window${i + 1}`, 'window', wall, between(rng, 100, 180, 10)));
  }
  return openings;
}

export function generateRoom(rng: Rng, index: number): SyntheticRoom {
  const roomType: RoomType = rng() < 0.55 ? 'bedroom' : 'living';
  const widthCm = roomType === 'bedroom' ? between(rng, 250, 450, 10) : between(rng, 300, 600, 10);
  const depthCm = roomType === 'bedroom' ? between(rng, 250, 450, 10) : between(rng, 300, 500, 10);

  const items: Furniture[] = [];
  const counts = new Map<FurnitureType, number>();
  for (const spec of CATALOG[roomType]) {
    if (rng() > spec.p) continue;
    const n = (counts.get(spec.type) ?? 0) + 1;
    counts.set(spec.type, n);
    const w = between(rng, spec.w[0], spec.w[1], 5);
    const d = between(rng, spec.d[0], spec.d[1], 5);
    const facing = pick(rng, WALL_LIST);
    // Footprint on the plan is rotated for E/W facing items (width runs along y).
    const fw = facing === 'N' || facing === 'S' ? w : d;
    const fh = facing === 'N' || facing === 'S' ? d : w;
    items.push({
      id: `${spec.type}${n}`,
      type: spec.type,
      label: spec.label,
      xCm: Math.round((rng() * Math.max(0, widthCm - fw)) / 5) * 5,
      yCm: Math.round((rng() * Math.max(0, depthCm - fh)) / 5) * 5,
      widthCm: w,
      depthCm: d,
      facing,
    });
  }
  const id = `r${String(index + 1).padStart(4, '0')}`;
  return {
    id,
    roomType,
    layout: { room: { widthCm, depthCm }, openings: makeOpenings(rng, widthCm, depthCm), items },
  };
}

export function generateRooms(n: number, seed: number): SyntheticRoom[] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, (_, i) => generateRoom(rng, i));
}
