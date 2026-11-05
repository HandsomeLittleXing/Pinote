import type { AIAnnotateResponse, AIStatus, AIRewriteRequest, AIRewriteResponse } from '@shared/types';
import { getLocalTimeZone } from '@shared/ai';
import { isSecureAiKeyServerUrl } from '@shared/aiKeyTransport';
import { getCredentials } from '../storage/credentials';

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const creds = await getCredentials();
  if (!creds.token) {
    throw new Error('尚未配对，AI 整理需要连接同步服务器');
  }
  if (path === '/ai/key' && !isSecureAiKeyServerUrl(creds.serverUrl)) {
    throw new Error('设置 AI Key 需要 HTTPS 连接，请先修改同步服务器地址');
  }
  const response = await fetch(`${creds.serverUrl}${path}`, {
    ...init,
    ...(path === '/ai/key' ? { redirect: 'error' as const } : {}),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${creds.token}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let code = '';
    try {
      const body = (await response.json()) as { error?: string };
      code = body.error ?? '';
    } catch {
      // ignore
    }
    if (code === 'master_key_unavailable') throw new Error('服务器尚未配置 AI 凭据主密钥');
    if (code === 'https_required') throw new Error('设置 AI Key 需要 HTTPS 连接');
    if (code === 'invalid_api_key') throw new Error('请输入有效的 API Key');
    if (code === 'invalid_ai_output') throw new Error('AI 返回内容无效，请重试');
    if (code === 'invalid_ai_key') throw new Error('API Key 无效，请在设置中更新');
    if (code === 'content_hash_mismatch') throw new Error('正文已变化，请重新整理');
    if (response.status === 503 || code === 'ai_not_configured') {
      throw new Error('请先在桌面或手机设置 AI Key');
    }
    if (response.status === 429) {
      throw new Error('AI 调用太频繁，请稍后再试');
    }
    if (response.status === 413) {
      throw new Error('便签太长，暂时无法 AI 整理');
    }
    if (response.status === 504) {
      throw new Error('AI 响应超时，请稍后重试');
    }
    throw new Error(`AI 整理失败 (${response.status})${code ? `: ${code}` : ''}`);
  }

  return (await response.json()) as T;
}

export async function getAIStatus(): Promise<AIStatus> {
  return request<AIStatus>('/ai/status', { method: 'GET' });
}

export async function saveAIKey(apiKey: string): Promise<AIStatus> {
  return request('/ai/key', { method: 'PUT', body: JSON.stringify({ apiKey }) });
}

export async function testAIKey(): Promise<void> {
  await request('/ai/key/test', { method: 'POST' });
}

export async function deleteAIKey(): Promise<AIStatus> {
  return request('/ai/key', { method: 'DELETE' });
}

export async function rewriteNote(input: AIRewriteRequest): Promise<AIRewriteResponse> {
  return request('/ai/rewrite', { method: 'POST', body: JSON.stringify(input) });
}

export async function annotateNote(
  plainText: string,
  contentHash: string,
  force = false
): Promise<AIAnnotateResponse> {
  return request<AIAnnotateResponse>('/ai/annotate', {
    method: 'POST',
    body: JSON.stringify({
      plainText,
      contentHash,
      timezone: getLocalTimeZone(),
      force,
    }),
  });
}
