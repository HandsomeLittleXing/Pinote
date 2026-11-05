import type { AIRewriteResponse } from './types';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

/** 仅序列化约定的标签；模型文本始终作为普通文字。 */
export function renderRewriteHtml(
  rewrite: Pick<AIRewriteResponse, 'organizedBlocks' | 'supplements'>,
  selectedIds: string[]
): string {
  const parts: string[] = [];
  let bullets: string[] = [];
  const flushBullets = () => {
    if (bullets.length) parts.push(`<ul>${bullets.join('')}</ul>`);
    bullets = [];
  };
  for (const block of rewrite.organizedBlocks) {
    const text = escapeHtml(block.text);
    if (block.type === 'bullet') {
      bullets.push(`<li>${text}</li>`);
      continue;
    }
    flushBullets();
    parts.push(block.type === 'heading' ? `<h2>${text}</h2>` : `<p>${text}</p>`);
  }
  flushBullets();
  const selected = rewrite.supplements.filter((item) => selectedIds.includes(item.id));
  if (selected.length) {
    parts.push('<h2>补充建议</h2>');
    for (const item of selected) parts.push(`<p>${escapeHtml(item.text)}</p>`);
  }
  return parts.join('');
}
