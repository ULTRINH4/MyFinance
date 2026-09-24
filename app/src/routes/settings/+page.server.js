import { fail, redirect } from '@sveltejs/kit';
import { deleteSessionCookie, getSessionToken, invalidateSession } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';

const MAX_AVATAR_BYTES = 1.5 * 1024 * 1024; // stored inline as a data: URI in the users row — no blob storage in this app, a profile picture is small and this is a single-user app

export const actions = {
  logout: async ({ cookies }) => {
    const token = getSessionToken(cookies);
    if (token) await invalidateSession(token);
    deleteSessionCookie(cookies);
    throw redirect(303, '/login');
  },

  uploadAvatar: async ({ request, locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    const form = await request.formData();
    const file = form.get('avatar');
    if (!(file instanceof File) || file.size === 0) return fail(400, { avatarError: 'Pick an image first.' });
    if (!file.type.startsWith('image/')) return fail(400, { avatarError: 'That file isn\'t an image.' });
    if (file.size > MAX_AVATAR_BYTES) return fail(400, { avatarError: 'Image is too large (max 1.5MB).' });

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
    await db.update(users).set({ avatarUrl: dataUrl }).where(eq(users.id, locals.user.id));
    return { avatarUploaded: true };
  },

  removeAvatar: async ({ locals }) => {
    if (!locals.user) throw redirect(303, '/login');
    await db.update(users).set({ avatarUrl: null }).where(eq(users.id, locals.user.id));
    return { avatarRemoved: true };
  }
};
