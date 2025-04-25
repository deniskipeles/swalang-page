import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/app';

  if (code) {
    const { error } = await locals.supabase.auth.exchangeCodeForSession(code); // sets cookies internally
    if (!error) {
      console.log('OAuth code exchange complete.');
      throw redirect(303, next);
    } else {
      console.error('Error exchanging code for session:', error);
      throw redirect(303, '/auth/login?error=exchange_failed');
    }
  }

  console.warn('No OAuth code provided in callback.');
  throw redirect(303, '/auth/login?error=no_code');
};
