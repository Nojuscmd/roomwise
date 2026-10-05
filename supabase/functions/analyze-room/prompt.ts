// Shared by the Edge Function and scripts/test-analysis.ts so both use the identical prompt.
/** Added when a room has several photos. */
export const MULTI_PHOTO_NOTE = (count: number) => `

You are given ${count} photos of the SAME room, taken from different positions. Combine them into ONE
layout: every piece of furniture, door and window appears exactly once, even if it is visible in
several photos. Use the first photo to decide which wall is north (the wall in front of the camera in
photo 1); keep that orientation for the whole room. Use the other photos to see walls, corners and
furniture that photo 1 hides, and to get sizes and positions more accurately. Raise "confidence"
when the photos together cover the whole room.`;

export const ROOM_ANALYSIS_PROMPT = `You are analysing a photo of a room to help plan its furniture layout.
Return ONLY a JSON object (no prose, no markdown fences) with this exact shape:

{
  "room": { "widthCm": number, "depthCm": number },
  "openings": [ { "kind": "door" | "window", "wall": "N"|"E"|"S"|"W", "offsetCm": number, "widthCm": number } ],
  "furniture": [ { "type": "bed"|"desk"|"sofa"|"wardrobe"|"table"|"shelf"|"tv_unit"|"other",
                   "label": string, "xCm": number, "yCm": number, "widthCm": number, "depthCm": number,
                   "facing": "N"|"E"|"S"|"W" } ],
  "confidence": number,
  "notes": string
}

Coordinate system (top-down floor plan, centimetres):
- Treat the wall directly in front of the camera as north (N), the wall on the left as west (W),
  on the right as east (E), and the wall behind the camera as south (S).
- Origin is the north-west corner. x grows toward east, y grows toward south.
- widthCm is the room's east-west extent, depthCm its north-south extent.
- For openings, offsetCm is the distance from the north end of an E/W wall, or from the west end of an N/S wall.
- For furniture, xCm/yCm is the top-left corner of its footprint; widthCm is the size across its front,
  depthCm front-to-back; "facing" is the direction its front points (for a bed, the direction its feet point).

Rules:
- Estimate sizes using typical furniture dimensions (e.g. double bed ~140x200, door ~90 wide, desk ~120x60).
- Only include furniture you can actually see. Do not invent items. Unseen areas: say so in "notes".
- Furniture cannot overlap: a wardrobe, chest or nightstand next to a bed sits beside or at the foot of it, never on top of it.
  Keep every footprint inside the room, and give each piece its own space.
- "label" is a short name of one to three words (e.g. "Queen bed", "Desk", "Nightstand"). No descriptions.
- "confidence" is 0 to 1 and should be low when walls or corners are hidden or the photo is unclear.
- "notes" is one or two plain sentences about uncertainty (max 300 characters).
- If the image is not a room interior, return {"error": "not_a_room"}.`;
