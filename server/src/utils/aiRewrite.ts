import { AIOutputError } from './ai';

export interface RewriteOutput {
  organizedBlocks: Array<{ type: 'heading' | 'paragraph' | 'bullet'; text: string }>;
  supplements: Array<{ id: string; kind: 'suggestion' | 'example' | 'question'; text: string }>;
}

export function validateRewriteOutput(raw: unknown): RewriteOutput {
  if (!raw || typeof raw !== 'object') throw new AIOutputError('rewrite is not an object');
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.organizedBlocks) || value.organizedBlocks.length < 1 || value.organizedBlocks.length > 30 ||
      !Array.isArray(value.supplements) || value.supplements.length > 3) {
    throw new AIOutputError('rewrite item count is invalid');
  }
  let totalLength = 0;
  const organizedBlocks = value.organizedBlocks.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new AIOutputError('invalid rewrite block');
    const block = item as Record<string, unknown>;
    if (!['heading', 'paragraph', 'bullet'].includes(String(block.type)) ||
        typeof block.text !== 'string' || !block.text.trim() || block.text.length > 2000) {
      throw new AIOutputError('invalid rewrite block');
    }
    totalLength += block.text.length;
    return { type: block.type as RewriteOutput['organizedBlocks'][number]['type'], text: block.text.trim() };
  });
  const ids = new Set<string>();
  const supplements = value.supplements.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new AIOutputError('invalid supplement');
    const supplement = item as Record<string, unknown>;
    if (!['suggestion', 'example', 'question'].includes(String(supplement.kind)) ||
        typeof supplement.id !== 'string' || !/^[a-zA-Z0-9_-]{1,20}$/.test(supplement.id) || ids.has(supplement.id) ||
        typeof supplement.text !== 'string' || !supplement.text.trim() || supplement.text.length > 500) {
      throw new AIOutputError('invalid supplement');
    }
    ids.add(supplement.id);
    totalLength += supplement.text.length;
    return { id: supplement.id, kind: supplement.kind as RewriteOutput['supplements'][number]['kind'], text: supplement.text.trim() };
  });
  if (totalLength > 12000) throw new AIOutputError('rewrite is too long');
  return { organizedBlocks, supplements };
}
