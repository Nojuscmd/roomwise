import { Mode, Rule, RoomLayout, RuleResult } from '../types';
import { bedSideClearance, doorClearance, frontClearance, noOverlap } from './common';
import { tvGlare, tvViewing, windowBlocked, windowGlare } from './ergonomic';
import { balance, bedDoorLine, bedHeadboard, commandPosition } from './fengShui';

export const ALL_RULES: readonly Rule[] = [
  noOverlap,
  frontClearance,
  bedSideClearance,
  doorClearance,
  windowGlare,
  windowBlocked,
  tvViewing,
  tvGlare,
  bedHeadboard,
  bedDoorLine,
  commandPosition,
  balance,
];

export const rulesFor = (mode: Mode): Rule[] => ALL_RULES.filter((r) => r.modes.includes(mode));

export interface Evaluation {
  /** Weighted average of all rule scores, 0..1. */
  score: number;
  results: RuleResult[];
}

export function evaluateLayout(layout: RoomLayout, mode: Mode): Evaluation {
  const results = rulesFor(mode).flatMap((rule) => rule.evaluate(layout));
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  const score =
    totalWeight === 0 ? 1 : results.reduce((s, r) => s + r.score * r.weight, 0) / totalWeight;
  return { score, results };
}
