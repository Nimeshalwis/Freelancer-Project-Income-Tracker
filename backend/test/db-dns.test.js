import test from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns/promises';
import { mongoDnsOptions } from '../src/config/db.js';

test('MongoDB DNS override is optional, validates servers, and preserves localhost lookup', async () => {
  assert.deepEqual(mongoDnsOptions(''), {});
  assert.throws(() => mongoDnsOptions('not-an-ip'), /DNS server IP addresses/);
  const original = dns.getServers();
  try {
    const options = mongoDnsOptions('1.1.1.1,8.8.8.8');
    assert.equal(options.family, 4);
    assert.deepEqual(dns.getServers(), ['1.1.1.1', '8.8.8.8']);
    const addresses = await new Promise((resolve, reject) => {
      options.lookup('localhost', { all: true, family: 4 }, (error, values) => error ? reject(error) : resolve(values));
    });
    assert.ok(addresses.some((entry) => entry.address === '127.0.0.1' && entry.family === 4));
  } finally {
    dns.setServers(original);
  }
});
