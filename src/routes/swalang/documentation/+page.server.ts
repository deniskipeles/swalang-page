// src/routes/swalang/documentation/+page.server.ts
import type { PageServerLoad } from './$types';
import { listDocPages, listDocCategories } from '$lib/services/documentationService';
import { error as svelteKitError } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
    const { url, locals: { supabase, safeGetSession:getSession } } = event;

    // Get filter parameters from URL search params
    const searchTerm = url.searchParams.get('search') || '';
    const category = url.searchParams.get('category') || ''; // Default to 'all'
    const limit = parseInt(url.searchParams.get('limit')??'1') || 50; 
    const offset = parseInt(url.searchParams.get('offset')??'1') || 50;
    const page = parseInt(url.searchParams.get('page')??'1') || 1;
    // Add pagination params later: const page = parseInt(url.searchParams.get('page') || '1'); const limit = 20;

    const session = await getSession(); // Needed to check if user can add docs

    // Fetch distinct categories and documentation pages in parallel
    const [categoriesResult, pagesResult] = await Promise.all([
        listDocCategories(supabase),
        listDocPages(supabase, {
            searchTerm: searchTerm,
            category: category,
            limit: limit, // Add pagination later
            offset: (page - 1) * limit
        })
    ]);

    // Handle errors - log them but try to show the page anyway if possible
    if (categoriesResult.error) {
        console.error("Error loading documentation categories:", categoriesResult.error);
        // Don't throw, allow page to render without category filter maybe
    }
    if (pagesResult.error) {
         console.error("Error loading documentation pages:", pagesResult.error);
         // Optionally throw if this is critical
         // throw svelteKitError(500, { message: `Failed to load documentation: ${pagesResult.error.message}` });
    }
    console.log(categoriesResult, pagesResult)

    return {
        docPages: pagesResult.data || [],
        docPagesError: pagesResult.error?.message || null,
        categories: categoriesResult.data || [],
        categoriesError: categoriesResult.error?.message || null,
        // Pass back current filter values for the UI
        currentSearchTerm: searchTerm,
        currentCategory: category??"all",
        session: session, // Pass session to determine if Add button should show
        // Add pagination data later: currentPage: page, totalPages: Math.ceil(count / limit)
    };
};

// No actions on this page itself, actions will be on create/edit pages