import { FurnitureType } from '@/domain';

/**
 * Roomwise looks like a planner's desk: warm stone paper, graphite ink, a marker blue for
 * things you can act on, and tape yellow for the one thing it marks on a plan: the door.
 */
export const colors = {
  background: '#EBE7DF',
  surface: '#FBF9F5',
  ink: '#18232E',
  inkSoft: '#2C3A47',
  muted: '#5E5D57',
  line: '#D9D4C9',
  accent: '#2F5BD3',
  accentSoft: '#E3EAFB',
  tape: '#F2B705',
  tapeSoft: '#FBF0C8',
  warn: '#B3372B',
  warnSoft: '#F8E4E1',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export const type = {
  title: { fontSize: 32, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.9 },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.ink, letterSpacing: -0.2 },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  caption: { fontSize: 13, color: colors.muted, lineHeight: 18 },
  /** Numbers that should line up, such as sizes and scores. */
  measure: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
    fontVariant: ['tabular-nums' as const],
  },
};

/** Flat, paper-cutout tones for furniture on the floor plan. */
export const furnitureColors: Record<FurnitureType, string> = {
  bed: '#CFE3DA',
  desk: '#F1E2B4',
  sofa: '#D3DCF2',
  wardrobe: '#E4D6D2',
  table: '#F0E8D2',
  shelf: '#DCE0E3',
  tv_unit: '#CBD2DC',
  other: '#E6E8EA',
};
