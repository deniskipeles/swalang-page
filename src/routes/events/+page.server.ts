import type { PageServerLoad } from './$types';
import { listPublishedEvents } from '$lib/services/contentService';
import { error as svelteKitError } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
    const { url, locals: { supabase, safeGetSession:getSession } } = event;
    const filter = url.searchParams.get('filter') || 'upcoming'; // Default to upcoming

    const { data: eventItems, error } = await listPublishedEvents(supabase, {
        limit: 20, // Add pagination later
        filter: (filter === 'past' || filter === 'upcoming') ? filter : 'all'
    });

    if (error) {
        console.error("Error loading events:", error);
    }

    const session = await getSession();

    return {
        eventItems: eventItems || [],
        error: error?.message || null,
        currentFilter: filter,
        session
    };
};