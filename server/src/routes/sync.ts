import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import {
  AIAnnotation,
  normalizeStoredAI,
  sanitizeIncomingAI,
} from '../utils/ai';

export const syncRouter = Router();

interface SyncSticker {
  id: string;
  content: string;
  color: string;
  tags: string[];
  isPinned: boolean;
  isVisible: boolean;
  opacity: number;
  reminder: string | null;
  reminderTriggered: boolean;
  windowState: unknown;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** 旧客户端不发送该字段；显式 null 表示清空 */
  ai?: AIAnnotation | null;
}

interface SyncRow {
  id: string;
  content: string;
  color: string;
  // mysql2 自动将 JSON 列解析为 JS 值，不是原始字符串
  tags: string[];
  is_pinned: number;
  is_visible: number;
  opacity: string;
  reminder: Date | null;
  reminder_triggered: number;
  window_state: unknown;
  ai: unknown;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

function rowToSticker(row: SyncRow): SyncSticker {
  return {
    id: row.id,
    content: row.content,
    color: row.color,
    tags: row.tags ?? [],
    isPinned: !!row.is_pinned,
    isVisible: !!row.is_visible,
    opacity: Number(row.opacity),
    reminder: row.reminder ? new Date(row.reminder).toISOString() : null,
    reminderTriggered: !!row.reminder_triggered,
    windowState: row.window_state ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    deletedAt: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
    ai: normalizeStoredAI(row.ai),
  };
}

/**
 * 双向增量同步：
 * 1. 客户端上传自 lastSyncedAt 以来的本地变更（含删除的 tombstone）
 * 2. 服务端按 updatedAt 做"最后写入优先"合并
 * 3. 返回自客户端 since 以来、服务端更新过的全部记录（供客户端合并）
 */
syncRouter.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { since, changes } = req.body as { since?: string; changes?: SyncSticker[] };
    const syncSpaceId = req.syncSpaceId!;
    const sinceDate = since ? new Date(since) : new Date(0);

    // 游标基于服务器时间，而记录时间来自各设备本地时钟；两者存在偏差时，
    // 严格用 updated_at > since 会永久漏掉"时间戳早于游标"的记录。
    // 这里多拉取 10 分钟做重叠窗口，客户端按 updatedAt 去重，重复数据无害。
    const OVERLAP_MS = 10 * 60 * 1000;
    const pullFrom = new Date(sinceDate.getTime() - OVERLAP_MS);

    const incoming = Array.isArray(changes) ? changes : [];

    for (const sticker of incoming) {
      const [rows] = await pool.query(
        'SELECT updated_at FROM stickers WHERE sync_space_id = ? AND id = ? LIMIT 1',
        [syncSpaceId, sticker.id]
      );
      const existing = (rows as Array<{ updated_at: Date }>)[0];

      if (existing && new Date(existing.updated_at).getTime() >= new Date(sticker.updatedAt).getTime()) {
        // 服务端版本更新或相同，跳过（最后写入优先）
        continue;
      }

      // 旧客户端不携带 ai 字段：保留库中已有值；显式传 null 才清空
      const hasAI = Object.prototype.hasOwnProperty.call(sticker, 'ai');
      const aiValue = hasAI ? sanitizeIncomingAI(sticker.ai) : null;
      const aiUpdate = hasAI ? 'ai=VALUES(ai)' : 'ai=ai';

      // upsert：主键为 (sync_space_id, id)，并发下也不会冲突
      await pool.query(
        `INSERT INTO stickers
           (sync_space_id, id, content, color, tags, is_pinned, is_visible, opacity,
            reminder, reminder_triggered, window_state, ai, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           content=VALUES(content), color=VALUES(color), tags=VALUES(tags),
           is_pinned=VALUES(is_pinned), is_visible=VALUES(is_visible), opacity=VALUES(opacity),
           reminder=VALUES(reminder), reminder_triggered=VALUES(reminder_triggered),
           window_state=VALUES(window_state), ${aiUpdate}, created_at=VALUES(created_at),
           updated_at=VALUES(updated_at), deleted_at=VALUES(deleted_at)`,
        [
          syncSpaceId,
          sticker.id,
          sticker.content,
          sticker.color,
          JSON.stringify(sticker.tags ?? []),
          sticker.isPinned ? 1 : 0,
          sticker.isVisible ? 1 : 0,
          sticker.opacity,
          sticker.reminder ? new Date(sticker.reminder) : null,
          sticker.reminderTriggered ? 1 : 0,
          sticker.windowState ? JSON.stringify(sticker.windowState) : null,
          aiValue ? JSON.stringify(aiValue) : null,
          new Date(sticker.createdAt),
          new Date(sticker.updatedAt),
          sticker.deletedAt ? new Date(sticker.deletedAt) : null,
        ]
      );
    }

    const [rows] = await pool.query(
      'SELECT * FROM stickers WHERE sync_space_id = ? AND updated_at > ? ORDER BY updated_at ASC',
      [syncSpaceId, pullFrom]
    );
    const serverChanges = (rows as SyncRow[]).map(rowToSticker);

    res.json({
      serverTime: new Date().toISOString(),
      changes: serverChanges,
    });
  })
);
