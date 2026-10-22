import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';
import { hashToken } from '../utils/crypto';

export interface AuthedRequest extends Request {
  deviceId?: string;
  syncSpaceId?: string;
}

/** 校验 Authorization: Bearer <token>，解析出 deviceId / syncSpaceId */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }

  const tokenHash = hashToken(match[1]);
  const [rows] = await pool.query(
    'SELECT id, sync_space_id FROM devices WHERE token_hash = ? LIMIT 1',
    [tokenHash]
  );
  const device = (rows as Array<{ id: string; sync_space_id: string }>)[0];
  if (!device) {
    res.status(401).json({ error: 'invalid token' });
    return;
  }

  req.deviceId = device.id;
  req.syncSpaceId = device.sync_space_id;

  pool.query('UPDATE devices SET last_seen_at = NOW(3) WHERE id = ?', [device.id]).catch(() => {});

  next();
}
