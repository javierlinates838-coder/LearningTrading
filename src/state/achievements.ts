import { LESSONS } from '../content';
import { skillStatus, type ProgressState } from '../engine/progress';
import { entryNet, type JournalState } from '../sim/journal';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  earned: (p: ProgressState, j: JournalState) => boolean;
}

const demonstrated = (skill: string) => (p: ProgressState) => skillStatus(p, skill) === 'demonstrated';

/** Achievements reward understanding and reflection only. Nothing here looks at profit or trade count. */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-lesson',
    title: 'First step',
    description: 'Complete your first lesson.',
    earned: (p) => Object.values(p.lessons).some((l) => l.status === 'completed'),
  },
  {
    id: 'understand-spread',
    title: 'Understand the spread',
    description: 'Answer two different spread questions correctly on the first try.',
    earned: demonstrated('spread'),
  },
  {
    id: 'read-a-candle',
    title: 'Read a candle',
    description: 'Show you can read open, high, low and close on new examples.',
    earned: demonstrated('ohlc'),
  },
  {
    id: 'size-a-position',
    title: 'Size a position',
    description: 'Size two different trades within a risk budget on the first try.',
    earned: demonstrated('position-sizing'),
  },
  {
    id: 'choose-to-wait',
    title: 'Choose to wait',
    description: 'Show, on new examples, that you can pass when the setup is missing.',
    earned: demonstrated('waiting'),
  },
  {
    id: 'spot-a-scam',
    title: 'Spot a scam',
    description: 'Recognize investment-fraud red flags on two different examples.',
    earned: demonstrated('scam-signals'),
  },
  {
    id: 'fix-a-misconception',
    title: 'Fix a misconception',
    description: 'Get an item right after missing it the first time.',
    earned: (p) => Object.keys(p.awards).some((k) => k.startsWith('fix:')),
  },
  {
    id: 'clear-a-review',
    title: 'Close the loop',
    description: 'Clear a skill from the review queue with correct answers on changed examples.',
    earned: (p) => p.reviewsCleared > 0,
  },
  {
    id: 'explain-a-losing-trade',
    title: 'Explain a losing trade',
    description: 'Write a reflection on a simulated trade that lost money.',
    earned: (_p, j) => j.entries.some((e) => entryNet(e) < 0 && !!e.reflection && e.reflection.whatHappened.trim().length >= 10),
  },
  {
    id: 'finish-course',
    title: 'Course complete',
    description: 'Pass every unit checkpoint.',
    earned: (p) => LESSONS.filter((l) => l.kind === 'checkpoint').every((l) => p.lessons[l.id]?.status === 'completed'),
  },
];

export function evaluateAchievements(p: ProgressState, j: JournalState, at: string): { progress: ProgressState; unlocked: Achievement[] } {
  const unlocked = ACHIEVEMENTS.filter((a) => !p.achievements[a.id] && a.earned(p, j));
  if (!unlocked.length) return { progress: p, unlocked };
  const achievements = { ...p.achievements };
  for (const a of unlocked) achievements[a.id] = at;
  return { progress: { ...p, achievements }, unlocked };
}
