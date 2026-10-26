import * as SQLite from 'expo-sqlite';
import type { Sticker } from '@shared/types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('stickernote.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS stickers (
          id TEXT PRIMARY KEY NOT NULL,
          content TEXT NOT NULL,
          color TEXT NOT NULL,
          tags TEXT NOT NULL,
          isPinned INTEGER NOT NULL,
          isVisible INTEGER NOT NULL,
          opacity REAL NOT NULL,
          reminder TEXT,
          reminderTriggered INTEGER NOT NULL,
          windowState TEXT,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          deletedAt TEXT
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

interface StickerRow {
  id: string;
  content: string;
  color: string;
  tags: string;
  isPinned: number;
  isVisible: number;
  opacity: number;
  reminder: string | null;
  reminderTriggered: number;
  windowState: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function rowToSticker(row: StickerRow): Sticker {
  return {
    id: row.id,
    content: row.content,
    color: row.color as Sticker['color'],
    tags: JSON.parse(row.tags),
    isPinned: !!row.isPinned,
    isVisible: !!row.isVisible,
    opacity: row.opacity,
    reminder: row.reminder,
    reminderTriggered: !!row.reminderTriggered,
    windowState: row.windowState ? JSON.parse(row.windowState) : { x: 0, y: 0, width: 240, height: 200 },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

/** 获取所有未删除的便签，按更新时间倒序 */
export async function getActiveStickers(): Promise<Sticker[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StickerRow>(
    'SELECT * FROM stickers WHERE deletedAt IS NULL ORDER BY updatedAt DESC'
  );
  return rows.map(rowToSticker);
}

/** 获取全部便签（含已删除 tombstone），供同步使用 */
export async function getAllStickersRaw(): Promise<Sticker[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StickerRow>('SELECT * FROM stickers');
  return rows.map(rowToSticker);
}

export async function getStickerById(id: string): Promise<Sticker | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<StickerRow>('SELECT * FROM stickers WHERE id = ?', [id]);
  return row ? rowToSticker(row) : null;
}

/** 新建或整条覆盖写入一个便签（用于本地编辑保存，以及接收远程同步数据） */
export async function upsertSticker(sticker: Sticker): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO stickers
       (id, content, color, tags, isPinned, isVisible, opacity, reminder, reminderTriggered, windowState, createdAt, updatedAt, deletedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content=excluded.content, color=excluded.color, tags=excluded.tags,
       isPinned=excluded.isPinned, isVisible=excluded.isVisible, opacity=excluded.opacity,
       reminder=excluded.reminder, reminderTriggered=excluded.reminderTriggered,
       windowState=excluded.windowState, updatedAt=excluded.updatedAt, deletedAt=excluded.deletedAt`,
    [
      sticker.id,
      sticker.content,
      sticker.color,
      JSON.stringify(sticker.tags),
      sticker.isPinned ? 1 : 0,
      sticker.isVisible ? 1 : 0,
      sticker.opacity,
      sticker.reminder,
      sticker.reminderTriggered ? 1 : 0,
      JSON.stringify(sticker.windowState),
      sticker.createdAt,
      sticker.updatedAt,
      sticker.deletedAt,
    ]
  );
}

/** 软删除：写入 tombstone，供同步到其他设备 */
export async function softDeleteSticker(id: string): Promise<void> {
  const existing = await getStickerById(id);
  if (!existing) return;
  await upsertSticker({ ...existing, deletedAt: new Date().toISOString(), isVisible: false, updatedAt: new Date().toISOString() });
}

/** 写入远程同步返回的数据，直接覆盖（调用方已做过"最后写入优先"判断） */
export async function applyRemoteSticker(remote: Sticker): Promise<void> {
  await upsertSticker(remote);
}
