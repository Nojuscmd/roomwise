import { footprint, insideRoom, intersects, openingZone, opposite, Rect } from './geometry';
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
/** A move must improve the overall score by more than this (0.03 = 3 percentage points). */
const MIN_MOVE_GAIN = 0.03;
/** Beds and wardrobes are heavy: moving them has to be clearly worth the effort. */
const HEAVY_TYPES = new Set<FurnitureType>(['bed', 'wardrobe']);
const MIN_HEAVY_MOVE_GAIN = 0.05;
/** A chair this close to a desk is treated as that desk's chair and moves with it. */
const CHAIR_PATTERN = /chair|stool/i;
const CHAIR_MAX_DESK_GAP_CM = 80;
const CHAIR_MAX_TUCK_GAP_CM = 30;

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

type Companions = Map<string, Furniture>;

function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, a.x - (b.x + b.w), b.x - (a.x + a.w));
  const dy = Math.max(0, a.y - (b.y + b.h), b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

/** Pair each desk with the chair standing closest to it, so the chair can follow the desk. */
function findCompanions(items: Furniture[]): Companions {
  const desks = items.filter((i) => i.type === 'desk');
  const best = new Map<string, { chair: Furniture; gap: number }>();
  for (const chair of items) {
    if (chair.type === 'desk' || !CHAIR_PATTERN.test(chair.label)) continue;
    let nearest: { desk: Furniture; gap: number } | null = null;
    for (const desk of desks) {
      const gap = rectGap(footprint(chair), footprint(desk));
      if (gap <= CHAIR_MAX_DESK_GAP_CM && (!nearest || gap < nearest.gap)) nearest = { desk, gap };
    }
    if (!nearest) continue;
    const current = best.get(nearest.desk.id);
    if (!current || nearest.gap < current.gap)
      best.set(nearest.desk.id, { chair, gap: nearest.gap });
  }
  return new Map([...best].map(([deskId, { chair }]) => [deskId, chair]));
}

/** Where a desk's chair stands: centred in front of the desk, facing it. */
function chairFor(desk: Furniture, chair: Furniture, originalDesk: Furniture): Furniture {
  const gap = Math.min(CHAIR_MAX_TUCK_GAP_CM, rectGap(footprint(chair), footprint(originalDesk)));
  const facing = opposite(desk.facing);
  const { w, h } = dims(chair, facing);
  const d = footprint(desk);
  switch (desk.facing) {
    case 'N':
      return { ...chair, facing, xCm: d.x + (d.w - w) / 2, yCm: d.y - h - gap };
    case 'S':
      return { ...chair, facing, xCm: d.x + (d.w - w) / 2, yCm: d.y + d.h + gap };
    case 'W':
      return { ...chair, facing, xCm: d.x - w - gap, yCm: d.y + (d.h - h) / 2 };
    default:
      return { ...chair, facing, xCm: d.x + d.w + gap, yCm: d.y + (d.h - h) / 2 };
  }
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

interface Context {
  layout: RoomLayout;
  mode: Mode;
  /** desk id -> its chair as originally photographed. */
  companions: Companions;
  /** desk id -> the desk as originally photographed. */
  originals: Map<string, Furniture>;
}

/** The movable items plus every desk's chair standing where that desk currently is. */
function withChairs(items: Furniture[], ctx: Context): Furniture[] {
  const out = [...items];
  for (const item of items) {
    const chair = ctx.companions.get(item.id);
    const original = ctx.originals.get(item.id);
    if (chair && original) out.push(chairFor(item, chair, original));
  }
  return out;
}

/** Is this placement allowed, including the desk's chair if it has one? */
function isValidWithChair(cand: Furniture, others: Furniture[], ctx: Context): boolean {
  const fullOthers = withChairs(others, ctx);
  if (!isValidPlacement(cand, fullOthers, ctx.layout)) return false;
  const chair = ctx.companions.get(cand.id);
  const original = ctx.originals.get(cand.id);
  if (!chair || !original) return true;
  return isValidPlacement(chairFor(cand, chair, original), [...fullOthers, cand], ctx.layout);
}

const scoreOf = (items: Furniture[], ctx: Context): number =>
  evaluateLayout({ ...ctx.layout, items: withChairs(items, ctx) }, ctx.mode).score;

function pickBest(item: Furniture, others: Furniture[], ctx: Context): Furniture {
  let best: Furniture | null = null;
  let bestScore = -Infinity;
  for (const cand of candidatePlacements(item, ctx.layout)) {
    if (!isValidWithChair(cand, others, ctx)) continue;
    const score = scoreOf([...others, cand], ctx);
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
 * Undo moves that barely help, so a room that is already fine is left alone instead of having
 * furniture shuffled for a fraction of a percent. A move is always kept when it fixes a real
 * problem for that item (a rule that was clearly failing). Otherwise heavy items need a bigger
 * gain than light ones. Total score loss from all reverts together stays within the limits, and
 * an item is only put back where it was if that spot is still valid.
 */
function revertMinorMoves(original: Furniture[], placed: Furniture[], ctx: Context): Furniture[] {
  const beforeResults = evaluateLayout(ctx.layout, ctx.mode).results;
  let result = [...placed];
  const bestScore = scoreOf(result, ctx);
  for (const orig of original) {
    const index = result.findIndex((p) => p.id === orig.id);
    const current = result[index];
    if (!current || !hasMoved(orig, current)) continue;
    const afterResults = evaluateLayout(
      { ...ctx.layout, items: withChairs(result, ctx) },
      ctx.mode,
    ).results;
    if (reasonsFor(orig.id, beforeResults, afterResults).length > 0) continue;
    const trial = result.map((p, i) => (i === index ? orig : p));
    const others = trial.filter((_, i) => i !== index);
    if (!isValidWithChair(orig, others, ctx)) continue;
    const limit = HEAVY_TYPES.has(orig.type) ? MIN_HEAVY_MOVE_GAIN : MIN_MOVE_GAIN;
    if (bestScore - scoreOf(trial, ctx) <= limit) result = trial;
  }
  return result;
}

/**
 * Suggest a better arrangement for the given mode.
 * Deterministic greedy placement followed by a couple of coordinate-descent refinement passes.
 * A desk's chair is not placed on its own: it follows the desk.
 */
export function suggestArrangement(layout: RoomLayout, mode: Mode): Arrangement {
  const original = layout.items;
  const companions = findCompanions(original);
  const chairIds = new Set([...companions.values()].map((c) => c.id));
  const originals = new Map(original.map((o) => [o.id, o]));
  const ctx: Context = { layout, mode, companions, originals };

  const movable = original.filter((o) => !chairIds.has(o.id));
  const order = [...movable].sort(
    (a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type) || a.id.localeCompare(b.id),
  );

  const placed: Furniture[] = [];
  for (const item of order) placed.push(pickBest(item, placed, ctx));

  for (let pass = 0; pass < REFINEMENT_PASSES; pass++) {
    placed.forEach((item, i) => {
      const others = placed.filter((_, j) => j !== i);
      placed[i] = pickBest(item, others, ctx);
    });
  }

  const settled = revertMinorMoves(movable, placed, ctx);

  // Report items in the original order so the UI stays stable. A chair stays exactly where it was
  // unless its desk moved.
  const items = original.map((o) => {
    if (!chairIds.has(o.id)) return settled.find((p) => p.id === o.id) ?? o;
    const deskId = [...companions].find(([, c]) => c.id === o.id)?.[0] ?? '';
    const desk = settled.find((p) => p.id === deskId);
    const origDesk = originals.get(deskId);
    return desk && origDesk && hasMoved(origDesk, desk) ? chairFor(desk, o, origDesk) : o;
  });
  const before = evaluateLayout(layout, mode);
  const after = evaluateLayout({ ...layout, items }, mode);

  const movedLabels = original
    .filter((o) => !chairIds.has(o.id))
    .filter((o) => {
      const n = items.find((i) => i.id === o.id);
      return n && hasMoved(o, n);
    })
    .map((o) => o.label);

  const moves: Move[] = [];
  for (const o of original) {
    const n = items.find((i) => i.id === o.id);
    if (!n || !hasMoved(o, n)) continue;
    const deskId = [...companions].find(([, c]) => c.id === o.id)?.[0];
    const deskLabel = deskId ? originals.get(deskId)?.label : undefined;
    const direct = reasonsFor(o.id, before.results, after.results);
    const others = movedLabels.filter((label) => label !== o.label);
    const reasons = deskLabel
      ? [`Moves with the ${deskLabel} so you can still sit at it.`]
      : direct.length > 0
        ? direct
        : [
            others.length > 0
              ? `Makes room so the ${others.join(' and ')} can be placed better.`
              : 'Repositioned to improve overall flow and balance.',
          ];
    moves.push({ itemId: o.id, label: o.label, from: placementOf(o), to: placementOf(n), reasons });
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
