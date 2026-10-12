import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Client from '../src/models/Client.js';
import Project from '../src/models/Project.js';
import Payment from '../src/models/Payment.js';
import { env } from '../src/config/env.js';
import { loginLimiter, registerLimiter } from '../src/middleware/auth-rate-limit.middleware.js';
import { connectDB } from '../src/config/db.js';

let mongo;
let server;
let baseUrl;
let alice;
let bob;
const password = randomBytes(24).toString('base64url');

async function request(method, path, body, token, status = 200, extraHeaders = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(json)}`);
  assert.equal(json.success, status < 400);
  if (status >= 400) {
    assert.equal(typeof json.message, 'string');
    assert.ok(Array.isArray(json.errors));
  }
  return { ...json, headers: response.headers };
}
const data = async (...args) => (await request(...args)).data;

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: {
    version: '8.2.6', downloadDir: fileURLToPath(new URL('../../node_modules/.cache/mongodb-binaries/', import.meta.url)),
  } });
  await connectDB(mongo.getUri('freelancer_auth_test'));
  await Promise.all([User.init(), Client.init(), Project.init(), Payment.init()]);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  alice = await data('POST', '/auth/register', { name: 'Alice', email: 'alice@example.test', password }, undefined, 201);
  bob = await data('POST', '/auth/register', { name: 'Bob', email: 'bob@example.test', password }, undefined, 201);
}, { timeout: 1200000 });

beforeEach(async () => {
  // Keep the two authenticated users; isolate each test's business records and limits.
  await Promise.all([Client.deleteMany({}), Project.deleteMany({}), Payment.deleteMany({})]);
  loginLimiter.resetKey('127.0.0.1');
  registerLimiter.resetKey('127.0.0.1');
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function records(auth, prefix, fee = 100, amount = 20) {
  const client = await data('POST', '/clients', { name: `${prefix} Client` }, auth.token, 201);
  const project = await data('POST', '/projects', { projectName: `${prefix} Project`, client: client._id, fee, status: 'In Progress' }, auth.token, 201);
  const payment = await data('POST', '/payments', { project: project._id, amount, paymentMethod: 'Cash', paymentDate: '2026-01-15' }, auth.token, 201);
  return { client, project, payment };
}

test('registration normalizes email, hashes passwords with bcrypt, and returns an expiring JWT without password data', async () => {
  const response = await request('POST', '/auth/register', { name: '  New User  ', email: '  NEW@example.test ', password }, undefined, 201);
  const { user, token, tokenType } = response.data;
  assert.equal(user.name, 'New User');
  assert.equal(user.email, 'new@example.test');
  assert.equal(user.password, undefined);
  assert.equal(tokenType, 'Bearer');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const stored = await User.findById(user._id).select('+password');
  assert.notEqual(stored.password, password);
  assert.ok(await bcrypt.compare(password, stored.password));
  assert.equal(bcrypt.getRounds(stored.password), 12);
  assert.equal((await User.findById(user._id)).password, undefined);
  assert.equal(stored.toJSON().password, undefined);
  assert.equal(stored.toObject().password, undefined);
  const claims = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'], issuer: env.jwtIssuer, audience: env.jwtAudience });
  assert.equal(claims.sub, user._id);
  assert.equal(claims.exp - claims.iat, 900);
  assert.equal(claims.password, undefined);
  assert.equal(claims.email, undefined);
});

test('duplicate and simultaneous registrations cannot create duplicate normalized emails', async () => {
  await request('POST', '/auth/register', { name: 'Duplicate', email: 'ALICE@EXAMPLE.TEST', password }, undefined, 409);
  const body = { name: 'Concurrent', email: 'concurrent@example.test', password };
  const responses = await Promise.all([1, 2].map(() => fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })));
  assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
  assert.equal(await User.countDocuments({ email: body.email }), 1);
});

test('authentication validates names, emails, passwords, unknown fields, and UTF-8 byte length', async () => {
  const invalid = [
    { name: '', email: 'valid@example.test', password },
    { name: 'Valid', email: 'invalid', password },
    { name: 'Valid', email: 'valid@example.test', password: 'short' },
    { name: 'Valid', email: 'valid@example.test', password: 'x'.repeat(73) },
    { name: 'Valid', email: 'valid@example.test', password: '😀'.repeat(19) },
    { name: 'Valid', email: 'valid@example.test', password, user: bob.user._id },
    { name: 'Valid', email: { $ne: null }, password },
  ];
  for (const body of invalid) {
    registerLimiter.resetKey('127.0.0.1');
    const response = await request('POST', '/auth/register', body, undefined, 400);
    assert.ok(!JSON.stringify(response.errors).includes(password));
  }
  await request('POST', '/auth/login', { email: 'bad', password }, undefined, 400);
  await request('POST', '/auth/login', { email: 'alice@example.test', password: { $ne: null } }, undefined, 400);
  await request('POST', '/auth/login', {}, undefined, 400);
});

test('login verifies credentials and me returns only the authenticated safe user', async () => {
  const auth = await data('POST', '/auth/login', { email: ' ALICE@EXAMPLE.TEST ', password });
  assert.equal(auth.user._id, alice.user._id);
  assert.equal(auth.user.password, undefined);
  const me = await request('GET', '/auth/me', undefined, auth.token);
  assert.equal(me.data.user._id, alice.user._id);
  assert.equal(me.data.user.password, undefined);
  assert.equal(me.headers.get('cache-control'), 'no-store');
  const incorrect = await request('POST', '/auth/login', { email: 'alice@example.test', password: randomBytes(24).toString('base64url') }, undefined, 401);
  const absent = await request('POST', '/auth/login', { email: 'absent@example.test', password }, undefined, 401);
  assert.equal(incorrect.message, absent.message);
});

test('all resource methods and all dashboard routes require authentication', async () => {
  const id = new mongoose.Types.ObjectId();
  for (const resource of ['clients', 'projects', 'payments']) {
    for (const [method, path, body] of [
      ['GET', `/${resource}`], ['POST', `/${resource}`, { name: 'No access' }],
      ['GET', `/${resource}/${id}`], ['PUT', `/${resource}/${id}`, { notes: 'No access' }],
      ['PATCH', `/${resource}/${id}`, { notes: 'No access' }], ['DELETE', `/${resource}/${id}`],
    ]) await request(method, path, body, undefined, 401);
  }
  for (const path of ['/dashboard/summary', '/dashboard/monthly-income', '/dashboard/project-status', '/auth/me']) {
    const response = await request('GET', path, undefined, undefined, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');
  }
  await request('GET', '/health');
});

test('expired, forged, malformed, wrong-algorithm, wrong-issuer/audience, and incomplete JWTs are rejected', async () => {
  const options = { subject: alice.user._id, issuer: env.jwtIssuer, audience: env.jwtAudience, expiresIn: '15m' };
  const invalid = [
    'not-a-token',
    jwt.sign({}, env.jwtSecret, { ...options, expiresIn: -1 }),
    jwt.sign({}, randomBytes(48), options),
    jwt.sign({}, env.jwtSecret, { ...options, algorithm: 'HS384' }),
    jwt.sign({}, env.jwtSecret, { ...options, algorithm: 'none' }),
    jwt.sign({}, env.jwtSecret, { ...options, issuer: 'wrong' }),
    jwt.sign({}, env.jwtSecret, { ...options, audience: 'wrong' }),
    jwt.sign({}, env.jwtSecret, { ...options, subject: 'bad-id' }),
    jwt.sign({}, env.jwtSecret, { subject: alice.user._id, issuer: env.jwtIssuer, audience: env.jwtAudience }),
    jwt.sign({}, env.jwtSecret, { ...options, notBefore: '1h' }),
  ];
  for (const token of invalid) await request('GET', '/auth/me', undefined, token, 401);
  await request('GET', '/auth/me', undefined, undefined, 401, { Authorization: `Basic ${alice.token}` });
  await request('GET', '/auth/me', undefined, undefined, 401, { Authorization: `Bearer ${alice.token} extra` });
  await request('GET', `/auth/me?token=${alice.token}`, undefined, undefined, 401);
  const nonexistent = jwt.sign({}, env.jwtSecret, { ...options, subject: new mongoose.Types.ObjectId().toString() });
  await request('GET', '/auth/me', undefined, nonexistent, 401);
});

test('a token stops authenticating when its user is deleted', async () => {
  const auth = await data('POST', '/auth/register', { name: 'Temporary', email: 'temporary@example.test', password }, undefined, 201);
  await User.deleteOne({ _id: auth.user._id });
  await request('GET', '/auth/me', undefined, auth.token, 401);
  await request('GET', '/clients', undefined, auth.token, 401);
});

test('ownership is server-assigned; create/update attempts cannot inject another user', async () => {
  const own = await records(alice, 'Alice');
  for (const [resource, record, payload] of [
    ['clients', own.client, { name: 'Injected' }],
    ['projects', own.project, { projectName: 'Injected', client: own.client._id, fee: 100 }],
    ['payments', own.payment, { project: own.project._id, amount: 1, paymentMethod: 'Cash' }],
  ]) {
    assert.equal(record.user, alice.user._id);
    for (const value of [bob.user._id, alice.user._id, null, { $ne: null }]) {
      await request('POST', `/${resource}`, { ...payload, user: value }, alice.token, 400);
      await request('PATCH', `/${resource}/${record._id}`, { user: value }, alice.token, 400);
      await request('PUT', `/${resource}/${record._id}`, { user: value }, alice.token, 400);
    }
  }
  assert.equal(await Client.countDocuments(), 1);
  assert.equal(await Project.countDocuments(), 1);
  assert.equal(await Payment.countDocuments(), 1);
});

test('users cannot read, update, delete, or discover each other’s resources', async () => {
  const a = await records(alice, 'Alice');
  const b = await records(bob, 'Bob');
  for (const [resource, key, Model] of [['clients', 'client', Client], ['projects', 'project', Project], ['payments', 'payment', Payment]]) {
    const list = await data('GET', `/${resource}`, undefined, alice.token);
    assert.deepEqual(list.map((row) => row._id), [a[key]._id]);
    const before = await Model.findById(b[key]._id).lean();
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      const body = ['PUT', 'PATCH'].includes(method) ? (resource === 'projects' ? { description: 'Attack' } : { notes: 'Attack' }) : undefined;
      await request(method, `/${resource}/${b[key]._id}`, body, alice.token, 404);
      await request(method, `/${resource}/${a[key]._id}`, body, bob.token, 404);
    }
    assert.deepEqual(await Model.findById(b[key]._id).lean(), before);
  }
  assert.deepEqual(await data('GET', '/projects?search=Bob', undefined, alice.token), []);
  await request('GET', `/projects?client=${b.client._id}`, undefined, alice.token, 404);
  await request('GET', `/clients?user=${bob.user._id}`, undefined, alice.token); // Query cannot override server scope.
});

test('foreign client and project references are rejected on create, PUT, and PATCH without writes', async () => {
  const a = await records(alice, 'Alice');
  const b = await records(bob, 'Bob');
  const foreignBefore = await Project.findById(b.project._id).lean();
  await request('POST', '/projects', { projectName: 'Attack', client: b.client._id, fee: 100 }, alice.token, 404);
  await request('POST', '/payments', { project: b.project._id, amount: 1, paymentMethod: 'Cash' }, alice.token, 404);
  for (const method of ['PUT', 'PATCH']) {
    await request(method, `/projects/${a.project._id}`, { client: b.client._id }, alice.token, 404);
    await request(method, `/payments/${a.payment._id}`, { project: b.project._id }, alice.token, 404);
  }
  assert.equal((await Project.findById(a.project._id)).client.toString(), a.client._id);
  assert.equal((await Payment.findById(a.payment._id)).project.toString(), a.project._id);
  assert.deepEqual(await Project.findById(b.project._id).lean(), foreignBefore);
  assert.equal(await Project.countDocuments(), 2);
  assert.equal(await Payment.countDocuments(), 2);
});

test('dashboard totals, monthly charts, and project counts are isolated per user', async () => {
  await records(alice, 'Alice', 100, 20);
  await records(bob, 'Bob', 900, 800);
  const a = await data('GET', '/dashboard/summary', undefined, alice.token);
  const b = await data('GET', '/dashboard/summary', undefined, bob.token);
  assert.deepEqual(a, { totalIncome: 20, totalProjectValue: 100, pendingPayments: 80, activeProjects: 1, totalClients: 1, totalProjects: 1 });
  assert.equal(b.totalIncome, 800);
  assert.equal(b.pendingPayments, 100);
  assert.deepEqual(await data('GET', '/dashboard/monthly-income', undefined, alice.token), [{ month: '2026-01', totalIncome: 20, paymentCount: 1 }]);
  assert.deepEqual(await data('GET', '/dashboard/project-status', undefined, alice.token), [{ status: 'Pending', count: 0 }, { status: 'In Progress', count: 1 }, { status: 'Completed', count: 0 }]);
});

test('population does not expose foreign referenced documents, including nested legacy references', async () => {
  const a = await records(alice, 'Alice');
  const b = await records(bob, 'Bob');
  await Project.collection.updateOne({ _id: new mongoose.Types.ObjectId(a.project._id) }, { $set: { client: new mongoose.Types.ObjectId(b.client._id) } });
  const project = await data('GET', `/projects/${a.project._id}`, undefined, alice.token);
  assert.equal(project.client, null);
  let payment = await data('GET', `/payments/${a.payment._id}`, undefined, alice.token);
  assert.equal(payment.project.client, null);
  await Payment.collection.updateOne({ _id: new mongoose.Types.ObjectId(a.payment._id) }, { $set: { project: new mongoose.Types.ObjectId(b.project._id) } });
  payment = await data('GET', `/payments/${a.payment._id}`, undefined, alice.token);
  assert.equal(payment.project, null);
  const list = await data('GET', '/payments', undefined, alice.token);
  assert.equal(list[0].project, null);
  assert.ok(!JSON.stringify(list).includes('Bob'));
});

test('foreign and unowned legacy records cannot affect another user’s totals or remaining balance', async () => {
  const a = await records(alice, 'Alice');
  await Payment.create({ project: a.project._id, amount: 999, paymentMethod: 'Cash', user: bob.user._id });
  const orphanClient = await Client.collection.insertOne({ name: 'Unowned client' });
  const orphanProject = await Project.collection.insertOne({ projectName: 'Unowned project', client: orphanClient.insertedId, fee: 8000, status: 'Completed' });
  const orphanPayment = await Payment.collection.insertOne({ project: new mongoose.Types.ObjectId(a.project._id), amount: 500, paymentMethod: 'Cash', paymentDate: new Date('2026-01-01') });
  for (const [resource, id] of [['clients', orphanClient.insertedId], ['projects', orphanProject.insertedId], ['payments', orphanPayment.insertedId]]) {
    await request('GET', `/${resource}/${id}`, undefined, alice.token, 404);
    assert.equal((await data('GET', `/${resource}`, undefined, alice.token)).length, 1);
  }
  const totals = await data('GET', '/dashboard/summary', undefined, alice.token);
  assert.equal(totals.totalIncome, 20);
  assert.equal(totals.totalProjectValue, 100);
  assert.equal(totals.pendingPayments, 80);
  await data('POST', '/payments', { project: a.project._id, amount: 80, paymentMethod: 'Cash' }, alice.token, 201);
  await request('POST', '/payments', { project: a.project._id, amount: 0.01, paymentMethod: 'Cash' }, alice.token, 409);
});

test('login and registration are rate limited and return consistent JSON with retry headers', async () => {
  for (let index = 0; index < 10; index++) {
    await request('POST', '/auth/login', { email: 'absent@example.test', password }, undefined, 401);
  }
  const login = await request('POST', '/auth/login', { email: 'alice@example.test', password }, undefined, 429);
  assert.ok(login.headers.get('retry-after'));
  assert.ok(login.headers.get('ratelimit'));
  for (let index = 0; index < 5; index++) await request('POST', '/auth/register', {}, undefined, 400);
  const register = await request('POST', '/auth/register', { name: 'Blocked', email: 'blocked@example.test', password }, undefined, 429);
  assert.ok(register.headers.get('retry-after'));
  assert.equal(await User.countDocuments({ email: 'blocked@example.test' }), 0);
});

test('security headers are present and spoofed query parameters cannot select another current user', async () => {
  const response = await request('GET', `/auth/me?user=${bob.user._id}`, undefined, alice.token);
  assert.equal(response.data.user._id, alice.user._id);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('startup rejects missing/placeholder JWT secrets and unsafe expiration configuration', () => {
  const configUrl = new URL('../src/config/env.js', import.meta.url).href;
  for (const [overrides, expected] of [
    [{ JWT_SECRET: '' }, 'JWT_SECRET'],
    [{ JWT_SECRET: 'replace-with-a-long-random-secret-before-implementing-auth' }, 'JWT_SECRET'],
    [{ JWT_SECRET: randomBytes(8).toString('hex') }, 'JWT_SECRET'],
    [{ JWT_EXPIRES_IN: '900' }, 'JWT_EXPIRES_IN'],
    [{ JWT_EXPIRES_IN: '0s' }, 'JWT_EXPIRES_IN'],
    [{ JWT_EXPIRES_IN: '8d' }, 'JWT_EXPIRES_IN'],
  ]) {
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(configUrl)})`], {
      env: { ...process.env, ...overrides }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(child.status, 1);
    assert.ok(child.stderr.includes(expected));
  }
});
