import { Router, Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit, ipKey } from '../middleware/rateLimit';
import {
  AIAnnotation,
  AIOutputError,
  computeContentHash,
} from '../utils/ai';
import {
  AITimeoutError,
  AIUpstreamError,
  annotateWithLLM,
  getLLMConfig,
  rewriteWithLLM,
  testLLMKey,
} from '../services/llm';
import { deleteCredential, getCredentialStatus, getEffectiveKey, saveCredential } from '../services/aiCredentials';
import { getTagVocabulary } from '../services/tagVocabulary';

export const aiRouter = Router();

interface CacheEntry {
  annotation: AIAnnotation;
  expiresAt: number;
}

/** 进程内缓存：同一同步空间 + 内容哈希 + 模型只调用一次（24 小时） */
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

function readCache(key: string): AIAnnotation | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.annotation;
}

function writeCache(key: string, annotation: AIAnnotation): void {
  if (cache.size >= CACHE_MAX) {
    const now = Date.now();
    for (const [k, entry] of cache) {
      if (entry.expiresAt <= now || cache.size >= CACHE_MAX) cache.delete(k);
    }
  }
  cache.set(key, { annotation, expiresAt: Date.now() + CACHE_TTL_MS });
}

const ipLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.AI_RATE_LIMIT_IP_PER_MIN || 20),
  key: (req) => `ai-ip:${ipKey(req)}`,
});

const spaceLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.AI_RATE_LIMIT_SPACE_PER_MIN || 8),
  key: (req) => `ai-space:${(req as AuthedRequest).syncSpaceId ?? ipKey(req)}`,
});

export function isSecureKeyRequest(req: Request): boolean {
  const host = req.hostname.toLowerCase();
  const remote = req.socket.remoteAddress || '';
  return req.secure ||
    (process.env.NODE_ENV !== 'production' && process.env.TRUST_PROXY !== '1' &&
      !req.headers['x-forwarded-proto'] && ['localhost', '127.0.0.1', '::1'].includes(host) &&
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote));
}

aiRouter.get('/status', requireAuth, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    const status = await getCredentialStatus(req.syncSpaceId!);
    res.json({ ...status, model: getLLMConfig().model });
  } catch (error) { handleAiError(error, res); }
}));

aiRouter.put('/key', requireAuth, ipLimiter, spaceLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!isSecureKeyRequest(req)) { res.status(403).json({ error: 'https_required' }); return; }
  const apiKey = req.body?.apiKey;
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey.length > 512 || Buffer.byteLength(apiKey.trim(), 'utf8') > 1024) {
    res.status(400).json({ error: 'invalid_api_key' }); return;
  }
  try {
    await saveCredential(req.syncSpaceId!, apiKey);
    for (const key of cache.keys()) if (key.startsWith(`${req.syncSpaceId}:`)) cache.delete(key);
    res.json({ ...await getCredentialStatus(req.syncSpaceId!), model: getLLMConfig().model });
  } catch (error) {
    if (error instanceof Error && error.message.includes('主密钥')) {
      res.status(503).json({ error: 'master_key_unavailable' }); return;
    }
    throw error;
  }
}));

aiRouter.delete('/key', requireAuth, ipLimiter, spaceLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  if (!isSecureKeyRequest(req)) { res.status(403).json({ error: 'https_required' }); return; }
  await deleteCredential(req.syncSpaceId!);
  for (const key of cache.keys()) if (key.startsWith(`${req.syncSpaceId}:`)) cache.delete(key);
  res.json({ ...await getCredentialStatus(req.syncSpaceId!), model: getLLMConfig().model });
}));

aiRouter.post('/key/test', requireAuth, ipLimiter, spaceLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  try {
    await testLLMKey(await getEffectiveKey(req.syncSpaceId!));
    res.json({ ok: true });
  } catch (error) {
    handleAiError(error, res);
  }
}));

function handleAiError(error: unknown, res: import('express').Response): void {
  if (error instanceof AITimeoutError) { res.status(504).json({ error: 'ai_timeout' }); return; }
  if (error instanceof AIUpstreamError) { res.status(error.status).json({ error: error.code }); return; }
  if (error instanceof AIOutputError) { res.status(502).json({ error: 'invalid_ai_output' }); return; }
  if (error instanceof Error && error.message.includes('主密钥')) {
    res.status(503).json({ error: 'master_key_unavailable' }); return;
  }
  console.error('[ai] 请求失败', error instanceof Error ? error.message : error);
  res.status(502).json({ error: 'upstream_error' });
}

aiRouter.post('/rewrite', requireAuth, ipLimiter, spaceLimiter, asyncHandler(async (req: AuthedRequest, res) => {
  const plainText = typeof req.body?.plainText === 'string' ? req.body.plainText.trim() : '';
  if (!plainText) { res.status(400).json({ error: 'plainText is required' }); return; }
  const maxChars = Math.max(500, Number(process.env.AI_MAX_INPUT_CHARS || 8000));
  if (plainText.length > maxChars) { res.status(413).json({ error: 'text_too_long', maxChars }); return; }
  const sourceHash = computeContentHash(plainText);
  if (req.body?.contentHash !== sourceHash) { res.status(400).json({ error: 'content_hash_mismatch' }); return; }
  try {
    const output = await rewriteWithLLM(plainText, await getEffectiveKey(req.syncSpaceId!));
    res.json({ sourceHash, ...output });
  } catch (error) { handleAiError(error, res); }
}));

aiRouter.post(
  '/annotate',
  requireAuth,
  ipLimiter,
  spaceLimiter,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body as {
      plainText?: unknown;
      contentHash?: unknown;
      timezone?: unknown;
      force?: unknown;
    };
    const plainText = typeof body.plainText === 'string' ? body.plainText.trim() : '';
    if (!plainText) {
      res.status(400).json({ error: 'plainText is required' });
      return;
    }

    const maxChars = Math.max(500, Number(process.env.AI_MAX_INPUT_CHARS || 8000));
    if (plainText.length > maxChars) {
      res.status(413).json({ error: 'text_too_long', maxChars });
      return;
    }

    const timezone =
      typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim().slice(0, 60)
        : 'Asia/Shanghai';
    const force = body.force === true;
    const model = getLLMConfig().model;
    const contentHash = computeContentHash(plainText);

    if (typeof body.contentHash === 'string' && body.contentHash !== contentHash) {
      // 客户端与服务端归一化不一致时以服务端为准，但仍记录便于排查
      console.warn('[ai] content hash mismatch');
    }

    // 时区与日期参与 key：同一句“明天”在不同日期/时区不能复用提醒建议
    const cacheKey = `${req.syncSpaceId}:${model}:${timezone}:${new Date()
      .toISOString()
      .slice(0, 10)}:${contentHash}`;
    if (!force) {
      const cached = readCache(cacheKey);
      if (cached) {
        res.json({ annotation: cached, cached: true });
        return;
      }
    }

    const startedAt = Date.now();
    try {
      const annotation = await annotateWithLLM({ plainText, timezone,
        apiKey: await getEffectiveKey(req.syncSpaceId!),
        vocabulary: await getTagVocabulary(req.syncSpaceId!),
      });
      annotation.contentHash = contentHash;
      writeCache(cacheKey, annotation);
      console.log(
        `[ai] annotated chars=${plainText.length} cost=${Date.now() - startedAt}ms model=${annotation.model}`
      );
      res.json({ annotation, cached: false });
    } catch (error) {
      handleAiError(error, res);
    }
  })
);
