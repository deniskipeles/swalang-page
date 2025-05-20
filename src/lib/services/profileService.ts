// src/lib/services/profileService.ts
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { z } from 'zod';
import { supabase as globalSupabaseClient } from '$lib/supabaseClient';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Zod schema for profile data (adjust fields as per your profiles table)
export const profileSchema = z.object({
    id: z.string().uuid(),
    username: z.string().min(3, "Username too short").max(50, "Username too long")
               .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.")
               .nullable().optional(), // Make optional for initial load if not set
    full_name: z.string().max(150, "Full name too long.").nullable().optional(),
    avatar_url: z.string().url("Invalid avatar URL.").max(512).nullable().optional(),
    website: z.string().url("Invalid website URL.").max(255).nullable().optional(),
    updated_at: z.coerce.date().optional(), // Optional because we only care on fetch
    // Add other fields from your profiles table
});
export type Profile = z.infer<typeof profileSchema>;

// Error handling
export interface ProfileError { message: string; code?: string; details?: any; }
function formatProfileError(message: string, error?: any, code?: string): ProfileError {
    console.error(`Profile Service Error: ${message}`, error);
    // Basic error formatting implementation...
    return { message, code: code || 'PROFILE_ERROR', details: error };
}

/**
 * Retrieves the profile for a given user ID (or the current user if id is null).
 */
export async function getProfile(
    client: SupabaseClient<Database> = globalSupabaseClient,
    userId?: string | null // If null, tries to get current user's profile
): Promise<{ data?: Profile, error?: ProfileError }> {
    try {
        let targetUserId = userId;
        if (!targetUserId) {
            const { data: { user } } = await client.auth.getUser();
            if (!user) return { error: formatProfileError("User not authenticated to fetch own profile.", null, 'AUTH_REQUIRED') };
            targetUserId = user.id;
        }

        const { data, error: dbError } = await client
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .maybeSingle(); // Use maybeSingle as profile might not exist yet for a new user

        if (dbError) return { error: formatProfileError("Failed to retrieve profile.", dbError) };
        // if (!data) return { error: formatProfileError("Profile not found.", null, 'NOT_FOUND') }; // Handled below

        // Validate even if data is null (Zod will pass if fields are optional)
        const validation = profileSchema.safeParse(data);
        if (!validation.success) {
            console.warn("Get profile validation failed", validation.error);
            // For a non-existent profile, data will be null, parsing will likely fail if fields are not optional.
            // The trigger should create a profile, but handle this defensively.
            if (!data) return { data: undefined }; // No profile exists, return undefined data not error
            return { data: data as Profile }; // Return potentially invalid but existing data
        }
        return { data: validation.data };

    } catch (e) { return { error: formatProfileError("Unexpected error retrieving profile.", e as Error) }; }
}


/**
 * Updates the current authenticated user's profile.
 * RLS on 'profiles' table handles permission (user can only update their own).
 */
export async function updateProfile(
    client: SupabaseClient<Database>, // Must be authenticated client
    updates: Partial<Pick<Profile, 'username' | 'full_name' | 'avatar_url' | 'website'>>
): Promise<{ data?: Profile, error?: ProfileError }> {

    // Validate input fields that are being updated
    const updateSchema = profileSchema.pick({ // Only validate fields we intend to update
        username: true, full_name: true, avatar_url: true, website: true
    }).partial(); // Make all fields optional for partial update

    const validation = updateSchema.safeParse(updates);
    if (!validation.success) {
        return { error: formatProfileError("Invalid profile update data.", validation.error, 'VALIDATION_ERROR') };
    }
    if (Object.keys(validation.data).length === 0) {
        return { error: formatProfileError("No changes provided for profile update.", null, 'NO_CHANGES') };
    }

    try {
        const { data: { user } } = await client.auth.getUser();
        if (!user) return { error: formatProfileError("User not authenticated.", null, 'AUTH_REQUIRED') };

        // Prepare updates: filter out undefined values and ensure null for empty strings for optional fields
        const cleanUpdates: Record<string, any> = {};
        for (const key in validation.data) {
            const typedKey = key as keyof typeof validation.data;
            if (validation.data[typedKey] !== undefined) {
                 cleanUpdates[typedKey] = (validation.data[typedKey] === '' && (typedKey === 'avatar_url' || typedKey === 'website' || typedKey === 'full_name'))
                     ? null
                     : validation.data[typedKey];
            }
        }
        // Add updated_at, though trigger handles this too
        cleanUpdates.updated_at = new Date().toISOString();


        const { data, error: dbError } = await client
            .from('profiles')
            .update(cleanUpdates)
            .eq('id', user.id) // RLS also enforces this
            .select()
            .single(); // Expect one row updated

        if (dbError) {
            if (dbError.code === '23505' && dbError.message.includes('profiles_username_key') || dbError.message.includes('profiles_username_unique')) {
                 return { error: formatProfileError(`Username "${updates.username}" is already taken.`, dbError, 'USERNAME_TAKEN') };
            }
            return { error: formatProfileError("Failed to update profile.", dbError) };
        }
        if (!data) { // Should not happen if RLS and user.id are correct, unless profile deleted race condition
            return { error: formatProfileError("Profile not found or update failed unexpectedly.", null, 'UPDATE_FAILED') };
        }

        const responseValidation = profileSchema.safeParse(data);
        if(!responseValidation.success) { /* ... handle ... */ }
        return { data: responseValidation.data };

    } catch (e) { return { error: formatProfileError("Unexpected error updating profile.", e as Error) }; }
}
