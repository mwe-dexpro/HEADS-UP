/* Two helpers with no home of their own. */

export const uid = () => Math.random().toString(36).slice(2, 9);

/* Keeps the first of each key, in order. */
export function dedupeBy(list, key) {
  const seen = new Set();
  return list.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
