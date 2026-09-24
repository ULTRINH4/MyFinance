import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { hash } from '@node-rs/argon2';
import { users } from '../src/lib/server/db/schema.js';

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/seed-user.js <email> <password>');
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

const passwordHash = await hash(password);
await db.insert(users).values({ email: email.toLowerCase(), passwordHash })
  .onConflictDoUpdate({ target: users.email, set: { passwordHash } });

console.log(`User ${email} ready.`);
await client.end();
