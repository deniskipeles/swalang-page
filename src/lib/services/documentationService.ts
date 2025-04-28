// src/lib/services/documentationService.ts
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { z } from 'zod';
import { supabase as globalSupabaseClient } from '$lib/supabaseClient';

// --- Types & Schemas ---
type DocPageRow = Database['public']['Tables']['swalang_documentation_pages']['Row'];

// Schema for the data structure expected by the documentation page
export const docPageSchema = z.object({
    id: z.string().uuid(),
    slug: z.string(),
    title: z.string(),
    content_eng: z.string().nullable(),
    content_sw: z.string().nullable(),
    summary: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    created_by: z.string().uuid(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
    // Optionally include creator/editor info if needed later by joining public.profiles
});
export type DocPageData = z.infer<typeof docPageSchema>;

// Basic error formatting (reuse or adapt from other services)
export interface DocError { message: string; code?: string; details?: any; }
function formatDocError(message: string, error?: PostgrestError | Error | z.ZodError | null, code?: string): DocError {
     console.error(`Documentation Service Error: ${message}`, error);
     // Basic error formatting implementation...
     return { message, code: code || 'UNKNOWN_ERROR', details: error };
}


// --- Service Functions ---

/**
 * Retrieves a single documentation page by its unique slug.
 */
export async function getDocPageBySlug(
    client: SupabaseClient<Database> = globalSupabaseClient,
    slug: string
): Promise<{ data?: DocPageData, error?: DocError }> {
    if (!slug || typeof slug !== 'string' || slug.trim().length === 0) {
        return { error: formatDocError("Slug is required.", null, 'INVALID_INPUT') };
    }

    try {
        const { data, error: dbError } = await client
            .from('swalang_documentation_pages')
            .select('*') // Select all columns from the doc table
            .eq('slug', slug)
            .maybeSingle();

        if (dbError) {
            return { error: formatDocError(`Failed to retrieve documentation for slug '${slug}'.`, dbError) };
        }
        if (!data) {
            return { error: formatDocError(`Documentation not found for slug '${slug}'.`, null, 'NOT_FOUND') };
        }

        // Validate the fetched data
        const validation = docPageSchema.safeParse(data);
        if (!validation.success) {
            console.warn("Documentation page data validation failed", validation.error);
            return { data: data as DocPageData }; // Return potentially invalid data
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatDocError(`An unexpected error occurred retrieving documentation for slug '${slug}'.`, e as Error) };
    }
}

/**
 * Lists all documentation pages (e.g., for an index page).
 * Add filtering/pagination parameters as needed.
 */
export async function listDocPages(
    client: SupabaseClient<Database> = globalSupabaseClient,
    options?: { category?: string; limit?: number; offset?: number; searchTerm?: string }
): Promise<{ data?: Pick<DocPageData, 'slug' | 'title' | 'summary' | 'category'>[]; error?: DocError }> {
    try {
        let query = client
            .from('swalang_documentation_pages')
            .select('slug, title, summary, category')
            .order('category', { ascending: true })
            .order('title', { ascending: true });

        if (options?.category) {
            query = query.eq('category', options.category);
        }
        if (options?.limit !== undefined) {
            query = query.limit(options.limit);
        }
        if (options?.offset !== undefined) {
            query = query.range(options.offset, (options.offset + (options.limit || 10)) - 1);
        }
        if (options?.searchTerm) {
            query = query.textSearch('title', options.searchTerm, { type: 'plain' });
        }

        const { data, error: dbError } = await query;

        if (dbError) {
            return { error: formatDocError(`Failed to list documentation pages.`, dbError) };
        }

        // Validate fetched data
        const listSchema = z.array(z.object({
            slug: z.string(),
            title: z.string(),
            summary: z.string().nullable().optional(),
            category: z.string().nullable().optional(),
        }));

        const validation = listSchema.safeParse(data);
        if (!validation.success) {
            console.warn("Documentation list data validation failed", validation.error);
            return { data: data as any[] }; // Return possibly invalid data
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatDocError(`An unexpected error occurred listing documentation pages.`, e as Error) };
    }
}



// /**
//  * Lists documentation pages, optionally filtered by category and search term.
//  */
// export async function listDocPages(
//     client: SupabaseClient<Database> = globalSupabaseClient,
//     options?: {
//         category?: string;
//         searchTerm?: string; // Add search term
//         limit?: number;
//         offset?: number;
//     }
// ): Promise<{ data?: Pick<DocPageData, 'slug' | 'title' | 'summary' | 'category'>[], error?: DocError }> {
//     try {
//         let query = client
//             .from('swalang_documentation_pages')
//             .select('slug, title, summary, category') // Select only needed fields
//             .order('category') // Primary sort by category
//             .order('title'); // Secondary sort by title

//         // Apply category filter
//         if (options?.category && options.category !== 'all') { // Assume 'all' means no filter
//             query = query.eq('category', options.category);
//         }

//         // Apply search filter (basic search on title and summary)
//         if (options?.searchTerm && options.searchTerm.trim().length > 0) {
//             const searchTerm = options.searchTerm.trim();
//             // Use PostgREST 'or' filter with 'ilike' (case-insensitive)
//             // Note: For better performance on large datasets, consider Full-Text Search (FTS)
//             query = query.or(`title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%`);
//         }

//         // Apply limit/offset for pagination
//         if (options?.limit) {
//             query = query.limit(options.limit);
//         }
//         if (options?.offset) {
//              query = query.range(options.offset, options.offset + (options.limit || 50) - 1); // Use range for offset
//         }

//         const { data, error: dbError } = await query;

//          if (dbError) {
//             return { error: formatDocError(`Failed to list documentation pages.`, dbError) };
//         }

//         // Validation (Schema remains the same as before)
//         const listSchema = z.array(z.object({ /* ... as before ... */ }));
//         const validation = listSchema.safeParse(data);
//          if (!validation.success) { /* ... handle validation failure ... */ }

//         return { data: validation.data };

//     } catch (e) {
//          return { error: formatDocError(`An unexpected error occurred listing documentation pages.`, e as Error) };
//     }
// }

/**
 * Retrieves distinct categories used in documentation pages.
 */
export async function listDocCategories(
     client: SupabaseClient<Database> = globalSupabaseClient
): Promise<{ data?: string[], error?: DocError }> {
     try {
         // Use RPC call for distinct values for better performance potentially
         const { data, error: rpcError } = await client.rpc('get_distinct_doc_categories');

         // Fallback if RPC doesn't exist or fails (requires SELECT permission on table)
         // const { data, error: dbError } = await client
         //    .from('swalang_documentation_pages')
         //    .select('category', { count: 'exact', head: false }) // Select distinct categories
         //    .neq('category', null) // Exclude null categories
         //    .order('category');
         // const categories = data?.map(item => item.category).filter(Boolean) ?? [];


         if (rpcError) {
              // Log RPC error and potentially try the fallback SELECT query
              console.warn("RPC call 'get_distinct_doc_categories' failed, falling back to SELECT:", rpcError);
               const { data: selectData, error: dbError } = await client
                    .from('swalang_documentation_pages')
                    .select('category')
                    .neq('category', null)
                    .order('category');

                if(dbError) {
                    return { error: formatDocError(`Failed to list documentation categories.`, dbError) };
                }
                // Need to make distinct client-side if using simple select
                const distinctCategories = [...new Set(selectData?.map(item => item.category).filter(Boolean) as string[])].sort();
                return { data: distinctCategories };
         }

          // Ensure RPC result is an array of strings
          if (!Array.isArray(data) || !data.every(item => typeof item === 'string')) {
               console.error("RPC 'get_distinct_doc_categories' returned unexpected data format:", data);
                return { error: formatDocError("Invalid category data received.", null, 'INVALID_RESPONSE') };
          }

         return { data: data.sort() };

     } catch (e) {
         return { error: formatDocError(`An unexpected error occurred listing documentation categories.`, e as Error) };
     }
}

// --- Add DB function for distinct categories (Run this in SQL Editor) ---
/*
CREATE OR REPLACE FUNCTION public.get_distinct_doc_categories()
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT category
  FROM public.swalang_documentation_pages
  WHERE category IS NOT NULL
  ORDER BY category;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_distinct_doc_categories() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_distinct_doc_categories() TO anon; -- If anon users can see the list page

*/


/**
 * Creates a new documentation page.
 */
export async function createDocPage(
    client: SupabaseClient<Database>,
    details: {
        slug: string;
        title: string;
        category?: string | null;
        summary?: string | null;
        content_eng?: string | null;
        content_sw?: string | null;
    }
): Promise<{ data?: Pick<DocPageData, 'slug'>, error?: DocError }> { // Return just slug on success maybe

    // Validate input using Zod
     const inputSchema = z.object({
         slug: z.string().trim().min(1).max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format (lowercase, numbers, hyphens)."),
         title: z.string().trim().min(1).max(200),
         category: z.string().trim().max(100).optional().nullable(),
         summary: z.string().trim().max(500).optional().nullable(),
         content_eng: z.string().optional().nullable(),
         content_sw: z.string().optional().nullable(),
     });
     const validation = inputSchema.safeParse(details);
     if (!validation.success) {
         return { error: formatDocError("Invalid input for documentation page.", validation.error) };
     }

    try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatDocError("User not authenticated.", userError || new Error('No user found'), 'AUTH_REQUIRED') };
        }

        const { data, error: dbError } = await client
            .from('swalang_documentation_pages')
            .insert({
                slug: validation.data.slug,
                title: validation.data.title,
                category: validation.data.category || null,
                summary: validation.data.summary || null,
                content_eng: validation.data.content_eng || null,
                content_sw: validation.data.content_sw || null,
                created_by: user.id,
                last_edited_by: user.id // Set editor on creation too
            })
            .select('slug') // Select minimal data on success
            .single();

        if (dbError) {
             // Handle unique constraint violations (slug)
             if (dbError.code === '23505' && dbError.message.includes('swalang_documentation_pages_slug_unique')) {
                 return { error: formatDocError(`Slug "${validation.data.slug}" is already taken.`, dbError, 'DB_UNIQUE_VIOLATION') };
             }
            return { error: formatDocError(`Failed to create documentation page.`, dbError) };
        }

        return { data: { slug: data.slug } };

    } catch (e) {
        return { error: formatDocError(`An unexpected error occurred creating documentation page.`, e as Error) };
    }
}

/**
 * Updates an existing documentation page identified by its slug.
 */
export async function updateDocPage(
    client: SupabaseClient<Database>,
    slug: string, // Use slug to identify the page
    updates: { // Only allow updating certain fields
        title?: string;
        category?: string | null;
        summary?: string | null;
        content_eng?: string | null;
        content_sw?: string | null;
    }
): Promise<{ data?: Pick<DocPageData, 'slug'>, error?: DocError }> {

     // Validate input using Zod (make fields optional for update)
     const inputSchema = z.object({
         title: z.string().trim().min(1).max(200).optional(),
         category: z.string().trim().max(100).optional().nullable(),
         summary: z.string().trim().max(500).optional().nullable(),
         content_eng: z.string().optional().nullable(),
         content_sw: z.string().optional().nullable(),
     });
      // Filter out undefined values before parsing
     const definedUpdates = Object.fromEntries(Object.entries(updates).filter(([_, v]) => v !== undefined));
     const validation = inputSchema.safeParse(definedUpdates);
     if (!validation.success) {
         return { error: formatDocError("Invalid input for updating documentation page.", validation.error) };
     }
     // Ensure there's something to update
     if (Object.keys(validation.data).length === 0) {
          return { error: formatDocError("No changes provided.", null, 'NO_CHANGES') };
     }


    try {
         const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatDocError("User not authenticated.", userError || new Error('No user found'), 'AUTH_REQUIRED') };
        }

        // Prepare update payload, including setting the last editor
        const updatePayload: Partial<DocPageRow> = {
             ...validation.data,
             last_edited_by: user.id,
             // updated_at is handled by trigger
         };

        // Perform the update targeting the specific slug
        // RLS policy 'swalang_docs_update_editor' will enforce permissions
        const { data, error: dbError } = await client
            .from('swalang_documentation_pages')
            .update(updatePayload)
            .eq('slug', slug) // Target row by slug
            .select('slug') // Return slug on success
            .maybeSingle(); // Use maybeSingle in case RLS prevents update

        if (dbError) {
             // Handle potential errors (e.g., constraint violations if any applied on update)
            return { error: formatDocError(`Failed to update documentation page '${slug}'.`, dbError) };
        }
        if (!data) {
            // This likely means RLS prevented the update or the slug didn't exist
             return { error: formatCollabError(`Documentation page '${slug}' not found or update permission denied.`, null, 'NOT_FOUND_OR_DENIED') };
        }

        return { data: { slug: data.slug } };

    } catch (e) {
        return { error: formatCollabError(`An unexpected error occurred updating documentation page '${slug}'.`, e as Error) };
    }
}