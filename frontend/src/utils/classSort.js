/**
 * Natural school class sorting utility.
 * Orders classes in educational progression:
 * Playway -> Nursery -> LKG -> UKG -> 1st -> 2nd -> ... -> 12th, followed by section (A, B, C...).
 */

const PRE_PRIMARY_RANKS = {
  'PLAY': 1,
  'PLAYWAY': 1,
  'PLAY-WAY': 1,
  'PRE-NURSERY': 1,
  'PRE NURSERY': 1,
  'NURSERY': 2,
  'NURSURY': 2,
  'KG': 3,
  'LKG': 3,
  'L.K.G': 3,
  'L.K.G.': 3,
  'JR. KG': 3,
  'JR KG': 3,
  'UKG': 4,
  'U.K.G': 4,
  'U.K.G.': 4,
  'SR. KG': 4,
  'SR KG': 4,
  'PREP': 4,
};

export function getNaturalClassRank(cls) {
  const raw = ((typeof cls === 'string' ? cls : cls?.name) || '').trim().toUpperCase();
  const section = ((cls && typeof cls === 'object' ? cls?.section : '') || '').trim().toUpperCase();

  // 1. Check Pre-primary / Kindergarten
  for (const [key, rank] of Object.entries(PRE_PRIMARY_RANKS)) {
    if (raw.includes(key)) {
      return { group: 0, rank, section, raw };
    }
  }

  // 2. Check Numeric Classes (1 through 12)
  const match = raw.match(/\b\d+\b/) || raw.match(/\d+/);
  if (match) {
    return { group: 1, rank: parseInt(match[0], 10), section, raw };
  }

  // 3. Any other custom class name
  return { group: 2, rank: 999, section, raw };
}

export function sortClassesAscending(classList) {
  if (!Array.isArray(classList)) return [];

  return [...classList].sort((a, b) => {
    const rA = getNaturalClassRank(a);
    const rB = getNaturalClassRank(b);

    // First by group: Pre-primary (0) < Numeric (1) < Other (2)
    if (rA.group !== rB.group) return rA.group - rB.group;
    // Then by class rank: Playway (1) < Nursery (2) < LKG (3) < UKG (4) or 1 < 2 < 3 ... < 12
    if (rA.rank !== rB.rank) return rA.rank - rB.rank;
    // Then by section: A < B < C
    if (rA.section !== rB.section) return rA.section.localeCompare(rB.section);
    // Finally alphabetical fallback
    return rA.raw.localeCompare(rB.raw);
  });
}
