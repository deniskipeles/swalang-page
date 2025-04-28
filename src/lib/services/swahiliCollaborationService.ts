// src/lib/services/swahiliCollaborationService.ts
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types'; // Assuming you generated types
import { z } from 'zod';
import { supabase as globalSupabaseClient } from '$lib/supabaseClient'; // Import global client for default use

// --- Types (derive from DB schema or define manually/with Zod) ---
// Using generated types is preferred. If not generated, define interfaces or use Zod.
type CategoryRow = Database['public']['Tables']['collaborate_swalang_categories']['Row'];
type KeywordRow = Database['public']['Tables']['collaborate_swalang_keywords']['Row'];
type SuggestionRow = Database['public']['Tables']['collaborate_swalang_suggestions']['Row'];
type VoteRow = Database['public']['Tables']['collaborate_swalang_suggestion_votes']['Row'];

// Example Zod schema for validation/type safety if needed
export const categorySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().max(500).nullable(),
    created_at: z.coerce.date(),
    created_by: z.string().uuid().nullable(),
    updated_at: z.coerce.date(),
});
export type Category = z.infer<typeof categorySchema>;

// --- Error Handling ---
export interface CollaborateError {
    message: string;
    code?: string;
    details?: string | PostgrestError | Error | z.ZodError;
}

function formatCollabError(message: string, error?: PostgrestError | Error | z.ZodError | null, code?: string): CollaborateError {
    console.error(`Collaboration Service Error: ${message}`, error);
    let details: CollaborateError['details'];
    let errorCode = code;

    if (error) {
        details = error;
        if ('code' in error && typeof error.code === 'string') { // PostgrestError check
            const pgError = error as PostgrestError;
            if (pgError.code === '23505') errorCode = errorCode || 'DB_UNIQUE_VIOLATION';
            // Add more specific codes as needed
        } else if (error instanceof z.ZodError) {
             errorCode = errorCode || 'VALIDATION_ERROR';
             message = "Input validation failed."; // More generic message for validation
        }
    }
    return { message, code: errorCode || 'UNKNOWN_ERROR', details };
}


// --- Service Functions ---

/**
 * Lists all collaborative categories.
 * RLS ensures only accessible data is returned.
 */
export async function listCategories(
    client: SupabaseClient<Database> = globalSupabaseClient
): Promise<{ data?: Category[], error?: CollaborateError }> {
    try {
        const { data, error: dbError } = await client
            .from('collaborate_swalang_categories')
            .select('*')
            .order('name', { ascending: true });

        if (dbError) {
            return { error: formatCollabError("Failed to list categories.", dbError) };
        }

        // Validate with Zod (optional but recommended)
        const validation = z.array(categorySchema).safeParse(data);
        if (!validation.success) {
            console.warn("Category list validation failed", validation.error);
            // Return raw data but maybe log/flag it
             return { data: data as Category[] }; // Cast, might be partially invalid
            // Or return error: return { error: formatCollabError("Invalid category data received.", validation.error, 'INVALID_RESPONSE') };
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatCollabError("An unexpected error occurred while listing categories.", e as Error) };
    }
}

/**
 * Creates a new category. Requires authenticated client with insert permissions.
 * The 'created_by' field should be set based on the authenticated user performing the action.
 */
export async function createCategory(
    client: SupabaseClient<Database>, // Must pass authenticated client (usually from server)
    details: { name: string, description?: string | null }
): Promise<{ data?: Category, error?: CollaborateError }> {

    // Basic validation
     const inputSchema = z.object({
         name: z.string().min(1, "Name cannot be empty.").max(100, "Name too long."),
         description: z.string().max(500, "Description too long.").optional().nullable(),
     });
     const validation = inputSchema.safeParse(details);
     if (!validation.success) {
         return { error: formatCollabError("Invalid input for category.", validation.error) };
     }

    try {
        // Get current user ID directly from the authenticated client instance
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatCollabError("User not authenticated.", userError || new Error('No user found'), 'AUTH_REQUIRED') };
        }

        const { data, error: dbError } = await client
            .from('collaborate_swalang_categories')
            .insert({
                name: validation.data.name.trim(),
                description: validation.data.description?.trim() || null,
                created_by: user.id // Set creator automatically based on client's auth state
            })
            .select()
            .single();

        if (dbError) {
            const defaultMsg = `Failed to create category '${validation.data.name}'.`;
            // Check for unique constraint violation on name
            if (dbError.code === '23505' && dbError.message.includes('collaborate_swalang_categories_name_unique')) {
                 return { error: formatCollabError(`Category name "${validation.data.name}" already exists.`, dbError, 'DB_UNIQUE_VIOLATION') };
            }
            return { error: formatCollabError(defaultMsg, dbError) };
        }

        // Validate response data
        const responseValidation = categorySchema.safeParse(data);
        if (!responseValidation.success) {
            console.warn("Created category data validation failed", responseValidation.error);
            return { data: data as Category }; // Return potentially invalid data
        }

        return { data: responseValidation.data };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred creating category '${validation.data.name}'.`, e as Error) };
    }
}


// --- Types & Schemas (assuming Category is already defined) ---
// type KeywordRow = Database['public']['Tables']['collaborate_swalang_keywords']['Row'];

export const keywordSchema = z.object({
    id: z.string().uuid(),
    english_keyword: z.string().min(1).max(150),
    description: z.string().max(1000).nullable(),
    category_id: z.string().uuid(),
    created_at: z.coerce.date(),
    created_by: z.string().uuid().nullable(),
    updated_at: z.coerce.date(),
});
export type Keyword = z.infer<typeof keywordSchema>;


// --- Service Functions ---
/**
 * Retrieves a single category by its ID.
 */
export async function getCategoryById(
    client: SupabaseClient<Database> = globalSupabaseClient,
    categoryId: string
): Promise<{ data?: Category, error?: CollaborateError }> {
    if (!categoryId) {
        return { error: formatCollabError("Category ID is required.", null, 'INVALID_INPUT') };
    }
    try {
        const { data, error: dbError } = await client
            .from('collaborate_swalang_categories')
            .select('*')
            .eq('id', categoryId)
            .maybeSingle(); // Use maybeSingle to handle not found gracefully

        if (dbError) {
            return { error: formatCollabError(`Failed to retrieve category ${categoryId}.`, dbError) };
        }
        if (!data) {
            return { error: formatCollabError(`Category not found (ID: ${categoryId}).`, null, 'NOT_FOUND') };
        }

        const validation = categorySchema.safeParse(data);
        if (!validation.success) {
            console.warn("Get category by ID validation failed", validation.error);
            return { data: data as Category }; // Return potentially invalid
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred retrieving category ${categoryId}.`, e as Error) };
    }
}

/**
 * Lists all keywords belonging to a specific category.
 */
export async function listKeywordsByCategory(
    client: SupabaseClient<Database> = globalSupabaseClient,
    categoryId: string,
    // Add pagination params later if needed: limit = 50, offset = 0
): Promise<{ data?: Keyword[], error?: CollaborateError }> {
     if (!categoryId) {
        return { error: formatCollabError("Category ID is required.", null, 'INVALID_INPUT') };
    }
    try {
        const { data, error: dbError } = await client
            .from('collaborate_swalang_keywords')
            .select('*')
            .eq('category_id', categoryId)
            .order('english_keyword', { ascending: true });
            // .limit(limit) // For pagination
            // .offset(offset);

        if (dbError) {
            return { error: formatCollabError(`Failed to list keywords for category ${categoryId}.`, dbError) };
        }

        const validation = z.array(keywordSchema).safeParse(data);
        if (!validation.success) {
            console.warn("Keyword list validation failed", validation.error);
            return { data: data as Keyword[] }; // Return potentially invalid
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred listing keywords for category ${categoryId}.`, e as Error) };
    }
}


/**
 * Creates a new keyword within a specific category.
 */
export async function createKeyword(
    client: SupabaseClient<Database>, // Requires authenticated client
    details: { english_keyword: string, description?: string | null, category_id: string }
): Promise<{ data?: Keyword, error?: CollaborateError }> {

    // Validate input
     const inputSchema = z.object({
         english_keyword: z.string().trim().min(1, "Keyword cannot be empty.").max(150, "Keyword too long."),
         description: z.string().trim().max(1000, "Description too long.").optional().nullable(),
         category_id: z.string().uuid("Invalid Category ID format."), // Ensure category ID is valid UUID
     });
     const validation = inputSchema.safeParse(details);
     if (!validation.success) {
         return { error: formatCollabError("Invalid input for keyword.", validation.error) };
     }

    try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatCollabError("User not authenticated.", userError || new Error('No user found'), 'AUTH_REQUIRED') };
        }

        const { data, error: dbError } = await client
            .from('collaborate_swalang_keywords')
            .insert({
                english_keyword: validation.data.english_keyword,
                description: validation.data.description || null,
                category_id: validation.data.category_id,
                created_by: user.id
            })
            .select()
            .single();

        if (dbError) {
            const defaultMsg = `Failed to create keyword '${validation.data.english_keyword}'.`;
            // Check for unique constraint violation on english_keyword
            if (dbError.code === '23505' && dbError.message.includes('collaborate_swalang_keywords_english_keyword_unique')) {
                 return { error: formatCollabError(`Keyword "${validation.data.english_keyword}" already exists.`, dbError, 'DB_UNIQUE_VIOLATION') };
            }
             // Check if category_id FK constraint failed (shouldn't happen if UI is correct)
             if (dbError.code === '23503' && dbError.message.includes('collaborate_swalang_keywords_category_id_fkey')) {
                 return { error: formatCollabError('Invalid category selected.', dbError, 'DB_FK_VIOLATION') };
             }
            return { error: formatCollabError(defaultMsg, dbError) };
        }

        const responseValidation = keywordSchema.safeParse(data);
         if (!responseValidation.success) {
            console.warn("Created keyword data validation failed", responseValidation.error);
            return { data: data as Keyword };
        }

        return { data: responseValidation.data };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred creating keyword '${validation.data.english_keyword}'.`, e as Error) };
    }
}


// Include calculated votes and potentially user's vote in the suggestion type for the UI
export const suggestionSchema = z.object({
    id: z.string().uuid(),
    keyword_id: z.string().uuid(),
    swahili_word: z.string().min(1).max(200),
    description: z.string().max(1500).nullable(),
    submitted_by: z.string().uuid(), // Keep as UUID
    created_at: z.coerce.date(),
    is_approved: z.boolean(),
    approved_by: z.string().uuid().nullable(),
    approved_at: z.coerce.date().nullable(),
    // Add fields populated by the SELECT query below
    submitter_email: z.string().email().optional().nullable(), // Optional email from join
    votes: z.number().int().default(0), // Calculated vote score
    user_vote: z.number().int().nullable().default(null), // User's current vote (-1, 1, or null)
});
// export type SuggestionWithVotes = z.infer<typeof suggestionSchema>;

// --- Service Functions ---
// ... (listCategories, createCategory, getCategoryById, listKeywordsByCategory, createKeyword - remain the same) ...

/**
 * Retrieves a single keyword by its ID, including category info.
 */
export async function getKeywordById(
    client: SupabaseClient<Database> = globalSupabaseClient,
    keywordId: string
): Promise<{ data?: Keyword & { category_name?: string | null }, error?: CollaborateError }> {
     if (!keywordId) {
        return { error: formatCollabError("Keyword ID is required.", null, 'INVALID_INPUT') };
    }
    try {
        // Select keyword and join category name for context
        const { data, error: dbError } = await client
            .from('collaborate_swalang_keywords')
            .select(`
                *,
                category:collaborate_swalang_categories ( name )
            `)
            .eq('id', keywordId)
            .maybeSingle();

        if (dbError) {
            return { error: formatCollabError(`Failed to retrieve keyword ${keywordId}.`, dbError) };
        }
        if (!data) {
            return { error: formatCollabError(`Keyword not found (ID: ${keywordId}).`, null, 'NOT_FOUND') };
        }

        // Manual mapping because join structure differs slightly from base schema
        const keywordData: Keyword & { category_name?: string | null } = {
            id: data.id,
            english_keyword: data.english_keyword,
            description: data.description,
            category_id: data.category_id,
            created_at: new Date(data.created_at), // Coerce manually or adjust schema
            created_by: data.created_by,
            updated_at: new Date(data.updated_at),
            category_name: data.category?.name // Extract joined name
        };

        // Validate base keyword part (optional but good practice)
        const validation = keywordSchema.safeParse(keywordData);
         if (!validation.success) {
             console.warn("Get keyword by ID validation failed", validation.error);
             // Return raw data but log error
         }

        return { data: keywordData };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred retrieving keyword ${keywordId}.`, e as Error) };
    }
}

/**
 * Lists suggestions for a specific keyword, including vote counts and the current user's vote.
 */
// Define the shape expected from the VIEW + user vote join
// Note: Zod schema now matches the VIEW structure + user_vote
export const suggestionWithVotesSchema = z.object({
    id: z.string().uuid(),
    keyword_id: z.string().uuid(),
    swahili_word: z.string().min(1).max(200),
    description: z.string().max(1500).nullable(),
    submitted_by: z.string().uuid(),
    created_at: z.coerce.date(),
    is_approved: z.boolean(),
    approved_by: z.string().uuid().nullable(),
    approved_at: z.coerce.date().nullable(),
    // Fields from the VIEW
    submitter_username: z.string().nullable().optional(),
    submitter_avatar_url: z.string().url().nullable().optional(),
    total_votes: z.number().int().default(0), // Renamed from 'votes' for clarity
    // Field added by the specific query's LEFT JOIN
    user_vote: z.number().int().nullable().default(null),
});
export type SuggestionWithVotes = z.infer<typeof suggestionWithVotesSchema>;


/**
 * Lists suggestions for a specific keyword using the VIEW,
 * including vote counts and the current user's vote.
 */
export async function listSuggestionsByKeyword(
    client: SupabaseClient<Database>=globalSupabaseClient, // Needs authenticated client for user_vote
    keywordId: string
): Promise<{ data?: SuggestionWithVotes[], error?: CollaborateError }> {
     if (!keywordId) {
        return { error: formatCollabError("Keyword ID is required.", null, 'INVALID_INPUT') };
    }
    const { data: { user } } = await client.auth.getUser(); // Get current user ID or null
    const currentUserId = user?.id ?? '00000000-0000-0000-0000-000000000000'; // Use placeholder UUID if no user

    try {
        // Query the VIEW and LEFT JOIN the user's specific vote
        const { data, error: dbError } = await client
            .from('collaborate_swalang_view_suggestion_details') // <<<--- Query the VIEW
            .select(`
                *,
                user_vote:collaborate_swalang_suggestion_votes ( vote )
            `)
            .eq('keyword_id', keywordId) // Filter view results by keyword
             // Filter the LEFT JOIN to only get the current user's vote row
            .eq('user_vote.user_id', currentUserId)
            // Filter based on approval status if needed (RLS on underlying table might also handle this)
            // .eq('is_approved', true)
            .order('total_votes', { ascending: false }) // Order by total votes from the view
            .order('created_at', { ascending: true });

        if (dbError) {
             // Handle potential errors querying the view or joining votes
             // If error mentions relationship issues, schema cache might need refresh for the VIEW itself.
            return { error: formatCollabError(`Failed to list suggestions for keyword ${keywordId}.`, dbError) };
        }

        // Map and Validate data structure from the combined query result
         const mappedData: SuggestionWithVotes[] = (data || []).map(row => ({
             id: row.id,
             keyword_id: row.keyword_id,
             swahili_word: row.swahili_word,
             description: row.description,
             submitted_by: row.submitted_by,
             created_at: new Date(row.created_at),
             is_approved: row.is_approved,
             approved_by: row.approved_by,
             approved_at: row.approved_at ? new Date(row.approved_at) : null,
             // View fields
             submitter_username: row.submitter_username,
             submitter_avatar_url: row.submitter_avatar_url,
             total_votes: row.total_votes ?? 0, // Use total_votes from view
             // Joined field
             user_vote: (row.user_vote as { vote: number }[] | null)?.[0]?.vote ?? null // Extract user vote from join result
         }));

         // Validate mapped data against the combined schema
         const validation = z.array(suggestionWithVotesSchema).safeParse(mappedData);
          if (!validation.success) {
             console.warn("Suggestion list validation failed (using view)", validation.error);
             // Decide how to handle validation errors
             return { data: mappedData }; // Return potentially invalid data but log warning
             // OR return { error: formatCollabError("Invalid suggestion data received.", validation.error, 'INVALID_RESPONSE') };
         }

        return { data: validation.data };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred listing suggestions for keyword ${keywordId}.`, e as Error) };
    }
}
// export async function listSuggestionsByKeyword(
//     client: SupabaseClient<Database>=globalSupabaseClient, // Needs authenticated client for user_vote
//     keywordId: string
// ): Promise<{ data?: SuggestionWithVotes[], error?: CollaborateError }> {
//      if (!keywordId) {
//         return { error: formatCollabError("Keyword ID is required.", null, 'INVALID_INPUT') };
//     }
//     const { data: { user } } = await client.auth.getUser(); // Get current user ID or null

//     try {
//         // Fetch suggestions, join submitter email (optional), calculate total votes via RPC,
//         // and LEFT JOIN to get the current user's vote
//         const { data, error: dbError } = await client
//             .from('collaborate_swalang_suggestions')
//             .select(`
//                 *,
//                 submitter:auth_users ( email ),
//                 total_votes:collaborate_swalang_fn_get_suggestion_votes ( id ),
//                 user_vote:collaborate_swalang_suggestion_votes ( vote )
//             `)
//             .eq('keyword_id', keywordId)
//             // Filter user_vote join only for the current user
//             .eq('user_vote.user_id', user?.id ?? '00000000-0000-0000-0000-000000000000') // Use null UUID if no user
//             // Filter to show only approved suggestions? Or show all? Adjust RLS/query as needed
//             // .eq('is_approved', true)
//             .order('total_votes', { ascending: false }) // Order by highest votes first
//             .order('created_at', { ascending: true });

//         if (dbError) {
//             return { error: formatCollabError(`Failed to list suggestions for keyword ${keywordId}.`, dbError) };
//         }

//         // Manual mapping & validation because SELECT structure is complex
//          const mappedData: SuggestionWithVotes[] = (data || []).map(row => ({
//              id: row.id,
//              keyword_id: row.keyword_id,
//              swahili_word: row.swahili_word,
//              description: row.description,
//              submitted_by: row.submitted_by,
//              created_at: new Date(row.created_at), // Coerce date
//              is_approved: row.is_approved,
//              approved_by: row.approved_by,
//              approved_at: row.approved_at ? new Date(row.approved_at) : null,
//              submitter_email: row.submitter?.email, // Use optional chaining
//              votes: (row.total_votes as number | null) ?? 0, // Use RPC result, default 0
//              user_vote: (row.user_vote as { vote: number }[] | null)?.[0]?.vote ?? null // Extract vote from array result
//          }));

//          const validation = z.array(suggestionSchema).safeParse(mappedData);
//           if (!validation.success) {
//              console.warn("Suggestion list validation failed", validation.error);
//              return { data: mappedData }; // Return potentially invalid data
//          }

//         return { data: validation.data };

//     } catch (e) {
//         return { error: formatCollabError(`An unexpected error occurred listing suggestions for keyword ${keywordId}.`, e as Error) };
//     }
// }

/**
 * Creates a new suggestion for a keyword.
 */
export async function createSuggestion(
    client: SupabaseClient<Database>,
    details: { keyword_id: string, swahili_word: string, description?: string | null }
): Promise<{ data?: SuggestionRow, error?: CollaborateError }> { // Return basic SuggestionRow initially
     const inputSchema = z.object({
         keyword_id: z.string().uuid("Invalid Keyword ID format."),
         swahili_word: z.string().trim().min(1, "Swahili word cannot be empty.").max(200),
         description: z.string().trim().max(1500).optional().nullable(),
     });
     const validation = inputSchema.safeParse(details);
     if (!validation.success) {
         return { error: formatCollabError("Invalid input for suggestion.", validation.error) };
     }

    try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatCollabError("User not authenticated.", userError || new Error('No user found'), 'AUTH_REQUIRED') };
        }

        const { data, error: dbError } = await client
            .from('collaborate_swalang_suggestions')
            .insert({
                keyword_id: validation.data.keyword_id,
                swahili_word: validation.data.swahili_word,
                description: validation.data.description || null,
                submitted_by: user.id
            })
            .select()
            .single();

        if (dbError) {
            // Handle potential FK violation on keyword_id
            if (dbError.code === '23503' && dbError.message.includes('collaborate_swalang_suggestions_keyword_id_fkey')) {
                 return { error: formatCollabError('Invalid keyword selected.', dbError, 'DB_FK_VIOLATION') };
             }
            return { error: formatCollabError(`Failed to create suggestion.`, dbError) };
        }
        // No complex validation needed here, return raw row or basic validated type
        return { data };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred creating suggestion.`, e as Error) };
    }
}

/**
 * Upserts (inserts or updates) a user's vote on a suggestion.
 */
export async function castVote(
    client: SupabaseClient<Database>,
    suggestionId: string,
    voteValue: 1 | -1 | 0 // 0 can mean delete/revoke vote
): Promise<{ error?: CollaborateError }> {

     const inputSchema = z.object({
         suggestionId: z.string().uuid("Invalid Suggestion ID."),
         voteValue: z.union([z.literal(1), z.literal(-1), z.literal(0)])
     });
     const validation = inputSchema.safeParse({ suggestionId, voteValue });
      if (!validation.success) {
         return { error: formatCollabError("Invalid input for voting.", validation.error) };
     }

    try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatCollabError("User not authenticated.", userError || new Error('No user found'), 'AUTH_REQUIRED') };
        }

        let dbError: PostgrestError | null = null;

        if (voteValue === 0) {
             // Delete the existing vote
             const { error } = await client
                .from('collaborate_swalang_suggestion_votes')
                .delete()
                .eq('suggestion_id', suggestionId)
                .eq('user_id', user.id);
             dbError = error;
        } else {
            // Insert or update the vote
            const { error } = await client
                .from('collaborate_swalang_suggestion_votes')
                .upsert(
                    {
                        suggestion_id: suggestionId,
                        user_id: user.id,
                        vote: voteValue as 1 | -1 // Type assertion after check
                    },
                    { onConflict: 'suggestion_id, user_id' } // Specify conflict target for upsert
                );
            dbError = error;
        }

        if (dbError) {
            // Handle potential FK violation etc.
             return { error: formatCollabError(`Failed to cast vote.`, dbError) };
        }

        return {}; // Success

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred while casting vote.`, e as Error) };
    }
}


// Add listKeywords (simplified for context selector)
export async function listAllKeywords(
    client: SupabaseClient<Database> = globalSupabaseClient,
    limit = 50 // Limit results in modal
): Promise<{ data?: Pick<Keyword, 'id' | 'english_keyword'>[], error?: CollaborateError }> {
    try {
        const { data, error: dbError } = await client
            .from('collaborate_swalang_keywords')
            .select('id, english_keyword')
            .order('english_keyword')
            .limit(limit);
        if (dbError) { /* handle error */ }
        // Basic validation if needed
        return { data };
    } catch (e) { /* handle error */ }
    return { data: [] }; // Default
}

// Add listAllSuggestions (simplified for context selector)
export async function listAllSuggestions(
    client: SupabaseClient<Database> = globalSupabaseClient,
    limit = 50
): Promise<{ data?: Pick<SuggestionRow, 'id' | 'swahili_word' | 'keyword_id'>[], error?: CollaborateError }> {
     try {
        const { data, error: dbError } = await client
            .from('collaborate_swalang_suggestions')
            .select('id, swahili_word, keyword_id') // Select minimal fields
            .order('created_at', { ascending: false }) // Show recent suggestions
            .limit(limit);
        if (dbError) { /* handle error */ }
        return { data };
    } catch (e) { /* handle error */ }
     return { data: [] }; // Default
}

// Add getSuggestionById (needed to get full description)
export async function getSuggestionById(
    client: SupabaseClient<Database> = globalSupabaseClient,
    suggestionId: string
): Promise<{ data?: SuggestionRow, error?: CollaborateError }> {
     if (!suggestionId) { /* handle error */ }
     try {
        const { data, error: dbError } = await client
            .from('collaborate_swalang_suggestions')
            .select('*')
            .eq('id', suggestionId)
            .maybeSingle();
        if (dbError) { /* handle error */ }
        if (!data) { return { error: formatCollabError('Suggestion not found.', null, 'NOT_FOUND') }; }
        // Basic validation if needed
        return { data };
    } catch (e) { /* handle error */ }
     return { error: formatCollabError('Unexpected error.', null) }; // Default
}

// --- Add functions for keywords, suggestions, votes later ---
// async function getCategoryById(client, id)...
// async function listKeywordsByCategory(client, categoryId)...
// async function createKeyword(client, details)...
// async function listSuggestionsByKeyword(client, keywordId)...
// async function createSuggestion(client, details)...
// async function addVote(client, suggestionId, voteValue)...
// async function getUserVote(client, suggestionId)...