/** Cheap normalized comparison + Levenshtein for fuzzy country name match. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Edit distance where swapping two adjacent letters ("Zambai") costs one edit. */
export function levenshtein(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }
  return d[a.length]![b.length]!;
}

/** `others` are names of other entities of the same kind: matching one exactly is a wrong answer, never a typo. */
export function fuzzyMatch(
  guess: string,
  target: string,
  alts: string[] = [],
  others: string[] = [],
): boolean {
  const g = normalize(guess);
  if (!g) return false;
  const candidates = [target, ...alts].map(normalize).filter(Boolean);
  if (candidates.includes(g)) return true;
  if (others.some((o) => normalize(o) === g)) return false;
  for (const c of candidates) {
    const tol = Math.max(1, Math.floor(c.length / 8));
    if (levenshtein(g, c) <= tol) return true;
  }
  return false;
}

/** True while the guess is a strict prefix of another name ("Niger" of "Nigeria"): do not auto-submit. */
export function isPrefixOfOther(guess: string, others: string[]): boolean {
  const g = normalize(guess);
  return !!g && others.some((o) => {
    const n = normalize(o);
    return n.length > g.length && n.startsWith(g);
  });
}

/** Strict normalized equality — used for instant typing validation. */
export function exactMatch(guess: string, target: string, alts: string[] = []): boolean {
  const g = normalize(guess);
  if (!g) return false;
  const candidates = [target, ...alts].map(normalize).filter(Boolean);
  return candidates.includes(g);
}
