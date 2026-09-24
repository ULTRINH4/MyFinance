import { loadFinanceData } from '$lib/server/finance-data.js';

export async function load({ locals }) {
  if (!locals.user) return { user: null, financeData: null };
  return {
    user: { email: locals.user.email, avatarUrl: locals.user.avatarUrl, privateMode: locals.user.privateMode },
    financeData: await loadFinanceData()
  };
}
