// src/routes/swalang/+layout.server.ts
import type { LayoutServerLoad } from './$types';
import { listCategories } from '$lib/services/swahiliCollaborationService';
// No need to throw error from here, let page handle display if categories fail to load

export const load: LayoutServerLoad = async (event) => {
    const { locals: { supabase, safeGetSession: getSession } } = event; // Use getSession, not safeGetSession if from auth-helpers

    const session = await getSession(); // Get session to pass to layout

    // Fetch categories using the server's supabase client (respects RLS for listCategories)
    // If listCategories RLS is 'USING (true)' or 'USING (auth.role() = 'anon')', this works for all users.
    const { data: categories, error } = await listCategories(supabase);

    if (error) {
        console.error("Error loading categories for layout:", error);
        // Return error to layout, components can handle it
    }

    return {
        categories: categories || [],
        categoriesError: error?.message || null,
        session: session // Pass session for UI conditionals
    };
};