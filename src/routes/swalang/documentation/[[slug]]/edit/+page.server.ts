// src/routes/swalang/documentation/[[slug]]/edit/+page.server.ts
import { error as svelteKitError, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z, ZodError } from 'zod';
import {
    getDocPageBySlug,
    createDocPage,
    updateDocPage
} from '$lib/services/documentationService';
import type { DocPageData } from '$lib/services/documentationService';

// Combined Zod schema for create/update validation
const docPageFormSchema = z.object({
  // Slug is only required for creation, validated separately
  slug: z.string().trim().min(1, "Slug cannot be empty.").max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug: use lowercase letters, numbers, and hyphens only.").optional(), // Optional for update
  title: z.string().trim().min(1, "Title cannot be empty.").max(200),
  category: z.string().trim().max(100).optional(),
  summary: z.string().trim().max(500).optional(),
  content_eng: z.string().optional(),
  content_sw: z.string().optional(),
});


// Load function: Fetch existing data for editing, or provide empty structure for creation
export const load: PageServerLoad = async (event) => {
    const { params, locals: { supabase, safeGetSession:getSession } } = event;
    const slug = params.slug; // Slug from the URL ([[/slug/]])
    const isEditing = !!slug; // Are we editing an existing page?

    const session = await getSession();
    if (!session) {
        // Require login for creating/editing
        throw redirect(303, `/auth/login?redirectTo=${event.url.pathname}`);
    }

    let docData: DocPageData | null = null;

    if (isEditing) {
        const { data, error } = await getDocPageBySlug(supabase, slug);
        if (error) {
            console.error(`Error loading doc page '${slug}' for edit:`, error);
             if (error.code === 'NOT_FOUND') {
                throw svelteKitError(404, { message: `Documentation page '${slug}' not found.` });
            }
            throw svelteKitError(500, { message: `Failed to load documentation: ${error.message}` });
        }
        docData = data;
        // TODO: Add permission check here - does the logged-in user have rights to edit this specific page based on RLS/creator/editor?
        // This requires fetching the docData including created_by/last_edited_by and comparing with session.user.id
        // If no permission: throw error(403, { message: 'You do not have permission to edit this page.' });
    }

    return {
        isEditing: isEditing,
        // Provide existing data for edit, or initial empty values for create
        docData: isEditing ? docData : {
            slug: '', title: '', category: '', summary: '', content_eng: '', content_sw: ''
        },
        session: session
    };
};

// Actions: Handle create or update submissions
export const actions: Actions = {
    saveDoc: async (event) => {
        const { request, params, locals: { supabase, safeGetSession:getSession } } = event;
        const slugParam = params.slug; // Slug from URL (only present for edits)
        const isEditing = !!slugParam;

        const session = await getSession();
        if (!session) {
            return fail(401, { error: 'You must be logged in.' });
        }

        const formData = await request.formData();
        const formDataObj = Object.fromEntries(formData);

        try {
             // Validate common fields
             const validatedBase = docPageFormSchema.parse(formDataObj);

             // If creating, validate slug specifically
             if (!isEditing) {
                 if (!validatedBase.slug || validatedBase.slug.length === 0) {
                     return fail(400, { ...formDataObj, errors: { slug: ['Slug is required for new pages.'] }});
                 }
                 // Optionally re-validate just the slug with the regex if needed
                 const slugValidation = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format.").safeParse(validatedBase.slug);
                 if(!slugValidation.success) {
                      return fail(400, { ...formDataObj, errors: { slug: slugValidation.error.flatten().formErrors }});
                 }
             }

            let resultSlug: string | undefined = slugParam; // Use slug from URL for update
            let serviceError: any = null;

            if (isEditing && slugParam) {
                // --- Update Existing Page ---
                const { data, error } = await updateDocPage(supabase, slugParam, {
                    // Pass only fields that can be updated
                    title: validatedBase.title,
                    category: validatedBase.category || null, // Handle empty string as null
                    summary: validatedBase.summary || null,
                    content_eng: validatedBase.content_eng || null,
                    content_sw: validatedBase.content_sw || null,
                });
                 serviceError = error;
                 // resultSlug = data?.slug; // Slug doesn't change on update
            } else if (!isEditing && validatedBase.slug) {
                 // --- Create New Page ---
                 const { data, error } = await createDocPage(supabase, {
                     slug: validatedBase.slug, // Use validated slug from form
                     title: validatedBase.title,
                     category: validatedBase.category || null,
                     summary: validatedBase.summary || null,
                     content_eng: validatedBase.content_eng || null,
                     content_sw: validatedBase.content_sw || null,
                 });
                 serviceError = error;
                 resultSlug = data?.slug; // Get the slug of the newly created page
            } else {
                 // Should not happen if validation is correct
                  return fail(400, { ...formDataObj, error: 'Invalid operation state.' });
            }

            // Handle results from service call
            if (serviceError) {
                 return fail(400, { ...formDataObj, error: serviceError.message, errorCode: serviceError.code });
            }

            // Success! Redirect to the view page
            if (resultSlug) {
                throw redirect(303, `/swalang/documentation/${resultSlug}`); // Redirect to the view page
            } else {
                 // Should have a slug on success, but handle defensively
                 console.error("Save successful but no slug returned.");
                  return fail(500, { ...formDataObj, error: 'Save successful but failed to redirect.' });
            }

        } catch (err) {
            if(err?.status == 303) {
                console.log(err?.location)
                throw redirect(303, err?.location);
            }
            if (err instanceof ZodError) {
                const errors = err.flatten().fieldErrors;
                return fail(400, { ...formDataObj, errors });
            }
            console.error("Unexpected error saving documentation:", err);
            return fail(500, { ...formDataObj, error: 'An unexpected server error occurred.' });
        }
    }
};