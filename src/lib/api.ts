import * as ImageManipulator from 'expo-image-manipulator';
import { Arrangement, Mode } from '@/domain';
import { supabase } from './supabase';

export interface RoomRow {
  id: string;
  name: string;
  photo_path: string | null;
  width_cm: number | null;
  depth_cm: number | null;
  analysis_json: unknown | null;
  analysis_confidence: number | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArrangementRow {
  id: string;
  room_id: string;
  mode: Mode;
  score_before: number;
  score_after: number;
  created_at: string;
}

export interface Preferences {
  default_mode: Mode;
  units: 'metric' | 'imperial';
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const FRIENDLY: Record<string, string> = {
  not_a_room: "That doesn't look like a room. Try a wider photo of the interior.",
  rate_limited: "You've analysed a lot of rooms in the last hour. Please try again later.",
  analysis_failed: 'The analysis service had a problem. Please try again.',
  unauthorized: 'Your session expired. Please sign in again.',
};

function fail(error: { message: string } | null, fallback: string): never {
  throw new ApiError(error?.message ?? fallback);
}

export async function listRooms(): Promise<RoomRow[]> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load rooms.');
  return data as RoomRow[];
}

export async function getRoom(id: string): Promise<RoomRow> {
  const { data, error } = await supabase.from('rooms').select('*').eq('id', id).single();
  if (error) fail(error, 'Could not load the room.');
  return data as RoomRow;
}

export async function deleteRoom(room: RoomRow): Promise<void> {
  if (room.photo_path) await supabase.storage.from('room-photos').remove([room.photo_path]);
  const { error } = await supabase.from('rooms').delete().eq('id', room.id);
  if (error) fail(error, 'Could not delete the room.');
}

/** Resize + compress before upload: keeps uploads fast and API costs low. */
async function prepareImage(uri: string): Promise<ArrayBuffer> {
  const result = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1400 } }], {
    compress: 0.8,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const response = await fetch(result.uri);
  return response.arrayBuffer();
}

export async function createRoom(input: {
  name: string;
  photoUri: string;
  widthCm?: number;
  depthCm?: number;
}): Promise<RoomRow> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new ApiError(FRIENDLY.unauthorized!, 'unauthorized');

  const path = `${userData.user.id}/${Date.now()}.jpg`;
  const bytes = await prepareImage(input.photoUri);
  const upload = await supabase.storage
    .from('room-photos')
    .upload(path, bytes, { contentType: 'image/jpeg' });
  if (upload.error) fail(upload.error, 'Could not upload the photo.');

  const { data, error } = await supabase
    .from('rooms')
    .insert({
      name: input.name,
      photo_path: path,
      width_cm: input.widthCm ?? null,
      depth_cm: input.depthCm ?? null,
    })
    .select('*')
    .single();
  if (error) {
    await supabase.storage.from('room-photos').remove([path]);
    fail(error, 'Could not save the room.');
  }
  return data as RoomRow;
}

export async function analyzeRoom(roomId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('analyze-room', { body: { roomId } });
  if (error) {
    // supabase-js hides the JSON body of non-2xx responses inside error.context.
    let code: string | undefined;
    try {
      const body = await (error as { context?: Response }).context?.json();
      code = body?.error;
    } catch {
      /* fall through to generic message */
    }
    throw new ApiError(FRIENDLY[code ?? ''] ?? 'Analysis failed. Please try again.', code);
  }
  if (!data?.analysis) throw new ApiError(FRIENDLY.analysis_failed!, 'analysis_failed');
}

/** Store the user's corrected layout in place of the model's raw detection. */
export async function updateRoomAnalysis(
  roomId: string,
  analysis: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('rooms')
    .update({ analysis_json: analysis, analysis_confidence: 1 })
    .eq('id', roomId);
  if (error) fail(error, 'Could not save your changes.');
}

export async function photoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('room-photos').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function saveArrangement(roomId: string, a: Arrangement): Promise<void> {
  const { error } = await supabase.from('arrangements').insert({
    room_id: roomId,
    mode: a.mode,
    layout_json: a.items,
    moves_json: a.moves,
    score_before: a.scoreBefore,
    score_after: a.scoreAfter,
  });
  if (error) fail(error, 'Could not save the arrangement.');
}

export async function listArrangements(roomId: string): Promise<ArrangementRow[]> {
  const { data, error } = await supabase
    .from('arrangements')
    .select('id, room_id, mode, score_before, score_after, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false });
  if (error) fail(error, 'Could not load saved arrangements.');
  return data as ArrangementRow[];
}

export async function getPreferences(): Promise<Preferences> {
  const { data } = await supabase.from('preferences').select('default_mode, units').maybeSingle();
  return (data as Preferences | null) ?? { default_mode: 'ergonomic', units: 'metric' };
}

export async function savePreferences(prefs: Preferences): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new ApiError(FRIENDLY.unauthorized!, 'unauthorized');
  const { error } = await supabase
    .from('preferences')
    .upsert({ user_id: userData.user.id, ...prefs });
  if (error) fail(error, 'Could not save preferences.');
}
