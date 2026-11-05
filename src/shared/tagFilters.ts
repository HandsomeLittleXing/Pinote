/** 高频标签优先；相同频次按名称排序，筛选只改变展示顺序。 */
export function rankTags(stickers: Array<{ tags: string[] }>): string[] {
  const counts = new Map<string, number>();
  for (const sticker of stickers) {
    for (const tag of new Set(sticker.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
}
