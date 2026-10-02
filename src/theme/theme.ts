import { FurnitureType } from '@/domain';

export const colors = {
  background: '#F7F4EE',
  surface: '#FFFFFF',
  ink: '#2B2A28',
  muted: '#8A857C',
  line: '#E3DED4',
  accent: '#6B8F71',
  accentSoft: '#E4ECE4',
  warn: '#C26A4A',
  warnSoft: '#F5E6DF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20 } as const;

export const type = {
  title: { fontSize: 28, fontWeight: '600' as const, color: colors.ink, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '600' as const, color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  caption: { fontSize: 13, color: colors.muted, lineHeight: 18 },
};

/** Muted, calm tones for furniture on the floor plan. */
export const furnitureColors: Record<FurnitureType, string> = {
  bed: '#C9D6CA',
  desk: '#D9CDB8',
  sofa: '#CBD3DC',
  wardrobe: '#D6C7C0',
  table: '#E0D6C4',
  shelf: '#D3CFC4',
  tv_unit: '#C8CBD0',
  other: '#DDD9D0',
};
