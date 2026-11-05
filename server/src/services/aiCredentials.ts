import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { pool } from '../db/pool';

interface EncryptedKey {
  encryptedKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

function masterKey(): Buffer {
  const encoded = process.env.AI_CREDENTIALS_MASTER_KEY || '';
  const key = Buffer.from(encoded, 'base64');
  if (!/^[A-Za-z0-9+/]{43}=$/.test(encoded) || key.length !== 32) {
    throw new Error('AI 凭据主密钥未配置或格式错误');
  }
  return key;
}

export function encryptKey(apiKey: string, spaceId: string, master: Buffer): EncryptedKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', master, iv);
  cipher.setAAD(Buffer.from(spaceId));
  return { encryptedKey: Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]), iv, authTag: cipher.getAuthTag() };
}

export function decryptKey(value: EncryptedKey, spaceId: string, master: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', master, value.iv);
  decipher.setAAD(Buffer.from(spaceId));
  decipher.setAuthTag(value.authTag);
  return Buffer.concat([decipher.update(value.encryptedKey), decipher.final()]).toString('utf8');
}

export function resolveKeySource(hasSpaceKey: boolean, serverKey: string): 'space' | 'server' | 'none' {
  return hasSpaceKey ? 'space' : serverKey ? 'server' : 'none';
}

interface CredentialRow {
  encrypted_key: Buffer;
  iv: Buffer;
  auth_tag: Buffer;
  key_hint: string;
}

async function readRow(spaceId: string): Promise<CredentialRow | undefined> {
  const [rows] = await pool.query(
    'SELECT encrypted_key, iv, auth_tag, key_hint FROM ai_credentials WHERE sync_space_id = ? AND is_deleted = 0 LIMIT 1',
    [spaceId]
  );
  return (rows as CredentialRow[])[0];
}

export async function getCredentialStatus(spaceId: string): Promise<{ configured: boolean; source: 'space' | 'server' | 'none'; keyHint?: string }> {
  const row = await readRow(spaceId);
  if (row) decryptStoredKey(row, spaceId);
  const source = resolveKeySource(!!row, process.env.LLM_API_KEY || '');
  return { configured: source !== 'none' || process.env.AI_MOCK === '1', source, ...(row ? { keyHint: row.key_hint } : {}) };
}

export async function getEffectiveKey(spaceId: string): Promise<string> {
  const row = await readRow(spaceId);
  if (!row) return process.env.LLM_API_KEY || '';
  return decryptStoredKey(row, spaceId);
}

function decryptStoredKey(row: CredentialRow, spaceId: string): string {
  try {
    return decryptKey({ encryptedKey: row.encrypted_key, iv: row.iv, authTag: row.auth_tag }, spaceId, masterKey());
  } catch {
    throw new Error('AI 凭据主密钥错误或数据损坏');
  }
}

export async function saveCredential(spaceId: string, apiKey: string): Promise<void> {
  const normalized = apiKey.trim();
  if (!normalized || normalized.length > 512 || Buffer.byteLength(normalized, 'utf8') > 1024) {
    throw new Error('invalid_api_key');
  }
  const master = masterKey();
  const existing = await readRow(spaceId);
  if (existing) decryptStoredKey(existing, spaceId);
  const encrypted = encryptKey(normalized, spaceId, master);
  await pool.query(
    `INSERT INTO ai_credentials (sync_space_id, encrypted_key, iv, auth_tag, key_hint, is_deleted)
     VALUES (?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE encrypted_key = VALUES(encrypted_key), iv = VALUES(iv),
       auth_tag = VALUES(auth_tag), key_hint = VALUES(key_hint), is_deleted = 0, update_time = NOW(3)`,
    [spaceId, encrypted.encryptedKey, encrypted.iv, encrypted.authTag, normalized.slice(-4)]
  );
}

export async function deleteCredential(spaceId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_credentials SET encrypted_key = NULL, iv = NULL, auth_tag = NULL,
       key_hint = NULL, is_deleted = 1, update_time = NOW(3) WHERE sync_space_id = ?`,
    [spaceId]
  );
}
