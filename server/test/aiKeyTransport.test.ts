import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isSecureAiKeyServerUrl } from '../../src/shared/aiKeyTransport';

test('AI Key transport accepts HTTPS and local development URLs', () => {
  assert.equal(isSecureAiKeyServerUrl('https://sync.example.com'), true);
  assert.equal(isSecureAiKeyServerUrl('http://localhost:4000'), true);
  assert.equal(isSecureAiKeyServerUrl('http://127.0.0.1:4000'), true);
  assert.equal(isSecureAiKeyServerUrl('http://[::1]:4000'), true);
});

test('AI Key transport rejects public HTTP and malformed URLs', () => {
  assert.equal(isSecureAiKeyServerUrl('http://47.113.217.176:4000'), false);
  assert.equal(isSecureAiKeyServerUrl('http://localhost.example.com:4000'), false);
  assert.equal(isSecureAiKeyServerUrl('ftp://sync.example.com'), false);
  assert.equal(isSecureAiKeyServerUrl(''), false);
});
