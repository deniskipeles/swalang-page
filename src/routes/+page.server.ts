// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';
import { listDocPages } from '$lib/services/documentationService';
import { listPublishedNews, listPublishedEvents } from '$lib/services/contentService';
import { listRecentPublicShares } from '$lib/services/fileSystemService';

const HOME_PAGE_LIMIT = 5; // Number of items to show per section

export const load: PageServerLoad = async ({ locals }) => {
    const { supabase } = locals;

    // Fetch data for all sections concurrently
    const [docsResult, newsResult, eventsResult, sharesResult] = await Promise.all([
        listDocPages(supabase, { limit: HOME_PAGE_LIMIT }),
        listPublishedNews(supabase, { limit: HOME_PAGE_LIMIT }),
        listPublishedEvents(supabase, { limit: HOME_PAGE_LIMIT, filter: 'upcoming' }), // Only show upcoming events
        listRecentPublicShares(supabase, HOME_PAGE_LIMIT)
    ]);

    // Log errors but don't necessarily block the page load
    if (docsResult.error) console.error("Home page error loading docs:", docsResult.error);
    if (newsResult.error) console.error("Home page error loading news:", newsResult.error);
    if (eventsResult.error) console.error("Home page error loading events:", eventsResult.error);
    if (sharesResult.error) console.error("Home page error loading shares:", sharesResult.error);

    return {
        // Return data or empty arrays if fetch failed
        docs: docsResult.data || [],
        news: newsResult.data || [],
        events: eventsResult.data || [],
        recentShares: sharesResult.data || [],
        // Optionally pass specific errors if needed for UI feedback
        errors: {
            docs: docsResult.error?.message || null,
            news: newsResult.error?.message || null,
            events: eventsResult.error?.message || null,
            shares: sharesResult.error?.message || null
        }
    };
};