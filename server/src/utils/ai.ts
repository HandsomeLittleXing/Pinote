/** 服务端 AI 类型与校验。与 src/shared/ai.ts 的哈希/字段约定保持一致。 */

export type AnnotationKind = 'time' | 'place' | 'person' | 'action' | 'important';

export interface AnnotationSpan {
  kind: AnnotationKind;
  text: string;
  importance: 1 | 2 | 3;
  start?: number;
}

export interface SuggestedReminder {
  text: string;
  dueAt: string | null;
  confidence: number;
}

export interface AIAnnotation {
  version: 1;
  contentHash: string;
  summary: string;
  tags: string[];
  spans: AnnotationSpan[];
  todos: string[];
  suggestedReminder: SuggestedReminder | null;
  generatedAt: string;
  model: string;
}

export class AIOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIOutputError';
  }
}

function canonicalizePlainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 与 src/shared/ai.ts 完全一致：两轮 FNV-1a 32-bit + 长度 */
export function computeContentHash(plainText: string): string {
  const text = canonicalizePlainText(plainText);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const a = (h1 >>> 0).toString(16).padStart(8, '0');
  const b = (h2 >>> 0).toString(16).padStart(8, '0');
  return `v1-${a}${b}-${text.length}`;
}

function isKind(value: unknown): value is AnnotationKind {
  return (
    value === 'time' ||
    value === 'place' ||
    value === 'person' ||
    value === 'action' ||
    value === 'important'
  );
}

function clampImportance(value: unknown): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  const num = Number(value);
  if (num >= 3) return 3;
  if (num >= 2) return 2;
  return 1;
}

function cleanTags(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = item.replace(/^#+/, '').trim().slice(0, 16);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= max) break;
  }
  return tags;
}

function cleanTodos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 8);
}

function cleanSpans(value: unknown, plainText: string): AnnotationSpan[] {
  if (!Array.isArray(value)) return [];
  const candidates: AnnotationSpan[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.text !== 'string' || !isKind(raw.kind)) continue;
    const text = raw.text.trim();
    if (!text || text.length > 80 || !plainText.includes(text)) continue;
    const start = plainText.indexOf(text);
    candidates.push({
      kind: raw.kind,
      text,
      importance: clampImportance(raw.importance),
      start,
    });
  }

  candidates.sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || b.importance - a.importance);
  const kept: AnnotationSpan[] = [];
  for (const candidate of candidates) {
    const from = candidate.start ?? 0;
    const to = from + candidate.text.length;
    const overlaps = kept.some((item) => {
      const otherFrom = item.start ?? 0;
      const otherTo = otherFrom + item.text.length;
      return from < otherTo && to > otherFrom;
    });
    if (!overlaps) kept.push(candidate);
    if (kept.length >= 20) break;
  }
  return kept;
}

function cleanReminder(value: unknown): SuggestedReminder | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== 'string' || !raw.text.trim()) return null;
  let dueAt: string | null = null;
  if (typeof raw.dueAt === 'string') {
    const timestamp = new Date(raw.dueAt).getTime();
    // 必须是带时区的 ISO 8601，且在未来（留 5 分钟容差）
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(raw.dueAt.trim());
    if (hasZone && Number.isFinite(timestamp) && timestamp > Date.now() - 5 * 60 * 1000) {
      dueAt = raw.dueAt;
    }
  }
  const confidenceRaw = Number(raw.confidence);
  return {
    text: raw.text.trim().slice(0, 120),
    dueAt,
    confidence: Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0.5,
  };
}

/** 去掉模型偶尔包上的 ```json 围栏 */
export function parseModelJson(content: string): unknown {
  let text = content.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AIOutputError('model output is not valid JSON');
  }
}

/**
 * 校验并归一化模型输出。
 * 单项非法会被丢弃；整体没有可用内容才抛 AIOutputError。
 */
export function validateModelOutput(
  raw: unknown,
  plainText: string,
  model: string
): AIAnnotation {
  if (!raw || typeof raw !== 'object') {
    throw new AIOutputError('model output is not an object');
  }
  const value = raw as Record<string, unknown>;
  const summary =
    typeof value.summary === 'string' ? value.summary.trim().slice(0, 120) : '';
  const tags = cleanTags(value.tags, 2);
  const spans = cleanSpans(value.spans, plainText);
  const todos = cleanTodos(value.todos);
  if (!summary && tags.length === 0 && spans.length === 0 && todos.length === 0) {
    throw new AIOutputError('model output has no usable fields');
  }

  return {
    version: 1,
    contentHash: computeContentHash(plainText),
    summary,
    tags,
    spans,
    todos,
    suggestedReminder: cleanReminder(value.suggestedReminder),
    generatedAt: new Date().toISOString(),
    model,
  };
}

/** 同步/数据库中的 AI JSON 防御性归一化（形状非法则返回 null） */
export function normalizeStoredAI(value: unknown): AIAnnotation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const contentHash = typeof raw.contentHash === 'string' ? raw.contentHash : '';
  const summary = typeof raw.summary === 'string' ? raw.summary.slice(0, 120) : '';
  const tags = cleanTags(raw.tags);
  const todos = cleanTodos(raw.todos);
  const spans = Array.isArray(raw.spans)
    ? raw.spans
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .filter(
          (item) =>
            typeof item.text === 'string' &&
            item.text.length > 0 &&
            item.text.length <= 80 &&
            isKind(item.kind)
        )
        .slice(0, 20)
        .map((item) => ({
          kind: item.kind as AnnotationKind,
          text: item.text as string,
          importance: clampImportance(item.importance),
          ...(typeof item.start === 'number' && Number.isFinite(item.start)
            ? { start: Math.max(0, Math.floor(item.start)) }
            : {}),
        }))
    : [];
  if (!summary && tags.length === 0 && spans.length === 0 && todos.length === 0) {
    return null;
  }
  return {
    version: 1,
    contentHash,
    summary,
    tags,
    spans,
    todos,
    suggestedReminder: cleanReminder(raw.suggestedReminder),
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date(0).toISOString(),
    model: typeof raw.model === 'string' ? raw.model.slice(0, 60) : 'unknown',
  };
}

/** 同步时限制 AI JSON 体积，避免单条记录异常膨胀 */
export function sanitizeIncomingAI(value: unknown): AIAnnotation | null {
  if (value === null || value === undefined) return null;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > 64 * 1024) return null;
  } catch {
    return null;
  }
  return normalizeStoredAI(value);
}
