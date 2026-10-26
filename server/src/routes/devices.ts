import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { generateToken, hashToken } from '../utils/crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { rateLimit, ipKey } from '../middleware/rateLimit';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const devicesRouter = Router();

/** 限制注册频率，防止被刷出大量同步空间 */
const registerLimiter = rateLimit({ windowMs: 60_000, max: 10, key: ipKey });

/** 首次启动注册：创建新的 sync_space + 第一台设备，返回明文 token（仅此一次） */
devicesRouter.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const { deviceName, platform } = req.body as { deviceName?: string; platform?: string };
    if (!deviceName || !platform) {
      res.status(400).json({ error: 'deviceName and platform are required' });
      return;
    }

    const syncSpaceId = uuidv4();
    const deviceId = uuidv4();
    const token = generateToken();
    const tokenHash = hashToken(token);

    await pool.query('INSERT INTO sync_spaces (id) VALUES (?)', [syncSpaceId]);
    await pool.query(
      'INSERT INTO devices (id, sync_space_id, token_hash, device_name, platform) VALUES (?, ?, ?, ?, ?)',
      [deviceId, syncSpaceId, tokenHash, deviceName, platform]
    );

    res.json({ deviceId, syncSpaceId, token });
  })
);

/** 查看当前 sync_space 下的所有已配对设备 */
devicesRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const [rows] = await pool.query(
      'SELECT id, device_name, platform, created_at, last_seen_at FROM devices WHERE sync_space_id = ? ORDER BY created_at ASC',
      [req.syncSpaceId]
    );
    res.json({ devices: rows });
  })
);

/** 解绑设备（使其 token 失效） */
devicesRouter.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM devices WHERE id = ? AND sync_space_id = ?',
      [id, req.syncSpaceId]
    );
    const affected = (result as { affectedRows: number }).affectedRows;
    if (affected === 0) {
      res.status(404).json({ error: 'device not found' });
      return;
    }
    res.json({ ok: true });
  })
);
