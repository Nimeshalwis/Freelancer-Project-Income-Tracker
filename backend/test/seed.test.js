import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Client from '../src/models/Client.js';
import Project from '../src/models/Project.js';
import Payment from '../src/models/Payment.js';

test('seed adds account-owned chart data, balances payments, and safely skips reruns', async () => {
  const mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../../node_modules/.cache/mongodb-binaries/', import.meta.url)) },
  });
  try {
    await mongoose.connect(mongo.getUri());
    const user = await User.create({ name: 'Seed Tester', email: 'seed@example.test', password: randomBytes(24).toString('hex') });
    const other = await User.create({ name: 'Other User', email: 'other@example.test', password: randomBytes(24).toString('hex') });
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [
        fileURLToPath(new URL('../scripts/seed.js', import.meta.url)), '--email', user.email, '--as-of', '2026-10-12',
      ], { env: { ...process.env, MONGODB_URI: mongo.getUri(), JWT_SECRET: randomBytes(48).toString('hex') } });
      let output = '';
      child.stdout.on('data', (data) => { output += data; });
      child.stderr.on('data', (data) => { output += data; });
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(output)));
    });
    assert.match(await run(), /Seeded 8 clients, 16 projects, and 26 payments/);
    const existing = await Client.findOne({ user: user._id });
    existing.notes = 'User edited this sample';
    await existing.save();
    assert.match(await run(), /already exists/);
    assert.equal((await Client.findById(existing._id)).notes, 'User edited this sample');
    assert.equal(await Client.countDocuments({ user: user._id }), 8);
    assert.equal(await Project.countDocuments({ user: user._id }), 16);
    assert.equal(await Payment.countDocuments({ user: user._id }), 26);
    for (const Model of [Client, Project, Payment]) assert.equal(await Model.countDocuments({ user: other._id }), 0);
    const payments = await Payment.find().lean();
    const projects = await Project.find().lean();
    const clients = await Client.find().lean();
    assert.equal(new Set(payments.map((p) => p.paymentDate.toISOString().slice(0, 7))).size, 10);
    for (const project of projects) {
      assert.ok(clients.some((client) => client._id.equals(project.client) && client.user.equals(project.user)));
      const paid = payments.filter((p) => p.project.equals(project._id)).reduce((sum, p) => sum + p.amount, 0);
      assert.ok(paid <= project.fee);
      if (project.status === 'Completed') assert.equal(paid, project.fee);
    }
    for (const payment of payments) assert.ok(payment.paymentDate <= new Date('2026-10-12T23:59:59.999Z'));
    await Payment.deleteOne({ _id: payments[0]._id });
    await assert.rejects(run(), /Partial sample data already exists/);
    assert.equal(await Payment.countDocuments({ user: user._id }), 25);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
