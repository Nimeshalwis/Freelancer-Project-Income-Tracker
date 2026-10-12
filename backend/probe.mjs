import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: new URL('./.env', import.meta.url), quiet: true });
const uri = process.env.MONGODB_URI;
const n = Number(process.argv[2] || 5);

for (let i = 1; i <= n; i++) {
  const conn = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 5000 });
  const t = Date.now();
  try {
    await conn.asPromise();
    await conn.db.admin().command({ ping: 1 });
    console.log(i, 'OK   ', Date.now() - t, 'ms');
  } catch (err) {
    console.log(i, 'FAIL ', Date.now() - t, 'ms |', err.name, '|', err.message);
  }
  await conn.close().catch(() => {});
}
