import { supabase } from '$lib/supabaseClient';
import { z } from 'zod';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types'; // Import generated types

// Generate DB types (run this command after setting up supabase CLI and linking)
// npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > src/lib/database.types.ts
// Make sure to replace YOUR_PROJECT_REF or configure it in supabase/config.toml

// Define the Zod schema based on the Database types for stronger typing and potential runtime validation
// Use the generated 'Row' type for 'files' table
type FileRow = Database['public']['Tables']['files']['Row'];

export const fileSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    name: z.string().min(1).max(255).regex(/^[^/]+$/, "Name cannot contain '/'"),
    content: z.string().nullable(),
    is_folder: z.boolean(),
    parent_id: z.string().uuid().nullable(),
    // Use z.coerce.date() to parse the string into a Date object
    created_at: z.coerce.date(), // Changed from z.string().datetime()
    updated_at: z.coerce.date(), // Changed from z.string().datetime()
}).refine(data => data.is_folder ? data.content === null : true, {
    message: "Folders cannot have content.",
    path: ["content"],
});


export type FileNode = z.infer<typeof fileSchema>;

// Define a structured error type for better error handling upstream
export interface VfsError {
    message: string;
    code?: string; // e.g., 'DB_UNIQUE_VIOLATION', 'DB_CYCLE_DETECTED', 'NETWORK_ERROR', 'VALIDATION_ERROR'
    details?: string | PostgrestError | Error; // Original error details
}

// Helper function to format errors
function formatError(message: string, error?: PostgrestError | Error | null, code?: string): VfsError {
    console.error(`VFS Error: ${message}`, error);
    let details: string | PostgrestError | Error | undefined;
    let errorCode = code;

    if (error) {
        details = error;
        // Try to map Postgrest errors to specific codes
        if(error && 'code' in error) {
             const pgError = error as PostgrestError;
             if (pgError.code === '23505') errorCode = errorCode || 'DB_UNIQUE_VIOLATION'; // unique_violation
             if (pgError.message.includes('Circular reference detected')) errorCode = errorCode || 'DB_CYCLE_DETECTED';
             if (pgError.message.includes('Maximum folder depth exceeded')) errorCode = errorCode || 'DB_DEPTH_EXCEEDED';
             if (pgError.code === 'PGRST301' || pgError.code === '42501') errorCode = errorCode || 'DB_PERMISSION_DENIED'; // RLS issue
        }
    }

    return {
        message,
        code: errorCode || 'UNKNOWN_ERROR',
        details
    };
}

// --- CRUD Operations ---
// Note: We don't pass user_id explicitly to SELECT/UPDATE/DELETE
// as RLS handles filtering based on the authenticated user making the request via `supabase` client.
// For INSERT, RLS `WITH CHECK` uses `auth.uid()` automatically.

/**
 * Lists files and folders within a given parent folder (or root if parentId is null).
 * Implements cursor-based pagination based on folder status and name.
 */
export async function listFiles(
    // Allow passing a specific Supabase client instance (useful for server-side auth)
    client: SupabaseClient<Database> = supabase,
    parentId: string | null = null,
    cursor?: { name: string, is_folder: boolean } | null,
    limit: number = 50
): Promise<{ data?: FileNode[], error?: VfsError, nextCursor?: { name: string, is_folder: boolean } | null }> {

    try {
        let query = client
            .from('files')
            .select('*');

        // Apply parent_id filter
        if (parentId === null) {
            query = query.is('parent_id', null);
        } else {
            query = query.eq('parent_id', parentId);
        }

        // Apply cursor pagination
        // We order by is_folder DESC, name ASC.
        // The cursor needs to match this order.
        if (cursor) {
            // If cursor was a folder, find items that are either:
            // - Folders with name > cursor.name
            // - Files (is_folder = false), regardless of name (since files come after folders)
            // If cursor was a file, find items that are:
            // - Files with name > cursor.name
            if(cursor.is_folder) {
                query = query.or(`and(is_folder.eq.true,name.gt.${cursor.name}),is_folder.eq.false`);
            } else {
                 query = query.or(`and(is_folder.eq.false,name.gt.${cursor.name})`);
                 // No need to filter by is_folder.eq.false explicitly if it was the last folder already
            }

            // Alternative simpler cursor logic (might be less efficient on large dirs): Fetch limit+1 and use offset logic client side or just sort/filter in query
            // query = query.gt('name', cursor); // Simpler, but less accurate with mixed types
        }

        // Consistent Ordering: Folders first, then alphabetically by name
        query = query.order('is_folder', { ascending: false })
                     .order('name', { ascending: true })
                     .limit(limit);

        const { data, error: dbError } = await query;

        if (dbError) {
            return { error: formatError("Failed to list files.", dbError, dbError.code) };
        }

        // Validate data structure (optional, mostly for type safety)
        const validation = z.array(fileSchema).safeParse(data);
        if (!validation.success) {
            console.warn("VFS listFiles response validation failed:", validation.error);
            // Decide how to handle validation errors - return partial data, or an error?
            // For now, return potentially invalid data but log it.
        }
        const validatedData = validation.success ? validation.data : data as FileNode[]; // Use validated or raw data

        // Determine the next cursor
        let nextCursor: { name: string, is_folder: boolean } | null = null;
        if (validatedData && validatedData.length === limit) {
            const lastItem = validatedData[validatedData.length - 1];
            nextCursor = { name: lastItem.name, is_folder: lastItem.is_folder };
        }

        return { data: validatedData, nextCursor };

    } catch (e) {
        return { error: formatError("An unexpected error occurred while listing files.", e as Error) };
    }
}

/**
 * Creates a new file or folder.
 */
export async function createFile(
    client: SupabaseClient<Database> = supabase,
    details: {
        name: string,
        content?: string | null, // Optional content for files
        is_folder: boolean,
        parent_id: string | null
        user_id: string | null
    }
): Promise<{ data?: FileNode, error?: VfsError }> {

     // Basic validation before hitting DB
    if (!details.name || details.name.includes('/') || details.name.length > 255) {
        return { error: formatError("Invalid name provided.", null, 'VALIDATION_ERROR') };
    }
    if (details.is_folder && details.content != null) { // Note strict null check
        return { error: formatError("Folders cannot have content.", null, 'VALIDATION_ERROR') };
    }
    // Allow empty string content for files, ensure null for folders
    const contentToInsert = details.is_folder ? null : (details.content ?? '');
    const {data, error: sessionError} = await client.auth.getSession()
    if (data.session) {
        details.user_id = data.session.user.id;
    }
    try {
        const { data, error: dbError } = await client
            .from('files')
            .insert({
                name: details.name.trim(), // Trim whitespace
                content: contentToInsert,
                is_folder: details.is_folder,
                parent_id: details.parent_id,
                user_id:details.user_id
                // user_id is handled by RLS policy check: (auth.uid() = user_id)
            })
            .select()
            .single(); // Expecting a single row back

        if (dbError) {
            // Specific error handling based on DB constraints/triggers
            return { error: formatError(`Failed to create '${details.name}'.`, dbError, dbError.code) };
        }

        // Validate the returned data
        const validation = fileSchema.safeParse(data);
        if (!validation.success) {
            return { error: formatError("Created file data is invalid.", validation.error, 'INVALID_RESPONSE') };
        }

        return { data: validation.data };

    } catch (e) {
         return { error: formatError(`An unexpected error occurred creating '${details.name}'.`, e as Error) };
    }
}

/**
 * Retrieves a single file or folder by its ID.
 */
export async function getFile(
     client: SupabaseClient<Database> = supabase,
     id: string
): Promise<{ data?: FileNode, error?: VfsError }> {
    try {
        const { data, error: dbError } = await client
            .from('files')
            .select('*')
            .eq('id', id)
            // RLS applies automatically
            .maybeSingle(); // Use maybeSingle to handle not found or no access gracefully

        if (dbError) {
             return { error: formatError(`Failed to retrieve file ${id}.`, dbError, dbError.code) };
        }
        if (!data) {
            // Could be Not Found or RLS Permission Denied - RLS usually returns empty, not error
             return { error: formatError(`File not found or access denied (ID: ${id}).`, null, 'NOT_FOUND_OR_DENIED') };
        }

         // Validate the returned data
        const validation = fileSchema.safeParse(data);
        if (!validation.success) {
            return { error: formatError("Received file data is invalid.", validation.error, 'INVALID_RESPONSE') };
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatError(`An unexpected error occurred retrieving file ${id}.`, e as Error) };
    }
}

/**
 * Updates an existing file or folder (name, content, parent_id).
 */
export async function updateFile(
    client: SupabaseClient<Database> = supabase,
    id: string,
    updates: Partial<Pick<FileNode, 'name' | 'content' | 'parent_id'>>
): Promise<{ data?: FileNode, error?: VfsError }> {

    // Basic validation before hitting DB
    if (updates.name !== undefined && (!updates.name || updates.name.includes('/') || updates.name.length > 255)) {
        return { error: formatError("Invalid name provided.", null, 'VALIDATION_ERROR') };
    }
     if (updates.parent_id !== undefined && updates.parent_id === id) {
        return { error: formatError("Cannot move a folder inside itself.", null, 'VALIDATION_ERROR') };
    }

    // We don't need to validate content based on is_folder here,
    // because we assume is_folder is NOT changing in this update function.
    // If changing file<->folder status is needed, a separate function or logic is required.
    // The handle_updated_at trigger updates `updated_at`.

    try {
        const updatePayload: Partial<Database['public']['Tables']['files']['Update']> = { ...updates };
        if (updates.name) updatePayload.name = updates.name.trim();


        const { data, error: dbError } = await client
            .from('files')
            .update(updatePayload)
            .eq('id', id)
            // RLS USING clause ensures user owns the file they are trying to update.
            // RLS WITH CHECK clause prevents changing user_id.
            .select()
            .single();

        if (dbError) {
            // Handle specific errors from triggers (cycle, depth) or constraints (unique name)
            return { error: formatError(`Failed to update file ${id}.`, dbError, dbError.code) };
        }

        // Validate the returned data
        const validation = fileSchema.safeParse(data);
        if (!validation.success) {
            return { error: formatError("Updated file data is invalid.", validation.error, 'INVALID_RESPONSE') };
        }

        return { data: validation.data };

    } catch (e) {
         return { error: formatError(`An unexpected error occurred updating file ${id}.`, e as Error) };
    }
}

/**
 * Deletes a file or folder by its ID.
 * Note: ON DELETE CASCADE in the DB handles deleting children automatically.
 */
export async function deleteFile(
    client: SupabaseClient<Database> = supabase,
    id: string
): Promise<{ error?: VfsError }> {
    try {
        const { error: dbError } = await client
            .from('files')
            .delete()
            .eq('id', id);
            // RLS USING clause ensures user owns the file they are trying to delete.

        if (dbError) {
             return { error: formatError(`Failed to delete file ${id}.`, dbError, dbError.code) };
        }

        // Success, no data to return on delete
        return {};

    } catch (e) {
        return { error: formatError(`An unexpected error occurred deleting file ${id}.`, e as Error) };
    }
}

/**
 * Retrieves the full path string for a given file/folder ID.
 * Example: /folderA/folderB/file.txt
 * This requires recursive calls or a Common Table Expression (CTE) query.
 * Note: This might be slow for deeply nested files if done purely client-side via multiple getFile calls.
 * A dedicated DB function or server-side implementation is often better.
 */
export async function getFilePath(
    client: SupabaseClient<Database> = supabase,
    fileId: string
): Promise<{ path?: string, error?: VfsError }> {
    try {
        // Use Supabase RPC to call a database function for efficiency
        const { data, error: rpcError } = await client.rpc('get_file_path', { target_file_id: fileId });

        if (rpcError) {
             return { error: formatError(`Failed to get file path for ${fileId}.`, rpcError, rpcError.code) };
        }
        if (typeof data !== 'string') {
             return { error: formatError(`Invalid path received for ${fileId}.`, new Error('RPC returned non-string'), 'INVALID_RESPONSE') };
        }

        return { path: data };

    } catch (e) {
         return { error: formatError(`An unexpected error occurred getting path for ${fileId}.`, e as Error) };
    }
}

// --- Database Function for getFilePath ---
/* Add this function to your Supabase SQL editor or a new migration:

CREATE OR REPLACE FUNCTION public.get_file_path(target_file_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE -- Indicates the function cannot modify the database
SECURITY DEFINER -- Necessary to potentially bypass RLS during path traversal if needed, ensure logic is safe
AS $$
  WITH RECURSIVE file_path AS (
    -- Base case: the starting file/folder
    SELECT id, parent_id, name
    FROM public.files
    WHERE id = target_file_id
      -- Ensure the requesting user owns the target file (apply RLS check here)
      AND auth.uid() = user_id

    UNION ALL

    -- Recursive step: join with parent
    SELECT f.id, f.parent_id, f.name
    FROM public.files f
    JOIN file_path fp ON f.id = fp.parent_id
      -- RLS is implicitly handled by the base case, no need to re-check auth.uid() here
      -- unless you want to ensure ownership of all parent folders (might be too restrictive)
  )
  -- Aggregate the names into a path string
  SELECT '/' || string_agg(name, '/' ORDER BY file_path.id = target_file_id DESC, file_path.parent_id NULLS FIRST)
  FROM file_path;
$$;

-- Note: The ORDER BY in string_agg might need adjustment depending on how you want the path constructed.
-- This version attempts to put the target file's name last. Building the path correctly often involves
-- reversing the order collected from the CTE. A plpgsql version might offer more control.

-- Simpler plpgsql version (often easier to reason about path construction):
CREATE OR REPLACE FUNCTION public.get_file_path(target_file_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER -- Check implications carefully
AS $$
DECLARE
    result_path TEXT := '';
    current_name TEXT;
    current_parent_id UUID := target_file_id;
    current_user_id UUID;
    requesting_user_id UUID := auth.uid();
BEGIN
    -- Check if the target file exists and belongs to the user first
    SELECT user_id INTO current_user_id FROM public.files WHERE id = target_file_id;
    IF NOT FOUND OR current_user_id != requesting_user_id THEN
       RETURN NULL; -- Or raise an exception 'Permission denied or file not found'
    END IF;

    LOOP
        SELECT name, parent_id
        INTO current_name, current_parent_id
        FROM public.files
        WHERE id = current_parent_id;

        IF NOT FOUND THEN
            EXIT; -- Should not happen if starting from a valid ID, but safety check
        END IF;

        result_path := '/' || current_name || result_path;

        IF current_parent_id IS NULL THEN
            EXIT; -- Reached the root
        END IF;

         -- Optional: Check if user owns parent? Generally not needed if initial check is done.
         -- SELECT user_id INTO current_user_id FROM public.files WHERE id = current_parent_id;
         -- IF current_user_id != requesting_user_id THEN RAISE EXCEPTION 'Access denied to parent folder'; END IF;

    END LOOP;

    -- Handle root case (if path is empty, means it was a root file)
    IF result_path = '' THEN
        SELECT '/' || name INTO result_path FROM public.files WHERE id = target_file_id;
    END IF;


    RETURN result_path;
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_file_path(UUID) TO authenticated;

*/