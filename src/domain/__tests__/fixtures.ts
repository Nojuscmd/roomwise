import { Furniture, Opening, RoomLayout } from '../types';

/** A 400 x 350 cm bedroom: door on the south wall, window on the north wall. */
export const bedroomOpenings: Opening[] = [
  { id: 'door', kind: 'door', wall: 'S', offsetCm: 40, widthCm: 90 },
  { id: 'win', kind: 'window', wall: 'N', offsetCm: 130, widthCm: 140 },
];

export const bed = (over: Partial<Furniture> = {}): Furniture => ({
  id: 'bed',
  type: 'bed',
  label: 'bed',
  xCm: 130,
  yCm: 0,
  widthCm: 160,
  depthCm: 200,
  facing: 'S',
  ...over,
});

export const desk = (over: Partial<Furniture> = {}): Furniture => ({
  id: 'desk',
  type: 'desk',
  label: 'desk',
  xCm: 300,
  yCm: 150,
  widthCm: 120,
  depthCm: 60,
  facing: 'W',
  ...over,
});

export const wardrobe = (over: Partial<Furniture> = {}): Furniture => ({
  id: 'wardrobe',
  type: 'wardrobe',
  label: 'wardrobe',
  xCm: 0,
  yCm: 200,
  widthCm: 100,
  depthCm: 55,
  facing: 'E',
  ...over,
});

export const makeLayout = (items: Furniture[]): RoomLayout => ({
  room: { widthCm: 400, depthCm: 350 },
  openings: bedroomOpenings,
  items,
});
