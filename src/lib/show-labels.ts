/**
 * Short sidebar labels for the slates of one weekend.
 *
 * Slates in a weekend are conventionally named by repeating the event
 * and varying a suffix ("EPRHA Fire Cracker Classic I" / "... Classic 2").
 * In a w-64 sidebar the shared prefix is pure noise — it pushes the only
 * part that differs onto a second line, or off the end entirely.
 *
 * So: drop the words every name shares, then add back the LAST shared
 * word so the label still reads as a phrase rather than a bare "I" / "2".
 *
 *   EPRHA Fire Cracker Classic I  ->  Classic I
 *   EPRHA Fire Cracker Classic 2  ->  Classic 2
 *
 * Returns the names untouched when shortening would be wrong or useless:
 * a weekend of one, names with nothing in common, or a name that is a
 * pure prefix of another (where the shorter would shorten to nothing).
 */
export function weekendShowLabels(names: string[]): string[] {
  if (names.length < 2) return names;

  const words = names.map((n) => n.trim().split(/\s+/));
  const shortest = Math.min(...words.map((w) => w.length));

  let shared = 0;
  while (
    shared < shortest &&
    words.every((w) => w[shared] === words[0][shared])
  ) {
    shared++;
  }

  // Nothing shared, or some name is entirely the shared prefix — in
  // either case there is no safe shortening.
  if (shared === 0) return names;
  if (words.some((w) => w.length <= shared)) return names;

  // shared - 1 keeps the last common word ("Classic") for context.
  return words.map((w) => w.slice(shared - 1).join(" "));
}
