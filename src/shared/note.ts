/** 便签内容解析工具：桌面端与移动端共用，不依赖 React/Electron */

/** 去掉 HTML 标签并解码常见实体 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 从便签内容提取标题：优先取第一个段落/标题/列表项 */
export function extractTitle(content: string): string {
  const firstBlock = content.match(/<(p|h[1-6]|li)[^>]*>([\s\S]*?)<\/\1>/i);
  const raw = firstBlock ? firstBlock[2] : content;
  return stripHtml(raw).slice(0, 20) || '新便签';
}

/** 列表卡片摘要：尽量去掉与标题重复的开头 */
export function extractSnippet(html: string, title?: string, maxLength = 120): string {
  let text = stripHtml(html);
  if (title && text.startsWith(title)) {
    text = text.slice(title.length).trim();
  }
  return text.slice(0, maxLength);
}

/** 统计待办完成度：Tiptap taskList 的 li 带 data-checked 属性 */
export function getChecklistProgress(html: string): { done: number; total: number } {
  const total = (html.match(/data-checked="(true|false)"/g) ?? []).length;
  const done = (html.match(/data-checked="true"/g) ?? []).length;
  return { done, total };
}

/** 转义正则特殊字符，供搜索高亮使用 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
