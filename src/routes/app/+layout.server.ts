import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals: { safeGetSession, user } }) => {
  const session = await safeGetSession();
  // console.log(session,user);

  // If the user is not logged in, redirect them to the login page
  if (!user) {
    throw redirect(303, '/auth/login');
  }

  // If logged in, return the session.
  // You can also fetch user profile/roles here if needed for RBAC
  // const { data: profile } = await supabase.from('profiles')...

  return {
    session,
    user,
  };
};