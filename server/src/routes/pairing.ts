import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import { generatePairingCode, generateToken, hashToken } from '../utils/crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { rateLimit, ipKey } from '../middleware/rateLimit';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const pairingRouter = Router();

const TTL_SECONDS = Number(process.env.PAIRING_CODE_TTL_SECONDS ?? 300);

/** 防止暴力枚举配对码：每 IP 每分钟最多 5 次兑换尝试，成功后重置 */
const redeemLimiter = rateLimit({ windowMs: 60_000, max: 5, key: ipKey });

/** 已登录设备（通常是桌面端）生成配对码，供新设备兑换加入同一 sync_space */
pairingRouter.post(
  '/create',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    // 清理过期的配对码，避免 code 主键冲突堆积
    await pool.query('DELETE FROM pairing_codes WHERE expires_at < NOW(3)');

    let code = generatePairingCode();
    // 极小概率冲突时重试
    for (let attempt = 0; attempt < 5; attempt++) {
      const [existing] = await pool.query('SELECT code FROM pairing_codes WHERE code = ?', [code]);
      if ((existing as unknown[]).length === 0) break;
      code = generatePairingCode();
    }

    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
    await pool.query(
      'INSERT INTO pairing_codes (code, sync_space_id, expires_at) VALUES (?, ?, ?)',
      [code, req.syncSpaceId, expiresAt]
    );

    res.json({ code, expiresAt: expiresAt.toISOString(), ttlSeconds: TTL_SECONDS });
  })
);

/** 新设备（通常是手机）用配对码兑换 token，加入同一 sync_space */
pairingRouter.post(
  '/redeem',
  redeemLimiter,
  asyncHandler(async (req, res) => {
    const { code, deviceName, platform } = req.body as {
      code?: string;
      deviceName?: string;
      platform?: string;
    };
    if (!code || !deviceName || !platform) {
      res.status(400).json({ error: 'code, deviceName and platform are required' });
      return;
    }

    const [rows] = await pool.query(
      'SELECT code, sync_space_id, expires_at, redeemed_at FROM pairing_codes WHERE code = ? LIMIT 1',
      [code]
    );
    const record = (rows as Array<{
      code: string;
      sync_space_id: string;
      expires_at: Date;
      redeemed_at: Date | null;
    }>)[0];

    if (!record) {
      res.status(404).json({ error: 'invalid pairing code' });
      return;
    }
    if (record.redeemed_at) {
      res.status(410).json({ error: 'pairing code already used' });
      return;
    }
    if (new Date(record.expires_at).getTime() < Date.now()) {
      res.status(410).json({ error: 'pairing code expired' });
      return;
    }

    const deviceId = uuidv4();
    const token = generateToken();
    const tokenHash = hashToken(token);

    await pool.query(
      'INSERT INTO devices (id, sync_space_id, token_hash, device_name, platform) VALUES (?, ?, ?, ?, ?)',
      [deviceId, record.sync_space_id, tokenHash, deviceName, platform]
    );
    await pool.query('UPDATE pairing_codes SET redeemed_at = NOW(3) WHERE code = ?', [code]);

    // 兑换成功后清空该 IP 的计数，不影响正常连续配对
    redeemLimiter.reset(req);

    res.json({ deviceId, syncSpaceId: record.sync_space_id, token });
  })
);
