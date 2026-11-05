-- StickerNote 云同步数据库结构
-- 独立数据库：sticker_note_sync（不复用 stock_analysis）

CREATE DATABASE IF NOT EXISTS `sticker_note_sync`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `sticker_note_sync`;

-- 同步空间：相当于一个无账号体系的"轻量用户"，由桌面端首次启动时创建
CREATE TABLE IF NOT EXISTS `sync_spaces` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 每个同步空间一份加密 AI 凭据；移除时清空密文并逻辑删除。
CREATE TABLE IF NOT EXISTS `ai_credentials` (
  `sync_space_id` CHAR(36) NOT NULL COMMENT '所属同步空间，唯一配置一份 AI 凭据',
  `encrypted_key` VARBINARY(1024) NULL COMMENT 'AES-256-GCM 加密的 API Key；移除时清空',
  `iv` BINARY(12) NULL COMMENT 'GCM 随机初始化向量；移除时清空',
  `auth_tag` BINARY(16) NULL COMMENT 'GCM 认证标签；移除时清空',
  `key_hint` CHAR(4) NULL COMMENT '仅用于界面遮罩显示的末尾四位；移除时清空',
  `is_deleted` TINYINT(1) UNSIGNED DEFAULT 0 NOT NULL COMMENT '是否删除 0-否 1-是',
  `create_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `update_time` DATETIME(3) NULL COMMENT '最近一次更新或移除时间',
  PRIMARY KEY (`sync_space_id`),
  CONSTRAINT `fk_ai_credentials_sync_space` FOREIGN KEY (`sync_space_id`)
    REFERENCES `sync_spaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 已配对设备：token 只存哈希，不存明文
CREATE TABLE IF NOT EXISTS `devices` (
  `id` CHAR(36) NOT NULL PRIMARY KEY,
  `sync_space_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `device_name` VARCHAR(100) NOT NULL,
  `platform` VARCHAR(20) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY `uq_devices_token_hash` (`token_hash`),
  KEY `idx_devices_sync_space` (`sync_space_id`),
  CONSTRAINT `fk_devices_sync_space` FOREIGN KEY (`sync_space_id`)
    REFERENCES `sync_spaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 配对码：短期有效，单次兑换
CREATE TABLE IF NOT EXISTS `pairing_codes` (
  `code` CHAR(6) NOT NULL PRIMARY KEY,
  `sync_space_id` CHAR(36) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `redeemed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY `idx_pairing_sync_space` (`sync_space_id`),
  CONSTRAINT `fk_pairing_sync_space` FOREIGN KEY (`sync_space_id`)
    REFERENCES `sync_spaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 便签数据：服务端权威副本，按 sync_space 隔离，软删除
-- 主键为 (sync_space_id, id)：同一张本地便签可能被同步到不同空间（如重新配对），
-- 仅用 id 做主键会导致跨空间主键冲突。
CREATE TABLE IF NOT EXISTS `stickers` (
  `id` CHAR(36) NOT NULL,
  `sync_space_id` CHAR(36) NOT NULL,
  `content` MEDIUMTEXT NOT NULL,
  `color` VARCHAR(10) NOT NULL,
  `tags` JSON NOT NULL,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_visible` TINYINT(1) NOT NULL DEFAULT 1,
  `opacity` DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  `reminder` DATETIME(3) NULL,
  `reminder_triggered` TINYINT(1) NOT NULL DEFAULT 0,
  `window_state` JSON NULL,
  -- AI 整理结果（摘要/标签/语义标注/提醒建议）；与正文分开存储，旧客户端缺省为 NULL
  `ai` JSON NULL,
  `created_at` DATETIME(3) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) NULL,
  PRIMARY KEY (`sync_space_id`, `id`),
  KEY `idx_stickers_updated_at` (`sync_space_id`, `updated_at`),
  CONSTRAINT `fk_stickers_sync_space` FOREIGN KEY (`sync_space_id`)
    REFERENCES `sync_spaces` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
