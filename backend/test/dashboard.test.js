import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, test } from 'node:test';
import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import Client from '../src/models/Client.js';
import Project from '../src/models/Project.js';
import Payment from '../src/models/Payment.js';
import User from '../src/models/User.js';
import { connectDB } from '../src/config/db.js';

let mongo;
let server;
let baseUrl;
let token;
let userId;

before(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: {
    version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../../node_modules/.cache/mongodb-binaries/', import.meta.url)),
  } });
  await connectDB(mongo.getUri('freelancer_dashboard_test'));
  await Promise.all([Client.init(), Project.init(), Payment.init(), User.init()]);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const response = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Dashboard Tester', email: 'dashboard@example.test', password: randomBytes(24).toString('base64url') }) });
  assert.equal(response.status, 201);
  const auth = (await response.json()).data;
  token = auth.token;
  userId = auth.user._id;
}, { timeout: 1200000 });

beforeEach(async () => {
  await Promise.all([Client.deleteMany({}), Project.deleteMany({}), Payment.deleteMany({})]);
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function raw(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json();
  assert.equal(json.success, response.status < 400);
  if (response.status >= 400) {
    assert.equal(typeof json.message, 'string');
    assert.ok(Array.isArray(json.errors));
  }
  return { status: response.status, ...json };
}

async function api(method, path, body, status = 200) {
  const result = await raw(method, path, body);
  assert.equal(result.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
  return result.data;
}

const createClient = (name = 'Client A') => api('POST', '/clients', { name }, 201);
const createProject = (client, fee = 100, extra = {}) => api('POST', '/projects', { projectName: 'Website', client: client._id, fee, ...extra }, 201);
const createPayment = (project, amount, extra = {}, status = 201) => api('POST', '/payments', { project: project._id, amount, paymentMethod: 'Bank Transfer', ...extra }, status);
const summary = () => api('GET', '/dashboard/summary');

async function fixture() {
  const a = await createClient();
  const b = await createClient('Client B');
  const website = await createProject(a, 1000, { projectName: 'Website Redesign', status: 'In Progress' });
  const mobile = await createProject(b, 500, { projectName: 'Mobile app', status: 'Pending' });
  const logo = await createProject(a, 200, { projectName: 'Logo [v2]', status: 'Completed' });
  const free = await createProject(b, 0, { projectName: 'WEBSITE Audit', status: 'Pending' });
  await createPayment(website, 100, { paymentDate: '2025-01-02' });
  await createPayment(website, 200, { paymentDate: '2026-01-31' });
  await createPayment(mobile, 250, { paymentDate: '2026-02-01' });
  await createPayment(logo, 200, { paymentDate: '2026-02-20' });
  return { a, b, website, mobile, logo, free };
}

test('empty database returns zero summary, empty income, and every status with zero count', async () => {
  assert.deepEqual(await summary(), { totalIncome: 0, totalProjectValue: 0, pendingPayments: 0, activeProjects: 0, totalClients: 0, totalProjects: 0 });
  assert.deepEqual(await api('GET', '/dashboard/monthly-income'), []);
  const months = await api('GET', '/dashboard/monthly-income?year=2026');
  assert.equal(months.length, 12);
  assert.ok(months.every((row) => row.totalIncome === 0 && row.paymentCount === 0));
  assert.deepEqual(await api('GET', '/dashboard/project-status'), [
    { status: 'Pending', count: 0 }, { status: 'In Progress', count: 0 }, { status: 'Completed', count: 0 },
  ]);
});

test('summary calculates actual payments, project fees, partial balances, and counts', async () => {
  await fixture();
  assert.deepEqual(await summary(), { totalIncome: 750, totalProjectValue: 1700, pendingPayments: 950, activeProjects: 1, totalClients: 2, totalProjects: 4 });
  assert.deepEqual(await api('GET', '/dashboard/project-status'), [
    { status: 'Pending', count: 2 }, { status: 'In Progress', count: 1 }, { status: 'Completed', count: 1 },
  ]);
});

test('monthly income separates years, sorts months, and fills a requested year with zeros', async () => {
  await fixture();
  assert.deepEqual(await api('GET', '/dashboard/monthly-income'), [
    { month: '2025-01', totalIncome: 100, paymentCount: 1 },
    { month: '2026-01', totalIncome: 200, paymentCount: 1 },
    { month: '2026-02', totalIncome: 450, paymentCount: 2 },
  ]);
  const months = await api('GET', '/dashboard/monthly-income?year=2026');
  assert.equal(months.length, 12);
  assert.deepEqual(months[0], { month: '2026-01', totalIncome: 200, paymentCount: 1 });
  assert.deepEqual(months[1], { month: '2026-02', totalIncome: 450, paymentCount: 2 });
  assert.deepEqual(months[11], { month: '2026-12', totalIncome: 0, paymentCount: 0 });
  for (const query of ['year=abc', 'year=26', 'year=9999', 'year=2026&year=2025', 'year[$gt]=2020', 'unknown=1']) {
    await api('GET', `/dashboard/monthly-income?${query}`, undefined, 400);
  }
});

test('income uses paymentDate and UTC month boundaries, not creation time', async () => {
  const project = await createProject(await createClient());
  const payment = await createPayment(project, 10, { paymentDate: '2026-01-01T00:30:00+01:00' });
  assert.deepEqual(await api('GET', '/dashboard/monthly-income'), [{ month: '2025-12', totalIncome: 10, paymentCount: 1 }]);
  await api('PATCH', `/payments/${payment._id}`, { paymentDate: '2026-01-01T00:00:00Z', amount: 20 });
  assert.deepEqual(await api('GET', '/dashboard/monthly-income'), [{ month: '2026-01', totalIncome: 20, paymentCount: 1 }]);
  assert.equal((await summary()).totalIncome, 20);
  await api('DELETE', `/payments/${payment._id}`);
  assert.equal((await summary()).totalIncome, 0);
  assert.equal((await summary()).pendingPayments, 100);
});

test('pending is clamped per project even for legacy overpayments and counts actual orphan payments as income', async () => {
  const client = await createClient();
  const overpaid = await createProject(client, 100);
  await createProject(client, 200);
  // Deliberately bypass APIs to simulate legacy inconsistent data from before Step 3.
  await Payment.create([
    { project: overpaid._id, amount: 150, paymentMethod: 'Cash', user: userId },
    { project: new mongoose.Types.ObjectId(), amount: 25, paymentMethod: 'Cash', user: userId },
  ]);
  const result = await summary();
  assert.equal(result.totalIncome, 175);
  assert.equal(result.totalProjectValue, 300);
  assert.equal(result.pendingPayments, 200);
  await createPayment(overpaid, 1, {}, 409);
});

test('project status/client filters and literal case-insensitive name search combine', async () => {
  const { a, b, website, logo, free } = await fixture();
  const ids = (rows) => rows.map((row) => row._id).sort();
  assert.deepEqual(ids(await api('GET', '/projects?status=In%20Progress')), [website._id]);
  assert.deepEqual(ids(await api('GET', `/projects?client=${a._id}`)), [website._id, logo._id].sort());
  assert.deepEqual(ids(await api('GET', '/projects?search=website')), [website._id, free._id].sort());
  assert.deepEqual(ids(await api('GET', `/projects?client=${b._id}&status=Pending&search=WEBSITE`)), [free._id]);
  assert.deepEqual(ids(await api('GET', '/projects?search=%5Bv2%5D')), [logo._id]);
  assert.deepEqual(await api('GET', '/projects?search=.*'), []);
  assert.equal((await api('GET', '/projects?search=%20%20')).length, 4);
  await api('GET', `/projects?client=${new mongoose.Types.ObjectId()}`, undefined, 404);
  for (const query of ['status=Done', 'client=bad', 'status=Pending&status=Completed', 'client[$ne]=x', 'unknown=1', `search=${'x'.repeat(201)}`]) {
    await api('GET', `/projects?${query}`, undefined, 400);
  }
});

test('partial payments allow the exact balance and reject overpayments or payments on a zero-fee project', async () => {
  const client = await createClient();
  const project = await createProject(client);
  await createPayment(project, 30);
  await createPayment(project, 60);
  assert.equal((await summary()).pendingPayments, 10);
  await createPayment(project, 10.01, {}, 409);
  assert.equal(await Payment.countDocuments(), 2);
  await createPayment(project, 10);
  await createPayment(project, 0.01, {}, 409);
  assert.equal((await summary()).pendingPayments, 0);
  const free = await createProject(client, 0);
  await createPayment(free, 0.01, {}, 409);
});

test('decimal payments are exact in balances and summary; excessive precision is rejected', async () => {
  const client = await createClient();
  const project = await createProject(client, 0.3);
  await createPayment(project, 0.1);
  await createPayment(project, 0.2);
  assert.equal((await summary()).totalIncome, 0.3);
  assert.equal((await summary()).pendingPayments, 0);
  await createPayment(project, 0.01, {}, 409);
  await createPayment(project, 0.001, {}, 400);
  await createProject(client, 1e12); // Upper supported amount is still valid.
  await api('PATCH', `/projects/${project._id}`, { fee: 0.301 }, 400);
  await api('PATCH', `/projects/${project._id}`, { fee: 1e12 + 1 }, 400);
});

test('payment updates exclude their own previous amount and roll back rejected edits', async () => {
  const project = await createProject(await createClient());
  const first = await createPayment(project, 40);
  await createPayment(project, 30);
  await api('PUT', `/payments/${first._id}`, { amount: 70 });
  await api('PATCH', `/payments/${first._id}`, { notes: 'Fully paid' });
  await api('PATCH', `/payments/${first._id}`, { amount: 70.01, notes: 'Must roll back' }, 409);
  const saved = await Payment.findById(first._id);
  assert.equal(saved.amount, 70);
  assert.equal(saved.notes, 'Fully paid');
  await api('PATCH', `/payments/${first._id}`, { amount: 20 });
  assert.equal((await summary()).pendingPayments, 50);
  await createPayment(project, 50);
});

test('moving payments checks destination balance and failed moves preserve source records', async () => {
  const client = await createClient();
  const source = await createProject(client, 100);
  const target = await createProject(client, 30);
  const payment = await createPayment(source, 40);
  await createPayment(target, 10);
  await api('PATCH', `/payments/${payment._id}`, { project: target._id }, 409);
  let saved = await Payment.findById(payment._id);
  assert.equal(saved.project.toString(), source._id);
  assert.equal(saved.amount, 40);
  await api('PUT', `/payments/${payment._id}`, { project: target._id, amount: 20 });
  saved = await Payment.findById(payment._id);
  assert.equal(saved.project.toString(), target._id);
  assert.equal(saved.amount, 20);
  assert.equal((await summary()).pendingPayments, 100);
  await createPayment(target, 0.01, {}, 409);
  await createPayment(source, 100);
});

test('fee reductions below total payments fail; equal, higher, and unpaid fee reductions succeed', async () => {
  const client = await createClient();
  const project = await createProject(client);
  await createPayment(project, 30);
  await createPayment(project, 20);
  for (const method of ['PUT', 'PATCH']) await api(method, `/projects/${project._id}`, { fee: 49.99, projectName: 'Must roll back' }, 409);
  assert.equal((await Project.findById(project._id)).fee, 100);
  assert.equal((await Project.findById(project._id)).projectName, 'Website');
  await api('PATCH', `/projects/${project._id}`, { fee: 50 });
  await api('PATCH', `/projects/${project._id}`, { description: 'Metadata-only edit' });
  await api('PUT', `/projects/${project._id}`, { fee: 75 });
  assert.equal((await summary()).pendingPayments, 25);
  const unpaid = await createProject(client);
  await api('PATCH', `/projects/${unpaid._id}`, { fee: 0 });
});

test('concurrent payment creates cannot spend the same remaining balance', async () => {
  const project = await createProject(await createClient());
  const results = await Promise.all([1, 2].map(() => raw('POST', '/payments', { project: project._id, amount: 60, paymentMethod: 'Cash' })));
  assert.deepEqual(results.map((row) => row.status).sort(), [201, 409]);
  assert.equal(await Payment.countDocuments(), 1);
  assert.equal((await summary()).totalIncome, 60);
});

test('concurrent payment updates cannot overpay the project', async () => {
  const project = await createProject(await createClient());
  const first = await createPayment(project, 25);
  const second = await createPayment(project, 25);
  const results = await Promise.all([first, second].map((payment) => raw('PATCH', `/payments/${payment._id}`, { amount: 60 })));
  assert.deepEqual(results.map((row) => row.status).sort(), [200, 409]);
  assert.equal((await summary()).totalIncome, 85);
});

test('concurrent fee reduction and payment creation cannot violate the balance', async () => {
  const project = await createProject(await createClient());
  const results = await Promise.all([
    raw('PATCH', `/projects/${project._id}`, { fee: 50 }),
    raw('POST', '/payments', { project: project._id, amount: 80, paymentMethod: 'Cash' }),
  ]);
  assert.equal(results.filter((row) => row.status < 400).length, 1);
  assert.equal(results.filter((row) => row.status === 409).length, 1);
  const state = await summary();
  assert.ok(state.totalIncome <= state.totalProjectValue);
});

test('concurrent project deletion and payment creation cannot leave an orphan payment', async () => {
  const project = await createProject(await createClient());
  const results = await Promise.all([
    raw('DELETE', `/projects/${project._id}`),
    raw('POST', '/payments', { project: project._id, amount: 20, paymentMethod: 'Cash' }),
  ]);
  assert.equal(results.filter((row) => row.status < 400).length, 1);
  assert.ok(results.some((row) => [404, 409].includes(row.status)));
  const payments = await Payment.find();
  for (const payment of payments) assert.ok(await Project.exists({ _id: payment.project }));
});
