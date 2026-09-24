import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { sessions, users } from './db/schema.js';

const SESSION_COOKIE = 'myfinance_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew when < 15 days left

export function generateSessionToken() {
  return randomBytes(20).toString('base64url');
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(token, userId) {
  const session = {
    id: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
  };
  await db.insert(sessions).values(session);
  return session;
}

export async function validateSessionToken(token) {
  const sessionId = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  if (!row) return { session: null, user: null };

  if (Date.now() >= row.session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { session: null, user: null };
  }

  if (Date.now() >= row.session.expiresAt.getTime() - RENEW_THRESHOLD_MS) {
    row.session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await db.update(sessions).set({ expiresAt: row.session.expiresAt }).where(eq(sessions.id, sessionId));
  }

  return { session: row.session, user: row.user };
}

export async function invalidateSession(token) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

export function setSessionCookie(cookies, token, expiresAt) {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: (process.env.ORIGIN ?? '').startsWith('https://'),
    sameSite: 'lax',
    expires: expiresAt
  });
}

export function deleteSessionCookie(cookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function getSessionToken(cookies) {
  return cookies.get(SESSION_COOKIE);
}
