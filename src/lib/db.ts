import mongoose from 'mongoose';

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; txSupported: boolean | null };
const g = globalThis as unknown as { _fwMongo?: Cache };
const cache: Cache = g._fwMongo ?? (g._fwMongo = { conn: null, promise: null, txSupported: null });

export async function connectDB() {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.');
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, { bufferCommands: false, maxPoolSize: 10, serverSelectionTimeoutMS: 10000 });
  }
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}

/** Detects once whether the connected deployment supports multi-document transactions (Atlas: yes). */
async function transactionsSupported(): Promise<boolean> {
  if (cache.txSupported !== null) return cache.txSupported;
  const conn = await connectDB();
  try {
    const session = await conn.startSession();
    try {
      await session.withTransaction(async () => {
        await conn.connection.db!.collection('_fw_probe').findOne({}, { session });
      });
      cache.txSupported = true;
    } finally {
      await session.endSession();
    }
  } catch {
    cache.txSupported = false;
    console.warn('[FinWise] MongoDB transactions not supported by this deployment — running without them. Use Atlas or a replica set in production.');
  }
  return cache.txSupported;
}

/**
 * Runs `fn` inside a MongoDB transaction when supported, so multi-document writes
 * (sale + stock + ledger) succeed or fail together.
 */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession | null) => Promise<T>): Promise<T> {
  const conn = await connectDB();
  if (!(await transactionsSupported())) return fn(null);
  const session = await conn.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
