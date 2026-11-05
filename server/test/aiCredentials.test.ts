import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptKey, encryptKey, resolveKeySource } from '../src/services/aiCredentials';

const master = Buffer.alloc(32, 7);

test('credentials decrypt only with matching space and master key', () => {
  const encrypted = encryptKey('sk-secret', 'space-a', master);
  assert.equal(decryptKey(encrypted, 'space-a', master), 'sk-secret');
  assert.throws(() => decryptKey(encrypted, 'space-b', master));
  assert.throws(() => decryptKey(encrypted, 'space-a', Buffer.alloc(32, 8)));
  encrypted.encryptedKey[0] ^= 1;
  assert.throws(() => decryptKey(encrypted, 'space-a', master));
});

test('removed space key falls back to server key', () => {
  assert.equal(resolveKeySource(false, 'default'), 'server');
  assert.equal(resolveKeySource(false, ''), 'none');
  assert.equal(resolveKeySource(true, 'default'), 'space');
});
