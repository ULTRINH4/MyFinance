import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

export async function POST({ request, locals }) {
  if (!locals.user) throw error(401);
  const { enabled } = await request.json();
  await db.update(users).set({ privateMode: Boolean(enabled) }).where(eq(users.id, locals.user.id));
  return json({ privateMode: Boolean(enabled) });
}
