/**
 * Draw generation: deterministic seeded shuffle with best-effort rider
 * spacing. Pure functions — the same seed always produces the same draw
 * for the same entry list, so a re-draw is reproducible and auditable.
 */

export interface DrawCandidate {
  entryClassId: string;
  riderPersonId: string;
}

/** xmur3 string hash → 32-bit seed */
function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 PRNG */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates shuffle with the seeded PRNG, then a greedy repair pass so
 * the same rider isn't within `riderSpacing` runs of themselves when the
 * entry mix allows it (best effort — a rider with many horses in a small
 * class can't always be spaced).
 */
export function generateDrawOrder(
  candidates: DrawCandidate[],
  seed: string,
  riderSpacing = 1
): DrawCandidate[] {
  const rand = mulberry32(hashSeed(seed));
  const order = [...candidates];

  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  if (riderSpacing > 0) {
    for (let i = 1; i < order.length; i++) {
      const windowStart = Math.max(0, i - riderSpacing);
      const conflict = order
        .slice(windowStart, i)
        .some((c) => c.riderPersonId === order[i].riderPersonId);
      if (!conflict) continue;
      // find the next later candidate that doesn't conflict here
      for (let j = i + 1; j < order.length; j++) {
        const candidateConflicts = order
          .slice(windowStart, i)
          .some((c) => c.riderPersonId === order[j].riderPersonId);
        if (!candidateConflicts) {
          [order[i], order[j]] = [order[j], order[i]];
          break;
        }
      }
    }
  }

  return order;
}

/** Short human-readable random seed (e.g. "K7QX2M") for re-draw audit trails. */
export function randomSeed(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
