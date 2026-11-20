import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { pool } from '../src/db/pool';
import { syncRouter } from '../src/routes/sync';

test('sync persists adopted tasks and preserves them for older clients', async () => {
  const previousQuery = pool.query;
  const inserts: Array<{ sql: string; values: unknown[] }> = [];
  pool.query = (async (sql: string, values?: unknown[]) => {
    if (sql.includes('FROM devices')) return [[{ id: 'device-a', sync_space_id: 'space-a' }], []];
    if (sql.includes('SELECT updated_at FROM stickers')) return [[], []];
    if (sql.includes('INSERT INTO stickers')) inserts.push({ sql, values: values ?? [] });
    return [[], []];
  }) as typeof pool.query;
  const app = express();
  app.use(express.json());
  app.use('/sync', syncRouter);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/sync`;
    const headers = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
    const now = new Date().toISOString();
    const sticker = {
      id: 'note-a', content: '<p>检查清单</p>', color: '#DFECFB', tags: [],
      isPinned: false, isVisible: true, opacity: 1, reminder: null,
      reminderTriggered: false, windowState: null, ai: null,
      createdAt: now, updatedAt: now, deletedAt: null,
      tasks: [{ id: 'task-a', text: '检查清单', done: false }],
    };
    const first = await fetch(base, { method: 'POST', headers,
      body: JSON.stringify({ changes: [sticker] }) });
    assert.equal(first.status, 200);
    assert.deepEqual(JSON.parse(inserts[0].values[12] as string), sticker.tasks);
    const oldClient = { ...sticker, updatedAt: new Date(Date.now() + 1000).toISOString() };
    delete (oldClient as Partial<typeof sticker>).tasks;
    const second = await fetch(base, { method: 'POST', headers,
      body: JSON.stringify({ changes: [oldClient] }) });
    assert.equal(second.status, 200);
    assert.match(inserts[1].sql, /tasks=tasks/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    pool.query = previousQuery;
  }
});
