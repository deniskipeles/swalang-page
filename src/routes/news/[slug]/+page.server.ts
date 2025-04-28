import { error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getNewsArticleBySlug } from '$lib/services/contentService';

export const load: PageServerLoad = async ({ params, locals }) => {
    const slug = params.slug;
    if (!slug) throw svelteKitError(400, 'Missing slug');

    const { data: article, error } = await getNewsArticleBySlug(locals.supabase, slug);

    if (error) {
        console.error(`Error loading news article ${slug}:`, error);
        if (error.code === 'NOT_FOUND_OR_DENIED') {
            throw svelteKitError(404, { message: `News article '${slug}' not found or is not published.` });
        }
        throw svelteKitError(500, { message: `Failed to load article: ${error.message}` });
    }

    return { article };
};