/**
 * Compares two things on synthetic rooms:
 *   Baseline : the layout as it is (random furniture placement)
 *   Proposed : the layout Roomwise suggests (rules engine + solver)
 *   npx tsx scripts/evaluate.ts [count] [seed]
 * Writes results/evaluation.csv (per room and mode) and results/summary.md (tables for the report).
 * Violations are counted with the same geometry the app uses.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  footprint,
  insideRoom,
  overlapArea,
  suggestArrangement,
  evaluateLayout,
  type Furniture,
  type Mode,
  type RoomLayout,
} from '../src/domain';
import { generateRooms } from './lib/synthetic';

const count = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 42);
const MODES: Mode[] = ['ergonomic', 'feng_shui'];

function violations(layout: RoomLayout, items: Furniture[], mode: Mode) {
  const l = { ...layout, items };
  let overlapPairs = 0;
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (overlapArea(footprint(items[i]!), footprint(items[j]!)) > 1) overlapPairs++;
    }
  }
  const outOfBounds = items.filter((it) => !insideRoom(footprint(it), layout.room)).length;
  const results = evaluateLayout(l, mode).results;
  const doorBlocked = results.filter((r) => r.ruleId === 'door_clearance' && r.score < 0.9).length;
  const badRules = results.filter((r) => r.score < 0.9).length;
  return { overlapPairs, outOfBounds, doorBlocked, badRules };
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? (s[Math.floor((s.length - 1) / 2)]! + s[Math.ceil((s.length - 1) / 2)]!) / 2
    : 0;
};
const pct = (n: number, d: number): string => (d ? ((100 * n) / d).toFixed(1) + ' %' : 'n/a');

interface Row {
  roomId: string;
  roomType: string;
  mode: Mode;
  nItems: number;
  scoreBefore: number;
  scoreAfter: number;
  overlapBefore: number;
  overlapAfter: number;
  oobBefore: number;
  oobAfter: number;
  doorBefore: number;
  doorAfter: number;
  badBefore: number;
  badAfter: number;
  moves: number;
  moveCm: number;
  ms: number;
}

const rows: Row[] = [];
for (const room of generateRooms(count, seed)) {
  for (const mode of MODES) {
    const t0 = performance.now();
    const arr = suggestArrangement(room.layout, mode);
    const ms = performance.now() - t0;
    const b = violations(room.layout, room.layout.items, mode);
    const a = violations(room.layout, arr.items, mode);
    rows.push({
      roomId: room.id,
      roomType: room.roomType,
      mode,
      nItems: room.layout.items.length,
      scoreBefore: arr.scoreBefore,
      scoreAfter: arr.scoreAfter,
      overlapBefore: b.overlapPairs,
      overlapAfter: a.overlapPairs,
      oobBefore: b.outOfBounds,
      oobAfter: a.outOfBounds,
      doorBefore: b.doorBlocked,
      doorAfter: a.doorBlocked,
      badBefore: b.badRules,
      badAfter: a.badRules,
      moves: arr.moves.length,
      moveCm: arr.moves.reduce(
        (s, m) => s + Math.hypot(m.to.xCm - m.from.xCm, m.to.yCm - m.from.yCm),
        0,
      ),
      ms,
    });
  }
}

const outDir = join(process.cwd(), 'results');
mkdirSync(outDir, { recursive: true });
const cols = Object.keys(rows[0]!) as (keyof Row)[];
writeFileSync(
  join(outDir, 'evaluation.csv'),
  [
    cols.join(','),
    ...rows.map((r) =>
      cols
        .map((c) => (typeof r[c] === 'number' ? Number((r[c] as number).toFixed(4)) : r[c]))
        .join(','),
    ),
  ].join('\n') + '\n',
);

const md: string[] = [
  `# Evaluation on synthetic rooms`,
  ``,
  `${count} synthetic rooms, seed ${seed}, both modes (${rows.length} runs). Baseline = layout as generated; Proposed = Roomwise suggestion.`,
  `Synthetic data: random placement inside plausible room sizes, NOT real photographed rooms.`,
  ``,
];
for (const mode of MODES) {
  const r = rows.filter((x) => x.mode === mode);
  const withIssue = (f: (x: Row) => number) => r.filter((x) => f(x) > 0).length;
  md.push(
    `## Mode: ${mode} (${r.length} rooms)`,
    ``,
    `| Metric | Baseline | Proposed |`,
    `| --- | --- | --- |`,
    `| Mean rule score (0-1) | ${mean(r.map((x) => x.scoreBefore)).toFixed(3)} | ${mean(r.map((x) => x.scoreAfter)).toFixed(3)} |`,
    `| Median rule score | ${median(r.map((x) => x.scoreBefore)).toFixed(3)} | ${median(r.map((x) => x.scoreAfter)).toFixed(3)} |`,
    `| Rooms with overlapping furniture | ${pct(
      withIssue((x) => x.overlapBefore),
      r.length,
    )} | ${pct(
      withIssue((x) => x.overlapAfter),
      r.length,
    )} |`,
    `| Rooms with furniture outside the walls | ${pct(
      withIssue((x) => x.oobBefore),
      r.length,
    )} | ${pct(
      withIssue((x) => x.oobAfter),
      r.length,
    )} |`,
    `| Rooms with blocked door | ${pct(
      withIssue((x) => x.doorBefore),
      r.length,
    )} | ${pct(
      withIssue((x) => x.doorAfter),
      r.length,
    )} |`,
    `| Mean rules scoring below 0.9 per room | ${mean(r.map((x) => x.badBefore)).toFixed(2)} | ${mean(r.map((x) => x.badAfter)).toFixed(2)} |`,
    ``,
    `| Solver behaviour | Value |`,
    `| --- | --- |`,
    `| Rooms where score improved | ${pct(r.filter((x) => x.scoreAfter > x.scoreBefore + 1e-9).length, r.length)} |`,
    `| Rooms where score got worse (should be 0) | ${r.filter((x) => x.scoreAfter < x.scoreBefore - 1e-9).length} |`,
    `| Rooms left unchanged | ${pct(r.filter((x) => x.moves === 0).length, r.length)} |`,
    `| Mean items moved per room | ${mean(r.map((x) => x.moves)).toFixed(2)} |`,
    `| Mean total move distance (cm) | ${mean(r.map((x) => x.moveCm)).toFixed(0)} |`,
    `| Mean solver time (ms) | ${mean(r.map((x) => x.ms)).toFixed(1)} |`,
    `| Max solver time (ms) | ${Math.max(...r.map((x) => x.ms)).toFixed(1)} |`,
    ``,
  );
}
writeFileSync(join(outDir, 'summary.md'), md.join('\n'));
console.log(md.join('\n'));
