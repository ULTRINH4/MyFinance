import { redirect } from '@sveltejs/kit';
import { getSessionToken, validateSessionToken } from '$lib/server/auth.js';

const PUBLIC_ROUTES = ['/login', '/manifest.webmanifest'];

export async function handle({ event, resolve }) {
  const token = getSessionToken(event.cookies);
  const { user } = token ? await validateSessionToken(token) : { user: null };
  event.locals.user = user;

  const isPublic = PUBLIC_ROUTES.some((route) => event.url.pathname.startsWith(route));

  if (!user && !isPublic) {
    const redirectTo = event.url.pathname === '/' ? '' : `?redirectTo=${encodeURIComponent(event.url.pathname)}`;
    throw redirect(303, `/login${redirectTo}`);
  }

  if (user && event.url.pathname.startsWith('/login')) {
    throw redirect(303, '/');
  }

  return resolve(event);
}
