import { pool } from './pool';

/**
 * 迁移：stickers 主键从 (id) 改为 (sync_space_id, id)。
 * 同一张便签可能被同步到不同同步空间（例如重新配对后），仅用 id 做主键会冲突。
 * 幂等：已迁移则跳过。
 */
async function main(): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stickers'
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION`
  );
  const pkColumns = (rows as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME);
  console.log('当前 stickers 主键:', pkColumns.join(', '));

  if (pkColumns.length === 2 && pkColumns[0] === 'sync_space_id' && pkColumns[1] === 'id') {
    console.log('已是组合主键，无需迁移。');
    await pool.end();
    return;
  }

  await pool.query('ALTER TABLE stickers DROP PRIMARY KEY, ADD PRIMARY KEY (sync_space_id, id)');
  console.log('迁移完成：stickers 主键 -> (sync_space_id, id)');
  await pool.end();
}

main().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
