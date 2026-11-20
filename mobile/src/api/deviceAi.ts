import type { AIAnnotateResponse, AIRewriteRequest, AIRewriteResponse, AIStatus } from '@shared/types';
import { computeContentHash, getLocalTimeZone } from '@shared/ai';
import {
  annotationMessages,
  DIRECT_AI_MODEL,
  DIRECT_AI_TIMEOUT_MS,
  DIRECT_AI_URL,
  filterSearchIds,
  parseDirectAIResponse,
  rewriteMessages,
  searchMessages,
  validateDirectAnnotation,
  validateDirectRewrite,
  type DirectAIMessage,
} from '@shared/aiDirect';
import { deleteDeviceAIKey, getDeviceAIKey, saveDeviceAIKey } from '../storage/deviceAiKey';

export async function getDeviceAIStatus(): Promise<AIStatus> {
  const key = await getDeviceAIKey();
  return { configured: !!key, model: DIRECT_AI_MODEL, source: 'device',
    ...(key ? { keyHint: key.slice(-4) } : {}) };
}

export async function saveDeviceKey(value: string): Promise<AIStatus> {
  await saveDeviceAIKey(value);
  return getDeviceAIStatus();
}

export async function deleteDeviceKey(): Promise<AIStatus> {
  await deleteDeviceAIKey();
  return getDeviceAIStatus();
}

async function request(messages: DirectAIMessage[], maxTokens: number): Promise<unknown> {
  const key = await getDeviceAIKey();
  if (!key) throw new Error('请先在本机设置 DeepSeek API Key');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DIRECT_AI_TIMEOUT_MS);
  try {
    const response = await fetch(DIRECT_AI_URL, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: DIRECT_AI_MODEL, temperature: 0.2,
        max_tokens: maxTokens, response_format: { type: 'json_object' }, messages }),
    });
    if (response.status === 401 || response.status === 403) throw new Error('设备 API Key 无效');
    if (response.status === 429) throw new Error('AI 调用太频繁，请稍后再试');
    if (!response.ok) throw new Error(`AI 服务暂不可用 (${response.status})`);
    const body = await response.text();
    if (body.length > 64 * 1024) throw new Error('AI 返回内容过大');
    return parseDirectAIResponse(body);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('AI 响应超时，请稍后重试');
    if (error instanceof TypeError) throw new Error('网络连接失败，请检查网络');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function testDeviceKey(): Promise<void> {
  await request([{ role: 'system', content: '只返回 JSON 对象 {"ok":true}' },
    { role: 'user', content: '连接测试' }], 20);
}

export async function annotateDevice(
  plainText: string,
  contentHash: string
): Promise<AIAnnotateResponse> {
  if (!plainText.trim() || plainText.length > 8000 || contentHash !== computeContentHash(plainText)) {
    throw new Error('便签内容无效或已变化');
  }
  const output = await request(annotationMessages(plainText, getLocalTimeZone()), 1000);
  return { annotation: validateDirectAnnotation(output, plainText, DIRECT_AI_MODEL), cached: false };
}

export async function rewriteDevice(input: AIRewriteRequest): Promise<AIRewriteResponse> {
  if (!input.plainText.trim() || input.plainText.length > 8000 ||
      input.contentHash !== computeContentHash(input.plainText)) throw new Error('便签内容无效或已变化');
  const output = await request(rewriteMessages(input.plainText), 6000);
  return { sourceHash: input.contentHash, ...validateDirectRewrite(output) };
}

export async function searchDevice(query: string, candidates: Array<{ id: string; text: string }>): Promise<string[]> {
  if (!query.trim()) throw new Error('请输入搜索内容');
  const bounded = candidates.slice(0, 80).map((item) => ({ id: item.id, text: item.text.slice(0, 300) }));
  const output = await request(searchMessages(query.trim(), bounded), 1200) as { ids?: unknown };
  return filterSearchIds(output?.ids, bounded.map((item) => item.id));
}
