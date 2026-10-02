/**
 * Core domain types. Coordinates are in centimetres, origin at the room's top-left corner,
 * x grows East (right), y grows South (down). Walls: N (y=0), S (y=depth), W (x=0), E (x=width).
 */

export type Wall = 'N' | 'E' | 'S' | 'W';
export const WALLS: readonly Wall[] = ['N', 'E', 'S', 'W'];

export const FURNITURE_TYPES = [
  'bed',
  'desk',
  'sofa',
  'wardrobe',
  'table',
  'shelf',
  'tv_unit',
  'other',
] as const;
export type FurnitureType = (typeof FURNITURE_TYPES)[number];

export type Mode = 'ergonomic' | 'feng_shui';

export interface Room {
  /** Extent along the x axis (N/S walls). */
  widthCm: number;
  /** Extent along the y axis (E/W walls). */
  depthCm: number;
}

export interface Opening {
  id: string;
  kind: 'door' | 'window';
  wall: Wall;
  /** Distance from the wall's start (N/S walls: from x=0, E/W walls: from y=0). */
  offsetCm: number;
  widthCm: number;
}

export interface Furniture {
  id: string;
  type: FurnitureType;
  label: string;
  /** Top-left corner of the item's footprint. */
  xCm: number;
  yCm: number;
  /** Size across the front of the item. */
  widthCm: number;
  /** Size from front to back. */
  depthCm: number;
  /** Direction the front of the item points. For a bed, the direction the feet point. */
  facing: Wall;
}

export interface RoomLayout {
  room: Room;
  openings: Opening[];
  items: Furniture[];
}

export type Severity = 'ok' | 'warn' | 'error';

export interface RuleResult {
  ruleId: string;
  itemIds: string[];
  /** 0 (worst) to 1 (satisfied). */
  score: number;
  weight: number;
  severity: Severity;
  /** The guideline, phrased so it reads as advice when the score is low. */
  message: string;
}

export interface Rule {
  id: string;
  modes: readonly Mode[];
  evaluate: (layout: RoomLayout) => RuleResult[];
}

export interface Placement {
  xCm: number;
  yCm: number;
  facing: Wall;
}

export interface Move {
  itemId: string;
  label: string;
  from: Placement;
  to: Placement;
  reasons: string[];
}

export interface Arrangement {
  mode: Mode;
  items: Furniture[];
  moves: Move[];
  scoreBefore: number;
  scoreAfter: number;
  /** Remaining issues in the suggested layout. */
  remainingIssues: RuleResult[];
}
