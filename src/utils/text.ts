export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  let prev = new Array<number>(bl + 1);
  let cur = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j += 1) prev[j] = j;
  for (let i = 1; i <= al; i += 1) {
    cur[0] = i;
    for (let j = 1; j <= bl; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[bl];
}

export function fuzzyMatch(word: string, variant: string): boolean {
  const a = normalizeWord(word);
  const b = normalizeWord(variant);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.startsWith(b) && b.length >= 4) return true;
  const maxDist = a.length <= 4 || b.length <= 4 ? 1 : 2;
  return levenshtein(a, b) <= maxDist;
}

export function fuzzyIncludes(text: string, variant: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  const v = normalizeWord(variant);
  if (!v) return false;
  if (text.includes(variant)) return true;
  return words.some((w) => fuzzyMatch(w, variant));
}

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
