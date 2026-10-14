import mongoose from 'mongoose';
import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';
import { isIP } from 'node:net';

export function mongoDnsOptions(value = process.env.MONGODB_DNS_SERVERS) {
  if (!value?.trim()) return {};
  const servers = value.split(',').map((server) => server.trim());
  if (servers.some((server) => !isIP(server))) {
    throw new Error('MONGODB_DNS_SERVERS must be comma-separated DNS server IP addresses.');
  }
  // The MongoDB driver uses the default promise resolver for SRV/TXT records.
  // This changes DNS only inside this Node process, never Windows settings.
  dnsPromises.setServers(servers);
  const resolver = new dnsPromises.Resolver({ timeout: 5000, tries: 2 });
  resolver.setServers(servers);
  return {
    family: 4,
    lookup(hostname, options, callback) {
      if (typeof options === 'function') { callback = options; options = {}; }
      // Preserve OS resolution for local databases and non-Atlas hosts.
      if (!hostname.endsWith('.mongodb.net')) return dns.lookup(hostname, options, callback);
      const family = (typeof options === 'number' ? options : options?.family) === 6 ? 6 : 4;
      const addresses = family === 6 ? resolver.resolve6(hostname) : resolver.resolve4(hostname);
      addresses.then((values) => {
        if (options?.all) callback(null, values.map((address) => ({ address, family })));
        else callback(null, values[0], family);
      }, callback);
    },
  };
}

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is required. Configure backend/.env before starting the server.');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, ...mongoDnsOptions() });
  console.log('MongoDB connected.');
}
