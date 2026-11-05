import type {
  AIAnnotation,
  AnnotationKind,
  AnnotationSpan,
  SuggestedReminder,
} from './types';

/** 语义标注的中文元信息，桌面与手机共用 */
export const ANNOTATION_META: Record<
  AnnotationKind,
  { label: string; short: string; hint: string }
> = {
  time: { label: '时间', short: '时', hint: '时间点或时间段' },
  place: { label: '地点', short: '地', hint: '地点或场所' },
  person: { label: '人物', short: '人', hint: '人名或角色' },
  action: { label: '事项', short: '事', hint: '要做的事或关键事物' },
  important: { label: '重点', short: '重', hint: '需要特别留意的一句话' },
};

export const ANNOTATION_KINDS: AnnotationKind[] = [
  'time',
  'place',
  'person',
  'action',
  'important',
];

export function isAnnotationKind(value: unknown): value is AnnotationKind {
  return (
    value === 'time' ||
    value === 'place' ||
    value === 'person' ||
    value === 'action' ||
    value === 'important'
  );
}

function decodeEntities(text: string): string {
  return text.replace(
    /&(nbsp|amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,
    (_match, entity: string) => {
      const name = entity.toLowerCase();
      if (name === 'nbsp') return ' ';
      if (name === 'amp') return '&';
      if (name === 'lt') return '<';
      if (name === 'gt') return '>';
      if (name === 'quot') return '"';
      if (name === 'apos') return "'";
      const code = name.startsWith('#x')
        ? Number.parseInt(name.slice(2), 16)
        : Number.parseInt(name.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return _match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return _match;
      }
    }
  );
}

/**
 * 便签 HTML → 可展示/可匹配的纯文本。
 * 保留段落换行（与 stripHtml 不同），让标注预览保持原文版式。
 */
export function noteToPlainText(content: string): string {
  if (!content) return '';
  const withBreaks = content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|section|article)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(withBreaks)
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 单行化：列表卡片等无法展示换行的场景 */
export function toSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function canonicalizePlainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * 内容哈希：两轮 FNV-1a 32-bit + 长度。
 * 仅用于缓存/过期判断，不用于安全。桌面、手机与服务器必须保持同一算法。
 */
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

function clampImportance(value: unknown): 1 | 2 | 3 {
  if (value === 1 || value === 2 || value === 3) return value;
  const num = Number(value);
  if (num >= 3) return 3;
  if (num >= 2) return 2;
  return 1;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const tag = item.replace(/^#+/, '').trim().slice(0, 16);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 6) break;
  }
  return tags;
}

/** 旧标注仍可存 6 个标签；新界面只展示前 2 个可用建议。 */
export function visibleAiTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).slice(0, 2);
}

export function adoptAiTags(current: string[], suggested: string[]): string[] {
  const result = [...current];
  for (const tag of visibleAiTags(suggested)) {
    if (result.length >= 3) break;
    if (!result.includes(tag)) result.push(tag);
  }
  return result;
}

function normalizeTodos(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeSpans(value: unknown): AnnotationSpan[] {
  if (!Array.isArray(value)) return [];
  const spans: AnnotationSpan[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    if (typeof raw.text !== 'string' || !isAnnotationKind(raw.kind)) continue;
    const text = raw.text.trim();
    if (!text || text.length > 80) continue;
    const span: AnnotationSpan = {
      kind: raw.kind,
      text,
      importance: clampImportance(raw.importance),
    };
    if (typeof raw.start === 'number' && Number.isFinite(raw.start)) {
      span.start = Math.max(0, Math.floor(raw.start));
    }
    spans.push(span);
    if (spans.length >= 24) break;
  }
  return spans;
}

function normalizeReminder(value: unknown): SuggestedReminder | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.text !== 'string' || !raw.text.trim()) return null;
  const dueAt =
    typeof raw.dueAt === 'string' && Number.isFinite(new Date(raw.dueAt).getTime())
      ? raw.dueAt
      : null;
  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.5;
  return { text: raw.text.trim().slice(0, 120), dueAt, confidence };
}

/** 防御性解析：数据库、同步与 electron-store 里的 AI 结果都可能来自旧版本 */
export function normalizeAIAnnotation(value: unknown): AIAnnotation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const summary = typeof raw.summary === 'string' ? raw.summary.trim().slice(0, 120) : '';
  const spans = normalizeSpans(raw.spans);
  const tags = normalizeTags(raw.tags);
  const todos = normalizeTodos(raw.todos);
  if (!summary && spans.length === 0 && tags.length === 0 && todos.length === 0) {
    return null;
  }
  return {
    version: 1,
    contentHash: typeof raw.contentHash === 'string' ? raw.contentHash : '',
    summary,
    tags,
    spans,
    todos,
    suggestedReminder: normalizeReminder(raw.suggestedReminder),
    generatedAt:
      typeof raw.generatedAt === 'string' && raw.generatedAt
        ? raw.generatedAt
        : new Date(0).toISOString(),
    model: typeof raw.model === 'string' ? raw.model.slice(0, 60) : 'unknown',
  };
}

export interface ResolvedAnnotation {
  from: number;
  to: number;
  kind: AnnotationKind;
  importance: 1 | 2 | 3;
  text: string;
}

/**
 * 在文本中解析标注：只接受精确子串。
 * 同一子串出现多次时，优先选择靠近 start 提示的那一处；重叠时保留先出现的。
 */
export function resolveAnnotationSpans(
  text: string,
  spans: AnnotationSpan[]
): ResolvedAnnotation[] {
  if (!text || spans.length === 0) return [];
  const candidates: ResolvedAnnotation[] = [];

  for (const span of spans) {
    if (!span.text || span.text.length > 80) continue;
    const positions: number[] = [];
    let cursor = text.indexOf(span.text);
    while (cursor !== -1 && positions.length < 32) {
      positions.push(cursor);
      cursor = text.indexOf(span.text, cursor + 1);
    }
    if (positions.length === 0) continue;

    let from = positions[0];
    if (typeof span.start === 'number') {
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const position of positions) {
        const distance = Math.abs(position - span.start);
        if (distance < bestDistance) {
          bestDistance = distance;
          from = position;
        }
      }
    }
    candidates.push({
      from,
      to: from + span.text.length,
      kind: span.kind,
      importance: span.importance,
      text: span.text,
    });
  }

  candidates.sort((a, b) => a.from - b.from || b.importance - a.importance);
  const chosen: ResolvedAnnotation[] = [];
  for (const candidate of candidates) {
    const overlaps = chosen.some(
      (item) => candidate.from < item.to && candidate.to > item.from
    );
    if (!overlaps) chosen.push(candidate);
  }
  return chosen;
}

export interface AnnotationSegment {
  text: string;
  annotation?: { kind: AnnotationKind; importance: 1 | 2 | 3 };
}

/** 把文本切成普通片段 + 标注片段，供两端渲染 */
export function splitAnnotatedText(
  text: string,
  spans: AnnotationSpan[]
): AnnotationSegment[] {
  const resolved = resolveAnnotationSpans(text, spans);
  if (resolved.length === 0) return [{ text }];
  const segments: AnnotationSegment[] = [];
  let cursor = 0;
  for (const item of resolved) {
    if (item.from > cursor) {
      segments.push({ text: text.slice(cursor, item.from) });
    }
    segments.push({
      text: text.slice(item.from, item.to),
      annotation: { kind: item.kind, importance: item.importance },
    });
    cursor = item.to;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** AI 结果是否仍对应当前正文 */
export function isAIUsable(ai: AIAnnotation | null | undefined, plainText: string): boolean {
  return !!ai && ai.version === 1 && ai.contentHash === computeContentHash(plainText);
}

/** 获取本机时区（用于让模型正确换算“下周二下午三点”） */
export function getLocalTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
  } catch {
    return 'Asia/Shanghai';
  }
}
