// src/routes/app/profile/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z, ZodError } from 'zod';
import { getProfile, updateProfile } from '$lib/services/profileService';
import type { Profile } from '$lib/services/profileService';

// Validation schema for profile update form
const profileUpdateSchema = z.object({
  username: z.string().trim().min(3, "Username must be 3-50 characters.").max(50)
             .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores.")
             .optional().or(z.literal('')), // Allow empty string to clear, will be set to null
  full_name: z.string().trim().max(150, "Full name too long.").optional().or(z.literal('')),
  avatar_url: z.string().trim().url("Must be a valid URL.").max(512).optional().or(z.literal('')),
  website: z.string().trim().url("Must be a valid URL.").max(255).optional().or(z.literal('')),
});

export const load: PageServerLoad = async (event) => {
    const { locals: { supabase, safeGetSession:getSession } } = event;
    const session = await getSession();

    if (!session) {
        throw redirect(303, '/auth/login?redirectTo=/app/profile');
    }

    // Fetch the current user's profile
    const { data: profile, error } = await getProfile(supabase, session?.user?.id);

    if (error && error.code !== 'NOT_FOUND') { // Allow NOT_FOUND as trigger might not have run yet for new user
        console.error("Error loading profile:", error);
        // Display error on page, don't throw svelteKitError to allow page rendering
    }

    return {
        profile: profile || null, // Pass profile data (or null if not found)
        profileError: error?.message || null,
        session // Needed for layout
    };
};

export const actions: Actions = {
    updateProfile: async (event) => {
        const { request, locals: { supabase, safeGetSession: getSession } } = event;
        const session = await getSession();

        if (!session) {
            return fail(401, { error: 'You must be logged in to update your profile.' });
        }

        const formData = await request.formData();
        const formDataObj = Object.fromEntries(formData);

        try {
            const validatedData = profileUpdateSchema.parse(formDataObj);

            const updatesToApply: Partial<Profile> = {};
            if (validatedData.username !== undefined) updatesToApply.username = validatedData.username || null; // Convert empty string to null if desired
            if (validatedData.full_name !== undefined) updatesToApply.full_name = validatedData.full_name || null;
            if (validatedData.avatar_url !== undefined) updatesToApply.avatar_url = validatedData.avatar_url || null;
            if (validatedData.website !== undefined) updatesToApply.website = validatedData.website || null;


            if (Object.keys(updatesToApply).length === 0) {
                return fail(400, { ...formDataObj, error: "No changes submitted." });
            }

            const { data: updatedProfile, error } = await updateProfile(supabase, updatesToApply);

            if (error) {
                return fail(400, { ...formDataObj, error: error.message, errorCode: error.code });
            }

            // Success! The load function will re-fetch or you can return updated profile
            return { success: true, message: "Profile updated successfully!", updatedProfile };

        } catch (err) {
            if (err instanceof ZodError) {
                const errors = err.flatten().fieldErrors;
                return fail(400, { ...formDataObj, errors });
            }
            console.error("Unexpected error updating profile:", err);
            return fail(500, { ...formDataObj, error: 'An unexpected server error occurred.' });
        }
    }
};