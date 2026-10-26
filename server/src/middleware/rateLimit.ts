import { Request, Response, NextFunction, RequestHandler } from 'express';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimiter extends RequestHandler {
  /** 成功请求后清空计数（例如兑换成功） */
  reset(req: Request): void;
}

/**
 * 简单的内存限流（单进程部署足够）。
 * 注意：进程重启后计数清空；多实例部署需换成 Redis 等共享存储。
 */
export function rateLimit(options: {
  windowMs: number;
  max: number;
  key: (req: Request) => string;
}): RateLimiter {
  const { windowMs, max, key } = options;

  const middleware = ((req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // 惰性清理过期桶，避免内存无限增长
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) {
        if (b.resetAt <= now) buckets.delete(k);
      }
    }

    const k = key(req);
    let bucket = buckets.get(k);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(k, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({ error: 'too many requests, please retry later' });
      return;
    }

    next();
  }) as RateLimiter;

  middleware.reset = (req: Request) => {
    buckets.delete(key(req));
  };

  return middleware;
}

export const ipKey = (req: Request): string => req.ip ?? req.socket.remoteAddress ?? 'unknown';
