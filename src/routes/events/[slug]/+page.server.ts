import { error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getEventBySlug } from '$lib/services/contentService';

export const load: PageServerLoad = async ({ params, locals }) => {
    const slug = params.slug;
    if (!slug) throw svelteKitError(400, 'Missing slug');

    const { data: eventData, error } = await getEventBySlug(locals.supabase, slug);

    if (error) {
        console.error(`Error loading event ${slug}:`, error);
         if (error.code === 'NOT_FOUND_OR_DENIED') {
            throw svelteKitError(404, { message: `Event '${slug}' not found or is not published.` });
        }
        throw svelteKitError(500, { message: `Failed to load event: ${error.message}` });
    }

    return { eventData }; // Renamed to avoid conflict with DOM event type
};