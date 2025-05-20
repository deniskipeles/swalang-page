// src/routes/app/settings/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    const { locals: { safeGetSession:getSession } } = event;
    const session = await getSession();

    if (!session) {
        throw redirect(303, '/auth/login?redirectTo=/app/settings');
    }

    return {
        session // Pass session for layout
    };
};