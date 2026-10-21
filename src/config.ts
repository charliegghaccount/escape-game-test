export const WORLD = { width: 1920, height: 1080 };
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export const difficultyConfig = {
  Easy: { volley: 1, interval: 5, rampPerMinute: 1, minInterval: 1.4, rotation: 1, coinLife: 4, positiveLife: 4, negativeLife: 4 },
  Medium: { volley: 3, interval: 4, rampPerMinute: 1.25, minInterval: 1, rotation: 1.5, coinLife: 3, positiveLife: 3, negativeLife: 5 },
  Hard: { volley: 5, interval: 3, rampPerMinute: 1.5, minInterval: 0.65, rotation: 2, coinLife: 2, positiveLife: 2, negativeLife: 6 },
} as const;
export const SCORE = { perSecond: 10, coin: 50, positive: 20, negative: -20 };
export const TUNING = {
  fixedStep: 1 / 120, shipSpeed: 340, shipArtScale: 0.84, shipShoreRadius: 110,
  shipHullRadius: 48, shipHullHalfLength: 23, ballRadius: 13, ballSpeed: 310,
  cannonRotation: 0.62, firstShot: 1, volleyGap: 1.5, shotJitter: 0.07,
  coinEvery: 1.5, positiveEvery: 5.5, negativeEvery: 7,
  pickupRadius: 26, pickupClearance: 38,
  island: { x: 960, y: 540, radius: 105 }, muzzleDistance: 140,
};
export type EffectId = 'small' | 'double' | 'clear' | 'fast' | 'large' | 'ballsFast' | 'noCoins' | 'slow';
export const effectsConfig: Record<EffectId, { positive: boolean; seconds: number; label: string; icon: string; message: string }> = {
  small: { positive: true, seconds: 10, label: 'Small ship', icon: '½', message: 'Blimey!' },
  double: { positive: true, seconds: 10, label: 'Double score', icon: '2×', message: 'Booty!' },
  clear: { positive: true, seconds: 0, label: 'Clear cannonballs', icon: '⚑', message: 'Parley!' },
  fast: { positive: true, seconds: 10, label: 'Fast ship', icon: '↑↑', message: 'Yo-ho-ho!' },
  large: { positive: false, seconds: 10, label: 'Large ship', icon: 'XL', message: 'Landlubber!' },
  ballsFast: { positive: false, seconds: 10, label: 'Fast cannonballs', icon: '●↑', message: 'Shiver Me Timbers!' },
  noCoins: { positive: false, seconds: 10, label: 'Disable coins', icon: '⊘◉', message: 'Plundered!' },
  slow: { positive: false, seconds: 10, label: 'Slow ship', icon: '↓', message: 'Weigh Anchor!' },
};
export const EFFECT_VALUES = { small: 0.5, large: 2, fast: 1.5, slow: 0.5, ballsFast: 1.25, double: 2 };
export const POSITIVES: EffectId[] = ['small', 'double', 'clear', 'fast'];
export const NEGATIVES: EffectId[] = ['large', 'ballsFast', 'noCoins', 'slow'];
export function fireInterval(mode: Difficulty, elapsed: number) {
  const d = difficultyConfig[mode];
  return Math.max(d.minInterval, d.interval - d.rampPerMinute * elapsed / 60);
}
