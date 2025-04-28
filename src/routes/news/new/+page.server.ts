import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z, ZodError } from 'zod';
import { createNewsArticle } from '$lib/services/contentService';

// Schema for form validation
const newsSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(250),
    slug: z.string().trim().min(1, 'Slug is required').max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
    summary: z.string().trim().max(600).optional(),
    content: z.string().optional(),
    featured_image_url: z.string().url('Invalid URL').max(512).optional().or(z.literal('')),
    is_published: z.enum(['on']).optional(), // Checkbox value is 'on' or undefined
    published_at: z.string().optional(), // Sent as string from datetime-local
});

export const load: PageServerLoad = async ({ locals }) => {
    // Require login to access creation page
    const { session } = await locals.safeGetSession();
    if (!session) {
        throw redirect(303, '/auth/login?redirectTo=/news/new');
    }
    // TODO: Add role check here if needed
    return {}; // No data needed to load the form initially
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        const { supabase } = locals;
        const { session } = await locals.safeGetSession();
        if (!session) return fail(401, { error: 'Unauthorized' });
        // TODO: Add role check here

        const formData = await request.formData();
        const formDataObj = Object.fromEntries(formData);

        try {
            const validatedData = newsSchema.parse(formDataObj);

            const { data: result, error } = await createNewsArticle(supabase, {
                ...validatedData,
                featured_image_url: validatedData.featured_image_url || null, // Handle empty string
                summary: validatedData.summary || null,
                content: validatedData.content || null,
                is_published: !!validatedData.is_published, // Convert 'on' to boolean
                published_at: validatedData.published_at || null // Handle empty string
            });

            if (error) {
                return fail(400, { ...formDataObj, error: error.message, errorCode: error.code });
            }
            if (result?.slug) {
                throw redirect(303, `/news/${result.slug}`);
            } else {
                // Should not happen on success
                return fail(500, { ...formDataObj, error: 'Failed to create article, slug not returned.' });
            }

        } catch (err) {
            if (err instanceof ZodError) {
                return fail(400, { ...formDataObj, errors: err.flatten().fieldErrors });
            }
            console.error("Unexpected error creating news:", err);
            return fail(500, { ...formDataObj, error: 'Server error.' });
        }
    }
};