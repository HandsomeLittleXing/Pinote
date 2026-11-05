import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRewriteOutput } from '../src/utils/aiRewrite';
import { renderRewriteHtml } from '../../src/shared/aiRewrite';
import { adoptAiTags } from '../../src/shared/ai';

test('rewrite keeps supplements separate and escapes untrusted text', () => {
  const result = validateRewriteOutput({
    organizedBlocks: [{ type: 'paragraph', text: '<script>alert("x")</script>' }],
    supplements: [{ id: 'a', kind: 'question', text: '确认 <日期>？' }],
  });
  assert.equal(renderRewriteHtml(result, ['a']), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p><h2>补充建议</h2><p>确认 &lt;日期&gt;？</p>');
  assert.equal(renderRewriteHtml(result, []), '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</p>');
});

test('rewrite rejects extra or invalid supplements', () => {
  assert.throws(() => validateRewriteOutput({ organizedBlocks: [{ type: 'paragraph', text: '正文' }], supplements: Array.from({ length: 4 }, (_, index) => ({ id: String(index), kind: 'question', text: '检查' })) }));
  assert.throws(() => validateRewriteOutput({ organizedBlocks: [{ type: 'paragraph', text: '' }], supplements: [] }));
});

test('AI tag adoption respects existing tags and capacity', () => {
  assert.deepEqual(adoptAiTags(['已有', '工作'], ['工作', '提醒', '项目', '其他']), ['已有', '工作', '提醒']);
  assert.deepEqual(adoptAiTags(['a', 'b', 'c', 'd'], ['e']), ['a', 'b', 'c', 'd']);
});
