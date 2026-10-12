import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health endpoint reports API availability and actual disconnected database state', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      status: 'ok',
      service: 'freelancer-project-income-tracker-api',
      database: 'disconnected',
    },
  });
});

test('unknown API routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, message: 'API route not found.', errors: [] });
});

test('CORS allows the configured frontend origin', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Origin: env.clientOrigin } });
  assert.equal(response.headers.get('access-control-allow-origin'), env.clientOrigin);
});

test('invalid JSON returns a JSON client error', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid',
  });
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).message, 'string');
});

test('database connection rejects missing configuration', async () => {
  await assert.rejects(connectDB(undefined), /MONGODB_URI is required/);
});
