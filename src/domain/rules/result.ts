import { Rule, RuleResult, Severity } from '../types';

export function severityFor(score: number): Severity {
  if (score >= 0.9) return 'ok';
  if (score >= 0.5) return 'warn';
  return 'error';
}

export function makeResult(
  ruleId: string,
  itemIds: string[],
  score: number,
  weight: number,
  message: string,
): RuleResult {
  const clamped = Math.max(0, Math.min(1, score));
  return { ruleId, itemIds, score: clamped, weight, severity: severityFor(clamped), message };
}

export type { Rule };
