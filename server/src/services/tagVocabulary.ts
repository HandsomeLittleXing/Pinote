import { pool } from '../db/pool';

/** 高频既有标签仅用于提示模型，绝不修改原便签标签。 */
export async function getTagVocabulary(spaceId: string): Promise<string[]> {
  const [rows] = await pool.query(
    'SELECT tags FROM stickers WHERE sync_space_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1000',
    [spaceId]
  );
  const counts = new Map<string, number>();
  for (const row of rows as Array<{ tags: unknown }>) {
    let tags = row.tags;
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch { continue; }
    }
    if (!Array.isArray(tags)) continue;
    for (const item of new Set(tags)) {
      if (typeof item === 'string' && item.length <= 16) counts.set(item, (counts.get(item) || 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag]) => tag);
}
