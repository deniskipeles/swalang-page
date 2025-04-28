// src/routes/swalang/documentation/[slug]/+page.server.ts
import { error as svelteKitError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
// Import from the new service file
import { getDocPageBySlug } from '$lib/services/documentationService'; // <<< UPDATED IMPORT

export const load: PageServerLoad = async (event) => {
    const { params, url, locals: { supabase } } = event;
    const slug = params.slug;

    if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw svelteKitError(400, { message: 'Invalid documentation identifier format.' });
    }

    const requestedLang = url.searchParams.get('language')?.toLowerCase();
    const currentLanguage: 'eng' | 'sw' = (requestedLang === 'sw') ? 'sw' : 'eng';

    // Fetch the documentation page data using the new service function
    const { data: docData, error: docError } = await getDocPageBySlug(supabase, slug);

    if (docError) {
        console.error(`Error loading documentation for slug '${slug}':`, docError);
        if (docError.code === 'NOT_FOUND') {
            throw svelteKitError(404, { message: `Documentation for '${slug}' not found.` });
        }
        throw svelteKitError(500, { message: `Failed to load documentation: ${docError.message}` });
    }

    // Select content based on language
    const documentationContent = currentLanguage === 'sw' ? docData.content_sw : docData.content_eng;
    const contentAvailable = documentationContent !== null && documentationContent !== undefined;

    if (!contentAvailable) {
         console.warn(`Documentation content for lang='${currentLanguage}' is missing for slug '${slug}'.`);
    }

    // Return data needed by the page component
    return {
        ...docData,
        docId: docData.id, // Changed from doc_id if schema changed
        slug: docData.slug,
        title: docData.title, // Add title
        content: documentationContent ?? `*Documentation in ${currentLanguage === 'sw' ? 'Swahili' : 'English'} is not available yet.*`,
        currentLanguage: currentLanguage,
        otherLanguageAvailable: currentLanguage === 'eng'
            ? (docData.content_sw !== null && docData.content_sw !== undefined)
            : (docData.content_eng !== null && docData.content_eng !== undefined),
        // Remove keyword data as it's no longer directly linked here
        // keyword: docData.keyword,
    };
};

// No actions defined here yet for editing documentation
// export const actions: Actions = { /* ... add update action later ... */ };