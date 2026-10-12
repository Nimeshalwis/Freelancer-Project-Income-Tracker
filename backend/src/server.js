import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

let server;

async function shutdown() {
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(timeout);
}

try {
  await connectDB(env.mongodbUri);
  server = app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
  server.on('error', async (error) => {
    console.error(`Server failed to listen (${error.code || error.name}).`);
    await shutdown();
    process.exitCode = 1;
  });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  // Avoid logging connection strings, which may contain credentials.
  console.error(error.name === 'Error' && !env.mongodbUri ? error.message : `MongoDB startup failed (${error.name}). Check MONGODB_URI and database availability.`);
  await mongoose.disconnect();
  process.exitCode = 1;
}
