import type { AISource } from './types';

/** 旧版已配对且启用 AI 的用户继续使用同步空间 Key。 */
export function resolveAiSource(
  stored: unknown,
  aiEnabled: boolean,
  linked: boolean
): AISource {
  if (stored === 'device' || stored === 'sync') return stored;
  return aiEnabled && linked ? 'sync' : 'device';
}
