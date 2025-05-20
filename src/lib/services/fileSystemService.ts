import { supabase } from '$lib/supabaseClient';
import { z } from 'zod';
import { customAlphabet } from 'nanoid'; // For generating URL-safe tokens
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types'; // Import generated types
import { supabase as globalSupabaseClient } from '$lib/supabaseClient';

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



// --- Types for Shares ---
export const fileShareSchema = z.object({
    id: z.string().uuid(),
    file_id: z.string().uuid(),
    user_id: z.string().uuid(),
    share_token: z.string(),
    title: z.string().max(250).nullable(),
    is_active: z.boolean(),
    expires_at: z.coerce.date().nullable(),
    created_at: z.coerce.date(),
});
export type FileShare = z.infer<typeof fileShareSchema>;

// nanoid for generating URL-friendly random strings
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 24); // 24 chars long

// --- Existing Service Functions ---
// ... (listFiles, createFile, getFile, updateFile, deleteFile, getFilePath) ...

// --- Share Link Functions ---

/**
 * Creates a share link for a file/folder.
 * If a share already exists for this file, it can either error or update it (e.g., reactivate).
 * This example creates a new one or errors if unique constraint `file_shares_file_id_unique` is active.
 */
export async function createFileShare(
    client: SupabaseClient<Database>, // Authenticated client of the file owner
    fileId: string,
    title?: string | null,
    expiresAt?: Date | null // Optional expiry
): Promise<{ data?: FileShare, error?: VfsError }> {
    // Basic validation for title
    if (title && title.trim().length > 250) {
        return { error: formatError("Share title is too long (max 250 characters).", null, 'VALIDATION_ERROR') };
    }
    if (title !== null && title !== undefined && title.trim().length === 0) {
        // If title is provided but empty after trimming, treat as null or error
        title = null; // Or return validation error: `return { error: formatError("Share title cannot be empty if provided.", ...)}`
    }
    try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatError("User not authenticated.", null, 'AUTH_REQUIRED') };
        }

        const shareToken = nanoid(); // Generate a unique share token

        const { data, error: dbError } = await client
            .from('file_shares')
            .insert({
                file_id: fileId,
                user_id: user.id, // Owner of the share is the current user
                share_token: shareToken,
                title: title || null,
                is_active: true,
                expires_at: expiresAt ? expiresAt.toISOString() : null
            })
            .select()
            .single();

        if (dbError) {
             // Handle unique constraint violation on file_id if you only allow one share per file
             if (dbError.code === '23505' && dbError.message.includes('file_shares_file_id_unique')) {
                //  return { error: formatError("A share link already exists for this file. Manage existing link.", dbError, 'SHARE_EXISTS')};
                 console.warn("A share link already exists for this file. Manage existing link.", dbError, 'SHARE_EXISTS');
             }
             // get the existing data
             const { data: existingData, error: existingError } = await client.from('file_shares').select().eq('file_id', fileId).maybeSingle();
            //  console.log(existingError,existingData)
             const validation_existingData = fileShareSchema.safeParse(existingData);
             if (validation_existingData) {
                return { data: validation_existingData.data, error_: formatError("A share link already exists for this file. Manage existing link.", dbError, 'SHARE_EXISTS') };
             }
            return { error: formatError("Failed to create share link.", dbError) };
        }
        const validation = fileShareSchema.safeParse(data);
        if(!validation.success) return { error: formatError("Invalid share data from DB.", validation.error, 'INVALID_RESPONSE')};
        return { data: validation.data };

    } catch (e) {
        return { error: formatError("An unexpected error occurred creating share link.", e as Error) };
    }
}

/**
 * Retrieves a share link record by its token.
 * This is used internally or by share management UI, not for public access directly.
 */
export async function getShareByToken(
    client: SupabaseClient<Database>, // Can be unauthenticated if RLS allows
    shareToken: string
): Promise<{ data?: FileShare, error?: VfsError }> {
    try {
        const { data, error: dbError } = await client
            .from('file_shares')
            .select('*')
            .eq('share_token', shareToken)
            .eq('is_active', true) // Only get active shares
            // Optionally add: .gt('expires_at', new Date().toISOString()) if not handled by RLS already
            .maybeSingle();

        if (dbError) return { error: formatError("Failed to get share link by token.", dbError) };
        if (!data) return { error: formatError("Share link not found, inactive, or expired.", null, 'NOT_FOUND') };

        const validation = fileShareSchema.safeParse(data);
        if(!validation.success) return { error: formatError("Invalid share data from DB.", validation.error, 'INVALID_RESPONSE')};
        return { data: validation.data };
    } catch (e) { return { error: formatError("Error getting share by token.", e as Error) }; }
}

/**
 * Fetches a publicly shared file/folder and its children (if folder) using a share token.
 * This uses the global unauthenticated client by default for the actual file access,
 * relying on the modified RLS on `public.files`.
 */
export async function getSharedFileOrFolderByToken(
    shareToken: string,
    // For listing children of a shared folder, parentId within the shared context
    sharedContextParentId: string | null = null
): Promise<{
    shareInfo?: FileShare; // Info about the share link itself
    fileNode?: FileNode;   // The root shared file/folder
    children?: FileNode[]; // Children if it's a folder and we are listing them
    error?: VfsError;
}> {
    // 1. Validate the share token and get share + root file_id
    const { data: shareInfo, error: shareError } = await getShareByToken(globalSupabaseClient, shareToken);
    if (shareError || !shareInfo) {
        return { error: shareError || formatError("Invalid or expired share link.", null, 'SHARE_INVALID') };
    }

    // 2. Get the root shared file/folder info
    // This query will pass because of the RLS policy on `files` checking `is_file_publicly_shared_or_descendant`
    const { data: rootFileNode, error: rootFileError } = await getFile(globalSupabaseClient,shareInfo.file_id); // Uses globalSupabaseClient, RLS applies
    if (rootFileError || !rootFileNode) {
        return { shareInfo, error: rootFileError || formatError("Shared file not found.", null, 'NOT_FOUND') };
    }

    // 3. If it's a folder and we are listing its children within the shared context
    let children: FileNode[] | undefined;
    let childrenError: VfsError | undefined;

    // The 'sharedContextParentId' determines what level we are listing.
    // If null, we list children of the root shared folder.
    // If not null, it's an ID of a subfolder *within* the shared structure.
    const parentToList = sharedContextParentId === null ? (rootFileNode.is_folder ? rootFileNode.id : null) : sharedContextParentId;

    if (parentToList) {
        // RLS policy on `files` should allow this if parentToList is a descendant of a shared item.
        const { data: childNodes, error: listError } = await listFiles(
            globalSupabaseClient, // Use unauthenticated client for public access
            parentToList
        );
        children = childNodes;
        childrenError = listError as VfsError; // Cast for type consistency
    }

    if(childrenError) {
        console.warn("Error listing children of shared folder:", childrenError);
        // Decide if this is a critical error for the whole page
    }
    // console.log(children?.length,children?.[0]?.name)

    return { shareInfo, fileNode: rootFileNode, children, error: childrenError };
}


/**
 * Deactivates a share link (or deletes the record).
 */
export async function deactivateShare(
    client: SupabaseClient<Database>, // Authenticated client of the share owner
    shareId: string // The ID of the file_shares record
): Promise<{ error?: VfsError }> {
    try {
        // RLS on file_shares ensures only owner can do this
        const { error: dbError } = await client
            .from('file_shares')
            .update({ is_active: false, expires_at: new Date().toISOString() }) // Or .delete()
            .eq('id', shareId);
            // .eq('user_id', user.id); // Redundant if RLS is correct

        if (dbError) return { error: formatError("Failed to deactivate share.", dbError) };
        return {};
    } catch (e) { return { error: formatError("Error deactivating share.", e as Error) }; }
}


// --- Type for Listed Shared Item ---
export const sharedFileListItemSchema = z.object({
    share_token: z.string(),
    share_title: z.string().nullable(), // Title from file_shares table
    file_name: z.string(),             // Name from files table
    file_is_folder: z.boolean(),      // is_folder from files table
    shared_at: z.coerce.date(),       // created_at from file_shares table
    // Optionally add original file creator's username if joining profiles
    // owner_username: z.string().nullable().optional(),
});
export type SharedFileListItem = z.infer<typeof sharedFileListItemSchema>;

/**
 * Lists recently created, active, and non-expired share links.
 * Includes the shared file's name and type.
 */
export async function listRecentPublicShares(
    client: SupabaseClient<Database> = globalSupabaseClient, // Can use unauthenticated client
    limit: number = 5
): Promise<{ data?: SharedFileListItem[], error?: VfsError }> {
    try {
        const { data, error: dbError } = await client
            .from('file_shares')
            .select(`
                share_token,
                title,
                shared_at:created_at,
                file:files!inner (
                    name,
                    is_folder
                )
                `)
                // Optional: Join with profiles to get sharer's username
                // sharer_profile:user_id!inner ( username )
            .eq('is_active', true) // Only active shares
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`) // Not expired or no expiry
            .order('created_at', { ascending: false }) // Most recent shares first
            .limit(limit);

        if (dbError) {
            // Handle potential error if 'files' join via 'file_shares_file_id_fkey' isn't found by PostgREST
            if (dbError.message.includes("relationship") && dbError.message.includes("'files'")) {
                 console.error("PostgREST schema cache might be stale. Try reloading schema in Supabase dashboard -> API settings. Error:", dbError);
                 return { error: formatError("Database relationship error fetching recent shares. Please try again later.", dbError, 'DB_RELATIONSHIP_ERROR')};
            }
            return { error: formatError("Failed to list recent shares.", dbError) };
        }
        if (!data) {
            return { data: [] }; // No recent shares found
        }

        // Map data to the expected structure
        const mappedData: SharedFileListItem[] = data.map(item => ({
            share_token: item.share_token,
            share_title: item.title, // Title from the share record
            file_name: (item.file as { name: string, is_folder: boolean } | null)?.name || 'Unknown File',
            file_is_folder: (item.file as { name: string, is_folder: boolean } | null)?.is_folder || false,
            shared_at: new Date(item.shared_at), // Already aliased 'created_at' as 'shared_at'
            // owner_username: (item.sharer_profile as { username: string } | null)?.username,
        }));

        // Validate with Zod
        const validation = z.array(sharedFileListItemSchema).safeParse(mappedData);
        if (!validation.success) {
            console.warn("Recent shares list validation failed", validation.error);
            return { data: mappedData }; // Return potentially invalid data
        }

        return { data: validation.data };

    } catch (e) {
        return { error: formatError("An unexpected error occurred listing recent shares.", e as Error) };
    }
}