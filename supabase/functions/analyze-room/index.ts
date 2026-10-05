// Supabase Edge Function (Deno): analyze a room photo with a vision model.
//
// Flow: the app uploads the photo to the private "room-photos" bucket and creates a `rooms` row,
// then calls this function with { roomId }. The function loads the room and photo AS THE CALLING
// USER (so Row Level Security applies), asks the model for a structured description, stores the
// result on the room row and returns it. The API key never leaves the server.
//
// Deploy:  supabase functions deploy analyze-room
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from 'npm:@supabase/supabase-js@2';
import { MULTI_PHOTO_NOTE, ROOM_ANALYSIS_PROMPT } from './prompt.ts';

const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
const MAX_ANALYSES_PER_HOUR = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON in model response');
  return JSON.parse(text.slice(start, end + 1));
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'server_not_configured' }, 500);

  let roomId: string;
  try {
    const body = await req.json();
    roomId = String(body?.roomId ?? '');
    if (!/^[0-9a-f-]{36}$/i.test(roomId)) throw new Error('bad id');
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  // A client bound to the caller's JWT: all queries below are subject to RLS.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401);

  // Simple per-user rate limit to protect the API budget.
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('rooms')
    .select('id', { count: 'exact', head: true })
    .gte('analyzed_at', since);
  if ((count ?? 0) >= MAX_ANALYSES_PER_HOUR) return json({ error: 'rate_limited' }, 429);

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, photo_path, extra_photo_paths, width_cm, depth_cm')
    .eq('id', roomId)
    .single();
  if (roomError || !room) return json({ error: 'room_not_found' }, 404);
  if (!room.photo_path) return json({ error: 'no_photo' }, 400);

  // Main photo first (it defines which wall is north), then up to three extra photos.
  const paths: string[] = [room.photo_path, ...(room.extra_photo_paths ?? [])].slice(0, 4);
  const images: { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }[] =
    [];
  for (const path of paths) {
    const { data: file, error: fileError } = await supabase.storage
      .from('room-photos')
      .download(path);
    if (fileError || !file) return json({ error: 'photo_not_found' }, 404);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    images.push({
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: toBase64(bytes) },
    });
  }

  const hint =
    room.width_cm && room.depth_cm
      ? `\n\nThe user measured the room: ${room.width_cm} cm (east-west) by ${room.depth_cm} cm (north-south). Use these exact room dimensions.`
      : '';

  let analysis: Record<string, unknown>;
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              ...images,
              {
                type: 'text',
                text:
                  ROOM_ANALYSIS_PROMPT +
                  (images.length > 1 ? MULTI_PHOTO_NOTE(images.length) : '') +
                  hint,
              },
            ],
          },
        ],
      }),
    });
    if (!response.ok) {
      console.error('Model API error', response.status, await response.text());
      return json({ error: 'analysis_failed' }, 502);
    }
    const result = await response.json();
    const text = (result.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('');
    if (result.stop_reason === 'max_tokens')
      console.error('Model output was cut off at max_tokens');
    try {
      analysis = extractJson(text) as Record<string, unknown>;
    } catch (parseError) {
      console.error('Unreadable model output:', text.slice(0, 500));
      throw parseError;
    }
  } catch (err) {
    console.error('Analysis error', err);
    return json({ error: 'analysis_failed' }, 502);
  }

  if (analysis.error === 'not_a_room') return json({ error: 'not_a_room' }, 422);
  if (typeof analysis.room !== 'object' || analysis.room === null) {
    return json({ error: 'analysis_failed' }, 502);
  }

  // Strict validation happens in the app (src/domain/validate.ts); store the raw result.
  const confidence = typeof analysis.confidence === 'number' ? analysis.confidence : null;
  const { error: updateError } = await supabase
    .from('rooms')
    .update({
      analysis_json: analysis,
      analysis_confidence: confidence,
      analyzed_at: new Date().toISOString(),
    })
    .eq('id', roomId);
  if (updateError) return json({ error: 'save_failed' }, 500);

  return json({ analysis });
});
