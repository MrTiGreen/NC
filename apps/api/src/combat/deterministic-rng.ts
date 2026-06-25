export type RandomSource = () => number;

/** Mulberry32 is small, deterministic and sufficient for reproducible combat rolls. */
export function createSeededRandom(seed: string | number): RandomSource {
  let state = hashSeed(String(seed));
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomBetween(random: RandomSource, minimum: number, maximum: number) {
  return minimum + random() * (maximum - minimum);
}
