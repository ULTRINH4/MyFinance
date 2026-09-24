import { fail, redirect } from '@sveltejs/kit';
import { verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { createSession, generateSessionToken, setSessionCookie } from '$lib/server/auth.js';

export const actions = {
  default: async ({ request, cookies, url }) => {
    const data = await request.formData();
    const email = String(data.get('email') || '').trim().toLowerCase();
    const password = String(data.get('password') || '');

    if (!email || !password) {
      return fail(400, { error: 'Enter your email and password.', email });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (!user || !user.passwordHash) {
      return fail(400, { error: 'Invalid email or password.', email });
    }

    const validPassword = await verify(user.passwordHash, password);
    if (!validPassword) {
      return fail(400, { error: 'Invalid email or password.', email });
    }

    const token = generateSessionToken();
    const session = await createSession(token, user.id);
    setSessionCookie(cookies, token, session.expiresAt);

    const redirectTo = url.searchParams.get('redirectTo');
    throw redirect(303, redirectTo && redirectTo.startsWith('/') ? redirectTo : '/');
  }
};
