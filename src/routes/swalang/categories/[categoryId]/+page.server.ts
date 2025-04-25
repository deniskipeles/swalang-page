// src/routes/swalang/categories/[categoryId]/+page.server.ts
import { error as svelteKitError, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z, ZodError } from 'zod';
import {
    getCategoryById,
    listKeywordsByCategory,
    createKeyword
} from '$lib/services/swahiliCollaborationService';

// Schema for adding a keyword
const createKeywordSchema = z.object({
  english_keyword: z.string().trim().min(1, "Keyword cannot be empty.").max(150, "Keyword too long."),
  description: z.string().trim().max(1000, "Description too long.").optional(),
});

// Load function: Fetch category details and its keywords
export const load: PageServerLoad = async (event) => {
    const { params, locals: { supabase, safeGetSession:getSession } } = event;
    const categoryId = params.categoryId;

    // Basic validation of categoryId format (UUID)
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(categoryId)) {
         throw svelteKitError(400, { message: 'Invalid Category ID format' }); // Use svelteKitError for load errors
    }

    const session = await getSession();
    if (!session) {
        // Allow viewing public categories/keywords even if not logged in? Adjust as needed.
        // For now, let's require login to view details.
        throw redirect(303, `/auth/login?redirectTo=/swalang/categories/${categoryId}`);
    }

    // Fetch category and keywords in parallel
    const [categoryResult, keywordsResult] = await Promise.all([
        getCategoryById(supabase, categoryId),
        listKeywordsByCategory(supabase, categoryId)
    ]);

    // Handle category fetch error or not found
    if (categoryResult.error) {
        console.error("Error loading category details:", categoryResult.error);
        if(categoryResult.error.code === 'NOT_FOUND') {
             throw svelteKitError(404, { message: 'Category not found' });
        }
        // Throw a generic error for other DB issues
        throw svelteKitError(500, { message: `Error loading category: ${categoryResult.error.message}` });
    }

    // Handle keywords fetch error (less critical than category not found)
    let keywordsError: string | null = null;
    if (keywordsResult.error) {
        console.error("Error loading keywords:", keywordsResult.error);
        keywordsError = `Could not load keywords: ${keywordsResult.error.message}`;
    }

    return {
        category: categoryResult.data, // Category must exist if we reach here
        keywords: keywordsResult.data || [],
        keywordsError: keywordsError, // Pass keyword-specific error
        categoryId: categoryId, // Pass ID for form action
        session: session
    };
};

// Actions: Handle new keyword submission
export const actions: Actions = {
    createKeyword: async (event) => {
        const { request, params, locals: { supabase, safeGetSession:getSession } } = event;
        const categoryId = params.categoryId; // Get categoryId from route params

        const session = await getSession();
        if (!session) {
            return fail(401, { error: 'You must be logged in to add a keyword.' });
        }

         // Basic validation of categoryId format
         if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(categoryId)) {
             return fail(400, { error: 'Invalid Category ID provided.' });
         }

        const formData = await request.formData();
        const english_keyword = formData.get('english_keyword');
        const description = formData.get('description');

        try {
            const validatedData = createKeywordSchema.parse({
                english_keyword: english_keyword,
                description: description || undefined
            });

            const { data: newKeyword, error } = await createKeyword(supabase, {
                english_keyword: validatedData.english_keyword,
                description: validatedData.description,
                category_id: categoryId // Pass the category ID from the route
            });

            if (error) {
                 return fail(400, {
                     english_keyword, description, // Return submitted data
                     error: error.message,
                     errorCode: error.code
                 });
            }

            return { success: true }; // Success, load will re-run

        } catch (err) {
             if (err instanceof ZodError) {
                const errors = err.flatten().fieldErrors;
                return fail(400, { english_keyword, description, errors });
            }
            console.error("Unexpected error creating keyword:", err);
            return fail(500, { english_keyword, description, error: 'An unexpected server error occurred.' });
        }
    }
};