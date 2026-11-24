/**
 * Writes a synthetic dataset (default 1000 rooms) to data/synthetic/.
 *   npx tsx scripts/generate-synthetic.ts [count] [seed]
 * Outputs: rooms.csv (one row per room), items.csv (one row per furniture item),
 * openings.csv (one row per door/window).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateRooms } from './lib/synthetic';

const count = Number(process.argv[2] ?? 1000);
const seed = Number(process.argv[3] ?? 42);
const outDir = join(process.cwd(), 'data', 'synthetic');
mkdirSync(outDir, { recursive: true });

const csv = (rows: (string | number)[][]): string =>
  rows
    .map((r) => r.map((c) => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c)).join(','))
    .join('\n') + '\n';

const rooms = generateRooms(count, seed);

writeFileSync(
  join(outDir, 'rooms.csv'),
  csv([
    ['room_id', 'room_type', 'width_cm', 'depth_cm', 'area_m2', 'n_items', 'n_doors', 'n_windows'],
    ...rooms.map(({ id, roomType, layout: l }) => [
      id,
      roomType,
      l.room.widthCm,
      l.room.depthCm,
      Number(((l.room.widthCm * l.room.depthCm) / 10000).toFixed(2)),
      l.items.length,
      l.openings.filter((o) => o.kind === 'door').length,
      l.openings.filter((o) => o.kind === 'window').length,
    ]),
  ]),
);

writeFileSync(
  join(outDir, 'items.csv'),
  csv([
    [
      'room_id',
      'room_type',
      'item_id',
      'type',
      'label',
      'x_cm',
      'y_cm',
      'width_cm',
      'depth_cm',
      'facing',
    ],
    ...rooms.flatMap(({ id, roomType, layout }) =>
      layout.items.map((i) => [
        id,
        roomType,
        i.id,
        i.type,
        i.label,
        i.xCm,
        i.yCm,
        i.widthCm,
        i.depthCm,
        i.facing,
      ]),
    ),
  ]),
);

writeFileSync(
  join(outDir, 'openings.csv'),
  csv([
    ['room_id', 'opening_id', 'kind', 'wall', 'offset_cm', 'width_cm'],
    ...rooms.flatMap(({ id, layout }) =>
      layout.openings.map((o) => [id, o.id, o.kind, o.wall, o.offsetCm, o.widthCm]),
    ),
  ]),
);

const nItems = rooms.reduce((s, r) => s + r.layout.items.length, 0);
console.log(`Wrote ${rooms.length} rooms, ${nItems} items to ${outDir} (seed ${seed})`);
