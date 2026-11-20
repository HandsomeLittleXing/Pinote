import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import type { Request } from 'express';
import { aiRouter, isSecureKeyRequest } from '../src/routes/ai';
import { computeContentHash } from '../src/utils/ai';
import { pool } from '../src/db/pool';

function request(hostname: string, remoteAddress: string, secure = false, forwarded = false): Request {
  return { hostname, secure, headers: forwarded ? { 'x-forwarded-proto': 'https' } : {},
    socket: { remoteAddress } } as unknown as Request;
}

test('key writes require verified TLS or direct local development', () => {
  assert.equal(isSecureKeyRequest(request('example.com', '198.51.100.3', true)), true);
  assert.equal(isSecureKeyRequest(request('localhost', '127.0.0.1')), true);
  assert.equal(isSecureKeyRequest(request('localhost', '198.51.100.3')), false);
  assert.equal(isSecureKeyRequest(request('localhost', '127.0.0.1', false, true)), false);
  const previousTrust = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = '1';
  assert.equal(isSecureKeyRequest(request('localhost', '127.0.0.1')), false);
  if (previousTrust === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previousTrust;
});

test('AI routes authenticate, save key status, rewrite and remove', async () => {
  const previousQuery = pool.query;
  const previousMaster = process.env.AI_CREDENTIALS_MASTER_KEY;
  const previousMock = process.env.AI_MOCK;
  const previousDefault = process.env.LLM_API_KEY;
  process.env.AI_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 3).toString('base64');
  process.env.AI_MOCK = '1';
  delete process.env.LLM_API_KEY;
  let row: Record<string, unknown> | undefined;
  pool.query = (async (sql: string, params?: unknown[]) => {
    if (sql.includes('FROM devices')) return [[{ id: 'device-a', sync_space_id: 'space-a' }], []];
    if (sql.includes('FROM ai_credentials')) return [row ? [row] : [], []];
    if (sql.includes('INSERT INTO ai_credentials')) {
      row = { encrypted_key: params?.[1], iv: params?.[2], auth_tag: params?.[3], key_hint: params?.[4] };
    }
    if (sql.includes('UPDATE ai_credentials')) row = undefined;
    return [[], []];
  }) as typeof pool.query;
  const app = express();
  app.use(express.json());
  app.use('/ai', aiRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/ai`;
    const auth = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
    assert.equal((await fetch(`${base}/status`)).status, 401);
    const initial = await (await fetch(`${base}/status`, { headers: auth })).json() as { source: string };
    assert.equal(initial.source, 'none');
    const saved = await fetch(`${base}/key`, { method: 'PUT', headers: auth, body: JSON.stringify({ apiKey: 'sk-secret' }) });
    assert.equal(saved.status, 200);
    const savedStatus = await saved.json() as { source: string; keyHint: string; apiKey?: string };
    assert.equal(savedStatus.source, 'space');
    assert.equal(savedStatus.keyHint, 'cret');
    assert.equal(savedStatus.apiKey, undefined);
    const oldRow = row;
    process.env.AI_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 4).toString('base64');
    const rejected = await fetch(`${base}/key`, { method: 'PUT', headers: auth,
      body: JSON.stringify({ apiKey: 'sk-overwrite' }) });
    assert.equal(rejected.status, 503);
    assert.equal(row, oldRow);
    process.env.AI_CREDENTIALS_MASTER_KEY = Buffer.alloc(32, 3).toString('base64');
    const plainText = '待办：检查发布清单';
    const rewritten = await fetch(`${base}/rewrite`, { method: 'POST', headers: auth,
      body: JSON.stringify({ plainText, contentHash: computeContentHash(plainText) }) });
    assert.equal(rewritten.status, 200);
    const output = await rewritten.json() as { sourceHash: string; organizedBlocks: unknown[] };
    assert.equal(output.sourceHash, computeContentHash(plainText));
    assert.equal(output.organizedBlocks.length, 1);
    const search = await fetch(`${base}/search`, { method: 'POST', headers: auth,
      body: JSON.stringify({ query: '发布', candidates: [
        { id: 'note-a', text: '检查发布清单' }, { id: 'note-b', text: '购买咖啡' },
      ] }) });
    assert.equal(search.status, 200);
    assert.deepEqual((await search.json() as { ids: string[] }).ids, ['note-a']);
    const invalidSearch = await fetch(`${base}/search`, { method: 'POST', headers: auth,
      body: JSON.stringify({ query: '发布', candidates: [{ id: 'note-a', text: 'x'.repeat(301) }] }) });
    assert.equal(invalidSearch.status, 400);
    assert.equal((await fetch(`${base}/key`, { method: 'DELETE', headers: auth })).status, 200);
    assert.equal(row, undefined);
    process.env.LLM_API_KEY = 'server-default';
    const fallback = await (await fetch(`${base}/status`, { headers: auth })).json() as { source: string };
    assert.equal(fallback.source, 'server');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    pool.query = previousQuery;
    if (previousMaster === undefined) delete process.env.AI_CREDENTIALS_MASTER_KEY;
    else process.env.AI_CREDENTIALS_MASTER_KEY = previousMaster;
    if (previousMock === undefined) delete process.env.AI_MOCK;
    else process.env.AI_MOCK = previousMock;
    if (previousDefault === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousDefault;
  }
});
