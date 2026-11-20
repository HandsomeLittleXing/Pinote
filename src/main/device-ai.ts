import type { AIAnnotateRequest, AIAnnotateResponse, AIRewriteRequest, AIRewriteResponse, AIStatus } from '../shared/types';
import { computeContentHash, getLocalTimeZone } from '../shared/ai';
import {
  annotationMessages,
  DIRECT_AI_MODEL,
  DIRECT_AI_TIMEOUT_MS,
  DIRECT_AI_URL,
  parseDirectAIResponse,
  rewriteMessages,
  validateDirectAnnotation,
  validateDirectRewrite,
  type DirectAIMessage,
} from '../shared/aiDirect';
import { DeviceAIKey } from './device-ai-key';

/** 桌面主进程直连云模型；不向渲染进程返回 Key。 */
export class DeviceAI {
  private keys = new DeviceAIKey();

  getStatus(): AIStatus {
    const key = this.keys.getKey();
    return { configured: !!key, model: DIRECT_AI_MODEL, source: 'device',
      ...(key ? { keyHint: key.slice(-4) } : {}) };
  }

  saveKey(value: string): AIStatus {
    this.keys.saveKey(value);
    return this.getStatus();
  }

  deleteKey(): AIStatus {
    this.keys.deleteKey();
    return this.getStatus();
  }

  private async request(messages: DirectAIMessage[], maxTokens: number): Promise<unknown> {
    const key = this.keys.getKey();
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

  async testKey(): Promise<void> {
    await this.request([{ role: 'system', content: '只返回 JSON 对象 {"ok":true}' },
      { role: 'user', content: '连接测试' }], 20);
  }

  async annotate(input: AIAnnotateRequest): Promise<AIAnnotateResponse> {
    if (!input?.plainText?.trim() || input.plainText.length > 8000 ||
        input.contentHash !== computeContentHash(input.plainText)) throw new Error('便签内容无效或已变化');
    const output = await this.request(annotationMessages(input.plainText, input.timezone || getLocalTimeZone()), 1000);
    return { annotation: validateDirectAnnotation(output, input.plainText, DIRECT_AI_MODEL), cached: false };
  }

  async rewrite(input: AIRewriteRequest): Promise<AIRewriteResponse> {
    if (!input?.plainText?.trim() || input.plainText.length > 8000 ||
        input.contentHash !== computeContentHash(input.plainText)) throw new Error('便签内容无效或已变化');
    const output = await this.request(rewriteMessages(input.plainText), 6000);
    return { sourceHash: input.contentHash, ...validateDirectRewrite(output) };
  }
}
