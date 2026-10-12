import assert from 'node:assert/strict';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
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
const absentId = new mongoose.Types.ObjectId().toString();
let userId;
let token;

before(async () => {
  // Always use a disposable real mongod. Never connect these tests to application data.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: {
    version: '8.2.6',
    downloadDir: fileURLToPath(new URL('../../node_modules/.cache/mongodb-binaries/', import.meta.url)),
  } });
  await connectDB(mongo.getUri('freelancer_crud_test'));
  await Promise.all([Client.init(), Project.init(), Payment.init(), User.init()]);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const response = await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'CRUD Tester', email: 'crud@example.test', password: randomBytes(24).toString('base64url') }) });
  assert.equal(response.status, 201);
  const auth = (await response.json()).data;
  token = auth.token;
  userId = auth.user._id;
}, { timeout: 1200000 });

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function request(method, path, body, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${JSON.stringify(json)}`);
  assert.equal(json.success, expectedStatus < 400);
  if (expectedStatus >= 400) {
    assert.equal(typeof json.message, 'string');
    assert.ok(Array.isArray(json.errors));
  } else assert.ok(Object.hasOwn(json, 'data'));
  return json.data;
}

test('all Client, Project, and Payment CRUD endpoints persist to real MongoDB', async (t) => {
  let client;
  let project;
  let payment;

  await t.test('health reports the connected MongoDB server', async () => {
    const health = await request('GET', '/health');
    assert.equal(health.database, 'connected');
  });

  await t.test('create client and verify persisted fields, normalization, timestamps, and user reference', async () => {
    client = await request('POST', '/clients', {
      name: '  Ada Lovelace  ', email: 'ADA@example.com', phone: '+94 77 123 4567',
      company: 'Analytical Studio', notes: 'First client',
    }, 201);
    assert.equal(client.name, 'Ada Lovelace');
    assert.equal(client.email, 'ada@example.com');
    assert.equal(client.user, userId);
    assert.ok(client.createdAt && client.updatedAt);
    assert.equal((await Client.findById(client._id)).company, 'Analytical Studio');
  });

  await t.test('create project with populated client and verify persisted relationship and default status', async () => {
    project = await request('POST', '/projects', {
      projectName: 'Website', client: client._id, description: 'Company site', fee: 2500,
      startDate: '2026-10-12', dueDate: '2026-11-12',
    }, 201);
    assert.equal(project.client._id, client._id);
    assert.equal(project.client.name, client.name);
    assert.equal(project.status, 'Pending');
    assert.equal((await Project.findById(project._id)).client.toString(), client._id);
  });

  await t.test('create payment with nested populated project/client and default payment date', async () => {
    payment = await request('POST', '/payments', {
      project: project._id, amount: 750, paymentMethod: 'Bank Transfer', notes: 'Deposit',
    }, 201);
    assert.equal(payment.project._id, project._id);
    assert.equal(payment.project.client._id, client._id);
    assert.ok(Number.isFinite(Date.parse(payment.paymentDate)));
    assert.equal((await Payment.findById(payment._id)).amount, 750);
  });

  await t.test('list and get each resource, including populated reads', async () => {
    for (const [resource, record] of [['clients', client], ['projects', project], ['payments', payment]]) {
      const list = await request('GET', `/${resource}`);
      assert.equal(list.length, 1);
      assert.equal(list[0]._id, record._id);
      const found = await request('GET', `/${resource}/${record._id}`);
      assert.equal(found._id, record._id);
      if (resource === 'projects') assert.equal(found.client.name, client.name);
      if (resource === 'payments') assert.equal(found.project.client.name, client.name);
    }
  });

  await t.test('PUT and PATCH each resource and verify actual database values', async () => {
    const cases = [
      ['clients', client, Client, { company: 'Updated Studio' }, { notes: 'Updated client' }],
      ['projects', project, Project, { status: 'In Progress' }, { fee: 3000 }],
      ['payments', payment, Payment, { amount: 900 }, { paymentDate: '2026-10-13', notes: 'Updated payment' }],
    ];
    for (const [resource, record, Model, put, patch] of cases) {
      await request('PUT', `/${resource}/${record._id}`, put);
      await request('PATCH', `/${resource}/${record._id}`, patch);
      const saved = await Model.findById(record._id).lean();
      for (const [key, value] of Object.entries({ ...put, ...patch })) {
        assert.equal(saved[key] instanceof Date ? saved[key].toISOString().slice(0, 10) : saved[key], value);
      }
    }
  });

  await t.test('missing and malformed IDs fail for get, put, patch, and delete on every resource', async () => {
    for (const resource of ['clients', 'projects', 'payments']) {
      for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
        const body = ['PUT', 'PATCH'].includes(method) ? (resource === 'projects' ? { description: 'Update' } : { notes: 'Update' }) : undefined;
        await request(method, `/${resource}/not-an-id`, body, 400);
        await request(method, `/${resource}/${absentId}`, body, 404);
      }
    }
  });

  await t.test('schema and body validation rejects invalid creates and updates', async () => {
    const invalidCreates = [
      ['/clients', { email: 'valid@example.com' }],
      ['/clients', { name: '   ' }],
      ['/clients', { name: 'Bad email', email: 'bad' }],
      ['/clients', { name: 'X'.repeat(121) }],
      ['/projects', { projectName: 'Missing client', fee: 0 }],
      ['/projects', { projectName: 'Bad status', client: client._id, fee: 5, status: 'Unknown' }],
      ['/projects', { projectName: 'Negative fee', client: client._id, fee: -1 }],
      ['/projects', { projectName: 'Bad dates', client: client._id, fee: 0, startDate: '2026-11-12', dueDate: '2026-10-12' }],
      ['/payments', { project: project._id, amount: 0, paymentMethod: 'Cash' }],
      ['/payments', { project: project._id, amount: -10, paymentMethod: 'Cash' }],
      ['/payments', { project: project._id, amount: 10 }],
      ['/payments', { amount: 10, paymentMethod: 'Cash' }],
    ];
    for (const [path, body] of invalidCreates) await request('POST', path, body, 400);
    const invalidUpdates = [
      [`/clients/${client._id}`, { name: '' }],
      [`/clients/${client._id}`, { email: 'broken' }],
      [`/projects/${project._id}`, { status: 'Done' }],
      [`/projects/${project._id}`, { fee: -10 }],
      [`/projects/${project._id}`, { startDate: '2026-12-01' }],
      [`/projects/${project._id}`, { dueDate: '2026-09-01' }],
      [`/payments/${payment._id}`, { amount: 0 }],
      [`/payments/${payment._id}`, { paymentMethod: '' }],
    ];
    for (const [path, body] of invalidUpdates) {
      for (const method of ['PUT', 'PATCH']) await request(method, path, body, 400);
    }
    for (const [resource, record] of [['clients', client], ['projects', project], ['payments', payment]]) {
      for (const body of [{}, [], { unknown: true }, { $set: { notes: 'Injected' } }, { user: 'bad' }, { notes: 123 }, { _id: absentId }]) {
        await request('POST', `/${resource}`, body, 400);
        await request('PATCH', `/${resource}/${record._id}`, body, 400);
      }
    }
    await request('PATCH', `/projects/${project._id}`, { fee: '200' }, 400);
    await request('PATCH', `/payments/${payment._id}`, { paymentDate: 'not-a-date' }, 400);
    await request('PATCH', `/payments/${payment._id}`, { paymentDate: '2026-02-30' }, 400);
    await request('PATCH', `/payments/${payment._id}`, { amount: true }, 400);
    assert.equal(await Client.countDocuments(), 1);
    assert.equal(await Project.countDocuments(), 1);
    assert.equal(await Payment.countDocuments(), 1);
    assert.equal((await Project.findById(project._id)).fee, 3000);
    assert.equal((await Payment.findById(payment._id)).amount, 900);
  });

  await t.test('validate missing and invalid references on both create and update', async () => {
    for (const [resource, record, field, payload] of [
      ['projects', project, 'client', { projectName: 'Reference test', fee: 0 }],
      ['payments', payment, 'project', { amount: 1, paymentMethod: 'Cash' }],
    ]) {
      for (const [value, status] of [['bad-id', 400], [absentId, 404], [null, 400]]) {
        await request('POST', `/${resource}`, { ...payload, [field]: value }, status);
        for (const method of ['PUT', 'PATCH']) await request(method, `/${resource}/${record._id}`, { [field]: value }, status);
      }
    }
    assert.equal((await Project.findById(project._id)).client.toString(), client._id);
    assert.equal((await Payment.findById(payment._id)).project.toString(), project._id);
  });

  await t.test('reassign references to existing records and populate the new relationships', async () => {
    const secondClient = await request('POST', '/clients', { name: 'Second client' }, 201);
    const secondProject = await request('POST', '/projects', { projectName: 'Second project', client: secondClient._id, fee: 1000 }, 201);
    const updatedProject = await request('PATCH', `/projects/${project._id}`, { client: secondClient._id });
    assert.equal(updatedProject.client.name, secondClient.name);
    const updatedPayment = await request('PUT', `/payments/${payment._id}`, { project: secondProject._id });
    assert.equal(updatedPayment.project.client.name, secondClient.name);
    await request('PATCH', `/projects/${project._id}`, { client: client._id });
    await request('PATCH', `/payments/${payment._id}`, { project: project._id });
    await request('DELETE', `/projects/${secondProject._id}`);
    await request('DELETE', `/clients/${secondClient._id}`);
  });

  await t.test('ownership is assigned by authentication and cannot be changed or cleared', async () => {
    for (const [resource, record, Model] of [['clients', client, Client], ['projects', project, Project], ['payments', payment, Payment]]) {
      await request('PATCH', `/${resource}/${record._id}`, { user: null }, 400);
      await request('PUT', `/${resource}/${record._id}`, { user: userId }, 400);
      assert.equal((await Model.findById(record._id)).user.toString(), userId);
    }
  });

  await t.test('prevent parent deletion while dependent records exist', async () => {
    await request('DELETE', `/clients/${client._id}`, undefined, 409);
    await request('DELETE', `/projects/${project._id}`, undefined, 409);
    assert.ok(await Client.exists({ _id: client._id }));
    assert.ok(await Project.exists({ _id: project._id }));
  });

  await t.test('delete each resource in dependency order and verify removal from MongoDB', async () => {
    for (const [resource, record, Model] of [['payments', payment, Payment], ['projects', project, Project], ['clients', client, Client]]) {
      const deleted = await request('DELETE', `/${resource}/${record._id}`);
      assert.equal(deleted._id, record._id);
      assert.equal(await Model.findById(record._id), null);
      assert.deepEqual(await request('GET', `/${resource}`), []);
      await request('GET', `/${resource}/${record._id}`, undefined, 404);
      await request('DELETE', `/${resource}/${record._id}`, undefined, 404);
    }
  });
});
