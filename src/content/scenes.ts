/** Ids for the illustrated scenes in src/components/scenes.tsx. */
export const SCENE_IDS = [
  'welcome',
  'shares',
  'spread',
  'ladder',
  'costs',
  'gap',
  'zones',
  'breakout',
  'fomo',
  'revenge',
  'scam',
  'journal',
  'grades',
  'sample',
  'pass',
  'hypothesis',
  'hindsight',
  'steps',
] as const;

export type SceneId = (typeof SCENE_IDS)[number];
