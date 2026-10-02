/**
 * Try the room-analysis prompt on your own photos, without the app or Supabase.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... npm run analysis:test -- ./test-photos
 *
 * For every .jpg/.jpeg/.png in the folder it calls the vision model with the same prompt the
 * Edge Function uses, validates the result with the app's real validator, and writes the raw
 * JSON to ./analysis-output/. Use it to tune the prompt until results are reliable.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { evaluateLayout, parseRoomAnalysis, suggestArrangement } from '../src/domain';
import { ROOM_ANALYSIS_PROMPT } from '../supabase/functions/analyze-room/prompt';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5-5';
const dir = process.argv[2];
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!dir || !apiKey) {
  console.error('Usage: ANTHROPIC_API_KEY=... npm run analysis:test -- <folder-with-photos>');
  process.exit(1);
}

const MEDIA: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

async function analyse(file: string): Promise<unknown> {
  const data = readFileSync(file).toString('base64');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey as string,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: MEDIA[extname(file).toLowerCase()], data },
            },
            { type: 'text', text: ROOM_ANALYSIS_PROMPT },
          ],
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`API ${response.status}: ${await response.text()}`);
  const body = (await response.json()) as { content: { type: string; text?: string }[] };
  const text = body.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON in model response');
  return JSON.parse(text.slice(start, end + 1));
}

async function main(): Promise<void> {
  const files = readdirSync(dir as string).filter((f) => extname(f).toLowerCase() in MEDIA);
  if (files.length === 0) {
    console.error(`No .jpg/.png files found in ${dir}`);
    process.exit(1);
  }
  mkdirSync('analysis-output', { recursive: true });

  let ok = 0;
  for (const name of files) {
    const path = join(dir as string, name);
    try {
      const raw = await analyse(path);
      writeFileSync(
        join('analysis-output', `${basename(name, extname(name))}.json`),
        JSON.stringify(raw, null, 2),
      );
      const { layout, confidence, notes } = parseRoomAnalysis(raw);
      const arrangement = suggestArrangement(layout, 'ergonomic');
      const baseline = evaluateLayout(layout, 'ergonomic').score;
      ok++;
      console.log(
        `OK   ${name}: ${layout.room.widthCm}x${layout.room.depthCm} cm, ` +
          `${layout.items.length} items, ${layout.openings.length} openings, confidence ${confidence.toFixed(2)}, ` +
          `score ${baseline.toFixed(2)} -> ${arrangement.scoreAfter.toFixed(2)}` +
          (notes ? `\n     notes: ${notes}` : ''),
      );
    } catch (e) {
      console.log(`FAIL ${name}: ${(e as Error).message}`);
    }
  }
  console.log(`\n${ok}/${files.length} photos produced a usable analysis.`);
}

void main();
