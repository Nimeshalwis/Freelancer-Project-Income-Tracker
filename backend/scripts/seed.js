import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Client from '../src/models/Client.js';
import Project from '../src/models/Project.js';
import Payment from '../src/models/Payment.js';

// Fictional Sri Lankan sample businesses. Emails use reserved example domains.
const clients = [
  ['Kasun Perera', 'Serendib Creative Studio', 'Colombo'],
  ['Dilini Fernando', 'Galle Coast Stays', 'Galle'],
  ['Tharindu Jayasinghe', 'Kandy Hills Tea', 'Kandy'],
  ['Nethmi Silva', 'Lanka Bloom Florists', 'Negombo'],
  ['Mohamed Rizwan', 'Eastern Spice Kitchen', 'Batticaloa'],
  ['Kavitha Tharmalingam', 'Yarl Learning Centre', 'Jaffna'],
  ['Chamath Wijesinghe', 'Ruhunu Adventure Tours', 'Matara'],
  ['Sanduni Dissanayake', 'Kurunegala Craft House', 'Kurunegala'],
];
const names = [
  'Serendib Brand Identity', 'Galle Guesthouse Website', 'Kandy Tea Online Store',
  'Negombo Florist Catalogue', 'Eastern Kitchen Menu Design', 'Yarl Student Portal',
  'Ruhunu Tour Booking Website', 'Craft House Product Photography', 'Serendib Campaign Landing Page',
  'Galle Stay Booking Dashboard', 'Kandy Tea Packaging Design', 'Bloom Delivery Tracker',
  'Eastern Kitchen Ordering App', 'Yarl Course Website', 'Ruhunu Travel Brochure', 'Craft House Online Store',
];

function options() {
  const result = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    if (!['--email', '--as-of'].includes(key) || !process.argv[i + 1]) {
      throw new Error('Usage: npm run seed -- --email you@example.com [--as-of YYYY-MM-DD]');
    }
    result[key.slice(2)] = process.argv[i + 1];
  }
  return result;
}

async function seed() {
  const args = options();
  const asOf = args['as-of'] || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const today = new Date(`${asOf}T23:59:59.999Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(today.getTime()) || today.toISOString().slice(0, 10) !== asOf) {
    throw new Error('--as-of must be a valid YYYY-MM-DD date.');
  }
  await connectDB(env.mongodbUri);
  let user;
  if (args.email) user = await User.findOne({ email: args.email.trim().toLowerCase() });
  else {
    const users = await User.find().limit(2);
    if (users.length === 1) [user] = users;
    else throw new Error('Specify --email for an existing registered account.');
  }
  if (!user) throw new Error('Account not found. Register first, then seed using that email.');

  // Stable IDs make reruns safe without changing existing records or credentials.
  const id = (kind, index) => new mongoose.Types.ObjectId(createHash('sha256')
    .update(`sri-lanka-demo-v1:${user._id}:${kind}:${index}`).digest('hex').slice(0, 24));
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const date = (m, day) => new Date(Math.min(Date.UTC(year, m, day, 6), today.getTime()));
  const clientDocs = clients.map(([name, company, city], i) => ({
    _id: id('client', i), user: user._id, name, company,
    email: `client${i + 1}@example.com`, notes: `Fictional demo client based in ${city}, Sri Lanka.`,
  }));
  const projectDocs = names.map((projectName, i) => {
    const completed = i < 9;
    const m = completed ? i % Math.max(1, month) : month;
    return {
      _id: id('project', i), user: user._id, client: clientDocs[i % clients.length]._id,
      projectName, description: 'Sri Lankan business demo project. Amounts use the app\'s shared currency (USD).',
      status: completed ? 'Completed' : i < 13 ? 'In Progress' : 'Pending',
      fee: 450 + (i % 7) * 250, startDate: date(m, 1),
      dueDate: completed ? date(m, 26) : new Date(Date.UTC(year, month + 1, 15, 6)),
    };
  });
  const paymentDocs = projectDocs.flatMap((project, i) => {
    if (project.status === 'Pending') return [];
    const completed = project.status === 'Completed';
    const m = completed ? i % Math.max(1, month) : month;
    return [0, 1].map((part) => ({
      _id: id('payment', i * 2 + part), user: user._id, project: project._id,
      amount: project.fee * (completed ? (part === 0 ? 0.4 : 0.6) : (part === 0 ? 0.25 : 0.15)),
      paymentDate: date(m, completed ? (part === 0 ? 8 : 24) : (part === 0 ? 5 : 10)),
      paymentMethod: ['Bank Transfer', 'Card', 'Cash'][(i + part) % 3],
      notes: `Demo ${part === 0 ? 'advance' : completed ? 'final' : 'milestone'} payment.`,
    }));
  });
  for (const [Model, docs] of [[Client, clientDocs], [Project, projectDocs], [Payment, paymentDocs]]) {
    for (const doc of docs) await new Model(doc).validate();
  }
  await mongoose.connection.transaction(async (session) => {
    const groups = [[Client, clientDocs], [Project, projectDocs], [Payment, paymentDocs]];
    const counts = [];
    for (const [Model, docs] of groups) counts.push(await Model.countDocuments({ _id: { $in: docs.map((doc) => doc._id) }, user: user._id }).session(session));
    if (counts.every((count, i) => count === groups[i][1].length)) {
      console.log('Sample data already exists; no records changed.');
      return;
    }
    if (counts.some(Boolean)) throw new Error('Partial sample data already exists; refusing to overwrite edited data.');
    for (const [Model, docs] of groups) await Model.insertMany(docs, { session });
    console.log(`Seeded ${clientDocs.length} clients, ${projectDocs.length} projects, and ${paymentDocs.length} payments for ${user.email} (${year}).`);
  });
}

try { await seed(); }
catch (error) {
  // Report actionable errors without exposing database credentials.
  const message = String(error.message).replaceAll(env.mongodbUri || 'NO_URI', '[database URI]')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/g, '[database URI]');
  console.error(`Seed failed (${error.name}): ${message}`);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
