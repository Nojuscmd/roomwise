/**
 * Precision / recall / F1 of the AI's furniture detection, from hand-counted data.
 *   npx tsx scripts/perception-metrics.ts [path]      (default: eval/perception_counts.csv)
 *
 * CSV columns: room,type,truth,detected
 *   truth    = how many items of this type are really in the room (you count them by eye)
 *   detected = how many items of this type the app found for that room
 * One row per room and furniture type. Per row: true positives = min(truth, detected),
 * false positives = detected beyond truth, false negatives = truth the AI missed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const path = process.argv[2] ?? join(process.cwd(), 'eval', 'perception_counts.csv');
const lines = readFileSync(path, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);
const header = lines
  .shift()
  ?.split(',')
  .map((h) => h.trim());
if (!header || header.join(',') !== 'room,type,truth,detected') {
  throw new Error('First line must be: room,type,truth,detected');
}
if (lines.length === 0) {
  console.log('No data rows yet. Fill eval/perception_counts.csv first.');
  process.exit(0);
}

interface Counts {
  tp: number;
  fp: number;
  fn: number;
}
const byType = new Map<string, Counts>();
const rooms = new Set<string>();
const total: Counts = { tp: 0, fp: 0, fn: 0 };

for (const [i, line] of lines.entries()) {
  const [room, type, truthRaw, detectedRaw] = line.split(',').map((c) => c.trim());
  const truth = Number(truthRaw);
  const detected = Number(detectedRaw);
  if (
    !room ||
    !type ||
    !Number.isInteger(truth) ||
    !Number.isInteger(detected) ||
    truth < 0 ||
    detected < 0
  ) {
    throw new Error(`Bad row ${i + 2}: ${line}`);
  }
  rooms.add(room);
  const c = byType.get(type) ?? { tp: 0, fp: 0, fn: 0 };
  const tp = Math.min(truth, detected);
  c.tp += tp;
  c.fp += detected - tp;
  c.fn += truth - tp;
  byType.set(type, c);
  total.tp += tp;
  total.fp += detected - tp;
  total.fn += truth - tp;
}

const ratio = (a: number, b: number): number => (b === 0 ? 0 : a / b);
const row = (name: string, c: Counts): string => {
  const p = ratio(c.tp, c.tp + c.fp);
  const r = ratio(c.tp, c.tp + c.fn);
  const f1 = ratio(2 * p * r, p + r);
  return `| ${name} | ${c.tp} | ${c.fp} | ${c.fn} | ${p.toFixed(2)} | ${r.toFixed(2)} | ${f1.toFixed(2)} |`;
};

console.log(`Rooms: ${rooms.size}, rows: ${lines.length}\n`);
console.log('| Type | TP | FP | FN | Precision | Recall | F1 |');
console.log('| --- | --- | --- | --- | --- | --- | --- |');
for (const [type, c] of [...byType.entries()].sort()) console.log(row(type, c));
console.log(row('**all**', total));
