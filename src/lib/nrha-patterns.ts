/** Official NRHA reining patterns (2024 NRHA Handbook, Patterns 1-18 plus
 * A/B for Youth 10 & Under Short Stirrup and Para-Reining). This is fixed
 * association reference material — not an org-configurable rule — so it's
 * plain data here rather than a database table. A class's actual pattern
 * text can still be freely edited/overridden in class_patterns.pattern_text
 * (e.g. for NRHA Green/Ride & Slide/modified patterns). */

export interface NrhaPattern {
  key: string;
  label: string;
  restriction?: string;
  maneuvers: string[];
}

export const NRHA_PATTERNS: NrhaPattern[] = [
  {
    key: "1",
    label: "Pattern 1",
    maneuvers: [
      "Run at speed to the far end of the arena past the end marker and do a left rollback—no hesitation.",
      "Run to the opposite end of the arena past the end marker and do a right rollback—no hesitation.",
      "Run past the center marker and do a sliding stop. Back up to center of the arena or at least ten feet (three meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four and one-quarter spins to the left so that horse is facing left wall or fence. Hesitate.",
      "Beginning on the left lead, complete three circles to the left: the first circle large and fast; the second circle small and slow; the third circle large and fast. Change leads at the center of the arena.",
      "Complete three circles to the right: the first circle large and fast; the second circle small and slow; the third circle large and fast. Change leads at the center of the arena.",
      "Begin a large circle to the left but do not close this circle. Run straight up the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from wall or fence. Hesitate to demonstrate the completion of the pattern.",
    ],
  },
  {
    key: "2",
    label: "Pattern 2",
    maneuvers: [
      "Beginning on the right lead, complete three circles to the right: the first circle small and slow; the next two circles large and fast. Change leads at the center of the arena.",
      "Complete three circles to the left: the first circle small and slow; the next two circles large and fast. Change leads at the center of the arena.",
      "Continue around previous circle to the right. At the top of the circle, run down the middle to the far end of the arena past the end marker and do a right rollback—no hesitation.",
      "Run up the middle to the opposite end of the arena past the end marker and do a left rollback—no hesitation.",
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least ten feet (three meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four spins to the left. Hesitate to demonstrate the completion of the pattern.",
    ],
  },
  {
    key: "3",
    label: "Pattern 3",
    maneuvers: [
      "Beginning, lope straight up the left side of the arena, circle the top end of the arena, and staying at least twenty feet (six meters) from the walls or fence, run straight down the opposite or right side of the arena past the center marker and do a left rollback—no hesitation.",
      "Continue straight up the right side of the arena circle back around the top of the arena, and staying at least twenty feet (six meters) from the walls or fence, run straight down the left side of the arena past the center marker and do a right rollback—no hesitation.",
      "Continue up the left side of the arena to the center marker. At the center marker, the horse should be on the right lead. Guide the horse to the center of the arena on the right lead and complete three circles to the right: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the left: the first two circles large and fast; the third circle small and slow. Change leads in the center of the arena.",
      "Begin a large circle to the right but do not close this circle. Continue up the left side of the arena, circle the top of the arena, and staying at least twenty feet (six meters) from the walls or fence, run straight down the opposite or right side of the arena past the center marker and do a sliding stop. Back up at least ten feet (three meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four spins to the left. Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "4",
    label: "Pattern 4",
    maneuvers: [
      "Beginning on the right lead, complete three circles to the right: the first two large and fast; the third circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the left lead, complete three circles to the left: the first two circles large and fast; the third circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the right lead, run a large fast circle to the right, change leads at the center of the arena, run a large fast circle to the left, and change leads at the center of the arena. (Figure 8)",
      "Continue around previous circle to the right. At the top of the circle, run down the middle to the far end of the arena past the end marker and do a right rollback—no hesitation.",
      "Run up the middle to the opposite end of the arena past the end marker and do a left rollback—no hesitation.",
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least ten feet (three meters). Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "5",
    label: "Pattern 5",
    maneuvers: [
      "Beginning on the left lead, complete three circles to the left: the first two circles large and fast; the third circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first two circles large and fast; the third circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the left lead, run a large fast circle to the left, change leads at the center of the arena, run a large fast circle to the right, and change leads at the center of the arena. (Figure 8)",
      "Continue around previous circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Back up at least ten feet (three meters). Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "6",
    label: "Pattern 6",
    maneuvers: [
      "Complete four spins to the right. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the left lead, complete three circles to the left: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the right: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Begin a large circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Back up at least ten feet (three meters). Hesitate to demonstrate the completion of the pattern.",
    ],
  },
  {
    key: "7",
    label: "Pattern 7",
    maneuvers: [
      "Run at speed to the far end of the arena past the end marker and do a left rollback—no hesitation.",
      "Run to the opposite end of the arena past the end marker and do a right rollback—no hesitation.",
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least ten feet (three meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four and one-quarter spins to the left so that horse is facing left wall or fence. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first two circles large fast; the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the left: the first two circles large fast; the third circle small and slow. Change leads at the center of the arena.",
      "Begin a large circle to the right but do not close this circle. Run straight down the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "8",
    label: "Pattern 8",
    maneuvers: [
      "Complete four spins to the left. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first circle large and fast; the second circle small and slow; the third circle large and fast. Change leads at the center of the arena.",
      "Complete three circles to the left: the first circle large and fast; the second circle small and slow; the third circle large and fast. Change leads at the center of the arena.",
      "Begin a large circle to the right but do not close this circle. Run straight down the right side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around the previous circle but do not close this circle. Run down the left side of the arena past the center maker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around the previous circle but do not close this circle. Run down the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Back up at least ten feet (three meters). Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "9",
    label: "Pattern 9",
    maneuvers: [
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least ten feet (three meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four and one-quarter spins to the left so that horse is facing the left wall or fence. Hesitate.",
      "Beginning on the left lead, complete three circles to the left: the first circle small and slow; the next two circles large and fast. Change leads at the center of the arena.",
      "Complete three circles to the right: the first circle small and slow; the next two circles large and fast. Change leads at the center of the arena.",
      "Begin a large circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around the previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "10",
    label: "Pattern 10",
    maneuvers: [
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least ten feet (three meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four and one-quarter spins to the left so that the horse is facing the left wall or fence. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first two circles large and fast, the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the left: the first circle small and slow, the next two circles large and fast. Change leads at the center of the arena.",
      "Begin a large circle to the right but do not close this circle. Run down the right side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around the previous circle but do not close this circle. Run down the left side of the arena past the center and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run down the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "11",
    label: "Pattern 11",
    maneuvers: [
      "Complete four spins to the left. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the right lead complete three circles to the right; the first circle small and slow; the next two circles large and fast. Change leads at the center of the arena.",
      "Complete three circles to the left; the first circle small and slow; the next two circles large and fast. Change leads at the center of the arena.",
      "Begin a large circle to the right, but do not close this circle. Run down the center of the arena past the end marker and do a right rollback—no hesitation.",
      "Run up the middle to the opposite end of the arena past the end marker and do a left rollback—no hesitation.",
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least ten feet (three meters). Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "12",
    label: "Pattern 12",
    maneuvers: [
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least 10 feet (3 meters). Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Complete four and one-quarter spins to the left so that the horse is facing the left wall or fence. Hesitate.",
      "Beginning on the left lead, complete three circles to the left: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the right: the first two circles large and fast; the third circle small and slow. Change leads at the center for the arena.",
      "Begin a large circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue back around previous circle but to not close this circle. Run up the left side of the arena and past the center marker and do a left rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least 20 feet (6 meters) from the wall or fence. Hesitate to demonstrate completion of pattern.",
    ],
  },
  {
    key: "13",
    label: "Pattern 13",
    maneuvers: [
      "Beginning on the left lead, complete two circles to the left: the first circle large and fast; the second circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the right lead, complete two circles to the right: the first being large and fast; the second circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the left lead, run a large fast circle to the left, change leads at the center of the arena, run a large fast circle to the right, and change leads at the center of the arena (figure 8).",
      "Continue around previous circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least 20 feet (6 meters) from the wall or fence. Back up at least 10 feet (3 meters). Hesitate to demonstrate completion of pattern.",
    ],
  },
  {
    key: "14",
    label: "Pattern 14",
    maneuvers: [
      "Complete four spins to the left. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the left: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Begin a large circle to the right but do not close this circle. Run up the right side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Back up at least ten feet (three meters). Hesitate to demonstrate the completion of the pattern.",
    ],
  },
  {
    key: "15",
    label: "Pattern 15",
    maneuvers: [
      "Complete four spins to the right. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the left lead, complete three circles to the left: the first circle large and fast; the second circle small and slow; the third circle large and fast. Change leads at the center of the arena.",
      "Complete three circles to the right: the first circle large and fast; the second circle small and slow; the third circle large and fast. Change leads at the center of the arena.",
      "Begin a large circle to the left but do not close this circle. Run straight down the right side of the arena past the center marker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around the previous circle but do not close this circle. Run down the left side of the arena past the center maker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around the previous circle but do not close this circle. Run down the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Back up at least ten feet (three meters). Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "16",
    label: "Pattern 16",
    maneuvers: [
      "Run past the center marker and do a sliding stop. Back up to the center of the arena or at least 10 feet (3 meters). Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Complete four and one-quarter spins to the right so that the horse is facing the right wall or fence. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first two circles large and fast; the third circle small and slow. Change leads at the center of the arena.",
      "Complete three circles to the left: the first two circles large and fast; the third circle small and slow. Change leads at the center for the arena.",
      "Begin a large circle to the right but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue back around previous circle but to not close this circle. Run up the right side of the arena and past the center marker and do a right rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a sliding stop at least 20 feet (6 meters) from the wall or fence. Hesitate to demonstrate completion of pattern.",
    ],
  },
  {
    key: "17",
    label: "Pattern 17",
    maneuvers: [
      "Continue on the left lead, complete two circles to the left: the first circle large and fast; the second circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the right lead, complete two circles to the right: the first being large and fast; the second circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the left lead, run a large fast circle to the left, change leads at the center of the arena, run a large fast circle to the right, and change leads at the center of the arena (figure 8).",
      "Continue around previous circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least 20 feet (6 meters) from the wall or fence-no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least 20 feet (6 meters) from the wall or fence. Back up at least 10 feet (3 meters). Hesitate to demonstrate completion of pattern.",
    ],
  },
  {
    key: "18",
    label: "Pattern 18",
    maneuvers: [
      "Continue on the left lead, complete three circles to the left: the first two circles large and fast; the third circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the left. Hesitate.",
      "Beginning on the right lead, complete three circles to the right: the first two circles large and fast; the third circle small and slow. Stop at the center of the arena. Hesitate.",
      "Complete four spins to the right. Hesitate.",
      "Beginning on the left lead, run a large fast circle to the left, change leads at the center of the arena, run a large fast circle to the right, and change leads at the center of the arena. (Figure 8)",
      "Continue around previous circle to the left but do not close this circle. Run up the right side of the arena past the center marker and do a right rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue around previous circle but do not close this circle. Run up the left side of the arena past the center marker and do a left rollback at least twenty feet (six meters) from the wall or fence—no hesitation.",
      "Continue back around previous circle but do not close this circle. Run up the right side of the arena past the center marker and do a sliding stop at least twenty feet (six meters) from the wall or fence. Back up at least ten feet (three meters). Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "A",
    label: "Pattern A",
    restriction: "Youth 10 & Under Short Stirrup and Para-Reining only",
    maneuvers: [
      "Beginning on the left lead, complete two circles to the left. Stop at the center of the arena. Hesitate.",
      "Complete two spins to the left. Hesitate.",
      "Beginning on the right lead complete two circles to the right. Stop at the center of the arena. Hesitate.",
      "Complete two spins to the right. Hesitate.",
      "Beginning on the left lead, go around the end of the arena, run down the right side of the arena past center marker, stop and roll back right.",
      "Continue around the end of the arena to run down the left side of the arena past the center marker. Stop. Back up. Hesitate to demonstrate completion of the pattern.",
    ],
  },
  {
    key: "B",
    label: "Pattern B",
    restriction: "Youth 10 & Under Short Stirrup and Para-Reining only",
    maneuvers: [
      "Beginning, lope straight up the right side of the arena, circle the top of the arena run straight down the opposite or left side of the arena past the center mark and do a right rollback—no hesitation.",
      "Continue straight up the left side of the arena circle back around the top of the arena run straight down the right side of the arena past the center marker and do a left rollback—no hesitation.",
      "Continue up the right side of the arena to the center marker, at the center marker the horse should be on the left lead and complete two circles to the left, one large fast and one small slow. Stop at center. Hesitate.",
      "Complete three spins to the left. Hesitate.",
      "Complete two circles to the right, one large fast and one small slow. Stop at center. Hesitate.",
      "Complete three spins to the right. Hesitate.",
      "Begin a large circle to the left, do not close the circle. Continue up the center of the arena past the center marker and do a sliding stop. Back up at least ten feet. Hesitate to demonstrate completion of the pattern.",
    ],
  },
];

export const NRHA_PATTERN_OPTIONS = NRHA_PATTERNS.map((p) => ({
  value: p.key,
  label: p.restriction ? `${p.label} (${p.restriction})` : p.label,
}));

export function getNrhaPattern(key: string | null | undefined): NrhaPattern | null {
  if (!key) return null;
  return NRHA_PATTERNS.find((p) => p.key === key) ?? null;
}

/** Numbered pattern text matching the freeform convention already used
 * in class_patterns.pattern_text (e.g. "1. Run to the center… 2. …"). */
export function renderPatternText(key: string): string {
  const pattern = getNrhaPattern(key);
  if (!pattern) return "";
  return pattern.maneuvers.map((m, i) => `${i + 1}. ${m}`).join("\n");
}
