import type { PageServerLoad } from './$types';
import { listPublishedNews } from '$lib/services/contentService';
import { error as svelteKitError } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
    const { locals: { supabase, safeGetSession:getSession } } = event;

    const { data: newsItems, error } = await listPublishedNews(supabase, { limit: 20 }); // Add pagination later

    if (error) {
        console.error("Error loading news:", error);
        // Don't throw, allow page to render with error message
        // throw svelteKitError(500, { message: `Failed to load news: ${error.message}` });
    }

    const session = await getSession(); // Get session to conditionally show 'Add' button

    return {
        newsItems: newsItems || [],
        error: error?.message || null,
        session
    };
};