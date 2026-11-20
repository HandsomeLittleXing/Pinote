import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeContentHash } from '../../src/shared/ai';
import { filterSearchIds, parseDirectAIResponse, validateDirectAnnotation, validateDirectRewrite } from '../../src/shared/aiDirect';
import { resolveAiSource } from '../../src/shared/aiSource';
import { validateModelOutput } from '../src/utils/ai';
import { validateRewriteOutput } from '../src/utils/aiRewrite';

test('旧互通用户保留同步来源，新用户默认设备来源', () => {
  assert.equal(resolveAiSource(undefined, true, true), 'sync');
  assert.equal(resolveAiSource(undefined, true, false), 'device');
  assert.equal(resolveAiSource(undefined, false, true), 'device');
  assert.equal(resolveAiSource('device', true, true), 'device');
});

test('设备标注只保留原文片段并使用原内容哈希', () => {
  const text = '明天下午找小王开会';
  const result = validateDirectAnnotation({
    summary: '安排会议',
    tags: ['工作'],
    spans: [
      { kind: 'time', text: '明天下午', importance: 3 },
      { kind: 'person', text: '不存在的人', importance: 2 },
    ],
    todos: [],
    suggestedReminder: null,
  }, text, 'deepseek-chat');
  assert.equal(result.contentHash, computeContentHash(text));
  assert.deepEqual(result.spans.map((span) => span.text), ['明天下午']);
  assert.deepEqual(result.spans.map((span) => span.text),
    validateModelOutput({ summary: '安排会议', tags: ['工作'], spans: [
      { kind: 'time', text: '明天下午', importance: 3 },
      { kind: 'person', text: '不存在的人', importance: 2 },
    ], todos: [], suggestedReminder: null }, text, 'deepseek-chat').spans.map((span) => span.text));
});

test('设备改写拒绝非法结构和 HTML 文本注入', () => {
  assert.throws(() => validateDirectRewrite({ organizedBlocks: [], supplements: [] }));
  const result = validateDirectRewrite({
    organizedBlocks: [{ type: 'paragraph', text: '<script>alert(1)</script>' }],
    supplements: [],
  });
  assert.equal(result.organizedBlocks[0].text, '<script>alert(1)</script>');
  assert.deepEqual(result, validateRewriteOutput({
    organizedBlocks: [{ type: 'paragraph', text: '<script>alert(1)</script>' }],
    supplements: [],
  }));
});

test('语义搜索只接受候选 ID 并去重限量', () => {
  assert.deepEqual(filterSearchIds(['a', 'bad', 'a', 'b'], ['a', 'b']), ['a', 'b']);
});

test('设备直连拒绝损坏的上游响应', () => {
  assert.throws(() => parseDirectAIResponse('<html>error</html>'), /有效 JSON/);
  assert.throws(() => parseDirectAIResponse('null'), /为空/);
  assert.throws(() => parseDirectAIResponse('{"choices":[]}'), /为空/);
});
