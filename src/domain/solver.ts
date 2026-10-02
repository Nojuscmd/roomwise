import { footprint, insideRoom, intersects, openingZone, opposite } from './geometry';
import { DOOR_CLEARANCE_CM } from './rules/common';
import { evaluateLayout } from './rules';
import {
  Arrangement,
  Furniture,
  FurnitureType,
  Mode,
  Move,
  Placement,
  RoomLayout,
  RuleResult,
  WALLS,
} from './types';

/** Large, important items are placed first so smaller items adapt around them. */
const PRIORITY: FurnitureType[] = [
  'bed',
  'wardrobe',
  'desk',
  'sofa',
  'tv_unit',
  'shelf',
  'table',
  'other',
];
const FLOATING_TYPES = new Set<FurnitureType>(['sofa', 'table', 'other']);
const WALL_STEP_CM = 20;
const FLOAT_STEP_CM = 50;
const MOVE_THRESHOLD_CM = 10;
const REFINEMENT_PASSES = 2;

function dims(item: Furniture, facing: Furniture['facing']): { w: number; h: number } {
  const swap = facing === 'E' || facing === 'W';
  return { w: swap ? item.depthCm : item.widthCm, h: swap ? item.widthCm : item.depthCm };
}

function range(from: number, to: number, step: number): number[] {
  if (to < from) return [];
  const values: number[] = [];
  for (let v = from; v < to; v += step) values.push(v);
  values.push(to);
  return values;
}

/** Candidate placements: flush against the wall behind the item, plus a grid for floating items. */
export function candidatePlacements(item: Furniture, layout: RoomLayout): Furniture[] {
  const { room } = layout;
  const out: Furniture[] = [];
  for (const facing of WALLS) {
    const { w, h } = dims(item, facing);
    if (w > room.widthCm || h > room.depthCm) continue;
    const maxX = room.widthCm - w;
    const maxY = room.depthCm - h;
    const back = opposite(facing);
    const make = (xCm: number, yCm: number): Furniture => ({ ...item, xCm, yCm, facing });
    if (back === 'S') range(0, maxX, WALL_STEP_CM).forEach((x) => out.push(make(x, maxY)));
    if (back === 'N') range(0, maxX, WALL_STEP_CM).forEach((x) => out.push(make(x, 0)));
    if (back === 'W') range(0, maxY, WALL_STEP_CM).forEach((y) => out.push(make(0, y)));
    if (back === 'E') range(0, maxY, WALL_STEP_CM).forEach((y) => out.push(make(maxX, y)));
    if (FLOATING_TYPES.has(item.type)) {
      for (const x of range(0, maxX, FLOAT_STEP_CM)) {
        for (const y of range(0, maxY, FLOAT_STEP_CM)) out.push(make(x, y));
      }
    }
  }
  return out;
}

function isValidPlacement(candidate: Furniture, others: Furniture[], layout: RoomLayout): boolean {
  const fp = footprint(candidate);
  if (!insideRoom(fp, layout.room)) return false;
  if (others.some((o) => intersects(fp, footprint(o)))) return false;
  return !layout.openings
    .filter((o) => o.kind === 'door')
    .some((door) => intersects(fp, openingZone(door, layout.room, DOOR_CLEARANCE_CM)));
}

function distanceMoved(a: Furniture, b: Furniture): number {
  return Math.hypot(a.xCm - b.xCm, a.yCm - b.yCm) + (a.facing === b.facing ? 0 : 50);
}

function pickBest(item: Furniture, others: Furniture[], layout: RoomLayout, mode: Mode): Furniture {
  let best: Furniture | null = null;
  let bestScore = -Infinity;
  for (const cand of candidatePlacements(item, layout)) {
    if (!isValidPlacement(cand, others, layout)) continue;
    const { score } = evaluateLayout({ ...layout, items: [...others, cand] }, mode);
    // Tiny tie-breaker favouring the smallest change from where the item already is.
    const adjusted = score - distanceMoved(cand, item) * 1e-6;
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = cand;
    }
  }
  return best ?? item;
}

const placementOf = (f: Furniture): Placement => ({ xCm: f.xCm, yCm: f.yCm, facing: f.facing });

function hasMoved(a: Furniture, b: Furniture): boolean {
  return (
    a.facing !== b.facing ||
    Math.abs(a.xCm - b.xCm) > MOVE_THRESHOLD_CM ||
    Math.abs(a.yCm - b.yCm) > MOVE_THRESHOLD_CM
  );
}

function reasonsFor(itemId: string, before: RuleResult[], after: RuleResult[]): string[] {
  const reasons = new Set<string>();
  for (const b of before) {
    if (!b.itemIds.includes(itemId) || b.score >= 0.9) continue;
    // Rules like door clearance name the blocking items, so once resolved the list is empty.
    const a = after.find(
      (r) => r.ruleId === b.ruleId && (r.itemIds.includes(itemId) || r.itemIds.length === 0),
    );
    if (a && a.score >= b.score + 0.1) reasons.add(b.message);
  }
  return [...reasons];
}

/**
 * Suggest a better arrangement for the given mode.
 * Deterministic greedy placement followed by a couple of coordinate-descent refinement passes.
 */
export function suggestArrangement(layout: RoomLayout, mode: Mode): Arrangement {
  const original = layout.items;
  const order = [...original].sort(
    (a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type) || a.id.localeCompare(b.id),
  );

  const placed: Furniture[] = [];
  for (const item of order) placed.push(pickBest(item, placed, layout, mode));

  for (let pass = 0; pass < REFINEMENT_PASSES; pass++) {
    placed.forEach((item, i) => {
      const others = placed.filter((_, j) => j !== i);
      placed[i] = pickBest(item, others, layout, mode);
    });
  }

  // Report items in the original order so the UI stays stable.
  const items = original.map((o) => placed.find((p) => p.id === o.id) ?? o);
  const before = evaluateLayout(layout, mode);
  const after = evaluateLayout({ ...layout, items }, mode);

  const moves: Move[] = [];
  for (const o of original) {
    const n = items.find((i) => i.id === o.id);
    if (!n || !hasMoved(o, n)) continue;
    const reasons = reasonsFor(o.id, before.results, after.results);
    moves.push({
      itemId: o.id,
      label: o.label,
      from: placementOf(o),
      to: placementOf(n),
      reasons: reasons.length > 0 ? reasons : ['Repositioned to improve overall flow and balance.'],
    });
  }

  return {
    mode,
    items,
    moves,
    scoreBefore: before.score,
    scoreAfter: after.score,
    remainingIssues: after.results.filter((r) => r.score < 0.9),
  };
}
