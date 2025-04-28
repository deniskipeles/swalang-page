// src/routes/swalang/keywords/[keywordId]/+page.server.ts
import { error as svelteKitError, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z, ZodError } from 'zod';
import {
    getKeywordById,
    listSuggestionsByKeyword,
    createSuggestion,
    castVote
} from '$lib/services/swahiliCollaborationService';

// Validation schemas for actions
const createSuggestionSchema = z.object({
  swahili_word: z.string().trim().min(1, "Swahili word cannot be empty.").max(200),
  description: z.string().trim().max(1500).optional(),
});

const castVoteSchema = z.object({
  suggestionId: z.string().uuid(),
  voteValue: z.coerce.number().int().min(-1).max(1), // Coerce form value to number
});

// Load function: Fetch keyword details and its suggestions
export const load: PageServerLoad = async (event) => {
    const { params, locals: { supabase, safeGetSession:getSession } } = event;
    const keywordId = params.keywordId;

    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(keywordId)) {
         throw svelteKitError(400, { message: 'Invalid Keyword ID format' });
    }

    const session = await getSession(); // Get session regardless to determine user's vote later

    // Fetch keyword and suggestions in parallel
    const [keywordResult, suggestionsResult] = await Promise.all([
        getKeywordById(supabase, keywordId),
        // Pass authenticated client to get user-specific vote status
        listSuggestionsByKeyword(supabase, keywordId)
    ]);

    // Handle keyword fetch error or not found
    if (keywordResult.error) {
        console.error("Error loading keyword details:", keywordResult.error);
        if(keywordResult.error.code === 'NOT_FOUND') {
             throw svelteKitError(404, { message: 'Keyword not found' });
        }
        throw svelteKitError(500, { message: `Error loading keyword: ${keywordResult.error.message}` });
    }

    // Handle suggestions fetch error
    let suggestionsError: string | null = null;
    if (suggestionsResult.error) {
        console.error("Error loading suggestions:", suggestionsResult.error);
        suggestionsError = `Could not load suggestions: ${suggestionsResult.error.message}`;
    }

    return {
        keyword: keywordResult.data, // Keyword must exist
        suggestions: suggestionsResult.data || [],
        suggestionsError: suggestionsError,
        keywordId: keywordId, // Pass ID for forms
        session: session // Pass session info to the page
    };
};

// Actions: Handle new suggestion and voting
export const actions: Actions = {
    // --- Add Suggestion Action ---
    createSuggestion: async (event) => {
        const { request, params, locals: { supabase, safeGetSession:getSession } } = event;
        const keywordId = params.keywordId;

        const session = await getSession();
        if (!session) return fail(401, { formId: 'suggestion', error: 'Login required.' });
        if (!keywordId) return fail(400, { formId: 'suggestion', error: 'Missing keyword ID.' });

        const formData = await request.formData();
        const swahili_word = formData.get('swahili_word');
        const description = formData.get('description');

        try {
            const validatedData = createSuggestionSchema.parse({ swahili_word, description: description || undefined });

            const { error } = await createSuggestion(supabase, {
                keyword_id: keywordId,
                swahili_word: validatedData.swahili_word,
                description: validatedData.description
            });

            if (error) {
                return fail(400, { formId: 'suggestion', swahili_word, description, error: error.message });
            }
            return { success: true, formId: 'suggestion' };

        } catch (err) {
             if (err instanceof ZodError) {
                return fail(400, { formId: 'suggestion', swahili_word, description, errors: err.flatten().fieldErrors });
            }
            console.error("Unexpected error creating suggestion:", err);
            return fail(500, { formId: 'suggestion', swahili_word, description, error: 'Server error.' });
        }
    },

    // --- Cast Vote Action ---
    castVote: async (event) => {
        const { request, locals: { supabase, safeGetSession:getSession } } = event;

        const session = await getSession();
        if (!session) return fail(401, { error: 'Login required.' });

        const formData = await request.formData();
        const suggestionId = formData.get('suggestionId');
        const voteValue = formData.get('voteValue'); // Will be string "-1", "0", or "1"
        console.log(suggestionId, voteValue)

        try {
            const validatedData = castVoteSchema.parse({ suggestionId, voteValue });

            const { error } = await castVote(
                supabase,
                validatedData.suggestionId,
                validatedData.voteValue as -1 | 0 | 1
            );

            if (error) {
                 // Return fail, but typically handle vote errors less severely in UI
                 console.error("Vote Error:", error);
                 // Could return fail(400, { voteError: error.message, suggestionId: validatedData.suggestionId });
                 // For now, just log and let the UI update optimistically or on next load
                 return { voteError: true, suggestionId: validatedData.suggestionId, message: error.message }; // Send back minimal error info
            }
             // No explicit success needed, UI should update based on next load or optimistic update
             return { voteSuccess: true, suggestionId: validatedData.suggestionId };

        } catch (err) {
             if (err instanceof ZodError) {
                 const errors = err.flatten().fieldErrors;
                 console.error("Vote Validation Error:", errors);
                 return fail(400, { voteError: true, suggestionId, errors }); // Pass back validation errors
             }
             console.error("Unexpected error casting vote:", err);
             return fail(500, { voteError: true, suggestionId, error: 'Server error.' });
        }
    }
};