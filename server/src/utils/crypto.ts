import crypto from 'crypto';

/** 生成设备 token（明文只在创建时返回一次，之后仅存哈希） */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** token 哈希，用于数据库存储和比对 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** 生成 6 位数字配对码 */
export function generatePairingCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}
