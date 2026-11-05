import { pool } from './pool';

/**
 * 幂等迁移：
 * 1. stickers 主键从 (id) 改为 (sync_space_id, id)
 * 2. 增加 ai JSON 列（AI 整理结果）
 *
 * 可重复执行；已完成的步骤会跳过。
 */
async function migratePrimaryKey(): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stickers'
        AND CONSTRAINT_NAME = 'PRIMARY'
      ORDER BY ORDINAL_POSITION`
  );
  const pkColumns = (rows as Array<{ COLUMN_NAME: string }>).map((r) => r.COLUMN_NAME);
  console.log('当前 stickers 主键:', pkColumns.join(', ') || '(无)');

  if (pkColumns.length === 2 && pkColumns[0] === 'sync_space_id' && pkColumns[1] === 'id') {
    console.log('主键已是 (sync_space_id, id)，跳过。');
    return;
  }

  await pool.query('ALTER TABLE stickers DROP PRIMARY KEY, ADD PRIMARY KEY (sync_space_id, id)');
  console.log('迁移完成：stickers 主键 -> (sync_space_id, id)');
}

async function migrateAiColumn(): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'stickers'
        AND COLUMN_NAME = 'ai'`
  );
  if ((rows as Array<{ COLUMN_NAME: string }>).length > 0) {
    console.log('stickers.ai 已存在，跳过。');
    return;
  }

  await pool.query('ALTER TABLE stickers ADD COLUMN ai JSON NULL AFTER window_state');
  console.log('迁移完成：stickers 增加 ai JSON 列');
}

async function migrateAiCredentials(): Promise<void> {
  await pool.query(`CREATE TABLE IF NOT EXISTS ai_credentials (
    sync_space_id CHAR(36) NOT NULL COMMENT '所属同步空间，唯一配置一份 AI 凭据',
    encrypted_key VARBINARY(1024) NULL COMMENT 'AES-256-GCM 加密的 API Key；移除时清空',
    iv BINARY(12) NULL COMMENT 'GCM 随机初始化向量；移除时清空',
    auth_tag BINARY(16) NULL COMMENT 'GCM 认证标签；移除时清空',
    key_hint CHAR(4) NULL COMMENT '仅用于界面遮罩显示的末尾四位；移除时清空',
    is_deleted TINYINT(1) UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否删除 0-否 1-是',
    create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
    update_time DATETIME(3) NULL COMMENT '最近一次更新或移除时间',
    PRIMARY KEY (sync_space_id),
    CONSTRAINT fk_ai_credentials_sync_space FOREIGN KEY (sync_space_id)
      REFERENCES sync_spaces (id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('ai_credentials 表已就绪。');
}

async function main(): Promise<void> {
  await migratePrimaryKey();
  await migrateAiColumn();
  await migrateAiCredentials();
  await pool.end();
}

main().catch((err) => {
  console.error('迁移失败:', err);
  process.exit(1);
});
